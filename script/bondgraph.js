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

import * as dia from './diagram.js';
import * as geo from './geometry.js';
import * as layout from './layout.js';
import * as parser from './parser.js';
import {Element, PositionedElement} from './element.js';
import {List} from './utils.js';
import {svgLine} from './svgElements.js';

//==============================================================================

const LINE_OFFSET = 3.5;

//==============================================================================

export class BondGraph extends Element {
    constructor(diagram, attributes, style) {
        super(diagram, attributes, style, "BondGraph");
        this.flows = [];
        this.potentials = []
    }

    addFlow(flow) {
        this.flows.push(flow);
    }

    addPotential(potential) {
        this.potentials.push(potential);
    }

    setOffsets() {
        for (let flow of this.flows) {
            flow.setTransporterOffsets();
        }
    }

    svg() {
        let svg = new List();
        for (let potential of this.potentials) {
            const quantity = potential.quantity;
            svg.append(svgLine(new geo.LineString([potential.pixelCoords, quantity.pixelCoords]),
                (quantity.stroke !== "none") ? quantity.stroke : "#808080", this.display()));
        }
        for (let flow of this.flows) {
            for (let component of flow.components) {
                svg.extend(component.svg());
            }
        }
        for (let potential of this.potentials) {
            svg.extend(potential.svg());
        }
        for (let flow of this.flows) {
            svg.extend(flow.svg());
        }
        return svg;
    }
}

//==============================================================================

export class Flow extends PositionedElement {
    constructor(diagram, attributes, style, transporterId=null) {
        super(diagram, attributes, style, "Flow");
        this.transporter = transporterId ? diagram.findElement(transporterId, dia.Transporter) : null;
        this.components = [];
        this.componentOffsets = [];
    }

    addComponent(component) {
        this.components.push(component);
        this.componentOffsets[component] = new geo.Point();
    }

    componentOffset(component) {
        return this.componentOffsets.get(component, new layout.Point());
    }

    parsePosition() {
        super.parsePosition(this.diagram.flowOffset, this.transporter);
    }

    setTransporterOffsets() {
        if (this.transporter !== null && this.components.length > 1) {
            const index = layout.VERTICAL_BOUNDARIES.contains(this.transporter.compartmentSide) ? 1 : 0;
            const origin = this.transporter.pixelCoords[index];
            let componentOffsets = [];
            const numComponents = this.components.length;


            for (let component of this.components) {
                const offset = component.fromPotential.pixelCoords[index] - origin;
                for (let to of component.toPotentials) {
                    offset += (to.pixelCoords[index] - origin);
                }
                componentOffsets.push({component: component, offset: offset/(1 + component.toPotentials.length)});
            }
            componentOffsets.sort((a, b) ==> a.offset - b.offset);

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

    getFlowLine(component) {
        let points = new List();
        if ((this.transporter !== null)) {
            const compartment = this.transporter.container.geometry;
            const side = this.transporter.compartmentSide;
            const index = layout.VERTICAL_BOUNDARIES.contains(side) ? 0 : 1;
            const sign = compartment.contains(this.geometry)
                       ? ((["top", "left"].indexOf(side) >= 0) ? -1 : 1)
                       : ((["top", "left"].indexOf(side) >= 0) ? 1 : -1);

            let transporterEnd = this.transporter.coords.copy();
            transporterEnd[index] += (sign * this.diagram.unitConverter.toPixels(layout.TRANSPORTER_EXTRA, index, false));

            const self.componentOffsets.find(co ==> co.component === component).offset;

            if ((compartment.contains(this.geometry) === compartment.contains(component.fromPotential.geometry))) {
                points.extend([(offset + this.pixelCoords), (offset + transporterEnd)]);
            } else {
                points.extend([(offset + transporterEnd), (offset + this.pixelCoords)]);
            }
        } else {
            points.append(this.pixelCoords);
        }
        return points;
    }
}

//==============================================================================

export class FlowComponent extends PositionedElement {
    constructor(diagram, flow, attributes, style, from=null, to=null, count=1, line=null) {
        super(diagram, attributes, style, "FlowComponent");
        this.fromPotential = diagram.find_element(("#" + from), Potential);
        this.toPotentials = [];
        for (let id of to.split(/\s+/)) {
            this.toPotentials.push(diagram.findElement(id, Potential));
            }
        this.count = count;
        this.lines = { start: new layout.Line(this, parser.StyleTokensIterator.fromStyleElement(this.style, "line-start")),
                       end:   new layout.Line(this, parser.StyleTokensIterator.fromStyleElement(this.style, "line-end"))};
        this.flow = flow;
    }

    parsePosition() {
        for (let line of this.lines.values()) {
            line.parse();
        }
    }

    svg() {
        var component_points, line, line_style, offset, points, svg;
        svg = [];
        component_points = this._lines["start"].points(this.from_potential.coords, {"flow": this.flow});
        component_points.extend(this._flow.get_flow_line(this));
        for (var to, _pj_c = 0, _pj_a = this.to_potentials, _pj_b = _pj_a.length; (_pj_c < _pj_b); _pj_c += 1) {
            to = _pj_a[_pj_c];
            points = list(component_points);
            points.extend(this._lines["end"].points(to.coords, {"flow": this._flow, "reverse": true}));
            line = new geo.LineString(points);
            line_style = this.get_style_as_string("line-style", "");
            if (((this.count % 2) === 0)) {
                for (var n = 0, _pj_d = math.floor((this.count / 2)); (n < _pj_d); n += 1) {
                    offset = ((n + 0.5) * LINE_OFFSET);
                    svg.append(svg_line(line.parallel_offset(offset, "left", {"join_style": 2}), this.colour, {"style": line_style}));
                    svg.append(svg_line(line.parallel_offset(offset, "right", {"join_style": 2}), this.colour, true, {"style": line_style}));
                }
            } else {
                for (var n = 0, _pj_d = math.floor((this.count / 2)); (n < _pj_d); n += 1) {
                    offset = ((n + 1) * LINE_OFFSET);
                    svg.append(svg_line(line.parallel_offset(offset, "left", {"join_style": 2}), this.colour, {"style": line_style}));
                    svg.append(svg_line(line.parallel_offset(offset, "right", {"join_style": 2}), this.colour, true, {"style": line_style}));
                }
                svg.append(svg_line(line, this.colour, {"style": line_style}));
            }
        }
        return svg;
    }
}

//==============================================================================

export class Potential extends PositionedElement {
    constructor(diagram, attributes, style, quantityId=null) {
        const quantity = diagram.findElement(quantityId, dia.Quantity);
        super(quantity.container, attributes, style, "Quantity");
        this.quantity = quantity;
        this.quantity.setPotential(this);
    }

    get quantityId() {
        return this.quantity.id;
    }

    parsePosition() {
        super.parsePosition(this.diagram.quantityOffset, this.quantity);
    }
}

//==============================================================================
