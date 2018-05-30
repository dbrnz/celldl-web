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

//import * as bg from './bondgraph.js';
//import * as dia from './diagram.js';

import * as exception from './exception.js';
import * as stylesheet from './stylesheet.js';

import {CellDiagram} from './cellDiagram.js';
import {List} from './utils.js';

//==============================================================================

export const ELEMENT_RADIUS = 15;

export const FLOW_OFFSET = {value: 60, unit: 'x'};

export const QUANTITY_OFFSET = {value: 60, unit: 'x'};
export const QUANTITY_WIDTH = 50;
export const QUANTITY_HEIGHT = 35;

export const TRANSPORTER_RADIUS = 25;
export const TRANSPORTER_EXTRA = {value: 25, unit: 'x'};
export const TRANSPORTER_WIDTH = {value: 10, unit: 'x'};

export const HORIZONTAL_RELATIONS = new List(['left', 'right']);
export const VERTICAL_RELATIONS = new List(['above', 'below']);
export const POSITION_RELATIONS = new List().extend(HORIZONTAL_RELATIONS).extend(VERTICAL_RELATIONS);

export const HORIZONTAL_BOUNDARIES = new List(['top', 'bottom']);
export const VERTICAL_BOUNDARIES = new List(['left', 'right']);
export const CORNER_BOUNDARIES = new List(['top-left', 'top-right', 'bottom-left', 'bottom-right']);
export const COMPARTMENT_BOUNDARIES = new List().extend(HORIZONTAL_BOUNDARIES).extend(VERTICAL_BOUNDARIES);

//==============================================================================

export class Offset {
    constructor(offset, unit) {
        this.offset = offset;
        this.unit = unit;
    }
}

//==============================================================================

export class Position
{
    constructor(element)
    {
        this.element = element;
        this.lengths = null;             // Position as a pair of Offsets
        this.relationships = [];
        this.coordinates = null;         // Resolved position in pixels
        this.dependencies = new Set();
    }

    get valid()
    //=========
    {
        return (this.dependencies.size > 0 || this.lengths !== null);
    }

    get hasCoordinates()
    //==================
    {
        return (this.coordinates !== null);
    }

    addDependency(dependency)
    //=======================
    {
        this.dependencies.add(dependency);
    }

    addDependencies(dependencies)
    //===========================
    {
        for (let dependency of dependencies) {
            this.dependencies.add(dependency);
        }
    }

    addRelationship(offset, relation, dependencies)
    //=============================================
    {
        this.relationships.push({offset, relation, dependencies});
    }

    setLengths(lengths)
    //=================
    {
        this.lengths = lengths;
    }

    static centroid(dependencies)
    //===========================
    {
        let coordinates = [0.0, 0.0];
        for (let dependency of dependencies) {
            if (!dependency.hasCoordinates) {
                throw new exception.ReferenceError(`No coordinates for the '${dependency}' element`);
            }
            coordinates[0] += dependency.coordinates[0];
            coordinates[1] += dependency.coordinates[1];
        }
        coordinates[0] /= dependencies.length;
        coordinates[1] /= dependencies.length;
        return coordinates;
    }

    parseComponent(tokens, previousDirn, defaultOffset, defaultDependency)
    //====================================================================
    {
        let offset = null;
        let usingDefaultOffset = false;
        let reln = null;
        let dependencies = new List();
        let state = 0;
        for (let token of tokens.value) {
            switch (state) {
              case 0:
                if (token.type !== 'ID') {
                    offset = stylesheet.parseOffset(token, defaultOffset);
                    state = 1;
                    break;
                } else {
                    offset = defaultOffset;
                    usingDefaultOffset = true;
                    // Fall through to parse relationship
                }
              case 1:
                if (token.type !== "ID" || !POSITION_RELATIONS.contains(token.value.toLowerCase())) {
                    throw new exception.StyleError(tokens, "Unknown relationship for position");
                }
                reln = token.value.toLowerCase();
                state = 2;
                break;
              case 2:
                if (token.type === 'HASH') {
                    const dependency = CellDiagram.instance().findElement(token.value);
                    if (dependency === null) {
                        throw new exception.StyleError(tokens, `Unknown element ${token.value}`);
                    }
                    dependencies.append(dependency);
                } else {
                    throw new exception.StyleError(tokens, "Element ID expected");
                }
            }
        }
        if (state === 2 && dependencies.length === 0) {
            if (defaultDependency !== null) {
                dependencies.append(defaultDependency);
            } else {
                throw new exception.StyleError(tokens, "Element IDs expected");
            }
        }

        let constraints = 0;
        if (previousDirn !== null) {
            constraints += 1;
            if (previousDirn === 'H' && HORIZONTAL_RELATIONS.contains(reln)
             || previousDirn === 'V' && VERTICAL_RELATIONS.contains(reln)) {
                throw new exception.StyleError(tokens, "Constraints must have different directions");
            }
        }
        if (usingDefaultOffset && constraints >= 1) {
            offset = null;
        }

        this.addRelationship(offset, reln, dependencies);
        this.addDependencies(dependencies);

        return HORIZONTAL_RELATIONS.contains(reln) ? 'H' : 'V';
    }

    parse(tokens, defaultOffset=null, defaultDependency=null)
    //=======================================================
    {
        /*
        * Position as coords: absolute or % of container -- `(100, 300)` or `(10%, 30%)`
        * Position as offset: relation with absolute offset from element(s) -- `300 above #q1 #q2`
        */

        if (tokens instanceof Array) {
            if (tokens.length === 2) {
                if (['ID', 'SEQUENCE'].indexOf(tokens[0].type) < 0) {
                    this.setLengths(stylesheet.parseOffsetPair(tokens));
                } else {
                    const dirn = this.parseComponent(tokens[0], null);
                    this.parseComponent(tokens[1], dirn, defaultOffset, defaultDependency);
                }
            } else {
                throw new exception.StyleError(tokens, "Position can't have more than two components")
            }
        } else {
            this.parseComponent(tokens, null, defaultOffset, defaultDependency);
        }
    }

    static getCoordinates(unitConverter, offset, reln, dependencies)
    //==============================================================
    {
        /*
        :return: tuple(tuple(x, y), index) where index == 0 means
        horizontal and 1 means vertical.
        */
        let coordinates = Position.centroid(dependencies);
        let index = Position.orientation[reln];
        if (index >= 0) {
            let adjust = unitConverter.toPixels(offset, index, false);
            if (["left", "above"].indexOf(reln) >= 0) {
                coordinates[index] -= adjust;
            } else {
                coordinates[index] += adjust;
            }
        }
        return [coordinates, index];
    }

    assignCoordinates(unitConverter)
    //==============================
    {
        if (this.lengths !== null) {
            this.coordinates = unitConverter.toPixelPair(this.lengths);

        } else if (this.coordinates === null || this.coordinates.indexOf(null) >= 0) {
            this.coordinates = [0, 0];
            if (this.relationships.length === 1) {
                const offset = this.relationships[0].offset;
                const reln = this.relationships[0].relation;
                const dependencies = this.relationships[0].dependencies;
                this.coordinates = Position.getCoordinates(unitConverter, offset, reln, dependencies)[0];
            } else {
                for (let relationship of this.relationships) {
                    const offset = relationship.offset;
                    const reln = relationship.relation;
                    const dependencies = relationship.dependencies;
                    [coordinates, index] = Position.getCoordinates(unitConverter, offset, reln, dependencies);
                    if (offset === null) {
                        index -= 1;
                    }
                    this.coordinates[index] = coordinates[index];
                }
            }
        }
    }
}

Position.orientation = {centre: -1, center: -1, left: 0, right: 0, above: 1, below: 1};

//==============================================================================

export class Size
{
    constructor(tokens)
    {
        this.size = []
        if (tokens instanceof Array && tokens.length == 2) {
            for (let token of tokens) {
                this.size.push(stylesheet.parseOffset(token));
            }
        } else {
            throw new exception.StyleError(tokens, "Pair of lengths expected");
        }
    }
}

//==============================================================================

export class Line
{
    constructor(element, tokens)
    {
        this.element = element;
        this.tokens = tokens;
        this.segments = [];
    }

    parse()
    //=====
    {
        /*
        <line-point> ::= <coord-pair> | <line-angle> <constraint>
        <coord-pair> ::= '(' <length> ',' <length> ')'
        <constraint> ::= ('until-x' | 'until-y') <relative-point>
        <relative-point> ::= <id-list> | [ <offset> <reln> ] <id-list>
        */

        // TODO

        var angle, constraint, dependencies, dependency, length, line_offset, offset, reln, token;
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
                dependency = CellDiagram.instance().findElement(token.value);
                if ((dependency === null)) {
                    throw new Error(`Unknown element ${token.value}`);
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

    points(start_pos, flow=null, reverse=false)
    //=========================================
    {
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

export class UnitConverter
{
    constructor(globalSize, localSize, localOffset=[0, 0])
    {
        /*
        :param globalSize: tuple(width, height) of diagram, in pixels
        :param localSize: tuple(width, height) of current container, in pixels
        :param localOffset: tuple(x_pos, y_pos) of current container, in pixels
        */
        this.globalSize = globalSize;
        this.localSize = localSize;
        this.localOffset = localOffset;
    }

    toString()
    //========
    {
        return "UC: global=${this.globalSize}, local=${this.localSize}, offset=${this.localOffset}";
    }

    toPixels(length, index, addOffset=true)
    //=====================================
    {
        if (length !== null) {
            const unit = length.unit;
            if (unit.indexOf('x') >= 0) {
                index = 0;
            } else if (unit.indexOf('y') >= 0) {
                index = 1;
            }
            if (unit.startsWith("%")) {
                const offset = length.offset*this.localSize[index]/ 100.0;
                return (addOffset ? this.localOffset[index] : 0) + offset;
            } else {
                return length.offset*this.globalSize[index]/1000.0;
            }
        }
        return 0;
    }

    toPixelPair(coords, addOffset=true)
    //=================================
    {
        return [this.toPixels(coords[0], 0, addOffset), this.toPixels(coords[1], 1, addOffset)];
    }
}

//==============================================================================
