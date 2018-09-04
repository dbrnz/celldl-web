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

export const ELEMENT_RADIUS = 15;

export const STROKE_WIDTH = new geo.Length(2.5, 'px');

export const FLOW_OFFSET = new geo.Length(6, '%w');

export const QUANTITY_OFFSET = new geo.Length(6, '%w');;
export const QUANTITY_WIDTH = 50;
export const QUANTITY_HEIGHT = 33;

export const TRANSPORTER_RADIUS = 20;
export const TRANSPORTER_EXTRA = new geo.Length(2.5, '%');
export const TRANSPORTER_WIDTH = new geo.Length(5, '%');

export const HORIZONTAL_RELATIONS = new List(['left', 'right']);
export const VERTICAL_RELATIONS = new List(['above', 'below']);
export const POSITION_RELATIONS = new List().extend(HORIZONTAL_RELATIONS).extend(VERTICAL_RELATIONS);

export const HORIZONTAL_BOUNDARIES = new List(['top', 'bottom']);
export const VERTICAL_BOUNDARIES = new List(['left', 'right']);
export const CORNER_BOUNDARIES = new List(['top-left', 'top-right', 'bottom-left', 'bottom-right']);
export const COMPARTMENT_BOUNDARIES = new List().extend(HORIZONTAL_BOUNDARIES).extend(VERTICAL_BOUNDARIES);

export const DEFAULT_POSITION = [ new geo.Length(0, '%'), new geo.Length(0, '%')];
export const DEFAULT_SIZE     = [ new geo.Length(), new geo.Length()];

//==============================================================================

export class Size
{
    constructor(element, sizeTokens)
    {
        this._element = element;
        this._size = sizeTokens ? stylesheet.parseSize(sizeTokens) : DEFAULT_SIZE;
        this._pixelSize = [0, 0];
        this._dependents = new Set();  // Set of elements that depend on this size
    }

    addDependent(element)
    //===================
    {
        this._dependents.add(element);
    }

    get dependents()
    //==============
    {
        return this._dependents;
    }

    get asPixels()
    //============
    {
        return this._pixelSize;
    }

    get pixelWidth()
    //==============
    {
        return this._pixelSize[0];
    }

    get pixelHeight()
    //===============
    {
        return this._pixelSize[1];
    }

    get units()
    //=========
    {
        return [this._size[0].units, this._size[1].units]
    }

    assignSize()
    //==========
    {
        this._pixelSize = utils.offsetToPixels(this._element.container, this._size);
    }

    setPixelSize(pixelSize)
    //=====================
    {
        this._pixelSize = pixelSize;
        if (this._element.container) {
            this._size = utils.pixelsToOffset(pixelSize, this._element.container, this.units);
        }
    }

    toString()
    //========
    {
        return `${this._size[0].toString()}, ${this._size[1].toString()}`;
    }
}

//==============================================================================

export class Position
{
    constructor(diagram, element, positionTokens)
    {
        this.diagram = diagram;
        this._element = element;
        this.coordinates = null;         // Resolved position in pixels
        this._tokens = positionTokens || null;
        this._offset = null;             // Position as a pair of Offsets
        this._relationships = [];
        this._dependents = new Set();
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

    _addDependency(dependency)
    //========================
    {
        dependency.position._dependents.add(this._element);
    }

    _addDependencies(dependencies)
    //============================
    {
        for (let dependency of dependencies) {
            dependency.position._dependents.add(this._element);
        }
    }

    /**
     * Set of all elements that depend on our element's position or size.
     *
     * @returns {Set}
    **/
    dependents()
    //==========
    {
        const directDependents = new Set();
        for (let dependent of this._element.size.dependents) {
            directDependents.add(dependent);
        }
        for (let dependent of this._dependents) {
            directDependents.add(dependent);
        }
        // Find closure of directDependents
        const dependents = new Set();
        for (let dependent of directDependents) {
            dependents.add(dependent);
            for (let d of dependent.position.dependents()) {
                if (d === this._element) {
                    throw exception.ValueError(`Element '${d.id}' is in a position dependency cycle`);
                } else {
                    dependents.add(d);
                }
            }
        }
        return dependents;
    }

    /**
     * Sort elements that are depend on our position into topological
     * order.
     *
     * @returns {Array}
    **/
    dependencyGraph(elements)
    //=======================
    {
        let dependencyGraph = new jsnx.DiGraph();

        // Sub-element dependencies
        for (let element of elements) {
            dependencyGraph.addNode(element);
            for (let dependent of element.position._dependents) {
                dependencyGraph.addNode(dependent);
                dependencyGraph.addEdge(element, dependent)
            }
        }

        try {
            return Array.from(jsnx.topologicalSort(dependencyGraph));
        } catch (e) {
            if (e instanceof jsnx.NetworkXUnfeasible) {
                throw exception.ValueError(`Position dependency graph of '${this._element.id}' contains a cycle...`);
            } else {
                console.log(e);
            }
            return [];
        }
    }

    _addRelationship(offset, relation, dependencies)
    //==============================================
    {
        this._relationships.push({offset, relation, dependencies});
    }

    static _centroid(dependencies)
    //============================
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

    _parseComponent(tokens, previousDirn, defaultOffset=null, defaultDependency=null)
    //===============================================================================
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
                    // Implicit dependency on our container's size if '%' offset
                    if (offset.units.indexOf('%') >= 0) {
                        this._element.container.size.addDependent(this._element);
                    }
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

        this._addRelationship(offset, reln, dependencies);
        this._addDependencies(dependencies);

        return HORIZONTAL_RELATIONS.contains(reln) ? 'H' : 'V';
    }

    parsePosition(defaultOffset=null, defaultDependency=null)
    //=======================================================
    {
        /*
        * Position as coords: absolute or % of container -- `100, 300` or `10%, 30%`
        * Position as offset: relation with absolute offset from element(s) -- `300 above #q1 #q2`
        */
        if (this._tokens == null) {
            return;
        }

        const tokens = this._tokens;
        if (tokens instanceof Array) {
            if (tokens.length === 2) {
                if (['ID', 'SEQUENCE'].indexOf(tokens[0].type) < 0) {
                    this._offset = stylesheet.parseOffsetPair(tokens);
                    // Implicit dependency on our container's size if any '%' offset
                    // and on our container's position
                    if (this._offset[0].units.indexOf('%') >= 0
                     || this._offset[1].units.indexOf('%') >= 0) {
                        this._element.container.size.addDependent(this._element);
                        this._addDependency(this._element.container);
                    }
                } else {
                    const dirn = this._parseComponent(tokens[0], null);
                    this._parseComponent(tokens[1], dirn, defaultOffset, defaultDependency);
                }
            } else {
                throw new exception.StyleError(tokens, "Position can't have more than two components");
            }
        } else {
            this._parseComponent(tokens, null, defaultOffset, defaultDependency);
        }

        // Assign default position if no position relationships specified

        if (this._offset === null && this._relationships.size === 0) {
            this._offset = DEFAULT_POSITION;
        }
    }

    tokensToString()
    //==============
    {
        return stylesheet.tokensToString(this._tokens);
    }

    _getCoordinates(container, offset, reln, dependencies)
    //====================================================
    {
        /*
        OFFSET RELN DEPENDENCIES
        10% left #element1             // our right edge is left of element1's edge
        10% left #element1 #element2   // our right edge is left of middle of element1 and element2

        @return {Array} A two-long array with the first element
                        the coordinates as a ``Point`` and the second
                        element indicating which of the coordinates
                        was set by the ``reln`` constraint (0 means
                        ``x``;  1 means ``y``).
        */
        let coordinates = Position._centroid(dependencies);
        let index = Position.orientation[reln];
        if (index >= 0) {
            const adjust = (offset !== null) ? container.lengthToPixels(offset, index, false) : 0;
            // The coordinate we are adjusting
            let value = coordinates.valueAt(index);
            if (["left", "above"].indexOf(reln) >= 0) {
                value -= adjust;
            } else {
                value += adjust;
            }
            // Offset is from the edge for a single dependency
            if (dependencies.length === 1) {
                if (index === 0) {
                    const delta = dependencies[0].size.pixelWidth/2;
                    if (reln === "left")  value -= delta;
                    else                  value += delta;
                } else {
                    const delta = dependencies[0].size.pixelHeight/2;
                    if (reln === "above") value -= delta;
                    else                  value += delta;
                }
            }
            // Adjust to get our center
            if (index === 0) {
                const delta = this._element.size.pixelWidth/2;
                if (reln === "left")  value -= delta;
                else                  value += delta;
            } else {
                const delta = this._element.size.pixelHeight/2;
                if (reln === "above") value -= delta;
                else                  value += delta;
            }
            coordinates.setValueAt(index, value);
        }
        return [coordinates, index];
    }

    assignCoordinates(container=null)
    //===============================
    {
        container = container || this._element.container;

        if (this._offset) {
            this.coordinates = new geo.Point(...utils.offsetToPixels(container, this._offset, true));
        } else {
            if (this._relationships.length === 1) {
                const offset = this._relationships[0].offset;
                const reln = this._relationships[0].relation;
                const dependencies = this._relationships[0].dependencies;
                this.coordinates = this._getCoordinates(container, offset, reln, dependencies)[0];
            } else {
                this.coordinates = new geo.Point(0, 0);
                for (let relationship of this._relationships) {
                    // May not have an offset
                    // OK since more than one reln
                    const offset = relationship.offset;
                    const reln = relationship.relation;
                    const dependencies = relationship.dependencies;
                    let [coordinates, index] = this._getCoordinates(container, offset, reln, dependencies);
                    if (offset === null) {
                        index = 1 - index;
                    }
                    this.coordinates.setValueAt(index, coordinates.valueAt(index));
                }
            }
        }
    }

    coordinatesToString()
    //===================
    {

        // TODO: Find relative position as a string (new `OFFSET from IDS` relationship??)
        if (!this._offset) {
            this._offset = DEFAULT_POSITION;
        }

        const container = this._element.container;
        if (this._offset) {
            const units = [this._offset[0].units, this._offset[1].units];
            const offset = utils.pixelsToOffset(this.coordinates.toOffset(), container, units, true);
            return `${offset[0].toString()}, ${offset[1].toString()}`;
        } else {
            const text = [];
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
        // TODO: all token parsing needs to be in `stylesheet.js`
        this._tokens = (pathAttribute in style) ? style[pathAttribute] : null;
        this._reversePath = false;
        this._constraints = [];
        this._lengths = null;
    }

    _parseConstraint(tokens)
    //======================
    {
        let angle = null;
        let limit = null;
        let offset = null;
        let reln = null;
        let offsets = [new geo.Length(), new geo.Length()];
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
                    offsets[0] = new geo.Length(((reln === 'right') ? offset.length : -offset.length), offset.units);
                } else {
                    offsets[1] = new geo.Length(((reln === 'below') ? offset.length : -offset.length), offset.units);
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
        this._constraints.push({angle, limit, offsets, dependencies, lineOffset});
    }

    _parse(tokens)
    //============
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
                    this._lengths = stylesheet.parseOffsetPair(tokens);
                } else {
                    throw new exception.StyleError(tokens, "Invalid path segment");
                }
            } else {
                for (let token of tokens) {
                    this._parseConstraint(token);
                }
            }
        } else {
            this._parseConstraint(tokens);
        }
    }

    parseLine()
    //=========
    {   // TODO: all token parsing needs to be in `stylesheet.js`
        if (this._tokens !== null) {
            if (this._tokens.type !== 'FUNCTION' || ['begin', 'end'].indexOf(this._tokens.name.value) < 0) {
                throw new exception.StyleError(this._tokens, 'Invalid path specification');
            }
            this._reversePath = (this._tokens.name.value === 'end');
            this._parse(this._tokens.parameters);
        }
    }

    toLineString(startCoordinates, endCoordinates)
    //============================================
    {
        // If coords are the same we will return an empty path

        const lineStart = this._reversePath ? endCoordinates : startCoordinates;
        const lineEnd = this._reversePath ? startCoordinates : endCoordinates;

        let currentPoint = lineStart;
        const points = [currentPoint.toOffset()];

        for (let constraint of this._constraints) {
            const angle = constraint.angle;
            const offset = utils.offsetToPixels(this.diagram, constraint.offsets);
            const targetPoint = Position._centroid(constraint.dependencies);
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
        if (this._reversePath) points.reverse();

        return new geo.LineString(points);
    }
}

//==============================================================================
