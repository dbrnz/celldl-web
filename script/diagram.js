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

//==============================================================================

import './jsnetworkx.js';

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
        if (this.cachedGeometry === null && this.positionResolved) {
            const [posX, posY] = this.pixelCoords;
            this.cachedGeometry = geo.box(posX, posY, posX + this.width, posY + this.height);
        }
        return this.cachedGeometry;
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

    parsePosition() {
        /*
        * Compartment size/position: absolute or % of container -- `(100, 300)` or `(10%, 30%)`
        */
        const lengths = parser.getLengthPair(this.positionTokens);
        this.position.setLengths(lengths);
        this.position.addDependency(this.container);
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

    parsePosition() {
        super.parsePosition(this.diagram.quantityOffset, this.potential);
    }

    svg() {
        let svg = ['<g${this.idClass()}${this.display()}>'];
        if (this.position.hasCoords) {
            const [x, y] = this.PixelCoords;
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
    constructor(compartment, attributes, style) {
        super(compartment, attributes, style, "Transporter");
        this.compartmentSide = null;
        this.flow = null;
        this.width = layout.TRANSPORTER_WIDTH;
    }

    parsePosition() {
        /*
        * Transporter position: side of container along with offset from
        top-right as % of container -- `10% left, `20% top`
        <side> [<offset>]
        * Transporter position: side of container along with offset from
        another transporter of the compartment which is on the same side
        and with the same orientation, as % of the container
        -- `10% below #t1`
        <offset> <dirn> [<trans_id>] ## trans_id must be on compartment with its side compatible eith <dirn>
                                     ## no <trans_id> means wrt preceeding transporter in document order??

        <dirn> <element_id_list>  ## dirn 'left', 'right', 'above', below'
        */
        let dependencies = [this.container];
// TODO: first check we actually have positionTokens
        if (this.positionTokens.type === 'SEQUENCE') {
            const tokens = this.positionTokens.value;
            let n = 0;
            for (let token of tokens) {
                switch (n) {
                    case 0:
                }
                if (token.type !== "ID" || layout.COMPARTMENT_BOUNDARIES.indexOf(token.value.toLowerCase()) < 0) {
                    throw new SyntaxError("Invalid compartment boundary.");
                }
                this.compartmentSide = token.value.toLowerCase();
                n += 1;
            }
        }

        let offset = 0;  // TODO
/*
             "type": "SEQUENCE",
              "value": [
                {
                  "type": "ID",
                  "value": "left"
                },
                {
                  "type": "PERCENTAGE",
                  "value": 10,
                  "unit": "%"
                },
                {
                  "type": "ID",
                  "value": "below"
                },
                {
                  "type": "HASH",
                  "value": "#t1"
                }
              ]
            }
*/

/* TODO
        try {

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
*/

        this.position.addRelationship(offset, this.compartmentSide, dependencies);
        this.position.addDependencies(dependencies);
    }


    positionResolved()

    resolvePosition() {


        const unitConverter = this.container.unitConverter;

# this = self.position
        if (this.lengths) {
            this.coords = unitConverter.pixelPair(this.lengths);

        } else {
            if (((this.coords === null) && this.relationships)) {

                this.coords = [0, 0];

                if ((this.relationships.length === 1)) {
                    const offset = this.relationships[0][0];
                    const reln = this.relationships[0][1];
                    const dependencies = this.relationships[0][2];




                        if (["bottom", "right"].indexOf(reln) >= 0) {
                            const dirn = (["top", "bottom"].indexOf(reln) >= 0) ? "below" : "right";
                            [coords, orientation] = this.resolvePoint(unitConverter, [100, "%"], dirn, [this._element.container]);
                            this.coords[orientation] = coords[orientation];
                        }
                        const dirn = (["top", "bottom"].indexOf(reln) >= 0) ? "right" : "below";
                        [coords, orientation] = this.resolvePoint(unitConverter, offset, dirn, [this.element.container]);
                        if (["bottom", "right"].indexOf(reln) >= 0) {
                            this.coords[orientation] = coords[orientation];
                        } else {
                            this.coords = coords;
                        }
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

    layoutElements() {
        /*
        Set positions (and sizes) of all components in the diagram.

        We position and size all compartments before positioning
        other elements.
        */

        this.position.setCoords(new layout.Point());

        let g = new jsnx.DiGraph();

        for (let e of this.elements) {
            e.parsePosition();
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
        for (let e of jsnx.topologicalSort(g)) {
            if (e !== this && !e.positionResolved) {
                e.resolvePosition();
                if (e instanceof Compartment) {
                    e.setPixelSize(e.container.unitConverter.pixelPair(e.size.lengths, false));
                    e.setUnitConverter(new layout.UnitConverter(this.pixelSize, e.pixelSize, e.position.pixels));
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
        return svg.join('\n');
    }
}

//==============================================================================
