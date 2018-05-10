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
import * as math from 'math';
*/

//==============================================================================

import * as bg from './bondgraph.js';
import * as dia from './diagram.js';
import * as parser from './parser.js';

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

const QUANTITY_OFFSET = [60, "x"];
const FLOW_OFFSET = [60, "x"];
const TRANSPORTER_EXTRA = [25, "x"];
const ELEMENT_RADIUS = 15;
const TRANSPORTER_RADIUS = 25;
const QUANTITY_WIDTH = 50;
const QUANTITY_HEIGHT = 35;
const HORIZONTAL_RELATIONS = ["left", "right"];
const VERTICAL_RELATIONS = ["above", "below"];
const POSITION_RELATIONS = (HORIZONTAL_RELATIONS + VERTICAL_RELATIONS);
const HORIZONTAL_BOUNDARIES = ["top", "bottom"];
const VERTICAL_BOUNDARIES = ["left", "right"];
const CORNER_BOUNDARIES = ["top-left", "top-right", "bottom-left", "bottom-right"];
const COMPARTMENT_BOUNDARIES = (HORIZONTAL_BOUNDARIES + VERTICAL_BOUNDARIES);

//==============================================================================

export class Point {
    constructor(x = 0.0, y = 0.0) {
        this._coords = [x, y];
    }

    get x() {
        return this._coords[0];
    }

    get y() {
        return this._coords[1];
    }

    toString() {
        return "<Point ({:g}, {:g})>".format(...this._coords);
    }

    get length() {
        return 2;
    }

    __add__(other) {
        return new Point((this.x + other.x), (this.y + other.y));
    }

    __sub__(other) {
        return new Point((this.x - other.x), (this.y - other.y));
    }

    __mul__(other) {
        return new Point((other * this.x), (other * this.y));
    }

    __rmul__(other) {
        return new Point((other * this.x), (other * this.y));
    }

    __truediv__(other) {
        return new Point((this.x / other), (this.y / other));
    }

    __itruediv__(other) {
        return new Point((this.x / other), (this.y / other));
    }

    __getitem__(key) {
        return this._coords[key];
    }

    __setitem__(key, value) {
        this._coords[key] = value;
    }

    copy() {
        return new Point(this.x, this.y);
    }
}

//==============================================================================

export class Position {
    constructor(element) {
        this.element = element;
        this.lengths = null;
        this.relationships = [];
        this.coords = null;
        this.dependencies = new Set();
    }

    __bool__() {
        return (bool(this.dependencies) || bool(this.lengths));
    }

    get hasCoords() {
        return (this.coords !== null);
    }

    get resolved() {
        return ((this.coords !== null) && (! _pj.in_es6(null, this._coords)));
    }

    add_dependencies(dependencies) {
        this._dependencies.update(dependencies);
    }

    addDependency(dependency) {
        this.dependencies.add(dependency);
    }

    addRelationship(offset, relation, dependencies) {
        this.relationships.push({offset, relation, dependencies});
    }

    setCoords(coords) {
        this.coords = coords;
    }

    setLengths(lengths) {
        this.lengths = lengths;
    }

    centroid(dependencies) {
        var coords;
        coords = new Point();
        for (var dependency, _pj_c = 0, _pj_a = dependencies, _pj_b = _pj_a.length; (_pj_c < _pj_b); _pj_c += 1) {
            dependency = _pj_a[_pj_c];
            if ((! dependency.position.resolved)) {
                throw new ValueError("No position for '{}' element".format(dependency));
            }
            coords += dependency.position.coords;
        }
        coords /= dependencies.length;
        return coords;
    }

    parse(tokens, default_offset, default_dependency) {
        /*
        * Position as coords: absolute or % of container -- `(100, 300)` or `(10%, 30%)`
        * Position as offset: relation with absolute offset from element(s) -- `300 above #q1 #q2`
        */
        var constraints, dependencies, dependency, element_dependencies, lengths, offset, reln, seen_horizontal, seen_vertical, token, using_default;
        element_dependencies = [];
        token = tokens.peek();
        if ((token.type === "() block")) {
            tokens.next();
            lengths = parser.get_coordinates(new parser.StyleTokens(token.content));
            this.set_lengths(lengths);
        } else {
            seen_horizontal = false;
            seen_vertical = false;
            constraints = 0;
            while ((token !== null)) {
                using_default = (! _pj.in_es6(token.type, ["number", "dimension", "percentage"]));
                offset = parser.get_length(tokens, {"default": default_offset});
                token = tokens.next();

                if (token.type !== "ident" || POSITION_RELATIONS.indexOf(token.toLowerCase) < 0) {
                    throw new SyntaxError("Unknown relationship for position.");
                }
                reln = token.lower_value;
                dependencies = [];
                token = tokens.peek();
                if ((_pj.in_es6(token, [null, ","]) && (default_dependency !== null))) {
                    dependencies.append(default_dependency);
                } else {
                    if ((((token !== null) && (token.type !== "hash")) && (token !== ","))) {
                        throw new SyntaxError("Identifier(s) expected");
                    } else {
                        if ((token !== null)) {
                            tokens.next();
                            while (((token !== null) && (token.type === "hash"))) {
                                dependency = this._element.diagram.find_element(("#" + token.value));
                                if ((dependency === null)) {
                                    throw new KeyError("Unknown element '#{}".format(token.value));
                                }
                                dependencies.append(dependency);
                                token = tokens.next();
                            }
                        }
                    }
                }
                if ((token === ",")) {
                    constraints += 1;
                    if (((seen_horizontal && _pj.in_es6(reln, HORIZONTAL_RELATIONS)) || (seen_vertical && _pj.in_es6(reln, VERTICAL_RELATIONS)))) {
                        throw new SyntaxError("Constraints must have different directions.");
                    }
                }
                if ((using_default && (constraints >= 1))) {
                    offset = null;
                }
                this.add_relationship(offset, reln, dependencies);
                element_dependencies.extend(dependencies);
                seen_horizontal = _pj.in_es6(reln, HORIZONTAL_RELATIONS);
                seen_vertical = _pj.in_es6(reln, VERTICAL_RELATIONS);
                if ((token === ",")) {
                    token = tokens.peek();
                    continue;
                } else {
                    if ((tokens.peek() === null)) {
                        break;
                    } else {
                        throw new SyntaxError("Invalid syntax");
                    }
                }
            }
        }
        this.add_dependencies(element_dependencies);
    }

    _resolve_point(unit_converter, offset, reln, dependencies) {
        /*
        :return: tuple(tuple(x, y), index) where index == 0 means
        horizontal and 1 means vertical.
        */
        var adjust, coords, index;
        coords = this.centroid(dependencies);
        index = Position._orientation[reln];
        if ((index >= 0)) {
            adjust = unit_converter.pixels(offset, index, false);
            if (_pj.in_es6(reln, ["left", "above"])) {
                coords[index] -= adjust;
            } else {
                coords[index] += adjust;
            }
        }
        return [coords, index];
    }

    resolve() {
        /*
        # Transporters are always on a compartment boundary
        pos="100 top"    ## x = x(compartment) + 100; y = y(compartment)
        pos="bottom"     ## y = y(compartment) + height(compartment)

        pos="100 top"    ## same as pos="100 right #compartment"
        pos="100 bottom" ## same as pos="100 right #compartment; 1000 below #compartment"

        pos="top; 10 right #t1"    ## same as pos="0 below #compartment; 10 right #t1"
        pos="right; 10 below #t2"  ## same as pos="1000 right #compartment; 10 below #t2"

        pos="top; 10 above/below #t1"  ## ERROR: multiple `y` constraints
        pos="left; 10 left/right #t1"  ## ERROR: multiple `y` constraints
        pos="10 right; 10 below #t2"   ## ERROR: multiple `y` constraints
        pos="5 left #t1; 100 bottom"   ## ERROR: multiple `x` constraints

        # FUTURE: Autopositioning
        pos="top"  # default is top  }
        pos="top"  #                 } Centered in top, spaced evenly (`transporter-spacing`?)
        pos="top"  #                 }
        */
        var _, coords, dependencies, dirn, index, offset, orientation, reln, unit_converter;
        unit_converter = this._element.container.unit_converter;
        if (this._lengths) {
            this._coords = unit_converter.pixel_pair(this._lengths);
        } else {
            if (((this._coords === null) && this._relationships)) {
                this._coords = new Point();
                if ((this._relationships.length === 1)) {
                    offset = this._relationships[0][0];
                    reln = this._relationships[0][1];
                    dependencies = this._relationships[0][2];
                    if ((this._element instanceof dia.Transporter)) {
                        if (_pj.in_es6(reln, ["bottom", "right"])) {
                            dirn = (_pj.in_es6(reln, ["top", "bottom"]) ? "below" : "right");
                            [coords, orientation] = this._resolve_point(unit_converter, [100, "%"], dirn, [this._element.container]);
                            this._coords[orientation] = coords[orientation];
                        }
                        dirn = (_pj.in_es6(reln, ["top", "bottom"]) ? "right" : "below");
                        [coords, orientation] = this._resolve_point(unit_converter, offset, dirn, [this._element.container]);
                        if (_pj.in_es6(reln, ["bottom", "right"])) {
                            this._coords[orientation] = coords[orientation];
                        } else {
                            this._coords = coords;
                        }
                    } else {
                        [this._coords, _] = this._resolve_point(unit_converter, offset, reln, dependencies);
                    }
                } else {
                    for (var relationship, _pj_c = 0, _pj_a = this._relationships, _pj_b = _pj_a.length; (_pj_c < _pj_b); _pj_c += 1) {
                        relationship = _pj_a[_pj_c];
                        offset = relationship[0];
                        reln = relationship[1];
                        dependencies = relationship[2];
                        if ((this._element instanceof dia.Transporter)) {
                        } else {
                            [coords, index] = this._resolve_point(unit_converter, offset, reln, dependencies);
                            if ((offset === null)) {
                                index = (index - 1);
                            }
                            this._coords[index] = coords[index];
                        }
                    }
                }
            }
        }
    }
}

_pj.set_properties(Position, {"_orientation": {"centre": (- 1), "center": (- 1), "left": 0, "right": 0, "above": 1, "below": 1}});

//==============================================================================

export class Size {
    constructor(tokens) {
        this._lengths = null;
        for (var token, _pj_c = 0, _pj_a = new parser.StyleTokens(tokens), _pj_b = _pj_a.length; (_pj_c < _pj_b); _pj_c += 1) {
            token = _pj_a[_pj_c];
            if ((token.type === "() block")) {
                this._lengths = parser.get_coordinates(new parser.StyleTokens(token.content));
            } else {
                throw new SyntaxError("Parenthesised pair of lengths expected.");
            }
        }
    }

    get lengths() {
        return this._lengths;
    }
}

//==============================================================================

export class Line {
    constructor(element, tokens) {
        this._element = element;
        this._tokens = tokens;
        this._segments = [];
    }

    parse() {
        /*
        <line-point> ::= <coord-pair> | <line-angle> <constraint>
        <coord-pair> ::= '(' <length> ',' <length> ')'
        <constraint> ::= ('until-x' | 'until-y') <relative-point>
        <relative-point> ::= <id-list> | [ <offset> <reln> ] <id-list>

        */
        var angle, constraint, dependencies, dependency, length, line_offset, offset, reln, token, tokens;
        if ((this._tokens === null)) {
            return;
        }
        this._segments = [];
        tokens = this._tokens;
        token = tokens.peek();
        while ((token !== null)) {
            angle = ((token.type === "number") ? parser.get_number(tokens) : null);
            token = tokens.next();
            if ((((token === null) || (token.type !== "ident")) || (! _pj.in_es6(token.lower_value, ["until", "until-x", "until-y"])))) {
                throw new SyntaxError("Unknown constraint for curve segment.");
            }
            if (((angle === null) && _pj.in_es6(token.lower_value, ["until-x", "until-y"]))) {
                throw new SyntaxError("Angle expected.");
            } else {
                if (((angle !== null) && (token.lower_value === "until"))) {
                    throw new SyntaxError("Unexpected angle.");
                }
            }
            constraint = ((token.lower_value === "until-x") ? (- 1) : ((token.lower_value === "until-y") ? 1 : 0));
            token = tokens.peek();
            if ((token.type === "() block")) {
                offset = parser.get_coordinates(new parser.StyleTokens(token.content), {"allow_local": false});
                token = tokens.next();
                if (((token.type !== "ident") || (token.lower_value !== "from"))) {
                    throw new SyntaxError("'from' expected.");
                }
                token = tokens.next();
            } else {
                if (_pj.in_es6(token.type, ["number", "dimension"])) {
                    length = parser.get_length(tokens);
                    token = tokens.next();
                    if (((token.type !== "ident") || (! _pj.in_es6(token.lower_value, POSITION_RELATIONS)))) {
                        throw new SyntaxError("Unknown relationship for offset.");
                    }
                    reln = token.lower_value;
                    if (_pj.in_es6(reln, HORIZONTAL_RELATIONS)) {
                        offset = [[((reln === "right") ? length[0] : (- length[0])), length[1]], [0, ""]];
                    } else {
                        offset = [[0, ""], [((reln === "right") ? length[0] : (- length[0])), length[1]]];
                    }
                    token = tokens.next();
                } else {
                    offset = [[0, ""], [0, ""]];
                }
            }
            dependencies = [];
            while (((token !== null) && (token.type === "hash"))) {
                dependency = this._element.diagram.find_element(("#" + token.value));
                if ((dependency === null)) {
                    throw new KeyError("Unknown element '#{}".format(token.value));
                }
                dependencies.append(dependency);
                token = tokens.next();
            }
            if ((! dependencies)) {
                throw new SyntaxError("Identifier(s) expected.");
            }
            if ((((token !== null) && (token.type === "ident")) && (token.lower_value === "offset"))) {
                token = tokens.next();
                if ((token.type === "() block")) {
                    line_offset = parser.get_coordinates(new parser.StyleTokens(token.content), {"allow_local": false});
                    token = tokens.peek();
                } else {
                    throw new SyntaxError("Offset expected.");
                }
            } else {
                line_offset = null;
            }
            this._segments.append([angle, constraint, offset, dependencies, line_offset]);
            if ((! _pj.in_es6(token, [null, ","]))) {
                throw new SyntaxError("Invalid syntax");
            }
            token = tokens.peek();
        }
    }

    points(start_pos, flow = null, reverse = false) {
        var angle, dx, dy, end_pos, last_pos, line_offset, offset, points, trans_coords;
        last_pos = start_pos;
        points = [start_pos];
        for (var segment, _pj_c = 0, _pj_a = this._segments, _pj_b = _pj_a.length; (_pj_c < _pj_b); _pj_c += 1) {
            segment = _pj_a[_pj_c];
            angle = segment[0];
            offset = this._element.diagram.unit_converter.pixel_pair(segment[2], {"add_offset": false});
            end_pos = (offset + Position.centroid(segment[3]));
            if ((segment[1] === (- 1))) {
                dx = (end_pos[0] - last_pos[0]);
                dy = (dx * math.tan(((angle * math.pi) / 180)));
                end_pos[1] = (last_pos[1] - dy);
            } else {
                if ((segment[1] === 1)) {
                    dy = (last_pos[1] - end_pos[1]);
                    dx = (dy * math.tan((((90 - angle) * math.pi) / 180)));
                    end_pos[0] = (last_pos[0] + dx);
                }
            }
            if ((segment[4] !== null)) {
                line_offset = this._element.diagram.unit_converter.pixel_pair(segment[4], {"add_offset": false});
                points.slice((- 1))[0] += line_offset;
                end_pos += line_offset;
            }
            points.append(end_pos);
            last_pos = end_pos;
        }
        if ((flow.transporter !== null)) {
            trans_coords = flow.transporter.coords;
            if (((trans_coords[0] === points.slice((- 1))[0][0]) || (trans_coords[1] === points.slice((- 1))[0][1]))) {
                points.slice((- 1))[0] += flow.component_offset(this._element);
            }
        }
        return ((! reverse) ? points : list(reversed(points)));
    }
}

//==============================================================================

export class UnitConverter {
    constructor(global_size, local_size, local_offset = [0, 0]) {
        /*
        :param global_size: tuple(width, height) of diagram, in pixels
        :param local_size: tuple(width, height) of current container, in pixels
        :param local_offset: tuple(x_pos, y_pos) of current container, in pixels
        */
        this._global_size = global_size;
        this._local_size = local_size;
        this._local_offset = local_offset;
    }

    toString() {
        return "UC: global={}, local={}, offset={}".format(this._global_size, this._local_size, this._local_offset);
    }

    pixels(length, index, add_offset = true) {
        var offset, units;
        if ((length !== null)) {
            units = length[1];
            if (_pj.in_es6("x", units)) {
                index = 0;
            } else {
                if (_pj.in_es6("y", units)) {
                    index = 1;
                }
            }
            if (units.startswith("%")) {
                offset = ((length[0] * this._local_size[index]) / 100.0);
                return ((add_offset ? this._local_offset[index] : 0) + offset);
            } else {
                return ((length[0] * this._global_size[index]) / 1000.0);
            }
        }
        return 0;
    }

    pixel_pair(coords, add_offset = true) {
        return new Point(this.pixels(coords[0], 0, add_offset), this.pixels(coords[1], 1, add_offset));
    }
}

//==============================================================================
