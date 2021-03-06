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

import * as config from '../config.js';
import * as exception from './exception.js';
import * as geo from './geometry.js';
import * as stylesheet from './stylesheet.js';
import * as utils from './utils.js';

import {List} from './utils.js';

//==============================================================================

export const HORIZONTAL_RELATIONS = new List(['left', 'right']);
export const VERTICAL_RELATIONS = new List(['above', 'below']);
export const POSITION_RELATIONS = new List().extend(HORIZONTAL_RELATIONS).extend(VERTICAL_RELATIONS);

export const HORIZONTAL_BOUNDARIES = new List(['top', 'bottom']);
export const VERTICAL_BOUNDARIES = new List(['left', 'right']);
export const CORNER_BOUNDARIES = new List(['top-left', 'top-right', 'bottom-left', 'bottom-right']);
export const COMPARTMENT_BOUNDARIES = new List().extend(HORIZONTAL_BOUNDARIES).extend(VERTICAL_BOUNDARIES);

//==============================================================================

export class Size
{
    constructor(element, sizeTokens)
    {
        this._element = element;
        this._size = sizeTokens ? stylesheet.parseSize(sizeTokens) : config.DEFAULT.SIZE;
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

    setSize(size)
    //===========
    {
        this._size = size;
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
        this._tokens = positionTokens || null;
        this._coordinates = null;            // Resolved position in pixels
        this._offset = null;                 // Position as a pair of Offsets
        this._relationships = [];            // Position in relation to other elements
        this._directDependents = new Set();  // Elements whose position directly depends on this position
        this._dependentsCache = null;
    }

    get hasCoordinates()
    //==================
    {
        return (this._coordinates !== null);
    }

    get coordinates()
    //===============
    {
        return this._coordinates;
    }

    setCoordinates(coordinates)
    //=========================
    {
        this._coordinates = coordinates;

        const container = this._element.container;
        if (container) {
            // TODO: Find relative position as a string (new `OFFSET from IDS` relationship??)
            const tempOffset = this._offset || config.DEFAULT.POSITION;   // **TEMP**
            if (tempOffset) {
                const units = [tempOffset[0].units, tempOffset[1].units];
                this._offset = utils.pixelsToOffset(this._coordinates.asArray(), container, units, true);
            } else {
                // TODO: Find relative position as a string (new `OFFSET from IDS` relationship??)
            }
        }
    }

    setOffset(offset)
    //===============
    {
        this._offset = offset;
    }

    moveByOffset(offset)
    //==================
    {
        const newCoords = this._coordinates.translate(offset); // Returns a new Point
        this.setCoordinates(newCoords);
    }

    coordinatesToString()
    //===================
    {
        if (this._offset) {
            return `${this._offset[0].toString()}, ${this._offset[1].toString()}`;
        } else {
            const relns = [];
            for (let relationship of this._relationships) {
                const ids = [];
                for (let dependency of relationship.dependencies) {
                    ids.push(dependency.id);
                }
                relns.push(`${relationship.offset.toString()} ${relationship.relation} ${ids.join(' ')}`);
            }
            return relns.join(', ');
        }
    }

    addDependent(element)
    //===================
    {
        this._directDependents.add(element);
    }

    _addDependency(dependency)
    //========================
    {
        dependency.position.addDependent(this._element);
    }

    _addDependencies(dependencies)
    //============================
    {
        for (let dependency of dependencies) {
            dependency.position.addDependent(this._element);
        }
    }

    /**
     * All elements that depend on our element's position or size, sorted in
     * topological order.
     *
     * @returns {Array}
    **/
    dependents()
    //==========
    {
        // We cache the resulting dependency graph

        if (this._dependentsCache !== null) {
            return this._dependentsCache;
        }

        const directDependents = new Set();
        for (let dependent of this._element.size.dependents) {
            directDependents.add(dependent);
        }
        for (let dependent of this._directDependents) {
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

        // Now sort our dependents by creating a directed graph of dependencies
        // and sorting it into topological order

        let dependencyGraph = new jsnx.DiGraph();

        for (let element of dependents) {
            dependencyGraph.addNode(element);
            for (let dependent of element.position._directDependents) {
                dependencyGraph.addNode(dependent);
                dependencyGraph.addEdge(element, dependent)
            }
        }

        try {
            this._dependentsCache = Array.from(jsnx.topologicalSort(dependencyGraph));
        } catch (e) {
            if (e instanceof jsnx.NetworkXUnfeasible) {
                throw exception.ValueError(`Position dependency graph of '${this._element.id}' contains a cycle...`);
            } else {
                console.log(e);
            }
            this._dependentsCache = [];
        }
        return this._dependentsCache;
    }

    layoutDependents(updateSvg=false)
    //===============================
    {
        /*
        - Hierarchical positioning
        - An element's position can depend on those of its siblings and any element
          at a higher level in the diagram. In the following, ``cm2`` may depend on
          ``gr1``, ``cm1``, ``gr2`` and ``gr0``, while ``gr3`` may depend on ``gr4``,
          ``cm3``, ``gr1``, ``cm1``, ``gr2`` and ``gr0``.
        - This means we need to position the container's elements before laying out
          any sub-containers.
        */

        // Need to ensure dependencies are amongst or above our elements

        const dependents = this.dependents();

        for (let element of dependents) {
            element.assignDimensions();
            element.assignGeometry();
            element.assignTextCoordinates();
            if (updateSvg) {
                element.updateSvg(false);
            }
        }
        if (updateSvg) {
            for (let element of dependents) {
                element.redrawConnections();
            }
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
            coordinates = coordinates.translate(dependency.coordinates.asArray());
        }
        return new geo.Point(coordinates.x/dependencies.length,
                             coordinates.y/dependencies.length);
    }

    _parseComponent(tokens, defaultDependency)
    //========================================
    {
        let offset = null;
        let reln = null;
        let dependencies = new List();
        let state = 0;
        if (tokens.type === 'SEQUENCE') {
            for (let token of tokens.value) {
                switch (state) {
                  case 0:
                    if (token.type !== 'ID' && token.type !== 'HASH') {
                        offset = stylesheet.parseLength(token, null);
                        // Implicit dependency on our container's size if '%' offset
                        if (offset && offset.units.indexOf('%') >= 0) {
                            this._element.container.size.addDependent(this._element);
                        }
                        state = 1;
                        break;
                    }
                    // Fall through to parse relationship
                  case 1:
                    if (token.type === "ID") {
                        if (!POSITION_RELATIONS.contains(token.value.toLowerCase())) {
                            throw new exception.StyleError(tokens, "Unknown relationship for position");
                        }
                        reln = token.value.toLowerCase();
                        state = 2;
                        break;
                    }
                    // Fall through to parse dependency
                  case 2:
                    if (token.type === 'HASH') {
                        const dependency = this.diagram.findElement(token.value);
                        if (dependency === null) {
                            throw new exception.StyleError(tokens, `Unknown element ${token.value}`);
                        }
                        dependencies.append(dependency);
                    } else if (defaultDependency !== null) {
                        dependencies.append(defaultDependency);
                    } else {
                        throw new exception.StyleError(tokens, "Element ID expected");
                    }
                }
            }
        } else if (tokens.type === 'HASH') {
            const dependency = this.diagram.findElement(tokens.value);
            if (dependency === null) {
                throw new exception.StyleError(tokens, `Unknown element ${tokens.value}`);
            }
            dependencies.append(dependency);
        } else {
            throw new exception.StyleError(tokens, "Invalid position rule");
        }
        this._addRelationship(offset, reln, dependencies);
        this._addDependencies(dependencies);
        return (HORIZONTAL_RELATIONS.contains(reln) && (offset !== null)
             || VERTICAL_RELATIONS.contains(reln)   && (offset === null)) ? 'X' : 'Y';
    }

    /*
     * Position as coords: absolute or % of container -- `100, 300` or `10%, 30%`
     * Position as offset: relation with absolute offset from element(s) -- `300 above #q1 #q2`
    **/
    parsePosition(defaultOffset, defaultDependency)
    //=============================================
    {
        const tokens = this._tokens;
        const container = this._element.container;
        if (tokens instanceof Array) {
            if (tokens.length === 2) {
                if (['ID', 'SEQUENCE'].indexOf(tokens[0].type) < 0) {
                    this._offset = stylesheet.parseOffsetPair(tokens);
                    // Implicit dependency on our container's size if any '%' offset
                    // and on our container's position
                    if (this._offset[0].units.indexOf('%') >= 0
                     || this._offset[1].units.indexOf('%') >= 0) {
                        container.size.addDependent(this._element);
                        this._addDependency(container);
                    }
                } else {
                    const axis1 = this._parseComponent(tokens[0], defaultDependency);
                    const axis2 = this._parseComponent(tokens[1], defaultDependency);
                    if (axis1 === axis2) {
                        throw new exception.StyleError(tokens, "Position constraints must specify different axes");
                    }
                }
            } else {
                throw new exception.StyleError(tokens, "Position can't have more than two components");
            }
        } else if (tokens !== null) {
            this._parseComponent(tokens, null, defaultOffset, defaultDependency);
        } else if (this._coordinates === null && this._offset === null) {
            // Assign default position if none specified
            this._offset = config.DEFAULT.POSITION;
            if (container !== null) {
                this._addDependency(container);
            }
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
            this._coordinates = new geo.Point(...utils.offsetToPixels(container, this._offset, true));
        } else {
            if (this._relationships.length === 1) {
                const offset = this._relationships[0].offset;
                const reln = this._relationships[0].relation;
                const dependencies = this._relationships[0].dependencies;
                this._coordinates = this._getCoordinates(container, offset, reln, dependencies)[0];
            } else {
                this._coordinates = new geo.Point(0, 0);
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
                    this._coordinates.setValueAt(index, coordinates.valueAt(index));
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

    toPolyLine(startCoordinates, endCoordinates)
    //==========================================
    {
        // If coords are the same we will return an empty path

        const lineStart = this._reversePath ? endCoordinates : startCoordinates;
        const lineEnd = this._reversePath ? startCoordinates : endCoordinates;

        let currentPoint = lineStart;
        const points = [currentPoint.asArray()];

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
        points.push(lineEnd.asArray());
        if (this._reversePath) points.reverse();

        return new geo.PolyLine(points);
    }
}

//==============================================================================
