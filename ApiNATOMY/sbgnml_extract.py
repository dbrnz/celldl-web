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
import logging
from lxml import etree
import os
import pathlib

# -----------------------------------------------------------------------------

NAMESPACES = { 'bqbiol': 'http://biomodels.net/biology-qualifiers/',
               'bqmodel': 'http://biomodels.net/model-qualifiers/',
               'celldl': 'http://www.cellml.org/celldl/1.0#',
               'obo': 'http://purl.obolibrary.org/obo/',
               'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
               'sbgn': 'http://sbgn.org/libsbgn/0.2',
               'sio': 'http://semanticscience.org/resource/',
              }

# -----------------------------------------------------------------------------

# Percentage range for automatically placing elements in a component

MIN_POS =  5
MAX_POS = 95

# -----------------------------------------------------------------------------

INDENT = 4

# -----------------------------------------------------------------------------

DEFAULT_SIZES = {
    'DIAGRAM': (1000, 1000),
    'compartment': (25, 25),
    'macromolecule': (4, 2),
    'process': (1, 1),
}

DEFAULT_STYLE_RULES = """
        connection {{
            stroke-opacity: 0.7;
            stroke-width: 4px;
        }}
        .compartment {{
            color: #CCC;
            stroke: #111;
            stroke-width: 2px;
            size: {}v, {}v;
            text-position: 50%, 90%;
            shape: rounded-rectangle;
        }}
        .compartment > .compartment {{
            color: #DDD;
            stroke: #222;
        }}

        .compartment > .compartment > .compartment {{
            color: #EEE;
            stroke: #333;
        }}

        .outermost {{
            size: 95v, 95v;
            stroke: #c0c0c0;
        }}
        .macromolecule {{
            color: #c0c0FF;
            opacity: 0.7;
            size: {}v, {}v;
            shape: rounded-rectangle;
        }}
        .process {{
            color: green;
            size: {}v, {}v;
        }}
        .consumption, .inhibitory {{
            line-color: #8080FF;
        }}
        .production, .excitatory {{
            line-color: #FF8080;
        }}
        .warn {{
            color: #ffff00;
            size: 1.5v, 1.5v;
        }}
""".format(*DEFAULT_SIZES['compartment'],
           *DEFAULT_SIZES['macromolecule'],
           *DEFAULT_SIZES['process'])

# -----------------------------------------------------------------------------

TURTLE_PREFIXES = ['@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .',
                   '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .',
                   '@prefix bqbiol: <http://biomodels.net/biology-qualifiers/> .',
                   '@prefix bqmodel: <http://biomodels.net/model-qualifiers/> .',
                   '@prefix obo: <http://purl.obolibrary.org/obo/> .',
                   '@prefix cio: <http://purl.obolibrary.org/cio/> .',
                   '@prefix ro: <http://purl.obolibrary.org/obo/> .',
                   '@prefix fm: <http://example.org/flatmap-ontology/> .',
                  ]

# -----------------------------------------------------------------------------

TYPE_TO_CLASS = { 'http://identifiers.org/GO:0060076': 'excitatory',
                  'http://identifiers.org/GO:0060077': 'inhibitory',
                }

# -----------------------------------------------------------------------------

class Id(object):
    _ids = []

    @staticmethod
    def new(name, guid):
        if name:
            clean_name = (name.replace(' (+)', '_plus')
                              .replace('Pump-', 'Pump-minus')
                              .replace('Pump+', 'Pump-plus')
                              .replace(' ', '_')
                              )
            if clean_name[0].isalpha():
                id = clean_name
            else:
                id = 'ID_{}'.format(clean_name)
        elif guid is not None:
            id = 'ID_{}'.format(guid)
        else:
            id = 'ID'
        n = 1
        unique = id
        while unique in Id._ids:
            unique = '{}-{}'.format(id, n)
            n += 1
        Id._ids.append(unique)
        return unique

# -----------------------------------------------------------------------------

def annotations(description_xml, property):
    values = []
    properties = description_xml.find(property, NAMESPACES)
    if properties is not None:
        bag = properties.find('rdf:Bag', NAMESPACES)
        if bag is not None:
            for item in bag.findall('rdf:li', NAMESPACES):
                resource = item.get('{{{}}}resource'.format(NAMESPACES['rdf']))
                values.append(resource)
    return values


def celldl_class_attribute(_type):
    cls = TYPE_TO_CLASS.get(_type)
    return ' class="{}"'.format(cls) if cls is not None else ''

# -----------------------------------------------------------------------------

class Scaler(object):
    def __init__(self):
        self._xmin = None
        self._xmax = None
        self._ymin = None
        self._ymax = None

    def update(self, bbox):
        (bounds_x, bounds_y) = bbox.bounds
        if self._xmin is None or self._xmin > bounds_x[0]:
            self._xmin = bounds_x[0]
        if self._xmax is None or self._xmax < bounds_x[1]:
            self._xmax = bounds_x[1]
        if self._ymin is None or self._ymin > bounds_y[0]:
            self._ymin = bounds_y[0]
        if self._ymax is None or self._ymax < bounds_y[1]:
            self._ymax = bounds_y[1]

    def absolute_size(self):
        return ((self._xmax - self._xmin),
                (self._ymax - self._ymin))

    def scale_size(self, size):
        return (100*size[0]/(self._xmax - self._xmin),
                100*size[1]/(self._ymax - self._ymin))

    def scale_position(self, position):
        return (MIN_POS + (MAX_POS-MIN_POS)*(position[0] - self._xmin)/(self._xmax - self._xmin),
                MIN_POS + (MAX_POS-MIN_POS)*(position[1] - self._ymin)/(self._ymax - self._ymin))

# -----------------------------------------------------------------------------

class BBox(object):
    def __init__(self, x, y, width, height):
        if width < 0: width = -width
        if height < 0: height = -height
        self._x = x + width/2.0
        self._y = y + height/2.0
        self._width = width
        self._height = height

    @property
    def size(self):
        return (self._width, self._height)

    @property
    def position(self):
        return (self._x, self._y)

    @property
    def bounds(self):
        return ((self._x - self._width/2.0, self._x + self._width/2.0),
                (self._y - self._height/2.0, self._y + self._height/2.0))

# -----------------------------------------------------------------------------

class Group(object):
    def __init__(self, index):
        self.leaves = []
        self.groups = []
        self.index = index

# -----------------------------------------------------------------------------

class Arc(object):
    def __init__(self, guid, cls, source, target):
        self._guid = guid
        self._classes = [cls] if cls else []
        self._source = source.rsplit('.')[0]  ## Port number...
        self._target = target.rsplit('.')[0]

    @property
    def guid(self):
        return self._guid

    @property
    def primary_class(self):
        return self._classes[0]

    @property
    def source(self):
        return self._source

    @property
    def target(self):
        return self._target

    def to_celldl(self, level=0):
        indent = INDENT*level*' '
        cls = ' class="{}"'.format(' '.join(self._classes)) if self._classes else ''
        return '{}<connection from="{}" to="{}"{}/>'.format(indent, self._source, self._target, cls)

# -----------------------------------------------------------------------------

class Glyph(object):
    def __init__(self, guid, cls, label, bbox, compartment):
        self._guid = guid
        self._classes = [cls] if cls else []
        self._label = label
        self._id = Id.new(label, guid)
        self._bbox = bbox
        self._position = None
        self._size = None
        self._compartment = compartment
        self._parent = None
        self._children = []
        self._index = None
        self._sources = []
        self._targets = []
        self._derived_from = []
        self._type = None

    @property
    def id(self):
        return self._id

    @property
    def primary_class(self):
        return self._classes[0]

    @property
    def uri(self):
        return '<#{}>'.format(self._guid)

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
        return self._size if self._size is not None else self._bbox.size

    @property
    def sources(self):
        return self._sources

    @property
    def targets(self):
        return self._targets

    @property
    def type(self):
        return self._type

    def is_a(self, cls):
        primary_class = self.primary_class
        return (primary_class in cls) if isinstance(cls, list) else (primary_class == cls)

    def add_source(self, source):
        self._sources.append(source)

    def add_target(self, target):
        self._targets.append(target)

    def set_index(self, index):
        self._index = index

    def set_position(self, position):
        self._position = position

    def set_size(self, size):
        self._size = size

    def set_parent(self, parent):
        self._parent = parent

    def add_child(self, child):
        self._children.append(child)

    def add_warning(self, message):
        logging.warning(message)
        self._classes.append('warn')

    def get_annotations(self, glyph_xml):
        for annotation in glyph_xml.iter('{{{}}}annotation'.format(NAMESPACES['sbgn'])):
            for description in annotation.iter('{{{}}}Description'.format(NAMESPACES['rdf'])):
                guid = description.get('{{{}}}about'.format(NAMESPACES['rdf']))[1:]
                if guid != self._guid:
                    raise ValueError("Annotation is not about us ({})".format(self._guid))
                self._derived_from = annotations(description, 'bqmodel:isDerivedFrom')
                types = annotations(description, 'bqbiol:is')
                if types:
                    self._type = types[0]

    def _attributes(self):
        attribs = ['id="{}"'.format(self._id)]
        if self._classes:
            classes = self._classes.copy()
            if classes[0] == 'compartment' and self._parent is None:
                classes.append('outermost')
            attribs.append('class="{}"'.format(' '.join(classes)))
        if self._label != '':
            attribs.append('label="{}"'.format(self._label))
        else:
            attribs.append('label="_"')
        return ' '.join(attribs)

    def to_celldl(self, level=0, class_filter=None):
        indent = INDENT*level*' '
        if len(self._children) == 0:
            return '{}<component {}/>'.format(indent, self._attributes())
        else:
            celldl = ['{}<component {}>'.format(indent, self._attributes())]
            for c in self._children:
                if class_filter is None or c.primary_class in class_filter:
                    celldl.append(c.to_celldl(level+1, class_filter))
            celldl.append('{}</component>'.format(indent))
            return '\n'.join(celldl)

    def to_turtle(self):
        turtle = [self.uri]
        turtle.append('    a fm:Component;')
        if self._label:
            turtle.append('    rdfs:label "{}";'.format(self._label))
        if self._derived_from:
            derived_from = ['<{}>'.format(d) for d in self._derived_from]
            turtle.append('    bqmodel:isDerivedFrom\n        {};'.format(',\n        '.join(derived_from)))
        if self._children:
            # ro:RO_0001019
            turtle.append('    fm:contains\n        {};'.format(',\n        '.join([c.uri for c in self._children])))
        if self._targets:
            turtle.append('    fm:connected_to\n        {};'.format(',\n        '.join([t.uri for t in self._targets])))
        return '\n'.join(turtle)

    def style(self, level=0):
        indent = INDENT*level*' '
        indent1 = (INDENT+1)*level*' '
        style = ['{}#{} {{'.format(indent, self._id)]
        style.append('{} position: {:.2f}%, {:.2f}%;'.format(indent1, *self.position))
        if self.is_a('compartment'):
            style.append('{} size: {:.2f}%, {:.2f}%;'.format(indent1, *self.size))
        style.append('{}}}'.format(indent))
        return '\n'.join(style)

# -----------------------------------------------------------------------------

class Connection(object):
    def __init__(self, source, target, _type):
        self._source = source
        self._target = target
        self._type = _type

    def to_celldl(self, level=0):
        indent = INDENT*level*' '
        return '{}<connection from="{}" to="{}"{}/>'.format(indent,
            self._source.id, self._target.id, celldl_class_attribute(self._type))

# -----------------------------------------------------------------------------

class SBGN_ML(object):

    @staticmethod
    def NS(tag):
        return '{{{}}}{}'.format(NAMESPACES['sbgn'], tag)

    def __init__(self, text, source_uri=None):
        self._source_uri = source_uri
        self._xml = etree.fromstring(text)
        assert self._xml.tag == self.NS('sbgn'), 'Not a valid SBGN document'
        self._glyphs = {}
        self._root_glyphs = []
        for glyph in self._xml.findall('sbgn:map/sbgn:glyph', NAMESPACES):
            guid = glyph.get('id')
            if guid:
                label = glyph.find('sbgn:label', NAMESPACES)
                bbox = glyph.find('sbgn:bbox', NAMESPACES)

                #ports = glyph.findall('sgbn:port', NAMESPACES)
                #<port id="nwtN_b458504e-cb3e-4699-8689-c4c427fe48d2.1" />

                g = Glyph(guid, glyph.get('class'),
                          label.get('text', '') if label is not None else '',
                          BBox(float(bbox.get('x')), float(bbox.get('y')),
                               float(bbox.get('w')), float(bbox.get('h'))) if bbox is not None else None,
                          glyph.get('compartmentRef', None))
                self._glyphs[guid] = g
                if g.compartment is None:
                    self._root_glyphs.append(g)
                g.get_annotations(glyph)
        for g in self._glyphs.values():
            if g.compartment:
                parent = self._glyphs[g.compartment]
                g.set_parent(parent)
                parent.add_child(g)
        self._geometry = self.assign_geometry(self._root_glyphs)
        self._arcs = []
        for arc in self._xml.findall('sbgn:map/sbgn:arc', NAMESPACES):
            label = glyph.find('sbgn:label', NAMESPACES)
            bbox = glyph.find('sbgn:bbox', NAMESPACES)
            self._arcs.append(Arc(arc.get('id'), arc.get('class'),
                                  arc.get('source'), arc.get('target')))
            self._connections = []

    @staticmethod
    def assign_geometry(children):
        scaler = Scaler()
        for c in children:
            scaler.update(c.bbox)
        for c in children:
            c.set_position(scaler.scale_position(c.bbox.position))
            c.set_size(scaler.scale_size(c.bbox.size))
            SBGN_ML.assign_geometry(c.children)
        return scaler

    def glyphs_of_class(self, cls):
        return [g for g in self._glyphs.values() if g.is_a(cls)]

    @property
    def compartments(self):
        return self.glyphs_of_class('compartment')

    @property
    def macromolecules(self):
        return self.glyphs_of_class('macromolecule')

    @property
    def processes(self):
        return self.glyphs_of_class('process')

    def assign_links(self):
        for arc in self._arcs:
            source = self._glyphs.get(arc.source)
            target = self._glyphs.get(arc.target)
            if source and target:
                if source.is_a('process'):
                    if target.is_a(['compartment', 'macromolecule']):
                        source.add_target(target)
                    else:
                        logging.error("Process ({}) target ({}) has invalid class".format(source.id, target.id))
                elif source.is_a(['compartment', 'macromolecule']):
                    if target.is_a('process'):
                        target.add_source(source)
                    else:
                        logging.error("Process ({}) source ({}) has invalid class".format(target.id, source.id))
                else:
                    logging.error("Invalid class of arc source ({})".format(source.id))
            else:
                logging.error("Arc ({}) has invalid source ({}) or target ({})".format(arc.id, source.id, target.id))

        for process in self.processes:
            if len(process.sources) == 0 and len(process.targets) == 0:
                process.add_warning("Process ({}) is not connected".format(process.id))
            elif len(process.sources) == 0:
                if len(process.targets) == 2:
                    self._connections.append(Connection(process.targets[0], process.targets[1], process.type))
                    self._connections.append(Connection(process.targets[1], process.targets[0], process.type))
                else:
                    process.add_warning("Process ({}) has no sources and targets {}".format(process.id,
                                                                                           [t.id for t in process.targets]))
            elif len(process.targets) == 0:
                process.add_warning("Process ({}) has no targets".format(process.id))
            else:
                # All sources connect to all targets
                for source in process.sources:
                    for target in process.targets:
                        self._connections.append(Connection(source, target, process.type))

    def to_celldl(self, class_filter=None):
        celldl = ['<cell-diagram>']

        celldl.append('{}<flat-map>'.format(INDENT*' '))
        for g in self._root_glyphs:
            if class_filter is None or g.primary_class in class_filter:
                celldl.append(g.to_celldl(2, class_filter))
        for c in self._connections:
            celldl.append(c.to_celldl(2))
        '''
        for a in self._arcs:               # Only between macromolecules...
            celldl.append(a.to_celldl(2))
        '''

        celldl.append('{}</flat-map>'.format(INDENT*' '))

        celldl.append('{}<style>'.format(INDENT*' '))
        celldl.append(self.style(2))
        celldl.append('{}</style>'.format(INDENT*' '))

        celldl.append('</cell-diagram>')
        return '\n'.join(celldl)

    def _json_build(self, glyph, class_filter=None):
        if len(glyph.children) == 0:
            size = glyph.size
            self._json_nodes.append(dict(index=self._json_node_index,
                                         name=glyph.label,
                                         width=size[0],
                                         height=size[1],
                                         type=glyph.primary_class))
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
                if class_filter is None or c.primary_class in class_filter:
                    self._json_build(c, class_filter)

    def to_json(self, class_filter=None):
        self._json_nodes = []
        self._json_node_index = 0
        self._json_groups = {}
        self._json_group_count = 0
        for g in self._root_glyphs:
            if class_filter is None or g.primary_class in class_filter:
                self._json_build(g, class_filter)

        groups = self._json_group_count*[None]
        for g in self._json_groups.values():
            groups[g.index] = dict(leaves = g.leaves,
                                   groups = [self._json_groups[id].index for id in g.groups])

        return { 'nodes': self._json_nodes,
                 'links': [dict(source=self._glyphs[a.source].index,
                                      target=self._glyphs[a.target].index,
                                      type=a.primary_class) for a in self._arcs],
                 'groups': groups,
                 'constraints': [],
               }

    def to_turtle(self, class_filter=None):
        turtle = []
        if self._source_uri:
            turtle.append('@base <{}> .'.format(self._source_uri))
        turtle.extend(TURTLE_PREFIXES)
        turtle.append('')
        for g in self.compartments:
            turtle.append(g.to_turtle())
        for g in self.macromolecules:
            turtle.append(g.to_turtle())
        return '\n'.join(turtle)

    def style(self, level):
        styling = [ '''cell-diagram {{
    width: {};
    height: {};
}}'''.format(*self._geometry.absolute_size())]
        styling.append(DEFAULT_STYLE_RULES)
        for g in self._glyphs.values():
            styling.append(g.style(level))
        return '\n'.join(styling)

# -----------------------------------------------------------------------------

if __name__ == '__main__':
    import sys

    if len(sys.argv) < 3 or sys.argv[1] not in ['celldl', 'json', 'rdf']:
        sys.exit('Usage: {} [ celldl | json | rdf ] SBGNML_FILE'.format(sys.argv[0]))

    BOM = '\ufeff'  # Unicode file marker
    filename = sys.argv[2]
    with open(filename, encoding='utf-8') as f:
        text = f.read()
        if text.startswith(BOM):
            text = text[1:]
        sbgn = SBGN_ML(text.encode('utf-8'), pathlib.Path(os.path.abspath(filename)).as_uri())

    sbgn.assign_links()

    class_list = ['compartment', 'macromolecule'] # if --no-processes else None
    if   sys.argv[1] == 'celldl':
        print(sbgn.to_celldl(class_list))
    elif sys.argv[1] == 'json':
        j = sbgn.to_json(class_list)
        print(json.dumps(j, sort_keys=True,
                         indent=4, separators=(',', ': ')))
    elif sys.argv[1] == 'rdf':
        print(sbgn.to_turtle(class_list))

# -----------------------------------------------------------------------------
