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

import * as config from '../config.js';
import * as exception from './exception.js';
import * as geo from './geometry.js';
import * as layout from './layout.js';

import {Connection} from './connections.js';
import {DiagramElement} from './elements.js';
import {SVG_NS} from './svgElements.js';

//==============================================================================

// UNUSED const LINE_OFFSET = 3.5;  // TODO: Initial/default value from CSS

//==============================================================================

export class BondGraph extends DiagramElement
{
    constructor(diagram, domElement)
    {
        super(diagram, domElement, false);
        this.diagram = diagram;
        this.id = `${this.diagram.id}_bondgraph`;
        this.container = diagram;
        this.size.setSize([new geo.Length(100, '%'), new geo.Length(100, '%')]);
        this.position.setOffset([new geo.Length(50, '%'), new geo.Length(50, '%')]);
        for (let element of domElement.children) {
            this.parseDomElement(element);
        }
    }

    parseDomElement(domElement)
    //=========================
    {
        const element = (domElement.nodeName === "flow") ?
                            new Flow(this.diagram, this, domElement)
                      : (domElement.nodeName === "gyrator") ?
                            new Gyrator(this.diagram, this, domElement)
                      : (domElement.nodeName === "potential") ?
                            new Potential(this.diagram, this, domElement)
                      : (domElement.nodeName === "quantity") ?
                            new Quantity(this.diagram, this, domElement)
                      : (domElement.nodeName === "reaction") ?
                            new Reaction(this.diagram, this, domElement)
                      : (domElement.nodeName === "transformer") ?
                            new Transformer(this.diagram, this, domElement)
                      : null;
        if (element === null) {
            throw new exception.SyntaxError(domElement, "Invalid element for <bond-graph>");
        }
        this.addElement(element);
        return element;
    }

    addElement(element)
    //=================
    {
        super.addElement(element);
        this.position.addDependent(element);
    }

    documentElement()
    //===============
    {
        return document.getElementById(`${this.diagram.id}_bondgraph`);
    }

    addXml(element)
    //=============
    {
        // NB. Ace editor search and replace appears to be broken so
        //     we simply use Javascript string methods
        const text = this.diagram.textEditor.getValue();
        const bondGraphEndRegExp = new RegExp(`(\\n?)([ \\t]*)(</bond-graph>)`);

        if (text.search(bondGraphEndRegExp) >= 0) {
            this.diagram.textEditor.setValue(text.replace(bondGraphEndRegExp,
                `$1$2    ${element.toXml()}\n$2$3`));
        } else {
            const cellDiagramEndRegExp = new RegExp(`(\\n?)([ \\t]*)(</cell-diagram>)`);
            this.diagram.textEditor.setValue(text.replace(cellDiagramEndRegExp,
                `$1$2    <bond-graph>\n$2        ${element.toXml()}\n$2    </bond-graph>\n$2$3`));
        }

        // Add element to the bondgraph's container
        this.addElement(element);
    }

    addEdge(edge)
    //===========
    {
        super.addConnection(edge);
    }

    asGraph()
    //=======
    {
        const graph = new jsnx.Graph();
        for (let element of this.elements) {
            graph.addNode(element);
        }
        for (let connection of this.connections) {
            graph.addEdge(connection._parentElement, connection._otherElement);
        }
        return graph;
    }

    cyElements()
    //==========
    {
        const nodes = [];
        for (let node of this.elements) {
            nodes.push(node.cyElement());
        }
        const edges = [];
        for (let edge of this.connections) {
            edges.push(edge.cyElement());
        }
        return { nodes: nodes, edges: edges };
    }

    generateSvg()
    //===========
    {
        const svgNode = document.createElementNS(SVG_NS, 'g');
        svgNode.id = this.id;
        for (let element of this.elements) {
            svgNode.appendChild(element.generateSvg());
        }
        for (let edge of this.connections) {
            svgNode.appendChild(edge.generateSvg());
        }
        return svgNode;
    }
}

//==============================================================================

/*
const componentPoints = new List(this.lines["start"].points(this.fromPotential.coordinates, {"flow": this.flow}));

componentPoints.extend(this.flow.getFlowLine(this));

for (let to of this.toPotentials) {
    const points = new List(componentPoints);
    points.extend(this.lines["end"].points(to.coordinates, {"flow": this.flow, "reverse": true}));
    const line = new geo.PolyLine(points);

    const lineStyle = this.getStyleAsString("line-style", "");
    if ((this.count % 2) === 0) {
        for (let n = 0; n < this.count/2; n += 1) {
            const offset = (n + 0.5)*LINE_OFFSET;
            svg.append(svgLine(line.parallelOffset(offset, "left"),
                               this.colour, {style: line_style}));
            svg.append(svgLine(line.parallelOffset(offset, "right"),
                               this.colour, {reverse: true, style: lineStyle}));
        }
    } else {
        for (let n = 0; n < math.floor(this.count/2); n += 1) {
            const offset = (n + 1)*LINE_OFFSET;
            svg.append(svgLine(line.parallelOffset(offset, "left"),
                               this.colour, {style: line_style}));
            svg.append(svgLine(line.parallelOffset(offset, "right"),
                               this.colour, {reverse: true, style: lineStyle}));
        }
        svg.append(svgLine(line, this.colour, {"style": lineStyle}));
    }
}
*/

//==============================================================================

export class FlowEdge extends Connection
{
    constructor(diagram, element, fromId, toParent, parentElement, validClasses, direction, count)
    {
        super(diagram, element, fromId, toParent, parentElement, validClasses);
        this.direction = direction;
        this.count = count;
    }

    static createFromAttributeValue(diagram, element, direction,
                                    toParent, parentElement, validClasses)
    //====================================================================
    {
        if (!element.hasAttribute(direction)) {
            throw new exception.KeyError(`Expected ${direction} attribute`);
        }
        const count = element.hasAttribute('count') ? Number(element.getAttribute('count')) : 1;
        return new FlowEdge(diagram, element, element.getAttribute(direction),
                            toParent, parentElement, validClasses, direction, count);
    }

    parseLine()
    //=========
    {
        super.parseLine(this.direction);
    }

}

//==============================================================================

export class Flow extends DiagramElement
{
    constructor(diagram, bondGraph, domElement)
    {
        super(diagram, domElement);
//        this.componentOffsets = [];
//        const transporterId = element.getAttribute('transporter');
//        this.transporter = this.fromAttribute('transporter', [diagramTransporter])
        this._inEdge = null;
        this._outEdge = null;
        const flowConnectsTo = [Gyrator, Potential, Reaction];
        for (let element of domElement.children) {
            if (element.nodeName === 'connection') {
                if (!element.hasAttribute('from') && !element.hasAttribute('to')) {
                    throw new exception.SyntaxError(element, "<connection> requires 'from' or 'to' element");
                }
                if (element.hasAttribute('from')) {
                    if (this._inEdge !== null) {
 //                       throw new exception.SyntaxError(element, `<flow> can only have a single 'from' element`);
                    }
                    this._inEdge = FlowEdge.createFromAttributeValue(diagram, element, 'from',
                                                                     true, this, flowConnectsTo);
                    bondGraph.addEdge(this._inEdge);
                    }
                if (element.hasAttribute('to')) {
                    if (this._outEdge !== null) {
//                        throw new exception.SyntaxError(element, `<flow> can only have a single 'to' element`);
                    }
                    this._outEdge = FlowEdge.createFromAttributeValue(diagram, element, 'to',
                                                                      false, this, flowConnectsTo);
                    bondGraph.addEdge(this._outEdge);
                }
            } else {
                throw new exception.SyntaxError(element, `Unexpected <flow> element`);
            }
        }
    }

}

/*
    componentOffset(component)
    //========================
    {
        return this.componentOffsets.get(component, new geo.Point());
    }

    setTransporterOffsets() {
        if (this.transporter !== null && this.components.length > 1) {
            const index = layout.VERTICAL_BOUNDARIES.contains(this.transporter.compartmentSide) ? 1 : 0;
            const origin = this.transporter.coordinates[index];
            let componentOffsets = [];
            const numComponents = this.components.length;


            for (let component of this.components) {
                const offset = component.fromPotential.coordinates[index] - origin;
                for (let to of component.toPotentials) {
                    offset += (to.coordinates[index] - origin);
                }
                componentOffsets.push({component: component, offset: offset/(1 + component.toPotentials.length)});
            }
            componentOffsets.sort((a, b) => a.length - b.length);

            for n, p in enumerate(sorted(component_offset.items(), key=operator.itemgetter(1))):
                w = self.diagram.unitConverter.pixels(self.transporter.width, index, add_offset=False)


                self._component_offsets[p[0]][index] = w*(-0.5 + n/float(num_components - 1))


            for (var np, _pj_c = 0, _pj_a = enumerate(sorted(componentOffset.items(), {"key": operator.itemgetter(1)})), _pj_b = _pj_a.length; (_pj_c < _pj_b); _pj_c += 1) {
                const w = this.diagram.unitConverter.toPixels(this.transporter.width, index, false);


                np = _pj_a[_pj_c];
                [n, p] = np;
                this.componentOffsets.push({component: [index] = w*(-0.5 + n/(num_components - 1));
            }
        }
    }

    getFlowLine(component)
    //====================
    {
        let points = new List();
        if ((this.transporter !== null)) {
            const compartment = this.transporter.container.geometry;
            const side = this.transporter.compartmentSide;
            const index = layout.VERTICAL_BOUNDARIES.contains(side) ? 0 : 1;
            const sign = compartment.contains(this.geometry)
                       ? ((["top", "left"].indexOf(side) >= 0) ? -1 : 1)
                       : ((["top", "left"].indexOf(side) >= 0) ? 1 : -1);

            const transporterEnd = this.transporter.coords.copy();
            transporterEnd[index] += (sign * this.diagram.unitConverter.toPixels(config.TRANSPORTER.EXTRA, index, false));

            const offset = self.componentOffsets.find(co => co.component === component).length;

            if ((compartment.contains(this.geometry) === compartment.contains(component.fromPotential.geometry))) {
                points.extend([(offset + this.coordinates), (offset + transporterEnd)]);
            } else {
                points.extend([(offset + transporterEnd), (offset + this.coordinates)]);
            }
        } else {
            points.append(this.coordinates);
        }
        return points;
    }
*/

//==============================================================================

export class Gyrator extends DiagramElement
{
    constructor(diagram, bondGraph, domElement)
    {
        super(diagram, domElement);
        for (let element of domElement.children) {
// Need to allow either Flows or Potentials...
            if        (element.nodeName === 'from') {
                bondGraph.addEdge(Connection.createFromAttributeValue(diagram, element,
                                                                      'potential', true, this, [Potential]));
            } else if (element.nodeName === 'to') {
                bondGraph.addEdge(Connection.createFromAttributeValue(diagram, element,
                                                                      'potential', false, this, [Potential]));
            } else {
                throw new exception.SyntaxError(element, `Unexpected <gyrator> element`);
            }
        }
    }
}

//==============================================================================

export class Potential extends DiagramElement
{
    constructor(diagram, bondGraph, domElement)
    {
        super(diagram, domElement);
        if (domElement.hasAttribute('quantity')) {
            this.quantityId = domElement.getAttribute('quantity');
            const edge = new Connection(diagram, domElement, this.quantityId, false,
                                  this, [Quantity], `#${this.quantityId}`);
            bondGraph.addEdge(edge);
            this.addConnection(edge);
        } else {
            this.quantityId = null;
        }
    }

    setQuantity(quantityId)
    //=====================
    {
        this.quantityId = quantityId.slice(1);
    }

    toXml()
    //=====
    {
        const attrs = [`id="${this.id.slice(1)}"`];
        if (this.quantityId !== null) {
            attrs.push(`quantity="${this.quantityId}"`);
        }
        return `<${this.tagName} ${attrs.join(" ")}/>`;
    }

}

//==============================================================================

export class Quantity extends DiagramElement
{
    constructor(diagram, bondGraph, domElement) {
        super(diagram, domElement);
        this.potential = null;
    }

    stroke()
    //======
    {
        return 'none';
    }

    assignGeometry(width=config.QUANTITY.WIDTH, height=config.QUANTITY.HEIGHT)
    //========================================================================
    {
        if (this.hasCoordinates) {
            const x = this.coordinates.x;
            const y = this.coordinates.y;
            this.geometry = new geo.RoundedRectangle([x - width/2, y - height/2],
                                                     [x + width/2, y + height/2],
                                                     0.18*width, 0.18*height);
        }
    }
}

//==============================================================================

export class Reaction extends DiagramElement
{
    constructor(diagram, bondGraph, domElement)
    {
        super(diagram, domElement);
        if (!('radius' in this.style)) {
            this._radius = config.TRANSPORTER.RADIUS;
        }
        for (let element of domElement.children) {
            if (element.nodeName === 'from') {
                bondGraph.addEdge(Connection.createFromAttributeValue(diagram, element, 'flow',
                                                                      true, this, [Flow]));
            } else if (element.nodeName === 'to') {
                bondGraph.addEdge(Connection.createFromAttributeValue(diagram, element, 'flow',
                                                                      false, this, [Flow]));
            } else if (element.nodeName === 'modulator') {
                bondGraph.addEdge(Connection.createFromAttributeValue(diagram, element, 'potential',
                                                                      true, this, [Potential]));
            } else {
                throw new exception.SyntaxError(element, `Unexpected <reaction> element`);
            }
        }
    }
}

//==============================================================================

export class Transformer extends DiagramElement
{
    constructor(diagram, bondGraph, domElement)
    {
        super(diagram, domElement);
        for (let element of domElement.children) {
// Need to allow either Flows or Potentials...
            if (element.nodeName === 'from') {
                bondGraph.addEdge(Connection.createFromAttributeValue(diagram, element, 'potential',
                                                                      true, this, [Potential]));
            } else if (element.nodeName === 'to') {
                bondGraph.addEdge(Connection.createFromAttributeValue(diagram, element, 'potential',
                                                                      false, this, [Potential]));
            } else {
                throw new exception.SyntaxError(element, `Unexpected <transformer> element`);
            }
        }
    }
}

//==============================================================================
