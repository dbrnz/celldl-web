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
import * as svgElements from './svgElements.js';
import {Element, PositionedElement} from './element.js';

//==============================================================================

class Container extends PositionedElement {
    constructor(container, attributes, style, className="Container") {
        super(container, attributes, style, className);
        this.unitConverter = null;
        this.width = null;
        this.height = null;
    }

    get pixelSize() {
        return [this.width, this.height];
    }

    get geometry() {
        if (this.geometry === null && this.position.hasCoords) {
            this.geometry = geo.box(this.coords[0], this.coords[1],
                                    this.coords[0] + this._width, this.coords[1] + this._height);
        }
        return this.geometry;
    }

    setPixelSize(pixelSize) {
        [this.width, this.height] = pixelSize;
    }

    setUnitConverter(unitConverter) {
        this.UnitConverter = unitConverter;
    }

    svg() {
        let svg = ['<g${this.idClass()}${this.display()}>'];
        if (this.position.hasCoords) {
            svg.push('<g transform="translate(${this.position.coords.x}, ${this.position.coords.y})">');
            const elementClass = this.get_style_as_string("svg-element");
            if (elementClass in svgElements) {
                const id = this.id ? this.id.substring(1) : "";
                const element = svgElements[elementClass](id, this.width, this.height);
                svg.push(element.svg());
            } else {
                if (!(this instanceof Diagram)) {
                    svg.push('<path fill="#eeeeee" stroke="#222222" stroke-width="2.0" opacity="0.6" d="M0,0 L${this.width},0 L${this.width},${this.height} L0,${this.height} z"/>');
                }
            }
            svg.push("</g>");
        }
        svg.push("</g>");
        return svg;
    }
}

//==============================================================================

export class Compartment extends Container {
    constructor(container, attributes, style) {
        super(container, attributes, style, "Compartment");
        this.size = ('size' in this.style) ? new layout.Size(this.style.size) : null;
    }

    get pixelSize() {
        return [this.width, this.height];
    }

    setPixelSize(pixelSize) {
        [this.width, this.height] = pixelSize;
    }

    parse_geometry() {
        /*
        * Compartment size/position: absolute or % of container -- `(100, 300)` or `(10%, 30%)`
        */
        var lengths;
        lengths = null;
        for (var token, _pj_c = 0, _pj_a = this.position_tokens, _pj_b = _pj_a.length; (_pj_c < _pj_b); _pj_c += 1) {
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
        super.parseGeometry(this.diagram.quantityOffset, this.potential);
    }

    svg() {
        let svg = ['<g${this.idClass()}${this.display()}>'];
        if (this.position.hasCoords) {
            const [x, y] = this.coords;
            const [w, h] = [layout.QUANTITY_WIDTH, layout.QUANTITY_HEIGHT];
            svg.push('  <rect rx="${0.375 * w}" ry="${0.375 * h}" x="${x - w/2}" y="${y - h/2}" width="${w}" height="${h}" stroke="none" fill="${this.colour}"/>');
            svg.push(this.labelAsSvg());
        }
        svg.push('</g>');
        return svg;
    }
}

//==============================================================================

export class Transporter extends PositionedElement {
    constructor(container, attributes, style) {
        super(container, attributes, style, "Transporter");
        this.compartmentSide = null;
        this.flow = null;
        this.width = {value: 10, unit: 'x'};
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
                throw new SyntaxError('Invalid transporter position');
            } else {
                throw e;
            }
        }
        this._position.add_relationship(offset, this._compartment_side, dependencies);
        this._position.add_dependencies(dependencies);
    }

    svg() {
        var element, element_class, id, radius, svg;
        let svg = [];
        const elementClass = this.getStyleAsString("svg-element");
        if (elementClass in svgElements) {
            svg.push('<g${this.idClass()}${this.display()}>');
            const id = this.id ? this.id.substring(1) : "";
            const element = svgElements[elementClass](id, this.coords,
                (layout.HORIZONTAL_BOUNDARIES.indexOf(this.compartmentSide) >= 0) ? 0 : 90);
            svg.push(element.svg());
            svg.push('</g>');
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
            return parser.getLength(this.style[name]);
        }
        return defaultValue;
    }

    numberFromStyle(name, defaultValue) {
        if (name in this.style) {
            return parser.getNumber(this.style[name]);
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
        return (e !== null && e instanceof cls) ? e : null;
    }

    layout() {
        /*
        Set positions (and sizes) of all components in the diagram.

        We position and size all compartments before positioning
        other elements.
        */

        this.position.setCoords(new layout.Point());

        let g = new nx.DiGraph();

        for (let e of this.elements) {
            e.parseGeometry();
            if (e.position.bool()) {
                g.addNode(e);
            }
        }

        for (let e of list(g)) {
            for (let d of e.position.dependencies) {
                let dependency = d;
                if (d instanceof String) {
                    dependency = this.findElement(d);
                    if (dependency === null) {
                        throw new KeyError("Unknown element: ${d}");
                    }
                }
                g.addEdge(dependency, e);
            }
        }

        this.setUnitConverter(new layout.UnitConverter(this.pixelSize, this.pixelSize));
        for (let e of nx.topological_sort(g)) {
            if (e !== this && !e.positionResolved) {
                e.resolvePosition();
                if (e instanceof Compartment) {
                    e.setPixelSize(e.container.unitConverter.pixelPair(e.size.lengths, false));
                    e.setUnitConverter(new layout.UnitConverter(this.pixelSize, e.pixelSize, e.position.coords));
                }
            }
        }
        this.bondGraph.setOffsets();
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
        let svg = ['<?xml version=\"1.0\" encoding=\"UTF-8\"?>'];
        svg.push('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}">');
        for (let c of this.compartments) {
            svg.extend(c.svg());
        }
        svg.extend(this.bond_graph.svg());
        for (let q of this.quantities) {
            svg.extend(q.svg());
        }
        for (let t of this.transporters) {
            svg.extend(t.svg());
        }
        svg.push('<defs>');
        svg.extend(svg_elements.DefinesStore.defines());
        svg.push('</defs>');
        svg.push('</svg>');
        return '\n'.join(svg);
    }
}

//==============================================================================
