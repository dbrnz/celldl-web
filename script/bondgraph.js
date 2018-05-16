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
import * as layout from './layout.js';
import * as parser from './parser.js';
import {Element, PositionedElement} from './element.js';
import {svgLine} from './svgElements.js';

//==============================================================================

const LINE_OFFSET = 3.5;

//==============================================================================

export class BondGraph extends Element {
    constructor(diagram, attributes, style) {
        super(diagram, attributes, style, "BondGraph");
        this.flows = [];
        this.potentials = {}
    }

    addFlow(flow) {
        this.flows.push(flow);
    }

    addPotential(potential) {
        this.potentials[potential] = potential.quantity;
    }

    set_offsets() {
        for (var flow, _pj_c = 0, _pj_a = this.flows, _pj_b = _pj_a.length; (_pj_c < _pj_b); _pj_c += 1) {
            flow = _pj_a[_pj_c];
            flow.set_transporter_offsets();
        }
    }

    svg() {
        var p, q, svg;
        svg = [];
        for (var pq, _pj_c = 0, _pj_a = this._potentials.items(), _pj_b = _pj_a.length; (_pj_c < _pj_b); _pj_c += 1) {
            pq = _pj_a[_pj_c];
            [p, q] = pq;
            svg.append(svg_line(new geo.LineString([p.coords, q.coords]), ((q.stroke !== "none") ? q.stroke : "#808080"), {"display": this.display()}));
        }
        for (var flow, _pj_c = 0, _pj_a = this._flows, _pj_b = _pj_a.length; (_pj_c < _pj_b); _pj_c += 1) {
            flow = _pj_a[_pj_c];
            for (var component, _pj_f = 0, _pj_d = flow.components, _pj_e = _pj_d.length; (_pj_f < _pj_e); _pj_f += 1) {
                component = _pj_d[_pj_f];
                svg.extend(component.svg());
            }
        }
        for (var pq, _pj_c = 0, _pj_a = this._potentials.items(), _pj_b = _pj_a.length; (_pj_c < _pj_b); _pj_c += 1) {
            pq = _pj_a[_pj_c];
            [p, q] = pq;
            svg.extend(p.svg());
        }
        for (var flow, _pj_c = 0, _pj_a = this.flows, _pj_b = _pj_a.length; (_pj_c < _pj_b); _pj_c += 1) {
            flow = _pj_a[_pj_c];
            svg.extend(flow.svg());
        }
        return svg;
    }
}

//==============================================================================

export class Flow extends PositionedElement {
    constructor(diagram, transporterId=null, attributes, style) {
        super(diagram, attributes, style, "Flow");
        this.transporter = (transporterId ? diagram.findElement(("#" + transporterId), dia.Transporter) : null);
        this.components = [];
        this.componentOffsets = {};
    }

    addComponent(component) {
        this.components.push(component);
        this.componentOffsets[component] = new layout.Point();  // v's geo.Point ??
    }

    componentOffset(component) {
        return this.componentOffsets.get(component, new layout.Point());
    }

    parsePosition() {
        super.parsePosition(this, {"default_offset": this.diagram.flow_offset, "default_dependency": this.transporter});
    }

    setTransporterOffsets() {
        var component_offset, index, n, num_components, offset, origin, p;
        if (((this.transporter !== null) && (this.components.length > 1))) {
            index = (_pj.in_es6(this.transporter.compartment_side, layout.VERTICAL_BOUNDARIES) ? 1 : 0);
            origin = this.transporter.coords[index];
            component_offset = {};
            num_components = this.components.length;
            for (var component, _pj_c = 0, _pj_a = this.components, _pj_b = _pj_a.length; (_pj_c < _pj_b); _pj_c += 1) {
                component = _pj_a[_pj_c];
                offset = (component.from_potential.coords[index] - origin);
                for (var to, _pj_f = 0, _pj_d = component.to_potentials, _pj_e = _pj_d.length; (_pj_f < _pj_e); _pj_f += 1) {
                    to = _pj_d[_pj_f];
                    offset += (to.coords[index] - origin);
                }
                component_offset[component] = (offset / Number.parseFloat((1 + component.to_potentials.length)));
            }
            for (var np, _pj_c = 0, _pj_a = enumerate(sorted(component_offset.items(), {"key": operator.itemgetter(1)})), _pj_b = _pj_a.length; (_pj_c < _pj_b); _pj_c += 1) {
                np = _pj_a[_pj_c];
                [n, p] = np;
                this._component_offsets[p[0]][index] = (((- 0.5) + (n / Number.parseFloat((num_components - 1)))) * this.diagram.unit_converter.pixels(this.transporter.width, index, {"add_offset": false}));
            }
        }
    }

    getFlowLine(component) {
        var compartment, index, offset, points, side, sign, transporter_end;
        points = [];
        if ((this.transporter !== null)) {
            compartment = this.transporter.container.geometry;
            side = this.transporter.compartment_side;
            index = (_pj.in_es6(side, layout.VERTICAL_BOUNDARIES) ? 0 : 1);
            if (compartment.contains(this.geometry)) {
                sign = (_pj.in_es6(side, ["top", "left"]) ? (- 1) : 1);
            } else {
                sign = (_pj.in_es6(side, ["top", "left"]) ? 1 : (- 1));
            }
            transporter_end = this.transporter.coords.copy();
            transporter_end[index] += (sign * this.diagram.unit_converter.pixels(layout.TRANSPORTER_EXTRA, index, {"add_offset": false}));
            offset = this._component_offsets[component];
            if ((compartment.contains(this.geometry) === compartment.contains(component.from_potential.geometry))) {
                points.extend([(offset + this.coords), (offset + transporter_end)]);
            } else {
                points.extend([(offset + transporter_end), (offset + this.coords)]);
            }
        } else {
            points.push(this.coords);
        }
        return points;
    }
}

//==============================================================================

export class FlowComponent extends PositionedElement {
    constructor(diagram, flow, from_ = null, to = null, count = 1, line = null, attributes, style) {
        super(diagram, attributes, style, "FlowComponent");
        this.fromPotential = diagram.find_element(("#" + from), Potential);
        this.toPotentials = function () {
            var _pj_a = [], _pj_b = to.split();
            for (var _pj_c = 0, _pj_d = _pj_b.length; (_pj_c < _pj_d); _pj_c += 1) {
                var name = _pj_b[_pj_c];
                _pj_a.push(diagram.findElement(name, Potential));
            }
            return _pj_a;
        }.call(this);
        this.count = Number.parseInt(count);
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
    constructor(diagram, quantity = null, attributes, style) {
        this.quantity = diagram.find_element(("#" + quantity), dia.Quantity);
        this.quantity.setPotential(this);
        super(this._quantity.container, attributes, style, "Quantity");
    }

    get quantityId() {
        return this.quantity.id;
    }

    parsePosition() {
        super.parsePosition(this, {"default_offset": this.diagram.quantity_offset, "default_dependency": this.quantity});
    }
}

//==============================================================================
