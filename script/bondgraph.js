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

import * as geo from './geometry.js';
import * as layout from './layout.js';

import {CellDiagram} from './cellDiagram.js';
import {DiagramElement} from './element.js';
import {List} from './utils.js';
import {svgLine} from './svgElements.js';

//==============================================================================

const LINE_OFFSET = 3.5;  // TODO: Initial/default value from CSS

//==============================================================================

export class Node extends DiagramElement
{
    constructor(attributes, style, className='Node')
    {
        super(attributes, style, className);
    }
}

//==============================================================================

function extendSvg(svg, elementClass)
{
    for (let element of CellDiagram.instance().elements(elementClass)) {
        svg.extend(element.generateSvg());
    }
}


export function generateSvg()
{
    let svg = new List();

    // Order of drawing matters as we want nodes covering lines

    extendSvg(svg, Flow);

    extendSvg(svg, Gyrator);
    extendSvg(svg, Reaction);
    extendSvg(svg, Transformer);

    extendSvg(svg, Potential);
    extendSvg(svg, Quantity);

    return svg;
}

//==============================================================================

export class Flow extends Node
{
    constructor(attributes, style)
    {
        super(attributes, style, "Flow");
        this.components = [];
//        this.componentOffsets = [];
//        this.transporter = DiagramElement.fromAttribute(attributes, 'transporter', diagram.Transporter)
    }

    addComponent(component)
    //=====================
    {
        this.components.push(component);
//        this.componentOffsets[component] = new geo.Point();
    }

    parsePosition()
    //=============
    {
        super.parsePosition();
        for (let component of this.components) {
            component.parsePosition();
        }
    }

    generateSvg()
    //===========
    {
        let svg = new List();
        for (let component of this.components) {
            svg.extend(component.generateSvg());
        }
        svg.extend(super.generateSvg());
        return svg;
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

export class FlowComponent
{
    constructor(attributes, style, flow)
    {
        this.flow = flow;
        this.input = DiagramElement.fromAttribute(attributes, 'input', Potential)
        this.output = DiagramElement.fromAttribute(attributes, 'output', Potential)
        this.count = ('count' in attributes) ? Number(attributes.count.textContent) : 1;
    }

    parsePosition()
    //=============
    {
/* TODO
        this.lines = { start: new layout.Line(this, this.style["line-start"]),
                       end:   new layout.Line(this, this.style["line-end"])};
        for (let line of this.lines.values()) {
            line.parse();
        }
*/
    }

    generateSvg()
    //===========
    {
        let svg = new List();
        if (this.input !== null) {
            // TODO: Default stroke colour from CSS
            svg.append(svgLine(new geo.LineString(this.input.coordinates, this.flow.coordinates), '#808080'));
        }
        if (this.output !== null) {
            // TODO: Default stroke colour from CSS
            svg.append(svgLine(new geo.LineString(this.flow.coordinates, this.output.coordinates), '#808080'));
        }
        return svg;
        /*
        const componentPoints = new List(this.lines["start"].points(this.fromPotential.coordinates, {"flow": this.flow}));
        componentPoints.extend(this.flow.getFlowLine(this));
        for (let to of this.toPotentials) {
            const points = new List(componentPoints);
            points.extend(this.lines["end"].points(to.coordinates, {"flow": this.flow, "reverse": true}));
            const line = new geo.LineString(...points);
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
    }
}

//==============================================================================

export class Gyrator extends DiagramElement
{
    constructor(attributes, style)
    {
        super(attributes, style, 'Gyrator');
        this.input = DiagramElement.fromAttribute(attributes, 'input', Flow)
        this.output = DiagramElement.fromAttribute(attributes, 'output', Flow)
        if (!this.label.startsWith('$')) this.label = `GY:${this.label}`;
    }

    generateSvg()
    //===========
    {
        let svg = new List();
        if (this.input !== null) {
            // TODO: Default stroke colour from CSS
            svg.append(svgLine(new geo.LineString(this.input.coordinates, this.coordinates), '#808080'));
        }
        if (this.output !== null) {
            // TODO: Default stroke colour from CSS
            svg.append(svgLine(new geo.LineString(this.coordinates, this.output.coordinates), '#808080'));
        }
        svg.extend(super.generateSvg());
        return svg;
    }


}

//==============================================================================

export class Potential extends Node
{
    constructor(attributes, style)
    {
        super(attributes, style, 'Potential');
        this.quantity = DiagramElement.fromAttribute(attributes, 'quantity', Quantity)
        if (this.quantity !== null) {
            this.quantity.setPotential(this);
        }
    }

    generateSvg()
    //===========
    {
        let svg = new List();
        const quantity = this.quantity;
        if (quantity !== null) {
            // TODO: Default stroke colour from CSS
            svg.append(svgLine(new geo.LineString(this.coordinates, quantity.coordinates),
                              (quantity.stroke !== "none") ? quantity.stroke : '#808080'));
        }
        svg.extend(super.generateSvg());
        return svg;
    }

    get quantityId()
    //==============
    {
        return this.quantity ? this.quantity.id : '';
    }
}

//==============================================================================

export class Quantity extends DiagramElement
{
    constructor(attributes, style) {
        super(attributes, style, 'Quantity');
        this.potential = null;
    }

    setPotential(potential)
    //=====================
    {
        this.potential = potential;
    }
}

//==============================================================================

export class Reaction extends DiagramElement
{
    constructor(attributes, style)
    {
        super(attributes, style, 'Reaction');
        this.input = DiagramElement.fromAttribute(attributes, 'input', Node)
        this.output = DiagramElement.fromAttribute(attributes, 'output', Node)
        this.modulator = DiagramElement.fromAttribute(attributes, 'modulator', Potential)
        if (!this.label.startsWith('$')) this.label = `RE:${this.label}`;
    }

    generateSvg()
    //===========
    {
        let svg = new List();
        if (this.input !== null) {
            // TODO: Default stroke colour from CSS
            svg.append(svgLine(new geo.LineString(this.input.coordinates, this.coordinates), '#808080'));
        }
        if (this.output !== null) {
            // TODO: Default stroke colour from CSS
            svg.append(svgLine(new geo.LineString(this.coordinates, this.output.coordinates), '#808080'));
        }
        if (this.modulator !== null) {
            // TODO: Default stroke colour from CSS
            svg.append(svgLine(new geo.LineString(this.modulator.coordinates, this.coordinates), '#808080'));
        }
        svg.extend(super.generateSvg());
        return svg;
    }
}

//==============================================================================

export class Transformer extends DiagramElement
{
    constructor(attributes, style)
    {
        super(attributes, style, 'Transformer');
        this.input = DiagramElement.fromAttribute(attributes, 'input', Potential)
        this.output = DiagramElement.fromAttribute(attributes, 'output', Potential)
        if (!this.label.startsWith('$')) this.label = `TF:${this.label}`;
    }

    generateSvg()
    //===========
    {
        let svg = new List();
        if (this.input !== null) {
            // TODO: Default stroke colour from CSS
            svg.append(svgLine(new geo.LineString(this.input.coordinates, this.coordinates), '#808080'));
        }
        if (this.output !== null) {
            // TODO: Default stroke colour from CSS
            svg.append(svgLine(new geo.LineString(this.coordinates, this.output.coordinates), '#808080'));
        }
        svg.extend(super.generateSvg());
        return svg;
    }

}

//==============================================================================
