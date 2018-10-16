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

import json
from lxml import etree

# -----------------------------------------------------------------------------

NAMESPACES = {'celldl': 'http://www.cellml.org/celldl/1.0#',
              'sbgn': 'http://sbgn.org/libsbgn/0.2'}

# -----------------------------------------------------------------------------

# Percentage range for automatically placing elements in a component

MIN_POS =  5
MAX_POS = 95

# -----------------------------------------------------------------------------

INDENT = 4

# -----------------------------------------------------------------------------

DEFAULT_SIZES = {
    'compartment': (25, 25),
    'macromolecule': (6, 4),
    'process': (1, 1),
}

DEFAULT_STYLE_RULES = """
        cell-diagram {{
            width: 1000;
            height: 1000;
        }}
        .outermost {{
            color: #ffd0d0;
            size: 95v, 95v;
            position: 50%, 50%;
            text-position: 50%, 97%;
        }}
        .compartment {{
            color: #d0d0ff;
            size: {}v, {}v;
            text-position: 50%, 90%;
            shape: rounded-rectangle;
        }}
        .macromolecule {{
            color: red;
            size: {}v, {}v;
            shape: rounded-rectangle;
        }}
        .process {{
            color: green;
            size: {}v, {}v;
        }}
        .consumption {{
            line-color: #8080FF;
        }}
        .production {{
            line-color: #FF8080;
        }}
""".format(DEFAULT_SIZES['compartment'][0], DEFAULT_SIZES['compartment'][1],
           DEFAULT_SIZES['macromolecule'][0], DEFAULT_SIZES['macromolecule'][1],
           DEFAULT_SIZES['process'][0], DEFAULT_SIZES['process'][1])

# -----------------------------------------------------------------------------

def clean_id(id):
    return 'ID_{}'.format(id) if id is not None else None

# -----------------------------------------------------------------------------

class Scaler(object):
    def __init__(self):
        self._xmin = 100
        self._xmax =   0
        self._ymin = 100
        self._ymax =   0

    def add(self, position):
        if position[0] < self._xmin: self._xmin = position[0]
        if position[0] > self._xmax: self._xmax = position[0]
        if position[1] < self._ymin: self._ymin = position[1]
        if position[1] > self._ymax: self._ymax = position[1]

    def scale(self, position):
        return (MIN_POS + (MAX_POS-MIN_POS)*(position[0] - self._xmin)/(self._xmax - self._xmin),
                MIN_POS + (MAX_POS-MIN_POS)*(position[1] - self._ymin)/(self._ymax - self._ymin))

# -----------------------------------------------------------------------------

class Group(object):
    def __init__(self, index):
        self.leaves = []
        self.groups = []
        self.index = index

# -----------------------------------------------------------------------------

class Arc(object):
    def __init__(self, id, cls, source, target):
        self._id = clean_id(id)
        self._class = cls
        self._source = clean_id(source).rsplit('.')[0]  ## Port number...
        self._target = clean_id(target).rsplit('.')[0]

    @property
    def source(self):
        return self._source

    @property
    def target(self):
        return self._target

    def to_celldl(self, level=0):
        indent = INDENT*level*' '
        cls = ' class="{}"'.format(self._class) if self._class else ''
        return '{}<connection from="{}" to="{}"{}/>'.format(indent, self._source, self._target, cls)

# -----------------------------------------------------------------------------

class BBox(object):
    def __init__(self, x, y, width, height):
        self._x = x/100.0                     # to %, 10000 is full width
        self._y = (10000 + y)/100.0
        self._width = width/10.0
        self._height = height/10.0            # to %, 1000 is full width

    @property
    def size(self):
        return (self._width, self._height)

    @property
    def position(self):
        return (self._x, self._y)

# -----------------------------------------------------------------------------

class Glyph(object):
    def __init__(self, id, cls, label, bbox, compartment):
        self._id = id         # Already cleaned...
        self._class = cls
        self._label = label
        self._bbox = bbox
        self._position = None
        self._compartment = clean_id(compartment)
        self._parent = None
        self._children = []
        self._index = None

    @property
    def id(self):
        return self._id

    @property
    def label(self):
        return self._label

    @property
    def index(self):
        return self._index

    @property
    def children(self):
        return self._children

    @property
    def parent(self):
        return self._parent

    @property
    def compartment(self):
        return self._compartment

    @property
    def bbox(self):
        return self._bbox

    @property
    def position(self):
        return self._position if self._position is not None else self._bbox.position

    @property
    def size(self):
        return DEFAULT_SIZES.get(self._class, self._bbox.size)

    def set_index(self, index):
        self._index = index

    def set_position(self, position):
        self._position = position

    def set_parent(self, parent):
        self._parent = parent

    def add_child(self, child):
        self._children.append(child)

    def _attributes(self):
        attribs = ['id="{}"'.format(self._id)]
        if self._class is not None:
            if self._class == 'compartment' and self._parent is None:
                self._class = 'outermost'
            attribs.append('class="{}"'.format(self._class))
        if self._label != '':
            attribs.append('label="{}"'.format(self._label))
        else:
            attribs.append('label="_"')
        return ' '.join(attribs)

    def assign_child_positions(self):
        if len(self._children):
            scaler = Scaler()
            for c in self._children:
                c.assign_child_positions()
                scaler.add(c.bbox.position)
            for c in self._children:
                c.set_position(scaler.scale(c.bbox.position))

    def to_celldl(self, level=0):
        indent = INDENT*level*' '
        if len(self._children) == 0:
            return '{}<component {}/>'.format(indent, self._attributes())
        else:
            celldl = ['{}<component {}>'.format(indent, self._attributes())]
            for c in self._children:
                celldl.append(c.to_celldl(level+1))
            celldl.append('{}</component>'.format(indent))
            return '\n'.join(celldl)

    def style(self, level=0):
        if self._parent is None:
            return ''
        indent = INDENT*level*' '
        return '{}#{} {{ position: {:.2f}%, {:.2f}%; }}'.format(
               indent, self._id, *self.position)

# -----------------------------------------------------------------------------

class SBGN_ML(object):

    @staticmethod
    def NS(tag):
        return '{{{}}}{}'.format(NAMESPACES['sbgn'], tag)

    def __init__(self, text):
        self._xml = etree.fromstring(text)
        assert self._xml.tag == self.NS('sbgn'), 'Not a valid SBGN document'
        self._glyphs = {}
        self._root_glyphs = []
        for glyph in self._xml.findall('sbgn:map/sbgn:glyph', NAMESPACES):
            id = clean_id(glyph.get('id'))
            if id:
                label = glyph.find('sbgn:label', NAMESPACES)
                bbox = glyph.find('sbgn:bbox', NAMESPACES)

                #ports = glyph.findall('sgbn:port', NAMESPACES)
                #<port id="nwtN_b458504e-cb3e-4699-8689-c4c427fe48d2.1" />

                g = Glyph(id, glyph.get('class'),
                          label.get('text', '') if label is not None else '',
                          BBox(float(bbox.get('x')), float(bbox.get('y')),
                               float(bbox.get('w')), float(bbox.get('h'))) if bbox is not None else None,
                          glyph.get('compartmentRef', None))
                self._glyphs[id] = g
                if g.compartment is None:
                    self._root_glyphs.append(g)
        for g in self._glyphs.values():
            if g.compartment:
                parent = self._glyphs[g.compartment]
                g.set_parent(parent)
                parent.add_child(g)
        for g in self._root_glyphs:
            g.assign_child_positions()
        self._arcs = []
        for arc in self._xml.findall('sbgn:map/sbgn:arc', NAMESPACES):
            label = glyph.find('sbgn:label', NAMESPACES)
            bbox = glyph.find('sbgn:bbox', NAMESPACES)
            self._arcs.append(Arc(arc.get('id'), arc.get('class'),
                                  arc.get('source'), arc.get('target')))

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

    def _json_build(self, glyph):
        if len(glyph.children) == 0:
            size = glyph.size
            self._json_nodes.append(dict(index=self._json_node_index,
                                         name=glyph.label,
                                         width=size[0],
                                         height=size[1],
                                         type=glyph._class))
            glyph.set_index(self._json_node_index)
            if glyph.parent is not None:
                self._json_groups[glyph.parent.id].leaves.append(glyph.index)
            self._json_node_index += 1
        else:
            if glyph.id not in self._json_groups:
                self._json_groups[glyph.id] = Group(self._json_group_count)
                self._json_group_count += 1
            if glyph.parent is not None:
                self._json_groups[glyph.parent.id].groups.append(glyph.id)
            for c in glyph.children:
                self._json_build(c)

    def to_json(self):
        self._json_nodes = []
        self._json_node_index = 0
        self._json_groups = {}
        self._json_group_count = 0
        for g in self._root_glyphs:
            self._json_build(g)

        groups = self._json_group_count*[None]
        for g in self._json_groups.values():
            groups[g.index] = dict(leaves = g.leaves,
                                   groups = [self._json_groups[id].index for id in g.groups])

        return { 'nodes': self._json_nodes,
                 'links': [dict(source=self._glyphs[a.source].index,
                                      target=self._glyphs[a.target].index,
                                      type=a._class) for a in self._arcs],
                 'groups': groups,
                 'constraints': [],
               }

    def style(self, level):
        styling = [DEFAULT_STYLE_RULES]
        for g in self._glyphs.values():
            styling.append(g.style(level))
        return '\n'.join(styling)

# -----------------------------------------------------------------------------

if __name__ == '__main__':

    import sys

    if len(sys.argv) < 3:
        sys.exit('Usage: {} SBGNML_FILE [celldl | json]'.format(sys.argv[0]))

    with open(sys.argv[1]) as f:
        sbgn = SBGN_ML(f.read())

    if sys.argv[2] in ['json', 'JSON']:
        j = sbgn.to_json()
        print(json.dumps(j, sort_keys=True,
                         indent=4, separators=(',', ': ')))
    elif sys.argv[2] in ['celldl', 'CELLDL']:
        print(sbgn.to_celldl())
    else:
        sys.exit("Unknown output format")

# -----------------------------------------------------------------------------
