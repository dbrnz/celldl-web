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

# -----------------------------------------------------------------------------

class Neurone(object):
    def __init__(self, name, id):
        self._name = name
        self._id = id

    @property
    def name(self):
        return self._name

    @property
    def id(self):
        return self._id

# -----------------------------------------------------------------------------

class Synapse(object):
    def __init__(self, source, target, type):
        self._source = source
        self._target = target
        self._type = type

    @property
    def source(self):
        return self._source

    @property
    def target(self):
        return self._target

    @property
    def type(self):
        return self._type

# -----------------------------------------------------------------------------

class NeuralNetwork(object):
    def __init__(self, csv_dict_reader):
        self._neurones = {}
        self._next_id = 1
        self._synapses = []
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
            neurone = Neurone(name, self._next_id)
            self._neurones[name] = neurone
            self._next_id += 1
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

    def to_json(self):
        nodes = []
        links = []
        for n in self._neurones.values():
            nodes.append(dict(name=n.name, id=n.id))
        for s in self._synapses:
            links.append(dict(source=s.source, target=s.target, type=s.type))

        return { 'nodes': nodes, 'links': links}

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
    else:
        sys.exit("Unknown output format")

# -----------------------------------------------------------------------------
