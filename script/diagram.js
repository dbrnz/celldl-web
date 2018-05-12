/******************************************************************************

Cell Diagramming Language

Copyright (c) 2018  David Brooks

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

******************************************************************************/

'use strict';

/*
import {OrderedDict} from 'collections';
import * as geo from 'shapely/geometry';
import * as nx from 'networkx';
*/

//==============================================================================

import * as layout from './layout.js';
import * as parser from './parser.js';
import * as svg_elements from './svg_elements.js';
import {Element, PositionedElement} from './element.js';

//==============================================================================

var _pj;
function _pj_snippets(container) {
    function in_es6(left, right) {
        if (((right instanceof Array) || ((typeof right) === "string"))) {
            return (right.indexOf(left) > (- 1));
        } else {
            if (((right instanceof Map) || (right instanceof Set) || (right instanceof WeakMap) || (right instanceof WeakSet))) {
                return right.has(left);
            } else {
                return (left in right);
            }
        }
    }
    container["in_es6"] = in_es6;
    return container;
}
_pj = {};
_pj_snippets(_pj);

//==============================================================================

class Container extends PositionedElement {
    constructor(container, attributes, style, className="Container") {
        super(container, attributes, style, className);
        this.unitConverter = null;
    }

    get pixelSize() {
        return [this._width, this._height];
    }

    get geometry() {
        if (((this._geometry === null) && this.position.has_coords)) {
            this._geometry = geo.box(this.coords[0], this.coords[1], (this.coords[0] + this._width), (this.coords[1] + this._height));
        }
        return this._geometry;
    }

    set_pixel_size(pixel_size) {
        [this._width, this._height] = pixel_size;
    }

    set_unit_converter(unit_converter) {
        this._unit_converter = unit_converter;
    }

    svg() {
        var element, element_class, id, svg;
        svg = ["<g{}{}>".format(this.id_class(), this.display())];
        if (this.position.has_coords) {
            svg.append("<g transform=\"translate({:g}, {:g})\">".format(...this.position.coords));
            element_class = this.get_style_as_string("svg-element");
            if (_pj.in_es6(element_class, dir(svg_elements))) {
                id = (this._id ? this._id.slice(1) : "");
                element = svg_elements.__dict__.get(element_class)(id, this._width, this._height);
                svg.append(element.svg());
            } else {
                if ((! (this instanceof Diagram))) {
                    svg.append("<path fill=\"#eeeeee\" stroke=\"#222222\" stroke-width=\"2.0\" opacity=\"0.6\" d=\"M0,0 L{right:g},0 L{right:g},{bottom:g} L0,{bottom:g} z\"/>".format({"right": this._width, "bottom": this._height}));
                }
            }
            svg.append("</g>");
        }
        svg.append("</g>");
        return svg;
    }
}

//==============================================================================

export class Compartment extends Container {
    constructor(container, attributes, style) {
        super(container, attributes, style, "Compartment");
        this.size = ('size' in this.style) ? new layout.Size(this.style.size) : null;
    }

    parse_geometry() {
        /*
        * Compartment size/position: absolute or % of container -- `(100, 300)` or `(10%, 30%)`
        */
        var lengths;
        lengths = null;
        for (var token, _pj_c = 0, _pj_a = this._position_tokens, _pj_b = _pj_a.length; (_pj_c < _pj_b); _pj_c += 1) {
            token = _pj_a[_pj_c];
            if (((token.type === "() block") && (lengths === null))) {
                lengths = parser.getCoordinates(new parser.StyleTokensIterator(token.content));
            } else {
                if ((lengths !== null)) {
                    throw new SyntaxError("Position already defined.");
                }
            }
        }
        this._position.set_lengths(lengths);
        this._position.add_dependency(this.container);
    }

    svg() {
        return super.svg();
    }
}

//==============================================================================

export class Quantity extends PositionedElement {
    constructor(container, attributes, style) {
        super(container, attributes, style, "Quantity");
        this.potential = null;
    }

    setPotential(potential) {
        this.potential = potential;
    }

    parseGeometry() {
        // super() ??
        PositionedElement.parseGeometry(this, {"default_offset": this.diagram.quantity_offset, "default_dependency": this._potential});
    }

    svg() {
        var h, svg, w, x, y;
        svg = ["<g{}{}>".format(this.idClass(), this.display())];
        if (this.position.hasCoords) {
            [x, y] = this.coords;
            [w, h] = [layout.QUANTITY_WIDTH, layout.QUANTITY_HEIGHT];
            svg.append("  <rect rx=\"{}\" ry=\"{}\" x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\" stroke=\"none\" fill=\"{}\"/>".format((0.375 * w), (0.375 * h), (x - (w / 2)), (y - (h / 2)), w, h, this.colour));
            svg.append(this.label_as_svg());
        }
        svg.append("</g>");
        return svg;
    }
}

//==============================================================================

export class Transporter extends PositionedElement {
    constructor(container, attributes, style) {
        super(container, attributes, style, "Transporter");
        this.compartmentSide = null;
        this.flow = null;
        this.width = [10, "x"];
    }

    parseGeometry() {
        /*
        * Transporter position: side of container along with offset from
        top-right as % of container -- `left 10%`, `top 20%`
        * Transporter position: side of container along with offset from
        another transporter of the compartment which is on the same side
        and with the same orientation, as % of the container
        -- `left 10% below #t1`
        */
        var dependencies, offset, token, tokens;
        dependencies = [this.container];

        const tokens = this.positionTokens;
        if (tokens.done())
            return;

        try {
            let token = tokens.next();
            if (((token.type !== "ident") || (! _pj.in_es6(token.lower_value, layout.COMPARTMENT_BOUNDARIES)))) {
                throw new SyntaxError("Invalid compartment boundary.");
            }
            this._compartment_side = token.lower_value;
            offset = parser.getPercentage(tokens);
            token = tokens.peek();
            if ((token && (token.type === "hash"))) {
                while ((token.type === "hash")) {
                    try {
                        token = tokens.next();
                        dependencies.append(("#" + token.value));
                    } catch(e) {
                        if ((e instanceof StopIteration)) {
                            break;
                        } else {
                            throw e;
                        }
                    }
                }
            }
        } catch(e) {
            if ((e instanceof StopIteration)) {
                throw new SyntaxError("Invalid `transporter` position");
            } else {
                throw e;
            }
        }
        this._position.add_relationship(offset, this._compartment_side, dependencies);
        this._position.add_dependencies(dependencies);
    }

    svg() {
        var element, element_class, id, radius, svg;
        svg = [];
        element_class = this.get_style_as_string("svg-element");
        if (_pj.in_es6(element_class, dir(svg_elements))) {
            svg.append("<g{}{}>".format(this.id_class(), this.display()));
            id = (this._id ? this._id.slice(1) : "");
            element = svg_elements.__dict__.get(element_class)(id, this.coords, (_pj.in_es6(this.compartment_side, layout.HORIZONTAL_BOUNDARIES) ? 0 : 90));
            svg.append(element.svg());
            svg.append("</g>");
            radius = layout.ELEMENT_RADIUS;
        } else {
            radius = layout.TRANSPORTER_RADIUS;
        }
        svg.extend(super.svg(radius));
        return svg;
    }
}

//==============================================================================

export class Diagram extends Container {
    constructor(attributes, style) {
        super(null, attributes, style, "Diagram");
        this.elements = [];
        this.elementsById = {}
        this.elementsByName = {}
        this.compartments = [];
        this.quantities = [];
        this.transporters = [];
        this.layout = null;
        this.width = this.numberFromStyle("width", 0);
        this.height = this.numberFromStyle("height", 0);
        this.flowOffset = this.lengthFromStyle("flow-offset", layout.FLOW_OFFSET);
        this.quantity_offset = this.lengthFromStyle("quantity-offset", layout.QUANTITY_OFFSET);
        this.bondGraph = null;
    }

    lengthFromStyle(name, defaultValue) {
        if (name in this.style) {
            return parser.getLength(new parser.StyleTokensIterator(this.style[name]));
        }
        return defaultValue;
    }

    numberFromStyle(name, defaultValue) {
        if (name in this.style) {
            return parser.getNumber(new parser.StyleTokensIterator(this.style[name]));
        }
        return defaultValue;
    }

    setBondGraph(bondGraph) {
        this.bondGraph = bondGraph;
    }

    addCompartment(compartment) {
        this.addElement(compartment);
        this.compartments.push(compartment);
    }

    addQuantity(quantity) {
        this.addElement(quantity);
        this.quantities.push(quantity);
    }

    addTransporter(transporter) {
        this.addElement(transporter);
        this.transporters.push(transporter);
    }

    addElement(element) {
        this.elements.push(element);
        if (element.id !== null) {
            if (element.id in this.elementsById) {
                throw new KeyError("Duplicate 'id': ${element.id}");
            }
            this.elementsById[element.id] = element;
        }
        this.elementsByName[element.fullName] = element;
    }

    findElement(idOrName, cls=Element) {
        const e = (idOrName.startsWith("#")
                   && idOrName in this.elementsById) ? this.elementsById[idOrName]
                  : (idOrName in this.elementsByName ? this.elementsByName[idOrName]
                  : null);
        return ((e !== null) && (e instanceof cls)) ? e : null;
    }

    layout() {
        /*
        Set positions (and sizes) of all components in the diagram.

        We position and size all compartments before positioning
        other elements.
        */
        var dependency, g, id_or_name;
        this.position.setCoords(new layout.Point());
        g = new nx.DiGraph();
        for (var e, _pj_c = 0, _pj_a = this._elements, _pj_b = _pj_a.length; (_pj_c < _pj_b); _pj_c += 1) {
            e = _pj_a[_pj_c];
            e.parse_geometry();
            if (e.position) {
                g.add_node(e);
            }
        }
        for (var e, _pj_c = 0, _pj_a = list(g), _pj_b = _pj_a.length; (_pj_c < _pj_b); _pj_c += 1) {
            e = _pj_a[_pj_c];
            for (var dependency, _pj_f = 0, _pj_d = e.position.dependencies, _pj_e = _pj_d.length; (_pj_f < _pj_e); _pj_f += 1) {
                dependency = _pj_d[_pj_f];
                if ((((typeof dependency) === "string") || (dependency instanceof String))) {
                    id_or_name = dependency;
                    dependency = this.find_element(id_or_name);
                    if ((dependency === null)) {
                        throw new KeyError("Unknown element: {}".format(id_or_name));
                    }
                }
                g.add_edge(dependency, e);
            }
        }
        this.set_unit_converter(new layout.UnitConverter(this.pixel_size, this.pixel_size));
        for (var e, _pj_c = 0, _pj_a = nx.topological_sort(g), _pj_b = _pj_a.length; (_pj_c < _pj_b); _pj_c += 1) {
            e = _pj_a[_pj_c];
            if (((e !== this) && (! e.position_resolved))) {
                e.resolve_position();
                if ((e instanceof Compartment)) {
                    e.set_pixel_size(e.container.unit_converter.pixel_pair(e.size.lengths, false));
                    e.set_unit_converter(new layout.UnitConverter(this.pixel_size, e.pixel_size, e.position.coords));
                }
            }
        }
        this.bond_graph.set_offsets();
    }

    svg() {
        /*
        Drawing order:
        0. All <defs>  ==>  first allocate SVG Element classes
        1. All compartment boundaries
        2. All flow lines
        3. Everything else (transporters, quantities, potentials, flow components)
        Transporter SVG elements need to generate SVG from super class (Exchanger, Channel, etc)
        with <defs> only once for each superclass...
        */
        var svg;
        svg = ["<?xml version=\"1.0\" encoding=\"UTF-8\"?>"];
        svg.append("<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" version=\"1.1\" width=\"{width:g}\" height=\"{height:g}\" viewBox=\"0 0 {width:g} {height:g}\">".format({"width": this._width, "height": this._height}));
        for (var c, _pj_c = 0, _pj_a = this._compartments, _pj_b = _pj_a.length; (_pj_c < _pj_b); _pj_c += 1) {
            c = _pj_a[_pj_c];
            svg.extend(c.svg());
        }
        svg.extend(this.bond_graph.svg());
        for (var q, _pj_c = 0, _pj_a = this._quantities, _pj_b = _pj_a.length; (_pj_c < _pj_b); _pj_c += 1) {
            q = _pj_a[_pj_c];
            svg.extend(q.svg());
        }
        for (var t, _pj_c = 0, _pj_a = this._transporters, _pj_b = _pj_a.length; (_pj_c < _pj_b); _pj_c += 1) {
            t = _pj_a[_pj_c];
            svg.extend(t.svg());
        }
        svg.append("<defs>");
        svg.extend(svg_elements.DefinesStore.defines());
        svg.append("</defs>");
        svg.append("</svg>");
        return "\n".join(svg);
    }
}

//==============================================================================
