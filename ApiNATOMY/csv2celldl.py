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

# -----------------------------------------------------------------------------

NAMESPACES = {'celldl': 'http://www.cellml.org/celldl/1.0#'}

# -----------------------------------------------------------------------------

# Percentage range for automatically placing elements in a component

MIN_POS =  5
MAX_POS = 95

# -----------------------------------------------------------------------------

INDENT = 4

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

class Component(object):
    def __init__(self, name, id, group_id=None):
        self._name = name
        self._id = id
        self._group_id = group_id

    @property
    def name(self):
        return self._name

    @property
    def id(self):
        return self._id

    def set_group_id(self, group_id):
        self._group_id = group_id

    def to_json(self):
        j = {'name': self._name,
             'id': self._id
            }
        if self._group_id:
            j['group'] = self._group_id
        return j

# -----------------------------------------------------------------------------

class Neurone(Component):
    pass

# -----------------------------------------------------------------------------

class Group(Component):
    pass

# -----------------------------------------------------------------------------

class Groups(object):
    def __init__(self, groups_by_name):
        self._groups_by_name = groups_by_name
        self._groups = {}
        next_id = 1
        for n, g in groups_by_name.items():
            if g not in self._groups:
                group = Group(g, next_id)
                self._groups[g] = group
                next_id += 1
        for g in self._groups.values():
            g.set_group_id(self.group_id(g.name))

    def group_id(self, name):
        group = self._groups.get(self._groups_by_name.get(name))
        return group.id if group else None

    def to_json(self):
        return [g.to_json() for g in self._groups.values()]

# -----------------------------------------------------------------------------

class Synapse(object):
    def __init__(self, source, target, type):
        self._source = source
        self._target = target
        self._type = type

    def to_json(self):
        return {'source': self._source,
                'target': self._target,
                'type': self._type
               }

# -----------------------------------------------------------------------------

class NeuralNetwork(object):
    def __init__(self, csv_dict_reader):
        self._neurones = {}
        self._next_neurone_id = 1
        self._synapses = []
        self._groups = Groups(RESPIRATORY_GROUP_BY_NAME)
        for row in csv_dict_reader:
            source = self.add_neurone(row['Source population'])
            target = self.add_neurone(row['Target population'])
            self._synapses.append(Synapse(source.id, target.id, row['Synaptic type']))

    def add_neurone(self, name):
        # A 'minus' sign is encoded in many different ways...
        name = name.replace(u'\u2212', '-').replace(u'\u2013', '-')
        # Clean up duplicate names for same neurone
        if name == 'E-Dec-T':
            name = 'E-Dec-Tonic'
        if name not in self._neurones:
            neurone = Neurone(name, self._next_neurone_id, self._groups.group_id(name))
            self._neurones[name] = neurone
            self._next_neurone_id += 1
        else:
            neurone = self._neurones[name]
        return neurone

    def to_celldl(self):
        celldl = ['<cell-diagram>']

        celldl.append('{}<flat-map>'.format(INDENT*' '))
        for g in self._root_glyphs:
            celldl.append(g.to_celldl(2))
        for a in self._arcs:
            celldl.append(a.to_celldl(2))
        celldl.append('{}</flat-map>'.format(INDENT*' '))

        celldl.append('{}<style>'.format(INDENT*' '))
        celldl.append(self.style(2))
        celldl.append('{}</style>'.format(INDENT*' '))

        celldl.append('</cell-diagram>')
        return '\n'.join(celldl)

    def neurones(self):
        return '\n'.join(sorted(self._neurones.keys()))

    def to_json(self):
        nodes = []
        links = []
        groups = []
        for n in self._neurones.values():
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
    elif sys.argv[2] == 'neurones':
        print(network.neurones())
    else:
        sys.exit("Unknown output format")

# -----------------------------------------------------------------------------
