# -----------------------------------------------------------------------------
#
#  Cell Diagramming Language
#
#  Copyright (c) 2018  David Brooks
#
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
#
# -----------------------------------------------------------------------------

import csv
import json
import networkx as nx

# -----------------------------------------------------------------------------

NAMESPACES = {'celldl': 'http://www.cellml.org/celldl/1.0#'}

# -----------------------------------------------------------------------------

GROUP_CLASSES = {
    'BötC': 'botc-group',
    'Brainstem Respiratory Network': 'brainstem-group',
    'Lung': 'lung-group',
    'NTS': 'nts-group',
    'Nucleus Ambiguus': 'nucleus-ambiguus-group',
    'pre-BötC': 'pre-botc-group',
    'PRG': 'prg-group',
    'Raphé': 'raphe-group',
    'Spine': 'spine-group',
    'VRC': 'vrc-group',
    'VRG': 'vrg-group',
}

RESPIRATORY_GROUP_BY_NAME = {
    'Cough 2nd order (+)': 'NTS',
    'Deflation 2nd (−)': 'NTS',
    'E-Aug (+)': 'BötC',
    'E-Aug-BS (+)': 'VRG',
    'E-Aug-Cough (−)': 'BötC',
    'E-Aug-early': 'BötC',
    'E-Aug-late': 'BötC',
    'E-Dec-Phasic': 'BötC',
    'E-Dec-Tonic': 'BötC',
    'E-Dec-pre-ELM': 'BötC',
    'E-pons': 'PRG',
    'EI-pons': 'PRG',
    'ELM': 'Nucleus Ambiguus',
    'I-Aug': 'VRG',
    'I-Aug-BS': 'VRC',
    'I-Dec': 'pre-BötC',
    'I-Dec_2': 'pre-BötC',
    'I-Driver': 'pre-BötC',
    'I-pons': 'PRG',
    'ILM': 'Nucleus Ambiguus',
    'Lumbar': 'Spine',
    'Lumbar-HT': 'Spine',
    'Lung DIS_1s': 'Lung',
    'Lung Def_1s': 'Lung',
    'Lung PSRs': 'Lung',
    'NRM-BötC': 'BötC',
    'NRM-pons': 'PRG',
    'Phrenic': 'Spine',
    'Phrenic-HT': 'Spine',
    'Pump (+)': 'NTS',
    'Pump (-)': 'NTS',
    'Raphé 28': 'Raphé',
    'Raphé 29': 'Raphé',
    'Raphé 30': 'Raphé',
    'Raphé 31': 'Raphé',
    'Raphé 32': 'Raphé',
    'Raphé 8': 'Raphé',
    'VRC-IE': 'VRG',
    'caudal IE-pons': 'PRG',
    'rostral IE-pons': 'PRG',
    'pre-BötC': 'VRC',
    'BötC': 'VRC',
    'VRG': 'VRC',
    'VRC': 'Brainstem Respiratory Network',
    'Raphé': 'Brainstem Respiratory Network',
    'PRG': 'Brainstem Respiratory Network',
    'NTS': 'Brainstem Respiratory Network',
    'Nucleus Ambiguus': 'Brainstem Respiratory Network',
}

# -----------------------------------------------------------------------------

# Percentage range for automatically placing elements in a component

MIN_POS =  5
MAX_POS = 95

# -----------------------------------------------------------------------------

INDENT = 4

DEFAULT_SIZES = {
    'compartment': (25, 25),
    'neuron': (6, 4),
}

DEFAULT_STYLE_RULES = """
        cell-diagram {{
            width: 1000;
            height: 1000;
        }}
        .brainstem-group {{
            color: #ffd0d0;
            size: 95v, 80v;
            position: 50%, 40%;
        }}
        .compartment {{
            color: #d0d0ff;
            size: {}v, {}v;
            shape: rounded-rectangle;
            stroke: #c08080;
        }}
       .raphe-group {{
            color: #d0ffd0;
        }}
        .vrc-group {{
            color: #d0ffff;
        }}
        .vrg-group {{
            color: #80e0ff;
        }}
        .neuron {{
            color: red;
            size: {}v, {}v;
            shape: rounded-rectangle;
        }}
        .ex {{
            line-color: #8080FF;
        }}
        .inh {{
            line-color: #FF8080;
        }}
""".format(DEFAULT_SIZES['compartment'][0], DEFAULT_SIZES['compartment'][1],
           DEFAULT_SIZES['neuron'][0], DEFAULT_SIZES['neuron'][1])

# -----------------------------------------------------------------------------

class Component(object):
    def __init__(self, name, id, cls, group=None):
        self._name = name
        self._id = id
        self._classes = [cls] if cls is not None else []
        self.set_group(group)

    @property
    def name(self):
        return self._name

    @property
    def id(self):
        return self._id

    def set_group(self, group):
        self._group = group
        if group:
            group.add(self)
            if len(group._classes):
                self._classes.append(group._classes[0])

    def _attributes(self):
        attribs = ['id="{}"'.format(self.id),
                   'label="{}"'.format(self.name)]
        if len(self._classes):
            attribs.append('class="{}"'.format(' '.join(self._classes)))
        return ' '.join(attribs)

    def to_celldl(self, level):
        indent = INDENT*level*' '
        return '{}<component {}/>'.format(indent, self._attributes())

    def to_json(self):
        j = {'name': self._name,
             'id': self._id
            }
        if self._group:
            j['group'] = self._group.id
        return j

# -----------------------------------------------------------------------------

class Neuron(Component):
    def __init__(self, name, id, group=None):
        super().__init__(name, 'n{}'.format(id), 'neuron', group)

# -----------------------------------------------------------------------------

class Group(Component):
    def __init__(self, name, id, cls, group=None):
        super().__init__(name, 'g{}'.format(id), cls, group)
        self._components = []

    @property
    def components(self):
        return self._components

    def add(self, component):
        self._components.append(component)

    def to_celldl(self, level):
        indent = INDENT*level*' '
        self._classes.append('compartment')
        if len(self._components) == 0:
            return '{}<component {}/>'.format(indent, self._attributes())
        else:
            celldl = ['{}<component {}>'.format(indent, self._attributes())]
            for c in self._components:
                celldl.append(c.to_celldl(level+1))
            celldl.append('{}</component>'.format(indent))
            return '\n'.join(celldl)

# -----------------------------------------------------------------------------

class Groups(object):
    def __init__(self, groups_by_name):
        self._groups_by_name = groups_by_name
        self._groups = {}
        next_id = 1
        for n, g in groups_by_name.items():
            if g not in self._groups:
                group = Group(g, next_id, GROUP_CLASSES.get(g))
                self._groups[g] = group
                next_id += 1
        self._root = Group('Diagram', next_id, None)
        for g in self._groups.values():
            g.set_group(self.group(g.name))

    def group(self, name):
        return self._groups.get(self._groups_by_name.get(name), self._root)

    def root(self):
        return self._root
        '''
        flat_graph = nx.DiGraph()
        for g in self._groups.values():
            flat_graph.add_node(g)
        for g in self._groups.values():
            for c in g.components:
                flat_graph.add_edge(g, c)

        for g in nx.topological_sort(flat_graph):
            print(g.id, g.name)
        #return next(nx.topological_sort(flat_graph))
        '''

    def to_celldl(self, level):
        return '\n'.join([c.to_celldl(level) for c in self._root._components])

    def to_json(self):
        return [g.to_json() for g in self._groups.values()]

# -----------------------------------------------------------------------------

class Synapse(object):
    def __init__(self, source, target, type):
        self._source = source
        self._target = target
        self._type = type

    def to_celldl(self, level=0):
        indent = INDENT*level*' '
        cls = ' class="{}"'.format(self._type.split('_')[0]) if self._type else ''
        return '{}<connection from="{}" to="{}"{}/>'.format(indent, self._source, self._target, cls)

    def to_json(self):
        return {'source': self._source,
                'target': self._target,
                'type': self._type
               }

# -----------------------------------------------------------------------------

class NeuralNetwork(object):
    def __init__(self, csv_dict_reader):
        self._neurons = {}
        self._next_neuron_id = 1
        self._synapses = []
        self._groups = Groups(RESPIRATORY_GROUP_BY_NAME)
        for row in csv_dict_reader:
            source = self.add_neuron(row['Source population'])
            target = self.add_neuron(row['Target population'])
            self._synapses.append(Synapse(source.id, target.id, row['Synaptic type']))

    def add_neuron(self, name):
        # A 'minus' sign is encoded in many different ways...
        name = name.replace(u'\u2212', '-').replace(u'\u2013', '-')
        # Clean up duplicate names for same neuron
        if name == 'E-Dec-T':
            name = 'E-Dec-Tonic'
        if name not in self._neurons:
            neuron = Neuron(name, self._next_neuron_id, self._groups.group(name))
            self._neurons[name] = neuron
            self._next_neuron_id += 1
        else:
            neuron = self._neurons[name]
        return neuron

    def neurons(self):
        return '\n'.join(sorted(self._neurons.keys()))

    def to_celldl(self):
        celldl = ['<cell-diagram>']
        celldl.append('{}<flat-map>'.format(INDENT*' '))
        celldl.append(self._groups.to_celldl(2))
        for s in self._synapses:
            celldl.append(s.to_celldl(2))
        celldl.append('{}</flat-map>'.format(INDENT*' '))
        celldl.append('{}<style>'.format(INDENT*' '))
        celldl.append(self.style(2))
        celldl.append('{}</style>'.format(INDENT*' '))
        celldl.append('</cell-diagram>')
        return '\n'.join(celldl)

    def style(self, level):
        styling = [DEFAULT_STYLE_RULES]
##        styling.append(self._groups.root().style(level))
        return '\n'.join(styling)

    def to_json(self):
        nodes = []
        links = []
        groups = []
        for n in self._neurons.values():
            nodes.append(n.to_json())
        for s in self._synapses:
            links.append(s.to_json())
        return { 'nodes': nodes,
                 'links': links,
                 'groups': self._groups.to_json()
               }

# -----------------------------------------------------------------------------

if __name__ == '__main__':

    import sys

    if len(sys.argv) < 3:
        sys.exit('Usage: {} CSV_FILE [celldl | json]'.format(sys.argv[0]))

    with open(sys.argv[1]) as f:
        reader = csv.DictReader(f, delimiter=',')
        network = NeuralNetwork(reader)

    if sys.argv[2] in ['json', 'JSON']:
        print(json.dumps(network.to_json(), sort_keys=True,
                         indent=INDENT, separators=(',', ': ')))
    elif sys.argv[2] in ['celldl', 'CELLDL']:
        print(network.to_celldl())
    elif sys.argv[2] == 'neurons':
        print(network.neurons())
    else:
        sys.exit("Unknown output format")

# -----------------------------------------------------------------------------
