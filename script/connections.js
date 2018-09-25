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

import {setAttributes} from './utils.js';
import {parseColour, styleAsString} from './stylesheet.js';

//==============================================================================

export class Connection
{
    constructor(diagram, domElement, fromId, toParent, parentElement, validClasses, styleElementId=null) {
        this.diagram = diagram;
        this.domElement = domElement;
        this.otherId = `#${fromId}`;
        this.otherElement = null;
        this.toParent = toParent;
        this.parentElement = parentElement;
        this.parentElement.addConnection(this);
        this.validClasses = validClasses;
        this.style = null;
        this.styleElementId = styleElementId;
        this.line = null;
        this.path = null;
        this.validPath = false;
        this.id = toParent ? `${fromId}-${parentElement.id.slice(1)}`
                           : `${parentElement.id.slice(1)}-${fromId}`;
        this._order = 1;
        this._adjacent = 1;
        // Track who the parent is connected to
        parentElement.connectTo(fromId);
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
        return `${this.diagram.id}_${this.id}`;
    }

    resolveReferences()
    //=================
    {
        for (let elementClass of this.validClasses) {
            this.otherElement = this.diagram.findElement(this.otherId, elementClass);
            if (this.otherElement !== null) {
                const styleDomElement = (this.styleElementId !== null)
                                            ? this.diagram.findElement(this.styleElementId).domElement
                                            : this.domElement;
                this.style = this.diagram.stylesheet.style(styleDomElement);
                this.otherElement.addConnection(this);  // Will set `order` and `adjacent`
                return;
            }
        }
        const names = this.validClasses.filter(c => c.name);
        const classNames = (names.length === 1) ? names[0]
                                                : [names.slice(0, -1).join(', '), names.slice(-1)[0]].join(' or ');
        throw new exception.KeyError(`Can't find ${classNames} with id '${this.otherId}'`);
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
        return ('line-color' in this.style) ? parseColour(this.diagram, this.style['line-color'])
                                            : '#A0A0A0'; // TODO: specify defaults in one place
    }

    parseLine()
    //=========
    {
        this.line = new layout.LinePath(this.diagram, this.style, 'line-path');
        this.line.parseLine();
    }

    lineAsPath(fromElement, toElement)
    //================================
    {
        return this.line.toLineString(fromElement.coordinates, toElement.coordinates);
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

    assignPath()
    //==========
    {
        const fromElement = this.toParent ? this.otherElement : this.parentElement;
        const toElement = this.toParent ? this.parentElement : this.otherElement;
        this.path = Connection.trimPath(this.lineAsPath(fromElement, toElement), fromElement, toElement);
        this.validPath = true;
    }

    get invalidPath()
    //===============
    {
        return (this.validPath === false);
    }

    invalidatePath()
    //==============
    {
        this.validPath = false;
    }

    generateSvg()
    //===========
    {
        const svgNode = this.path.svgNode();
        setAttributes(svgNode, {id: this.diagramId, fill: 'none',
                                stroke: this.lineColour,
                                'stroke-width': this.diagram.strokeWidthToPixels(config.STROKE.WIDTH),
                                'marker-end': this.diagram.svgFactory.arrow(this.lineColour)});
        if (styleAsString(this.style, 'line-style') === 'dashed') {
            setAttributes(svgNode, {'stroke-dasharray': '10,5'});
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
