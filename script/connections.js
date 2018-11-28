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
import * as layout from './layout.js';
import * as stylesheet from './stylesheet.js';

import {List, setAttributes} from './utils.js';

//==============================================================================

export class Connection
{
    constructor(diagram, domElement, fromId, toParent, parentElement, validClasses, styleElementId=null) {
        const idList = (new List(toParent ? [fromId, parentElement.id.slice(1)]
                                          : [parentElement.id.slice(1), fromId])).extend(domElement.classList);
        this.id = idList.join('-');
        this._diagram = diagram;
        this._domElement = domElement;
        this._otherId = `#${fromId}`;
        this._otherElement = null;
        this._toParent = toParent;
        this._parentElement = parentElement;
        this._parentElement.addConnection(this);
        this._validClasses = validClasses;

        // Track who the parent is connected to

        parentElement.connectTo(fromId);

        this._style = null;
        this._styleElementId = styleElementId;

        this._line = null;
        this._path = null;
        this._validPath = false;
        this._order = 1;
        this._adjacent = 1;

        this._diagram.addConnection(this);
    }

    static createFromAttributeValue(diagram, domElement, attributeName,
                                    toParent, parentElement, validClasses)
    //====================================================================
    {
        if (!domElement.hasAttribute(attributeName)) {
            throw new exception.KeyError(`Expected '${attributeName}' attribute`);
        }
        return new Connection(diagram, domElement, domElement.getAttribute(attributeName),
                              toParent, parentElement, validClasses);
    }

    get diagramId()
    //=============
    {
        return `${this._diagram.id}_${this.id}`;
    }

    resolveReferences()
    //=================
    {
        for (let elementClass of this._validClasses) {
            this._otherElement = this._diagram.findElement(this._otherId, elementClass);
            if (this._otherElement !== null) {
                const styleDomElement = (this._styleElementId !== null)
                                            ? this._diagram.findElement(this._styleElementId).domElement
                                            : this._domElement;
                this._style = this._diagram.stylesheet.style(styleDomElement);
                this._otherElement.addConnection(this);  // Will set `order` and `adjacent`
                return;
            }
        }
        const names = this._validClasses.map(c => c.name);
        const classNames = (names.length === 1) ? names[0]
                                                : [names.slice(0, -1).join(', '), names.slice(-1)[0]].join(' or ');
        throw new exception.KeyError(`Can't find ${classNames} with id '${this._otherId}'`);
    }

    setOrder(order, adjacent)
    //=======================
    {
        this._order = order;
        this._adjacent = adjacent;
    }

    get order()
    //=========
    {
        return this._order;
    }

    get adjacent()
    //============
    {
        return this._adjacent;
    }

    get lineColour()
    //==============
    {
        return ('line-color' in this._style) ? stylesheet.parseColour(this._diagram, this._style['line-color'])
                                             : '#A0A0A0'; // TODO: specify defaults in one place
    }

    parseLine(direction=null)
    //=======================
    {
        const attributeName = (direction !== null) ? `${direction}-line-path` : 'line-path';
        this._line = new layout.LinePath(this._diagram, this._style, attributeName);
        this._line.parseLine();
    }

    lineAsPath(fromElement, toElement)
    //================================
    {
        return this._line.toPolyLine(fromElement.coordinates, toElement.coordinates);
    }

    static trimPath(path, fromElement, toElement)
    //===========================================
    {
        const lines = path.lineSegments;
        const coords = path.coordinates;
        for (let n = 0; n < lines.length; ++n) {
            if (fromElement.geometry.outside(lines[n].end)) {
                const intersections = fromElement.geometry.lineIntersections(lines[n])
                const start = (intersections.length > 0) ? intersections[0] : lines[n].start;
                lines[n] = new geo.LineSegment(start, lines[n].end);
                coords[n] = lines[n].start;
                break;
            } else {
                lines[n] = null;
                coords[n] = null;
            }
        }
        for (let n = lines.length - 1; n >= 0; --n) {
            if (lines[n] !== null && toElement.geometry.outside(lines[n].start)) {
                const intersections = toElement.geometry.lineIntersections(lines[n])
                const end = (intersections.length > 0) ? intersections[0] : lines[n].end;
                lines[n] = (new geo.LineSegment(lines[n].start, end)).truncateEnd(5);
                coords[n+1] = lines[n].end;
                break;
            } else {
                lines[n] = null;
                coords[n+1] = null;
            }
        }
    path.lineSegments = lines.filter(line => (line !== null));
    path.coordinates = coords.filter(coord => (coord !== null));
    return path;
    }

    get source()
    //==========
    {
        return this._toParent ? this._otherElement : this._parentElement;
    }

    get target()
    //==========
    {
        return this._toParent ? this._parentElement : this._otherElement;
    }

    assignPath()
    //==========
    {
        this._path = this.lineAsPath(this.source, this.target);
        this._validPath = true;
    }

    get invalidPath()
    //===============
    {
        return (this._validPath === false);
    }

    invalidatePath()
    //==============
    {
        this._validPath = false;
    }

    get path()
    //========
    {
        return this._validPath ? this._path : null;
    }

    cyElement()
    //=========
    {
        const nodes = this.sourceTarget();
        return {
            data: { source: nodes.source.id, target: nodes.target.id, colour: this.lineColour }
        };
    }

    generateSvg()
    //===========
    {
        const trimmedPath = Connection.trimPath(this._path, this.source, this.target).asPolyBezier();
        const svgNode = trimmedPath.svgNode();
        const strokeWidth = this._diagram.strokeWidthToPixels(
                                ('stroke-width' in this._style) ? stylesheet.parseLength(this._style['stroke-width'])
                                                                : config.STROKE.WIDTH);
        const configWidth = this._diagram.strokeWidthToPixels(config.STROKE.WIDTH);
        const arrowScale = Math.sqrt(0.5*(strokeWidth+configWidth)/configWidth);
        setAttributes(svgNode, {id: this.diagramId, fill: 'none',
                                stroke: this.lineColour,
                                'stroke-width': strokeWidth,
                                'marker-end': this._diagram.svgFactory.arrow(this.lineColour, arrowScale)});
        if (stylesheet.styleAsString(this._style, 'line-style') === 'dashed') {
            setAttributes(svgNode, {'stroke-dasharray': '10,5'});
        }
        if ('stroke-opacity' in this._style) {
            setAttributes(svgNode, {'opacity': stylesheet.parseNumber(this._style['stroke-opacity'])});
        }
        return svgNode;
    }

    updateSvg()
    //=========
    {
        const svgNode = this.generateSvg();
        const currentNode = document.getElementById(this.diagramId);
        currentNode.outerHTML = svgNode.outerHTML;
    }

}

//==============================================================================
