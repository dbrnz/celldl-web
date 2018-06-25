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

import {CellDiagram} from './cellDiagram.js';
import {DiagramElement} from './element.js';
import {List} from './utils.js';
import {parseColour, styleAsString, StyleSheet} from './stylesheet.js';
import {SVG_NS, Arrow} from './svgElements.js';
import {setAttributes} from './utils.js';

//==============================================================================

const LINE_OFFSET = 3.5;  // TODO: Initial/default value from CSS

//==============================================================================

function drawEdges(svgNode)
//=========================
{
    for (let edge of CellDiagram.instance().edges()) {
        svgNode.appendChild(edge.generateSvg());
    }
}

function drawElements(svgNode, elementClass)
//==========================================
{
    for (let element of CellDiagram.instance().elements(elementClass)) {
        svgNode.appendChild(element.generateSvg());
    }
}

export function generateSvg()
//===========================
{
    const svgNode = document.createElementNS(SVG_NS, 'g');
    drawEdges(svgNode);
    drawElements(svgNode, Flow);
    drawElements(svgNode, Gyrator);
    drawElements(svgNode, Potential);
    drawElements(svgNode, Quantity);
    drawElements(svgNode, Reaction);
    drawElements(svgNode, Transformer);
    return svgNode;
}

//==============================================================================

export class Node extends DiagramElement
{
    constructor(element, className='Node')
    {
        super(element, className);
    }
}

//==============================================================================

export class Edge
{
    constructor(domElement, fromId, toParent, parent, validClasses, styleElementId=null) {
        this.domElement = domElement;
        this.otherId = `#${fromId}`;
        this.other = null;
        this.toParent = toParent;
        this.parent = parent;
        this.parent.addEdge(this);
        this.validClasses = validClasses;
        this.style = null;
        this.styleElementId = styleElementId;
        this.line = null;
        this.path = null;
        this.id = toParent ? `${this.otherId.slice(1)}-${parent.id.slice(1)}`
                           : `${parent.id.slice(1)}-${this.otherId.slice(1)}`;
        CellDiagram.instance().addEdge(this);
    }

    static fromAttribute(domElement, attributeName, toParent, parent, validClasses)
    //=============================================================================
    {
        if (!(attributeName in domElement.attributes)) {
            throw new exception.KeyError(domElement, `Expected ${attributeName} attribute`);
        }
        return new Edge(domElement, domElement.attributes[attributeName].textContent,
                        toParent, parent, validClasses);
    }

    resolveReferences()
    //=================
    {
        for (let elementClass of this.validClasses) {
            this.other = CellDiagram.instance().findElement(this.otherId, elementClass);
            if (this.other !== null) {
                const styleDomElement = (this.styleElementId !== null)
                                            ? CellDiagram.instance().findElement(this.styleElementId).domElement
                                            : this.domElement;
                this.style = StyleSheet.instance().style(styleDomElement);
                this.other.addEdge(this);
                return;
            }
        }
        const names = this.validClasses.filter(c => c.name);
        const classNames = (names.length === 1) ? names[0]
                                                : [names.slice(0, -1).join(', '), names.slice(-1)[0]].join(' or ');

        throw new exception.KeyError(this.domElement, `Can't find ${classNames} with id '${this.otherId}'`);
    }


    get lineColour()
    //==============
    {
        return ('line-color' in this.style) ? parseColour(this.style['line-color'])
                                            : '#A0A0A0'; // TODO: specify defaults in one place
    }

    parseLine()
    //=========
    {
        this.line = new layout.LinePath(this.style, 'line-path');
        this.line.parse();
    }

    getLineStringAsPath(fromElement, toElement)
    //=========================================
    {
        const path = this.line.toLineString(this.unitConverter,
                                            fromElement.coordinates,
                                            toElement.coordinates);
        const lines = path.lineSegments;
        const coords = path.coordinates;
        for (let n = 0; n < lines.length; ++n) {
            if (fromElement.geometry.outside(lines[n].end)) {
                const start = fromElement.geometry.lineIntersections(lines[n])[0];
                lines[n] = new geo.LineSegment(start, lines[n].end);
                coords[n] = lines[n].start;
                break;
            } else {
                lines[n] = null;
                coords[n] = null;
            }
        }
        for (let n = lines.length - 1; n >= 0; --n) {
            if (lines[n] !== null && toElement.geometry.outside(lines[n].start)) {
                const end = toElement.geometry.lineIntersections(lines[n])[0];
                lines[n] = (new geo.LineSegment(lines[n].start, end)).truncateEnd(5);
                coords[n+1] = lines[n].end;
                break;
            } else {
                lines[n] = null;
                coords[n+1] = null;
            }
        }
    path.lineSegments = lines.filter(line => (line !== null));
    path.coordinates = coords.filter(coord => (coord !== null));
    return path;
    }

    assignPath(unitConverter)
    //=======================
    {
        this.unitConverter = unitConverter;
        if (this.toParent) {
            this.path = this.getLineStringAsPath(this.other, this.parent);
        } else {
            this.path = this.getLineStringAsPath(this.parent, this.other);
        }
    }

    reassignPath()
    //===============
    {
        // either parent's or other's position has changed
        if (this.toParent) {
            this.path = this.getLineStringAsPath(this.other, this.parent);
        } else {
            this.path = this.getLineStringAsPath(this.parent, this.other);
        }
        // we could save unitconvertor above and simply assignPath
    }

    generateSvg()
    //===========
    {
        const svgNode = this.path.svgNode();
        setAttributes(svgNode, {id: this.id, fill: 'none',
                                stroke: this.lineColour,
                                'stroke-width': layout.STROKE_WIDTH,
                                'marker-end': Arrow.url(this.lineColour)});
        if (styleAsString(this.style, 'line-style') === 'dashed') {
            setAttributes(svgNode, {'stroke-dasharray': '10,5'});
        }
        return svgNode;
    }

    updateSvg()
    //=========
    {
        const svgNode = this.generateSvg();
        const currentNode = document.getElementById(this.id);
        currentNode.outerHTML = svgNode.outerHTML;
    }

}
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
    constructor(element, fromId, toParent, parent, validClasses, direction, count)
    {
        super(element, fromId, toParent, parent, validClasses);
        this.direction = direction;
        this.count = count;
    }

    static fromAttribute(element, direction, toParent, parent, validClasses)
    //======================================================================
    {
        if (!(direction in element.attributes)) {
            throw new exception.KeyError(element, `Expected ${direction} attribute`);
        }
        const count = ('count' in element.attributes) ? Number(attributes.count.textContent) : 1;
        return new FlowEdge(element, element.attributes[direction].textContent,
                            toParent, parent, validClasses, direction, count);
    }

    parseLine()
    //=========
    {
        this.line = new layout.LinePath(this.style, `${this.direction}-line-path`);
        this.line.parse();
    }

}

//==============================================================================

export class Flow extends Node
{
    constructor(element)
    {
        super(element, "Flow");
//        this.componentOffsets = [];
//        const transporterId = ('transporter' in element.attributes) ? element.attributes.transporter : null;
//        this.transporter = this.fromAttribute('transporter', [diagramTransporter])
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
            componentOffsets.sort((a, b) => a.offset - b.offset);

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

            const offset = self.componentOffsets.find(co => co.component === component).offset;

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
    constructor(element)
    {
        super(element, 'Gyrator');
        if (!this.label.startsWith('$')) this.label = `GY:${this.label}`;
    }
}

//==============================================================================

export class Potential extends Node
{
    constructor(element)
    {
        super(element, 'Potential');
        if ('quantity' in element.attributes) {
            const quantityId = element.attributes.quantity.textContent;
            new Edge(element, quantityId, false, this, [Quantity], `#${quantityId}`);
        }
    }
}

//==============================================================================

export class Quantity extends DiagramElement
{
    constructor(element) {
        super(element, 'Quantity');
        this.potential = null;
    }

    assignGeometry(width=layout.QUANTITY_WIDTH, height=layout.QUANTITY_HEIGHT)
    //========================================================================
    {
        if (this.hasCoordinates) {
            const [x, y] = this.coordinates;
            this.geometry = new geo.RoundedRectangle([x - width/2, y - height/2],
                                                     [x + width/2, y + height/2],
                                                     0.375*width, 0.375*height);
        }
    }

    generateSvg()
    //===========
    {
        const svgNode = document.createElementNS(SVG_NS, 'g');
        setAttributes(svgNode, this.idClass(), this.display);

        if (this.geometry !== null) {
            const node = this.geometry.svgNode();
            setAttributes(node, { stroke: 'none', fill: this.colour });
            svgNode.appendChild(node);
            svgNode.appendChild(this.labelAsSvg());
        }
        return svgNode;
    }
}

//==============================================================================

export class Reaction extends DiagramElement
{
    constructor(element)
    {
        super(element, 'Reaction');
        if (!this.label.startsWith('$')) this.label = `RE:${this.label}`;
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
    constructor(element)
    {
        super(element, 'Transformer');
        if (!this.label.startsWith('$')) this.label = `TF:${this.label}`;
    }
}

//==============================================================================
