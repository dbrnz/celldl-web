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
import * as geo from './geometry.js';
import * as stylesheet from './stylesheet.js';
import * as utils from './utils.js';

import {List} from './utils.js';

//==============================================================================

export class Length {
    constructor(length=0, unit='') {
        this.length = length;
        this.unit = unit;
    }
}

//==============================================================================

export const ELEMENT_RADIUS = 15;

export const STROKE_WIDTH = new Length(2.5, 'px');

export const FLOW_OFFSET = {value: 60, unit: 'vw'};

export const QUANTITY_OFFSET = {value: 60, unit: 'vw'};
export const QUANTITY_WIDTH = 50;
export const QUANTITY_HEIGHT = 33;

export const TRANSPORTER_RADIUS = 20;
export const TRANSPORTER_EXTRA = {value: 25, unit: 'vw'};
export const TRANSPORTER_WIDTH = {value: 10, unit: 'vw'};

export const HORIZONTAL_RELATIONS = new List(['left', 'right']);
export const VERTICAL_RELATIONS = new List(['above', 'below']);
export const POSITION_RELATIONS = new List().extend(HORIZONTAL_RELATIONS).extend(VERTICAL_RELATIONS);

export const HORIZONTAL_BOUNDARIES = new List(['top', 'bottom']);
export const VERTICAL_BOUNDARIES = new List(['left', 'right']);
export const CORNER_BOUNDARIES = new List(['top-left', 'top-right', 'bottom-left', 'bottom-right']);
export const COMPARTMENT_BOUNDARIES = new List().extend(HORIZONTAL_BOUNDARIES).extend(VERTICAL_BOUNDARIES);

export const DEFAULT_POSITION = [ new Length(0, '%'), new Length(0, '%')];

//==============================================================================

export class Position
{
    constructor(diagram, element)
    {
        this.diagram = diagram;
        this.element = element;
        this.lengths = null;             // Position as a pair of Offsets
        this.relationships = [];
        this.coordinates = null;         // Resolved position in pixels
        this.dependencies = new Set();
    }

    clearCoordinates()
    //================
    {
        this.coordinates = null;
    }

    get hasCoordinates()
    //==================
    {
        return (this.coordinates !== null);
    }

    addOffset(offset)
    //===============
    {
        this.coordinates = this.coordinates.addOffset(offset);
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
        let coordinates = new geo.Point(0, 0);
        for (let dependency of dependencies) {
            if (!dependency.hasCoordinates) {
                throw new exception.ValueError(`No coordinates for the '${dependency}' element`);
            }
            coordinates = coordinates.addOffset(dependency.coordinates.toOffset());
        }
        return new geo.Point(coordinates.x/dependencies.length,
                             coordinates.y/dependencies.length);
    }

    parseComponent(tokens, previousDirn, defaultOffset=null, defaultDependency=null)
    //==============================================================================
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
                    offset = stylesheet.parseLength(token, defaultOffset);
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
                    const dependency = this.diagram.findElement(token.value);
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
        * Position as coords: absolute or % of container -- `100, 300` or `10%, 30%`
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
                throw new exception.StyleError(tokens, "Position can't have more than two components");
            }
        } else {
            this.parseComponent(tokens, null, defaultOffset, defaultDependency);
        }

        // Assign default position no position specified

        if (this.lengths === null && this.dependencies.size = 0) {
            this.lengths = DEFAULT_POSITION;
        }
    }

    getCoordinates(container, offset, reln, dependencies)
    //===================================================
    {
        /*
        :return: tuple(tuple(x, y), index) where index == 0 means
                 horizontal and 1 means vertical.
        */
        let coordinates = Position.centroid(dependencies);
        let index = Position.orientation[reln];
        if (index >= 0) {
            const adjust = (offset !== null) ? container.lengthToPixels(offset, index, false) : 0;
            let value = coordinates.valueAt(index);
            if (["left", "above"].indexOf(reln) >= 0) {
                value -= adjust;
            } else {
                value += adjust;
            }
            if (dependencies.length === 1 && dependencies[0].sizeAsPixels !== null) {
                if      (reln === "left")  value -= dependencies[0].pixelWidth/2;
                else if (reln === "right") value += dependencies[0].pixelWidth/2;
                else if (reln === "above") value -= dependencies[0].pixelHeight/2;
                else if (reln === "below") value += dependencies[0].pixelHeight/2;
            }
            if (this.element.sizeAsPixels !== null) {
                if      (reln === "left")  value -= this.element.pixelWidth/2;
                else if (reln === "right") value += this.element.pixelWidth/2;
                else if (reln === "above") value -= this.element.pixelHeight/2;
                else if (reln === "below") value += this.element.pixelHeight/2;
            }
            coordinates.setValueAt(index, value);
        }
        return [coordinates, index];
    }

    assignCoordinates(container)
    //==========================
    {
        if (this.coordinates === null) {
            if (this.lengths !== null) {
                this.coordinates = new geo.Point(...utils.offsetToPixels(container, this.lengths, true));
            } else {
                if (this.relationships.length === 1) {
                    const offset = this.relationships[0].offset;
                    const reln = this.relationships[0].relation;
                    const dependencies = this.relationships[0].dependencies;
                    this.coordinates = this.getCoordinates(container, offset, reln, dependencies)[0];
                } else {
                    this.coordinates = new geo.Point(0, 0);
                    for (let relationship of this.relationships) {
                        // May not have an offset
                        // OK since more than one reln
                        const offset = relationship.offset;
                        const reln = relationship.relation;
                        const dependencies = relationship.dependencies;
                        let [coordinates, index] = this.getCoordinates(container, offset, reln, dependencies);
                        if (offset === null) {
                            index = 1 - index;
                        }
                        this.coordinates.setValueAt(index, coordinates.valueAt(index));
                    }
                }
            }
        }
    }
}

Position.orientation = {centre: -1, center: -1, left: 0, right: 0, above: 1, below: 1};

//==============================================================================

export class LinePath
{
    constructor(diagram, style, pathAttribute)
    {
        this.diagram = diagram;
        // TODO: all token parssing needs to be in `stylesheet.js`
        this.tokens = (pathAttribute in style) ? style[pathAttribute] : null;
        this.reversePath = false;
        this.constraints = [];
        this.lengths = null;
    }

    parseConstraint(tokens)
    //=====================
    {
        let angle = null;
        let limit = null;
        let offset = null;
        let reln = null;
        let offsets = [new Length(), new Length()];
        let dependencies = [];
        let lineOffset = null;

        let state = 0;
        // TODO: all token parsing needs to be in `stylesheet.js`

        // ANGLE UNTIL [OFFSET] ID-LIST [LINE-OFFSET]

        // [SIDE-OFFSET [SIDE]] ANGLE UNTIL [OFFSET] ID-LIST [LINE-OFFSET]

        // line-start: 10% bottom vertical;  /* Means start is 10% along bottom edge,
        //                                      line is vertical (i.e. down) until either
        //                                      destination top edge or half-way down
        //                                      a left or right edge of the destination
        //                                      and then horizontal until edge.  */

        // 10% bottom to 30% left

        // We can get the relevant sides from the positions (and sizes) of the two
        // elements (from and to).

        // When elements are rectangular then find OVERLAP of adjoining sides and
        // start/end line in middle of overlap.

        // Need to consider number of lines between the two elements and space
        // the lines apart.


        for (let token of tokens.value) {
            switch (state) {
              case 0:
                if (token.type === 'NUMBER') {
                    angle = stylesheet.parseNumber(token);
                    state = 1;
                    break;
                }
                // NB. Fall through to get limit

              case 1:
                if (token.type !== 'ID' || ['until-x', 'until-y'].indexOf(token.value) < 0) {
                    throw new exception.StyleError(tokens, 'Unknown limit for line segment');
                } else if (angle === null) {
                    throw new exception.StyleError(tokens, "Angle expected");
                } else if ((token.value === 'until-x' && ((angle+90) % 180) === 0)
                        || (token.value === 'until-y' && ( angle     % 180) === 0)) {
                    throw new exception.StyleError(tokens, "Invalid angle for direction");
                }
                limit = (token.value === 'until-x') ? -1 : 1 ;
                state = 2;
                break;

              case 2:
                if (['NUMBER', 'DIMENSION', 'PERCENTAGE'].indexOf(token.type) >= 0) {
                    offset = stylesheet.parseLength(token);
                    state = 9;
                    break;
                }
                state = 4;
                // NB. Fall through to get dependencies

              case 4:
                if (token.type === 'HASH') {
                    const dependency = this.diagram.findElement(token.value);
                    if (dependency === null) {
                        throw new exception.StyleError(tokens, `Unknown element ${token.value}`);
                    }
                    dependencies.push(dependency);
                    break;
                }
                // Check for a line offset
                if (token.type === 'FUNCTION' && token.name.value === 'offset') {
                    lineOffset = stylesheet.parseOffsetPair(token.parameters, false);
                }
                state = 99;
                break;

              case 9:
                if (token.type !== 'ID' || POSITION_RELATIONS.indexOf(token.value) < 0) {
                    throw new exception.StyleError(tokens, "Unknown offset relationship");
                }
                reln = token.value;
                if (HORIZONTAL_RELATIONS.indexOf(reln) >= 0) {
                    offsets[0] = new Length(((reln === 'right') ? offset.length : -offset.length), offset.unit);
                } else {
                    offsets[1] = new Length(((reln === 'below') ? offset.length : -offset.length), offset.unit);
                }
                state = 4;
                break;

              case 99:
                throw new exception.StyleError(tokens, 'Invalid syntax for a line segment');
            }
        }
        if (dependencies.length === 0) {
            throw new exception.StyleError(tokens, 'Identifier(s) expected');
        }
        this.constraints.push({angle, limit, offsets, dependencies, lineOffset});
    }

    parsePath(tokens)
    //===============
    {
        /*
        <line-point> ::= <coord-pair> | <line-angle> <limit>
        <coord-pair> ::= <length> ',' <length>
        <limit> ::= ('until-x' | 'until-y') <relative-point>
        <relative-point> ::= <id-list> | [ <offset> <reln> ] <id-list>

        0 degrees === horizontal, positive is anti-clockwise
        */
        if (tokens instanceof Array) {
            if (tokens[0].type !== 'SEQUENCE') {
                if (tokens.length === 2) {
                    this.lengths = stylesheet.parseOffsetPair(tokens);
                } else {
                    throw new exception.StyleError(tokens, "Invalid path segment");
                }
            } else {
                for (let token of tokens) {
                    this.parseConstraint(token);
                }
            }
        } else {
            this.parseConstraint(tokens);
        }
    }

    parse()
    //=====
    {   // TODO: all token parssing needs to be in `stylesheet.js`
        if (this.tokens !== null) {
            if (this.tokens.type !== 'FUNCTION' || ['begin', 'end'].indexOf(this.tokens.name.value) < 0) {
                throw new exception.StyleError(this.tokens, 'Invalid path specification');
            }
            this.reversePath = (this.tokens.name.value === 'end');
            this.parsePath(this.tokens.parameters);
        }
    }

    toLineString(startCoordinates, endCoordinates)
    //============================================
    {
        // If coords are the same we will return an empty path

        const lineStart = this.reversePath ? endCoordinates : startCoordinates;
        const lineEnd = this.reversePath ? startCoordinates : endCoordinates;

        let currentPoint = lineStart;
        const points = [currentPoint.toOffset()];

        for (let constraint of this.constraints) {
            const angle = constraint.angle;
            const offset = utils.offsetToPixels(this.diagram, constraint.offsets);
            const targetPoint = Position.centroid(constraint.dependencies);
            let x, y;
            if (constraint.limit === -1) {              // until-x
                x = targetPoint.x + offset[0];
                y = currentPoint.y - (x - currentPoint.x)*Math.tan(angle*Math.PI/180);
            } else if (constraint.limit === 1) {        // until-y
                y = targetPoint.y + offset[1];
                x = currentPoint.x + (y - currentPoint.y)*Math.tan((angle-90)*Math.PI/180);
            }
            if (constraint.lineOffset !== null) {
                const lineOffset = utils.offsetToPixels(this.diagram, constraint.lineOffset);
                points.slice(-1)[0][0] += lineOffset[0];
                points.slice(-1)[0][1] += lineOffset[1];
                x += lineOffset[0];
                y += lineOffset[1];
            }
            points.push([x, y]);
            currentPoint = new geo.Point(x, y);
        }
/*
        if ((flow.transporter !== null)) {
            trans_coords = flow.transporter.coords;
            if (((trans_coords[0] === points.slice((- 1))[0][0]) || (trans_coords[1] === points.slice((- 1))[0][1]))) {
                points.slice((- 1))[0] += flow.component_offset(this._element);
            }
        }
*/
        points.push(lineEnd.toOffset());
        if (this.reversePath) points.reverse();

        return new geo.LineString(points);
    }
}

//==============================================================================

export function dependencyGraph(elements)
{
    let dependencyGraph = new jsnx.DiGraph();
    for (let element of elements) {
        dependencyGraph.addNode(element);
    }
    for (let element of dependencyGraph) {
        for (let dependency of element.position.dependencies) {
            dependencyGraph.addEdge(dependency, element);
        }
    }
    try {
        return Array.from(jsnx.topologicalSort(dependencyGraph));
    } catch (e) {
        if (e instanceof jsnx.NetworkXUnfeasible) {
            return []; // We have a cycle  TODO: Generate an error message
        } else {
            console.log(e);
        }
    }
}

//==============================================================================
