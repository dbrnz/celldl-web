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

/*
import {asin, cos, pi, sin} from 'math';
*/

//==============================================================================

import * as mathjax from './mathjax';

//==============================================================================

var _pj;
var LINE_WIDTH, f, membrane, svg;
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
    function set_properties(cls, props) {
        var desc, value;
        var _pj_a = props;
        for (var p in _pj_a) {
            if (_pj_a.hasOwnProperty(p)) {
                value = props[p];
                if (((((! ((value instanceof Map) || (value instanceof WeakMap))) && (value instanceof Object)) && ("get" in value)) && (value.get instanceof Function))) {
                    desc = value;
                } else {
                    desc = {"value": value, "enumerable": false, "configurable": true, "writable": true};
                }
                Object.defineProperty(cls.prototype, p, desc);
            }
        }
    }
    container["in_es6"] = in_es6;
    container["set_properties"] = set_properties;
    return container;
}
_pj = {};
_pj_snippets(_pj);

//==============================================================================

LINE_WIDTH = 2;

//==============================================================================

export class SvgElement {
    constructor(id, id_base) {
        this._id = id;
        this._id_base = id_base;
    }
}

//==============================================================================

export class DefinesStore {
    static add(id, defs) {
        if ((! _pj.in_es6(id, this._defs))) {
            this._defs[id] = defs;
        }
    }

    static defines() {
        return list(this._defs.values());
    }
}

_pj.set_properties(DefinesStore, {"_defs": {}});

//==============================================================================

export class Gradient {
    constructor(gradient, stop_colours) {
        this._gradient = gradient;
        this._stop_colours = stop_colours;
    }

    __eq__(other) {
        return (((other instanceof Gradient) && (this._gradient === other._gradient)) && (this._stop_colours === other._stop_colours));
    }

    __hash__() {
        return hash([this._gradient, this._stop_colours.toString()]);
    }

    svg(id) {
        var n, nstops, offset, stop, stops;
        stops = [];
        nstops = this._stop_colours.length;
        for (var nstop, _pj_c = 0, _pj_a = enumerate(this._stop_colours), _pj_b = _pj_a.length; (_pj_c < _pj_b); _pj_c += 1) {
            nstop = _pj_a[_pj_c];
            [n, stop] = nstop;
            if ((n > 0)) {
                offset = " offset=\"{}%\"".format(((stop[1] !== null) ? stop[1] : ((n * 100.0) / (nstops - 1))));
            } else {
                offset = ((stop[1] !== null) ? " offset=\"{}%\"".format(stop[1]) : "");
            }
            stops.append("<stop{} stop-color=\"{}\"/>".format(offset, stop[0]));
        }
        return "<{gradient}Gradient id=\"{id}\">{stops}</{gradient}Gradient>".format({"gradient": this._gradient, "id": id, "stops": "/n".join(stops)});
    }
}

//==============================================================================

export class GradientStore {
    static next_id() {
        this._next_id += 1;
        return "_GRADIENT_{}_".format(this._next_id);
    }

    static url(gradient, stop_colours) {
        var g, id;
        g = new Gradient(gradient, stop_colours);
        id = this._gradients_to_id.get(g, null);
        if ((id === null)) {
            id = cls.next_id();
            cls._gradients_to_id[g] = id;
            DefinesStore.add(id, g.svg(id));
        }
        return "url(#{})".format(id);
    }
}

_pj.set_properties(GradientStore, {"_gradients_to_id": {}, "_next_id": 0});

//==============================================================================

export class CellMembrane extends SvgElement {
    constructor(id, width, height, id_base = "cell_membrane", outer_markers = 9, inner_markers = 3, marker_radius = 4, stroke_width = 1, stroke_colour = "#0092DF", fill_colour = "#BFDDFF") {
        /*
        :param outer_markers: Number of outer markers in a corner.
        :param immer_markers: Number of inner markers in a corner.
        */
        super(id, id_base);
        this._outer_markers = outer_markers;
        this._inner_markers = inner_markers;
        this._marker_radius = marker_radius;
        this._stroke_width = stroke_width;
        this._stroke_colour = stroke_colour;
        this._fill_colour = fill_colour;
        this._marker_width = ((2.0 * marker_radius) + this._stroke_width);
        this._outer_marker_angle = (90 / this._outer_markers);
        this._outer_radius = (this._marker_width / (2 * asin((pi / (4 * this._outer_markers)))));
        this._inner_marker_angle = (90 / this._inner_markers);
        this._inner_radius = (this._marker_width / (2 * asin((pi / (4 * this._inner_markers)))));
        this._line_width = (this._outer_radius - this._inner_radius);
        this._marker_tail = (0.9 * ((this._line_width - this._marker_radius) - this._stroke_width));
        this._horizontal_markers = Number.parseInt((0.5 + (((width - (this._line_width / 2.0)) - (3 * this._inner_radius)) / this._marker_width)));
        this._vertical_markers = Number.parseInt((0.5 + (((height - (this._line_width / 2.0)) - (3 * this._inner_radius)) / this._marker_width)));
        this._inner_width = (this._marker_width * this._horizontal_markers);
        this._inner_height = (this._marker_width * this._vertical_markers);
        this._outer_width = (this._inner_width + (2 * this._outer_radius));
        this._outer_height = (this._inner_height + (2 * this._outer_radius));
        DefinesStore.add(id_base, this.SVG_DEFS.format({"RADIUS": marker_radius, "TAIL": this._marker_tail, "WIDTH": stroke_width, "STROKE": stroke_colour, "FILL": fill_colour, "ID_BASE": id_base, "OFFSET": ((- this._line_width) / 2.0), "SPACING": ((- this._marker_width) / 2.0)}));
    }

    get width() {
        return (this._outer_width - this._line_width);
    }

    get height() {
        return (this._outer_height - this._line_width);
    }

    get thickness() {
        return this._line_width;
    }

    corner_path(outer_path) {
        var R, count, dt, marker_id, path, t, transform;
        transform = [];
        if (outer_path) {
            R = this._outer_radius;
            dt = ((this._outer_marker_angle * pi) / 180);
            marker_id = "{}_inward_marker".format(this._id_base);
            count = this._outer_markers;
            transform.append("rotate({:g})".format((this._outer_marker_angle / 2.0)));
        } else {
            R = this._inner_radius;
            dt = ((this._inner_marker_angle * pi) / 180);
            marker_id = "{}_outward_marker".format(this._id_base);
            count = this._inner_markers;
        }
        transform.append("translate(0, {:g})".format(R));
        path = ["M0,0"];
        t = 0;
        for (var n = 0, _pj_a = (count + 1); (n < _pj_a); n += 1) {
            path.append("a0,0 0 0,0 {:g},{:g}".format((R * (sin((t + dt)) - sin(t))), (R * (cos((t + dt)) - cos(t)))));
            t += dt;
        }
        return "\n      <g transform=\"{transform}\">\n        <path stroke=\"#FFFFFF\" fill=\"none\" marker-mid=\"url(#{marker})\" d=\"{path}\"/>\n      </g>".format({"transform": " ".join(transform), "marker": marker_id, "path": " ".join(path)});
    }

    corner(position) {
        var outer_path, outer_radius, rotation, translation;
        outer_radius = this._outer_radius;
        outer_path = this.corner_path(true);
        svg = [];
        rotation = ((position === "top_left") ? 180 : ((position === "top_right") ? 270 : ((position === "bottom_left") ? 90 : 0)));
        translation = ((position === "top_left") ? [0, 0] : ((position === "top_right") ? [0, this._inner_width] : ((position === "bottom_left") ? [this._inner_height, 0] : [this._inner_width, this._inner_height])));
        svg.append(("<g id=\"{}_{}\"".format(this._id_base, position) + " transform=\"translate({:g}, {:g}) rotate({:g}) translate({:g}, {:g})\">".format(outer_radius, outer_radius, rotation, ...translation)));
        svg.append(outer_path);
        svg.append(this.corner_path(false));
        svg.append("</g>");
        return svg;
    }

    side(orientation) {
        var count, marker_id, path, step_format, translation;
        translation = ((orientation === "top") ? [0, 0] : ((orientation === "bottom") ? [(this._marker_width / 2.0), this.height] : ((orientation === "left") ? [0, (this._marker_width / 2.0)] : [this.width, 0])));
        marker_id = "{}_marker".format(this._id_base);
        if (_pj.in_es6(orientation, ["top", "bottom"])) {
            path = ["M{:g},{:g}".format(this._outer_radius, (this._line_width / 2.0))];
            count = this._horizontal_markers;
            step_format = "l{:g},0";
        } else {
            path = ["M{:g},{:g}".format((this._line_width / 2.0), this._outer_radius)];
            count = this._vertical_markers;
            step_format = "l0,{:g}";
        }
        for (var n = 0, _pj_a = count; (n < _pj_a); n += 1) {
            path.append(step_format.format(this._marker_width));
        }
        return ["\n      <g id=\"{id}_{orientation}\" transform=\"translate({trans_x}, {trans_y})\">\n        <path stroke=\"#FFFFFF\" fill=\"none\"  d=\"{path}\"\n              marker-start=\"url(#{marker})\" marker-mid=\"url(#{marker})\"/>\n      </g>".format({"id": this._id_base, "orientation": orientation, "trans_x": translation[0], "trans_y": translation[1], "path": " ".join(path), "marker": marker_id})];
    }

    svg(outline = false) {
        svg = [];
        svg.append("<g transform=\"translate({:g},{:g})\">".format(((- this._line_width) / 2.0), ((- this._line_width) / 2.0)));
        svg.extend(this.corner("top_left"));
        svg.extend(this.corner("top_right"));
        svg.extend(this.corner("bottom_left"));
        svg.extend(this.corner("bottom_right"));
        svg.extend(this.side("top"));
        svg.extend(this.side("left"));
        svg.extend(this.side("bottom"));
        svg.extend(this.side("right"));
        if (outline) {
            svg.append("<path stroke=\"#0000FF\" fill=\"none\" d=\"M0,0 L{R:g},0 L{R:g},{B:g} L0,{B:g} z\"/>".format({"R": this._outer_width, "B": this._outer_height}));
        }
        svg.append("</g>");
        if (outline) {
            svg.append("<path stroke=\"#FF0000\" fill=\"none\" d=\"M0,0 L{R:g},0 L{R:g},{B:g} L0,{B:g} z\"/>".format({"R": this.width, "B": this.height}));
        }
        return "\n".join(svg);
    }
}

_pj.set_properties(CellMembrane, {"SVG_DEFS": "\n        <g id=\"{ID_BASE}_base_element\">\n            <circle cx=\"0\" cy=\"0\" r=\"{RADIUS}\" stroke-width=\"{WIDTH}\"/>\n            <line x1=\"{RADIUS}\" y1=\"0\" x2=\"{TAIL}\" y2=\"0\" stroke-width=\"{WIDTH}\"/>\n        </g>\n        <!-- Inward pointing marker -->\n        <marker id=\"{ID_BASE}_inward_marker\" markerUnits=\"userSpaceOnUse\" style=\"overflow: visible\" orient=\"auto\">\n            <use stroke=\"{STROKE}\" fill=\"{FILL}\" xlink:href=\"#{ID_BASE}_base_element\" transform=\"rotate(270)\"/>\n        </marker>\n        <!-- Outward pointing marker -->\n        <marker id=\"{ID_BASE}_outward_marker\" markerUnits=\"userSpaceOnUse\" style=\"overflow: visible\" orient=\"auto\">\n            <use stroke=\"{STROKE}\" fill=\"{FILL}\" xlink:href=\"#{ID_BASE}_base_element\" transform=\"rotate(90)\"/>\n        </marker>\n        <!-- Straight segments are built from two base elements at 180 degrees to each other -->\n        <g id=\"{ID_BASE}_element\">\n            <use transform=\"translate({OFFSET}, {SPACING})\" xlink:href=\"#{ID_BASE}_base_element\"/>\n            <use transform=\"rotate(180) translate({OFFSET}, 0)\" xlink:href=\"#{ID_BASE}_base_element\"/>\n        </g>\n        <!-- Marker for straight segments -->\n        <marker id=\"{ID_BASE}_marker\" markerUnits=\"userSpaceOnUse\" style=\"overflow: visible\" orient=\"auto\">\n            <use stroke=\"{STROKE}\" fill=\"{FILL}\" xlink:href=\"#{ID_BASE}_element\" transform=\"rotate(90)\"/>\n        </marker>"});

//==============================================================================

class _TransporterElement extends SvgElement {
    constructor(id, coords, rotation, height, defs, defined_height, id_base) {
        super(id, id_base);
        this._coords = coords;
        this._rotation = rotation;
        this._height = height;
        this._defined_height = defined_height;
        DefinesStore.add(id_base, defs.format({"ID_BASE": id_base}));
    }

    svg() {
        var scaling;
        svg = ["<use xlink:href=\"#{ID_BASE}_element\" transform=\"translate({X:g}, {Y:g})".format({"ID_BASE": this._id_base, "X": this._coords[0], "Y": this._coords[1]})];
        scaling = (this._height / Number.parseFloat(this._defined_height));
        if ((scaling !== 1.0)) {
            svg.append(" scale({})".format(scaling));
        }
        if ((this._rotation !== 0)) {
            svg.append(" rotate({})".format(this._rotation));
        }
        svg.append("\" />");
        return "".join(svg);
    }
}

//==============================================================================

export class Channel extends _TransporterElement {
    constructor(id, coords, rotation, height = (0.6 * HEIGHT), id_base = "channel") {
        super(id, coords, rotation, height, this.SVG_DEFS, this.HEIGHT, id_base);
    }
}

_pj.set_properties(Channel, {"HEIGHT": 100, "SVG_DEFS": "\n        <linearGradient id=\"{ID_BASE}_fill\">\n          <stop offset=\"0%\"    stop-color=\"#57FAFF\"/>\n          <stop offset=\"13.5%\" stop-color=\"#45C8D2\"/>\n          <stop offset=\"30.4%\" stop-color=\"#328F9F\"/>\n          <stop offset=\"46.8%\" stop-color=\"#216175\"/>\n          <stop offset=\"62.4%\" stop-color=\"#153C54\"/>\n          <stop offset=\"76.8%\" stop-color=\"#0B223C\"/>\n          <stop offset=\"89.8%\" stop-color=\"#06132E\"/>\n          <stop offset=\"100%\"  stop-color=\"#040D29\"/>\n        </linearGradient>\n        <path id=\"{ID_BASE}_sub_element\" fill=\"url(#{ID_BASE}_fill)\"\n          d=\"M0,0 a10,10 0 0 1 20,0 v80 a10,10 0 0 1 -20,0 v-80 z\"/>\n        <g id=\"{ID_BASE}_element\" transform=\"translate(-10, -40)\">\n          <use opacity=\"0.85\" xlink:href=\"#{ID_BASE}_sub_element\" transform=\"translate(  0, -5)\"/>\n          <use opacity=\"0.85\" xlink:href=\"#{ID_BASE}_sub_element\" transform=\"translate( 15,  0)\" />\n          <use opacity=\"0.75\" xlink:href=\"#{ID_BASE}_sub_element\" transform=\"translate(-15,  0)\" />\n          <use opacity=\"0.60\" xlink:href=\"#{ID_BASE}_sub_element\" transform=\"translate( -1,  5)\" />\n        </g>", "WIDTH": 50});


//==============================================================================

class Exchanger_TO_FINISH extends _TransporterElement {
    constructor(id, coords, rotation, height = 40, id_base = "exchanger") {
        super(id, coords, rotation, height, "", height, id_base);
    }
}

//==============================================================================

export class PMRChannel extends _TransporterElement {
    constructor(id, coords, rotation, height = (0.6 * HEIGHT), id_base = "pmr_channel") {
        super(id, coords, rotation, height, this.SVG_DEFS, this.HEIGHT, id_base);
    }
}

_pj.set_properties(PMRChannel, {"HEIGHT": 80, "SVG_DEFS": "\n        <radialGradient id=\"{ID_BASE}_fill\">\n            <stop offset=\"0%\"     stop-color=\"#FBFAE2\"/>\n            <stop offset=\"12.03%\" stop-color=\"#FCFADD\"/>\n            <stop offset=\"26.62%\" stop-color=\"#FFF9CD\"/>\n            <stop offset=\"42.55%\" stop-color=\"#FCF6B4\"/>\n            <stop offset=\"59.43%\" stop-color=\"#FDEF90\"/>\n            <stop offset=\"77.06%\" stop-color=\"#FEE863\"/>\n            <stop offset=\"95.06%\" stop-color=\"#FEE12A\"/>\n            <stop offset=\"100%\"   stop-color=\"#FEDE12\"/>\n        </radialGradient>\n        <path id=\"{ID_BASE}_element\" fill=\"url(#{ID_BASE}_fill)\"  transform=\"scale(1.1) translate(-22, -25)\"\n            stroke=\"#010101\" stroke-width=\"2\" stroke-linejoin=\"miter\"\n            d=\"M0,0 c0,-25 15,-30 22,-12 c7,-18 22,-13 22,12 v50 c0,25 -15,30 -22,12 c-7,18 -22,13 -22,-12 v-50 z\"/>\n        <marker id=\"{ID_BASE}_arrow\" orient=\"auto\" style=\"overflow: visible\">\n            <path fill=\"010101\" transform=\"rotate(90) translate(0, 0) scale(0.5)\"\n                  d=\"M0,0l5,3.1l0.1-0.2l-3.3-8.2l-1.9-8.6l-1.9,8.6l-3.3,8.2l0.1,0.2l5-3.1z\"/>\n        </marker>\n        <g id=\"{ID_BASE}_in_element\">\n          <path stroke=\"#010101\" stroke-width=\"2\" d=\"M0,-65 v130\" marker-end=\"url(#{ID_BASE}_arrow)\"/>\n          <use xlink:href=\"#{ID_BASE}_element\"/>\n        </g>\n        <g id=\"{ID_BASE}_out_element\">\n          <use xlink:href=\"#{ID_BASE}_in_element\" transform=\"rotate(180)\"/>\n        </g>\n        <g id=\"{ID_BASE}_inout_element\">\n          <use xlink:href=\"#{ID_BASE}_in_element\"/>\n          <use xlink:href=\"#{ID_BASE}_in_element\" transform=\"rotate(180)\"/>\n        </g>", "WIDTH": 44});

//==============================================================================

export class PMRChannelIn extends PMRChannel {
    constructor(id, coords, rotation, height = (0.6 * PMRChannel.HEIGHT), id_base = "pmr_channel") {
        super(id, coords, rotation, height, id_base);
        this._id_base = (this._id_base + "_in");
    }
}

//==============================================================================

export class PMRChannelOut extends PMRChannel {
    constructor(id, coords, rotation, height = (0.6 * PMRChannel.HEIGHT), id_base = "pmr_channel") {
        super(id, coords, rotation, height, id_base);
        this._id_base = (this._id_base + "_out");
    }
}

//==============================================================================

export class PMRChannelInOut extends PMRChannel {
    constructor(id, coords, rotation, height = (0.6 * PMRChannel.HEIGHT), id_base = "pmr_channel") {
        super(id, coords, rotation, height, id_base);
        this._id_base = (this._id_base + "_inout");
    }
}

//==============================================================================

class _ArrowDefine {
    constructor(colour) {
        this._colour = colour;
    }

    __eq__(other) {
        return ((other instanceof Arrow) && (this.colour === other._colour));
    }

    __hash__() {
        return hash(this._colour);
    }

    svg(id) {
        return "\n            <marker id=\"{id}\" orient=\"auto\" style=\"overflow: visible\">\n                <path fill=\"{fill}\" transform=\"rotate(90) translate(0, 13) scale(0.5)\"\n                      d=\"M0,0l5,3.1l0.1-0.2l-3.3-8.2l-1.9-8.6l-1.9,8.6l-3.3,8.2l0.1,0.2l5-3.1z\"/>\n            </marker>".format({"id": id, "fill": this._colour});
    }
}

//==============================================================================

export class Arrow {
    static next_id() {
        this._next_id += 1;
        return "_ARROW_{}_".format(this._next_id);
    }

    static url(colour) {
        var a, id;
        a = _ArrowDefine(colour);
        id = this._arrows_to_id.get(a, null);
        if ((id === null)) {
            id = this.next_id();
            cls._arrows_to_id[a] = id;
            DefinesStore.add(id, a.svg(id));
        }
        return "url(#{})".format(id);
    }
}

_pj.set_properties(Arrow, {"_arrows_to_id": {}, "_next_id": 0});

//==============================================================================

export function svg_line(line, colour, reverse = false, display = "", style = "") {
    var dash, points;
    points = (reverse ? list(reversed(line.coords)) : line.coords);
    dash = ((style === "dashed") ? " stroke-dasharray=\"10,5\"" : "");
    return "<path fill=\"none\" stroke=\"{}\" stroke-width=\"{}\" {} {} marker-end=\"{}\" d=\"M{:g},{:g} {:s}\"/>".format(colour, LINE_WIDTH, display, dash, Arrow.url(colour), points[0][0], points[0][1], " ".join(function () {
        var _pj_a = [], _pj_b = points.slice(1);
        for (var _pj_c = 0, _pj_d = _pj_b.length; (_pj_c < _pj_d); _pj_c += 1) {
            var point = _pj_b[_pj_c];
            _pj_a.push("L{:g},{:g}".format(...point));
        }
        return _pj_a;
    }.call(this)));
}

//==============================================================================

export class Text {
    static next_id() {
        this._next_id += 1;
        return "_TEXT_{}_".format(this._next_id);
    }
    static typeset(s, x, y, rotation = 0) {
        var h, size, va, w;
        [svg, size] = mathjax.typeset(s, this.next_id());
        [w, h, va] = [(6 * Number.parseFloat(size[0].slice(0, (- 2)))), (6 * Number.parseFloat(size[1].slice(0, (- 2)))), (6 * Number.parseFloat(size[2].slice(0, (- 2))))];
        return "<g transform=\"translate({}, {}) scale(0.015)\">{}</g>".format((x - (w / 2)), ((y + (h / 2)) + va), svg);
    }
}

_pj.set_properties(Text, {"_next_id": 0});

//==============================================================================

/*

Exchanger
<g>
<radialGradient id="SVGID_133_" cx="501.8" cy="536.9" r="18.0223" gradientTransform="matrix(1 0 0 1 0 -342)" gradientUnits="userSpaceOnUse">
<stop offset="0" style="stop-color:#ECFFE3"/>
<stop offset="0.5566" style="stop-color:#EBFFEE"/>
<stop offset="0.9946" style="stop-color:#FF2EF1"/>
</radialGradient>
<circle class="st187" cx="501.8" cy="194.9" r="18"/>
<text transform="matrix(1 0 0 1 490.6613 200.0031)" class="st3 st4">NKE</text>
</g>

.st3{font-family:'ArialMT';}
.st4{font-size:12px;}
.st187{fill:url(#SVGID_133_);stroke:#EB2900;stroke-width:4;}




ATP and arrow
<g>
<g>
<path class="st0" d="M696.6,480c-41.1,5-42.4,27,0.1,32.6"/>
<g>
<path class="st1" d="M705.5,513.5c-4.3,1.1-9.7,3.2-13.2,5.7l3.2-6.7l-1.8-7.2C696.6,508.4,701.5,511.5,705.5,513.5z"/>
</g>
</g>
</g>
<text transform="matrix(1 0 0 1 699.1954 483.9253)" class="st2 st3 st4">[ATP]</text>

.st0{fill:none;stroke:#EB2D00;stroke-width:3;stroke-miterlimit:10;}
.st1{fill:#EB2D00;}
*/

//==============================================================================
