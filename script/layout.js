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
    container["set_properties"] = set_properties;
    return container;
}
_pj = {};
_pj_snippets(_pj);

//==============================================================================

export const ELEMENT_RADIUS = 15;

export const FLOW_OFFSET = {value: 60, unit: 'x'};

export const QUANTITY_OFFSET = {value: 60, unit: 'x'};
export const QUANTITY_WIDTH = 50;
export const QUANTITY_HEIGHT = 35;

export const TRANSPORTER_RADIUS = 25;
export const TRANSPORTER_EXTRA = {value: 25, unit: 'x'};
export const TRANSPORTER_WIDTH = {value: 10, unit: 'x'};

export const HORIZONTAL_RELATIONS = ['left', 'right'];
export const VERTICAL_RELATIONS = ['above', 'below'];
export const POSITION_RELATIONS = (HORIZONTAL_RELATIONS + VERTICAL_RELATIONS);

export const HORIZONTAL_BOUNDARIES = ['top', 'bottom'];
export const VERTICAL_BOUNDARIES = ['left', 'right'];
export const CORNER_BOUNDARIES = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
export const COMPARTMENT_BOUNDARIES = (HORIZONTAL_BOUNDARIES + VERTICAL_BOUNDARIES);

//==============================================================================

export class Offset {
    constructor(offset, unit) {
        this.offset = offset;
        this.unit = unit;
    }
}

//==============================================================================

export class Coords {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}

//==============================================================================

export class Position {
    constructor(element) {
        this.element = element;
        this.lengths = null;             // Relative position as a pair of Lengths
        this.relationships = [];
        this.pixelCoords = null;              // Resolved position in pixels
        this.dependencies = new Set();

// lengths v's coords??
        // dependencies are Elements, so assign each elememt a unique `id`
        // (index into global array/list of elements)
    }

    bool() {
        return (this.dependencies.length > 0 || this.lengths !== null);
    }

    get hasCoords() {
        return (this.coords !== null);
    }

    get resolved() {
        return (this.coords !== null && this.coords.indexOf(null) < 0);
    }

    addDependency(dependency) {
        this.dependencies.add(dependency);
    }

    addDependencies(dependencies) {
        for (let dependency of dependencies) {
            this.dependencies.add(dependency);
        }
    }

    addRelationship(offset, relation, dependencies) {
        this.relationships.push({offset, relation, dependencies});
    }

    setPixelCoords(pixelCoords) {
        this.pixelCoords = pixelCoords;
    }

    setLengths(lengths) {
        this.lengths = lengths;
    }

    static centroid(dependencies) {
        let pixelCoords = [0.0, 0.0];
        for (let dependency of dependencies) {
            if (!dependency.position.resolved) {
                throw new ValueError("No position for '${dependency}' element");
            }
            pixelCoords[0] += dependency.position.pixelCoords[0];
            pixelCoords[1] += dependency.position.pixelCoords[1];
        }
        pixelCoords[0] /= dependencies.length;
        pixelCoords[1] /= dependencies.length;
        return pixelCoords;
    }

    parse(tokens, defaultOffset, defaultDependency) {
        /*
        * Position as coords: absolute or % of container -- `(100, 300)` or `(10%, 30%)`
        * Position as offset: relation with absolute offset from element(s) -- `300 above #q1 #q2`
        */

/* TODO
            "value": [
              {
                "type": "SEQUENCE",
                "value": [
                  {
                    "type": "PERCENTAGE",
                    "value": 10,
                    "unit": "%x"
                  },
                  {
                    "type": "ID",
                    "value": "left"
                  },
                  {
                    "type": "HASH",
                    "value": "#w"
                  }
                ]
              },
              {
                "type": "DIMENSION",
                "value": 2,
                "unit": "x"
              }
            ]
*/
        let elementDependencies = [];
        let token = tokens.peek();
        if ((token.type === "() block")) {
            tokens.next();
            const lengths = parser.getCoordinates(new parser.StyleTokensIterator(token.content));
            this.setLengths(lengths);
        } else {
            let seenHorizontal = false;
            let seenVertical = false;
            let constraints = 0;
            while ((token !== null)) {
                let usingDefault = (["number", "dimension", "percentage"].indexOf(token.type) < 0);
                let offset = parser.get_length(tokens, {"default": defaultOffset});

                token = tokens.next();
                if (token.type !== "ident" || POSITION_RELATIONS.indexOf(token.toLowerCase) < 0) {
                    throw new SyntaxError("Unknown relationship for position.");
                }
                const reln = token.lower_value;
                let dependencies = [];
                token = tokens.peek();
                if ((_pj.in_es6(token, [null, ","]) && (defaultDependency !== null))) {
                    dependencies.append(defaultDependency);
                } else {
                    if ((((token !== null) && (token.type !== "hash")) && (token !== ","))) {
                        throw new SyntaxError("Identifier(s) expected");
                    } else {
                        if ((token !== null)) {
                            tokens.next();
                            while (((token !== null) && (token.type === "hash"))) {
                                const dependency = this._element.diagram.findElement(("#" + token.value));
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
                    if ((seenHorizontal && HORIZONTAL_RELATIONS.indexOf(reln) >= 0)
                     || (seenVertical && VERTICAL_RELATIONS.indexOf(reln) >= 0)) {
                        throw new SyntaxError("Constraints must have different directions.");
                    }
                }
                if ((using_default && (constraints >= 1))) {
                    offset = null;
                }
                this.addRelationship(offset, reln, dependencies);
                elementDependencies.extend(dependencies);
                seenHorizontal = (HORIZONTAL_RELATIONS.indexOf(reln) >= 0);
                seenVertical = (VERTICAL_RELATIONS.indexOf(reln) >= 0);

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
        this.addDependencies(elementDependencies);
    }

    static resolvePoint(unitConverter, offset, reln, dependencies) {
        /*
        :return: tuple(tuple(x, y), index) where index == 0 means
        horizontal and 1 means vertical.
        */
        let pixelCoords = Position.centroid(dependencies);
        let index = Position.orientation[reln];
        if (index >= 0) {
            let adjust = unitConverter.toPixels(offset, index, false);
            if (["left", "above"].indexOf(reln) >= 0) {
                pixelCoords[index] -= adjust;
            } else {
                pixelCoords[index] += adjust;
            }
        }
        return [pixelCoords, index];
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

        const unitConverter = this.element.container.unitConverter;

        if (this.lengths) {
            this.pixelCoords = unitConverter.pixelPair(this.lengths);

        } else {
            if (((this.coords === null) && this.relationships)) {

                this.coords = [0, 0];

                if ((this.relationships.length === 1)) {
                    const offset = this.relationships[0][0];
                    const reln = this.relationships[0][1];
                    const dependencies = this.relationships[0][2];

                    if ((this.element instanceof dia.Transporter)) {
                        if (["bottom", "right"].indexOf(reln) >= 0) {
                            const dirn = (["top", "bottom"].indexOf(reln) >= 0) ? "below" : "right";
                            [coords, orientation] = Position.resolvePoint(unitConverter, [100, "%"], dirn, [this._element.container]);
                            this.coords[orientation] = coords[orientation];
                        }
                        const dirn = (["top", "bottom"].indexOf(reln) >= 0) ? "right" : "below";
                        [coords, orientation] = Position.resolvePoint(unitConverter, offset, dirn, [this.element.container]);
                        if (["bottom", "right"].indexOf(reln) >= 0) {
                            this.coords[orientation] = coords[orientation];
                        } else {
                            this.coords = coords;
                        }


                    } else {
                        this.pixelCoords = Position.resolvePoint(unitConverter, offset, reln, dependencies)[0];
                    }
                } else {
                    for (let relationship of this.relationships) {
                        const offset = relationship[0];
                        const reln = relationship[1];
                        const dependencies = relationship[2];

                        if ((this.element instanceof dia.Transporter)) {
                            // pass
                        } else {
                            [pixelCoords, index] = Position.resolvePoint(unitConverter, offset, reln, dependencies);
                            if (offset === null) {
                                index -= 1;
                            }
                            this.pixelCoords[index] = pixelCoords[index];
                        }
                    }
                }
            }
        }
    }
}

Position.prototype.orientation = {centre: -1, center: -1, left: 0, right: 0, above: 1, below: 1};

//==============================================================================

export class Size {
    constructor(tokens) {
        this.size = []
        if (tokens instanceof Array && tokens.length == 2) {
            for (let token of tokens) {
                this.size.push(parser.parseOffset(token));
            }
        } else {
            throw new SyntaxError("Pair of lengths expected.");
        }
    }
}

//==============================================================================

export class Line {
    constructor(element, tokens) {
        this.element = element;
        this.tokens = tokens;
        this.segments = [];
    }

    parse() {
        /*
        <line-point> ::= <coord-pair> | <line-angle> <constraint>
        <coord-pair> ::= '(' <length> ',' <length> ')'
        <constraint> ::= ('until-x' | 'until-y') <relative-point>
        <relative-point> ::= <id-list> | [ <offset> <reln> ] <id-list>

        */
        var angle, constraint, dependencies, dependency, length, line_offset, offset, reln, token, tokens;
        if (this.tokens === null) {
            return;
        }
        this.segments = [];
        const tokens = this.tokens;
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
                offset = parser.get_coordinates(new parser.StyleTokensIterator(token.content), {"allow_local": false});
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
                    line_offset = parser.get_coordinates(new parser.StyleTokensIterator(token.content), {"allow_local": false});
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
    constructor(globalSize, localSize, localOffset = [0, 0]) {
        /*
        :param globalSize: tuple(width, height) of diagram, in pixels
        :param localSize: tuple(width, height) of current container, in pixels
        :param localOffset: tuple(x_pos, y_pos) of current container, in pixels
        */
        this.globalSize = globalSize;
        this.localSize = localSize;
        this.localOffset = localOffset;
    }

    toString() {
        return "UC: global=${this.globalSize}, local=${this.localSize}, offset=${this.localOffset}";
    }

    toPixels(length, index, addOffset = true) {
        if (length !== null) {
            const unit = length.unit;
            if (unit.indexOf('x') >= 0) {
                index = 0;
            } else if (unit.indexOf('y') >= 0) {
                index = 1;
            }
            if (unit.startswith("%")) {
                const offset = ((length[0] * this.localSize[index]) / 100.0);
                return ((addOffset ? this.localOffset[index] : 0) + offset);
            } else {
                return ((length[0] * this.globalSize[index]) / 1000.0);
            }
        }
        return 0;
    }

    toPixelPair(coords, addOffset = true) {
        return [this.toPixels(coords[0], 0, addOffset), this.toPixels(coords[1], 1, addOffset)];
    }
}

//==============================================================================
