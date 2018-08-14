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

import * as exception from './exception.js';
import * as geo from './geometry.js';
import * as layout from './layout.js';

import {DiagramElement} from './element.js';
import {Edge} from './edge.js';
import {SVG_NS} from './svgElements.js';

//==============================================================================

// UNUSED const LINE_OFFSET = 3.5;  // TODO: Initial/default value from CSS

//==============================================================================

export class BondGraph
{
    constructor(diagram)
    {
        this.diagram = diagram;
        this.id = `${this.diagram.id}_bondgraph`;
        this.edges = [];
    }

    addElement(element)
    //=================
    {
        // NB. Ace editor search and replace appears to be broken so
        //     we simply use Javascript string methods
        const text = this.diagram.editor.getValue();
        const bondGraphEndRegExp = new RegExp(`(\\n?)([ \\t]*)(</bond-graph>)`);
        this.diagram.editor.setValue(text.replace(bondGraphEndRegExp,
            `$1$2    ${element.toXml()}\n$2$3`));
        this.diagram.editor.clearSelection();
    }

    addEdge(edge)
    //===========
    {
        this.edges.push(edge);
        this.diagram.addEdge(edge);
    }

    drawConnections(svgNode)
    //======================
    {
        for (let edge of this.edges) {
            svgNode.appendChild(edge.generateSvg());
        }
    }

    drawElements(svgNode, elementClass)
    //=================================
    {
        for (let element of this.diagram.elements(elementClass)) {
            svgNode.appendChild(element.generateSvg());
        }
    }

    generateSvg()
    //===========
    {
        const svgNode = document.createElementNS(SVG_NS, 'g');
        svgNode.id = this.id;
        this.drawConnections(svgNode);
        this.drawElements(svgNode, Flow);
        this.drawElements(svgNode, Gyrator);
        this.drawElements(svgNode, Potential);
        this.drawElements(svgNode, Quantity);
        this.drawElements(svgNode, Reaction);
        this.drawElements(svgNode, Transformer);
        return svgNode;
    }
}

//==============================================================================

export class Node extends DiagramElement
{
    constructor(diagram, element)
    {
        super(diagram, element);
    }
}

//==============================================================================

/*
const componentPoints = new List(this.lines["start"].points(this.fromPotential.coordinates, {"flow": this.flow}));

componentPoints.extend(this.flow.getFlowLine(this));

for (let to of this.toPotentials) {
    const points = new List(componentPoints);
    points.extend(this.lines["end"].points(to.coordinates, {"flow": this.flow, "reverse": true}));
    const line = new geo.LineString(points);

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

export class FlowEdge extends Edge
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
        if (!(direction in element.attributes)) {
            throw new exception.KeyError(`Expected ${direction} attribute`);
        }
        const count = ('count' in element.attributes) ? Number(element.attributes.count.textContent) : 1;
        return new FlowEdge(diagram, element, element.attributes[direction].textContent,
                            toParent, parentElement, validClasses, direction, count);
    }

    parseLine()
    //=========
    {
        this.line = new layout.LinePath(this.diagram, this.style, `${this.direction}-line-path`);
        this.line.parse();
    }

}

//==============================================================================

export class Flow extends Node
{
    constructor(diagram, element)
    {
        super(diagram, element);
        this.bondGraph = diagram.bondGraph;
//        this.componentOffsets = [];
//        const transporterId = ('transporter' in element.attributes) ? element.attributes.transporter : null;
//        this.transporter = this.fromAttribute('transporter', [diagramTransporter])
    }


    addComponent(domElement)
    //======================
    {
        const flowConnectsTo = [Gyrator, Potential, Reaction];
        if ('input' in domElement.attributes) {
            this.bondGraph.addEdge(FlowEdge.createFromAttributeValue(this.diagram, domElement, 'input',
                                                                     true, this, flowConnectsTo));
            }
        if ('output' in domElement.attributes) {
            this.bondGraph.addEdge(FlowEdge.createFromAttributeValue(this.diagram, domElement, 'output',
                                                                     false, this, flowConnectsTo));
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
            transporterEnd[index] += (sign * this.diagram.unitConverter.toPixels(layout.TRANSPORTER_EXTRA, index, false));

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
}

//==============================================================================

export class Gyrator extends DiagramElement
{
    constructor(diagram, domElement)
    {
        super(diagram, domElement);
        this.bondGraph = diagram.bondGraph;
        if (!this.label.startsWith('$')) this.label = `GY:${this.label}`;
    }

    addInput(domElement)
    //==================
    {
        this.bondGraph.addEdge(Edge.createFromAttributeValue(this.diagram, domElement,
                                                             'flow', true, this, [Flow]));
    }

    addOutput(domElement)
    //===================
    {
        this.bondGraph.addEdge(Edge.createFromAttributeValue(this.diagram, domElement,
                                                             'flow', false, this, [Flow]));
    }
}

//==============================================================================

export class Potential extends Node
{
    constructor(diagram, domElement)
    {
        super(diagram, domElement);
        this.bondGraph = diagram.bondGraph;

        if ('quantity' in domElement.attributes) {
            this.quantityId = domElement.attributes.quantity.textContent;
            const edge = new Edge(diagram, domElement, this.quantityId, false,
                                  this, [Quantity], `#${this.quantityId}`);
            this.bondGraph.addEdge(edge);
            this.addEdge(edge);
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
    constructor(diagram, domElement) {
        super(diagram, domElement);
        this.bondGraph = diagram.bondGraph;
        this.potential = null;
    }

    stroke()
    //======
    {
        return 'none';
    }

    assignGeometry(width=layout.QUANTITY_WIDTH, height=layout.QUANTITY_HEIGHT)
    //========================================================================
    {
        if (this.hasCoordinates) {
            const x = this.coordinates.x;
            const y = this.coordinates.y;
            this.geometry = new geo.RoundedRectangle([x - width/2, y - height/2],
                                                     [x + width/2, y + height/2],
                                                     0.375*width, 0.375*height);
        }
    }
}

//==============================================================================

export class Reaction extends DiagramElement
{
    constructor(diagram, domElement)
    {
        super(diagram, domElement);
        this.bondGraph = diagram.bondGraph;
        if (!this.label.startsWith('$')) this.label = `RE:${this.label}`;
    }

    addInput(domElement)
    //==================
    {
        this.bondGraph.addEdge(Edge.createFromAttributeValue(this.diagram, domElement, 'flow',
                                                             true, this, [Flow]));
    }

    addOutput(domElement)
    //===================
    {
        this.bondGraph.addEdge(Edge.createFromAttributeValue(this.diagram, domElement, 'flow',
                                                             false, this, [Flow]));
    }

    addModulator(domElement)
    //======================
    {
        this.bondGraph.addEdge(Edge.createFromAttributeValue(this.diagram, domElement, 'potential',
                                                             true, this, [Potential]));
    }

    assignGeometry(radius=layout.TRANSPORTER_RADIUS)
    //==============================================
    {
        return super.assignGeometry(radius);
    }
}

//==============================================================================

export class Transformer extends DiagramElement
{
    constructor(diagram, domElement)
    {
        super(diagram, domElement);
        this.bondGraph = diagram.bondGraph;
        if (!this.label.startsWith('$')) this.label = `TF:${this.label}`;
    }

    addInput(domElement)
    //==================
    {
        this.bondGraph.addEdge(Edge.createFromAttributeValue(this.diagram, domElement, 'potential',
                                                             true, this, [Potential]));
    }

    addOutput(domElement)
    //===================
    {
        this.bondGraph.addEdge(Edge.createFromAttributeValue(this.diagram, domElement, 'potential',
                                                             false, this, [Potential]));
    }
}

//==============================================================================
