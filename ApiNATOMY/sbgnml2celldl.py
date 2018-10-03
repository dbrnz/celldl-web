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

from lxml import etree

# -----------------------------------------------------------------------------

NAMESPACES = {'celldl': 'http://www.cellml.org/celldl/1.0#',
              'sbgn': 'http://sbgn.org/libsbgn/0.2'}

# -----------------------------------------------------------------------------

INDENT = 4

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
            size: 90v, 90v;
            text-position: 50%, 97%;
        }}
        .compartment {{
            color: #d0d0ff;
            size: {}v, {}v;
            text-position: 50%, 90%;
        }}
        .macromolecule {{
            color: red;
            size: {}v, {}v;
        }}
        .process {{
            color: green;
            size: {}v, {}v;
        }}
""".format(DEFAULT_SIZES['compartment'][0], DEFAULT_SIZES['compartment'][1],
           DEFAULT_SIZES['macromolecule'][0], DEFAULT_SIZES['macromolecule'][1],
           DEFAULT_SIZES['process'][0], DEFAULT_SIZES['process'][1])

# -----------------------------------------------------------------------------

def clean(id):
    return 'ID_{}'.format(id) if id is not None else None

# -----------------------------------------------------------------------------

class Arc(object):
    def __init__(self, id, cls, source, target):
        self._id = clean(id)
        self._class = cls
        self._source = clean(source).rsplit('.')[0]  ## Port number...
        self._target = clean(target).rsplit('.')[0]

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
        self._compartment = clean(compartment)
        self._parent = None
        self._children = []

    @property
    def id(self):
        return self._id

    @property
    def compartment(self):
        return self._compartment

    @property
    def bbox(self):
        return self._bbox

    @property
    def size(self):
        return DEFAULT_SIZES.get(self._class, self._bbox.size)

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

    def relative_position(self):
        if self._parent is None:
            return self._bbox.position
        else:    # Calculate position as % of parent
            parent_pos = self._parent._bbox.position
            parent_size = self._parent.size
            pos = self._bbox.position
            rel_pos = (pos[0] - parent_pos[0],
                       pos[1] - parent_pos[1])
            return (100.0*rel_pos[0]/parent_size[0],
                    100.0*rel_pos[1]/parent_size[1])

    def style(self, level=0):
        if self._bbox is None:
            return ''
        indent = INDENT*level*' '
        return '{}#{} {{ position: {:.2f}%, {:.2f}%; }}'.format(
               indent, self._id, *self.relative_position())

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
            id = clean(glyph.get('id'))
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
        print '\n'.join(celldl)


    def style(self, level):
        styling = [DEFAULT_STYLE_RULES]
        for g in self._glyphs.values():
            styling.append(g.style(level))
        return '\n'.join(styling)

# -----------------------------------------------------------------------------

if __name__ == '__main__':

    with open('newt-complex-2.sbgnml') as f:
        sbgn = SBGN_ML(f.read())

    sbgn.to_celldl()

# -----------------------------------------------------------------------------
