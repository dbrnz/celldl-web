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

import * as exception from './exception.js';
import * as geo from './geometry.js';
import * as layout from './layout.js';

import {setAttributes} from './utils.js';
import {parseColour, styleAsString} from './stylesheet.js';

//==============================================================================

export class Edge
{
    constructor(diagram, domElement, fromId, toParent, parentElement, validClasses, styleElementId=null) {
        this.diagram = diagram;
        this.domElement = domElement;
        this.otherId = `#${fromId}`;
        this.otherElement = null;
        this.toParent = toParent;
        this.parentElement = parentElement;
        this.parentElement.addEdge(this);
        this.validClasses = validClasses;
        this.style = null;
        this.styleElementId = styleElementId;
        this.line = null;
        this.path = null;
        this.id = toParent ? `${fromId}-${parentElement.id.slice(1)}`
                           : `${parentElement.id.slice(1)}-${fromId}`;
    }

    static createFromAttributeValue(diagram, domElement, attributeName,
                                    toParent, parentElement, validClasses)
    //====================================================================
    {
        if (!(attributeName in domElement.attributes)) {
            throw new exception.KeyError(`Expected '${attributeName}' attribute`);
        }
        return new Edge(diagram, domElement, domElement.attributes[attributeName].textContent,
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
                this.otherElement.addEdge(this);
                return;
            }
        }
        const names = this.validClasses.filter(c => c.name);
        const classNames = (names.length === 1) ? names[0]
                                                : [names.slice(0, -1).join(', '), names.slice(-1)[0]].join(' or ');
        throw new exception.KeyError(`Can't find ${classNames} with id '${this.otherId}'`);
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
        this.line.parse();
    }

    getLineStringAsPath(fromElement, toElement)
    //=========================================
    {
        // Only of coords are different...
        // if (fromElement.coordinates.notEqual(toElement.coordinates))...

        const path = this.line.toLineString(this.unitConverter,
                                            fromElement.coordinates,
                                            toElement.coordinates);
        const lines = path.lineSegments;
        const coords = path.coordinates;
        for (let n = 0; n < lines.length; ++n) {
            if (fromElement.geometry.outside(lines[n].end)) {
                const start = fromElement.geometry.lineIntersections(lines[n])[0];
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
                const end = toElement.geometry.lineIntersections(lines[n])[0];
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

    assignPath(unitConverter)
    //=======================
    {
        this.unitConverter = unitConverter;
        if (this.toParent) {
            this.path = this.getLineStringAsPath(this.otherElement, this.parentElement);
        } else {
            this.path = this.getLineStringAsPath(this.parentElement, this.otherElement);
        }
    }

    reassignPath()
    //===============
    {
        // either parent's or other's position has changed
        if (this.toParent) {
            this.path = this.getLineStringAsPath(this.otherElement, this.parentElement);
        } else {
            this.path = this.getLineStringAsPath(this.parentElement, this.otherElement);
        }
        // we could save unitconvertor above and simply assignPath
    }

    generateSvg()
    //===========
    {
        const svgNode = this.path.svgNode();
        setAttributes(svgNode, {id: this.diagramId, fill: 'none',
                                stroke: this.lineColour,
                                'stroke-width': layout.STROKE_WIDTH,
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
