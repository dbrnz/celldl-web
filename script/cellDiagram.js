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

import * as bondgraph from './bondgraph.js';
import * as exception from './exception.js';
import * as geo from './geometry.js';
import * as layout from './layout.js';
import * as stylesheet from './stylesheet.js';
import * as utils from './utils.js';

import {DiagramElement} from './elements.js';
import {SvgFactory, SVG_NS, SVG_VERSION} from './svgElements.js';

//==============================================================================

export class CellDiagram {
    constructor(id, stylesheet, textEditor=null)
    {
        this.id = id;
        this.stylesheet = stylesheet;
        this.textEditor = textEditor;
        this._elements = [];
        this._elementsById = {};
        this._connections = [];
        this.width = 0;
        this.height = 0;
        this.diagonal = 0;
        this.background = null;
        this.flatMap = null;
        this.bondGraph = null;
        this.svgFactory = new SvgFactory(id);
        this._manualPositions = [];
        this._manualSizes = [];
    }

    initialise(style)
    //===============
    {
        if ('width' in style) {
            this.width = stylesheet.parseNumber(style.width);
        }
        if ('height' in style) {
            this.height = stylesheet.parseNumber(style.height);
        }
    }

    get size()
    //========
    {
        return [this.width, this.height];
    }

    lengthToPixels(length, index)
    //===========================
    {
        if (!length.units || length.units === 'px') {
            return length.length;
        } else {
            return utils.lengthToPixels(length, index, this.width, this.height);
        }
    }

    pixelsToLength(pixels, units, index)
    //==================================
    {
        if (!units || units === 'px') {
            return new geo.Length(pixels, units);
        } else {
            return utils.pixelsToLength(pixels, units, index, this.width, this.height);
        }
    }

    strokeWidthToPixels(length)
    //=========================
    {
        if (!length.units || length.units === 'px') {
            return length.length;
        }
        else if (length.units === 'vh') {
            return length.length*this.height/100;
        }
        else if (length.units === 'vw') {
            return length.length*this.width/100;
        }
        else if (length.units === '%') {
            return length.length*this.diagonal/100;
        } else {
            return length.length;
        }
    }

    addElement(element)
    //=================
    {
        if (element.id !== '') {
            if (element.id in this._elementsById) {
                throw new exception.KeyError(`Duplicate element 'id': ${element.id}`);
            }
            this._elementsById[element.id] = element;
        }
        this._elements.push(element);
    }

    elements(elementClass=DiagramElement)
    //===================================
    {
        return this._elements.filter(e => e instanceof elementClass);
    }

    findElement(id, elementClass=DiagramElement)
    //==========================================
    {
        const e = (id in this._elementsById) ? this._elementsById[id] : null;
        return (e instanceof elementClass) ? e : null;
    }

    findElementById(diagramId)
    //========================
    {
        const prefix = `${this.id}_`;
        return (diagramId.startsWith(prefix))
            ? this.findElement(`#${diagramId.slice(prefix.length)}`)
            : null;
    }

    addConnection(connection)
    //=======================
    {
        this._connections.push(connection);
    }

    connections()
    //===========
    {
         return this._connections;
    }

/* FUTURE ??
    connectionsTo(fromId)
    //=============
    {
         return Array.from(this._connections).filter(connection => connection.id.split(' ')[1] === fromId)
    }

    elementsFrom(element)
    //===================
    {
        return this.connectionsFrom(element.id).filter(id => this._elementsById[id])
    }

    elementsTo(element)
    //===================
    {
        return this.connectionsTo(element.id).filter(id => this._elementsById[id])
    }
*/

    addBondGraphElement(element)
    //==========================
    {
        // Create bondGraph if none exists
        this.bondGraph.addXml(element);
    }

    layout(width=layout.DIAGRAM_WIDTH, height=layout.DIAGRAM_HEIGHT)
    //==============================================================
    {
        // Position and size all elements of the diagram.

        if (this.width === 0) this.width = width;
        if (this.height === 0) this.height = height;
        this.diagonal = Math.sqrt(this.width*this.width + this.height*this.height);

        // Resolve ID references and parse position definitions
        // for all elements

        for (let element of this._elements) {
            element.parsePosition();
        }

        // Resolve ID references and parse line definitions
        // for all connections

        for (let connection of this._connections) {
            connection.resolveReferences();
            connection.parseLine();
        }

        // Layout all groups and their elements

        if (this.flatMap !== null) {
            this.flatMap.layout();
        }

        // Layout bondgraph

        if (this.bondGraph !== null) {
            this.bondGraph.layout();
        }

        // Assign paths to all connections

        for (let connection of this._connections) {
            connection.assignPath();
        }

 // Space flow lines going through a transporter
 //       bondGraph.setOffsets();
    }

    generateSvg(addViewBox=true, dimensions=false)
    //============================================
    {
        const svgNode = document.createElementNS(SVG_NS, 'svg');
        svgNode.setAttribute('xmlns', SVG_NS);
        svgNode.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
        svgNode.setAttribute('version', SVG_VERSION);
        if (dimensions) {
            svgNode.setAttribute('width', `${this.width}`);
            svgNode.setAttribute('height', `${this.height}`);
        }
        if (addViewBox) {
            svgNode.setAttribute('viewBox', `0 0 ${this.width} ${this.height}`);
        }

//        for (let c of this.compartments) {
//            svg.extend(c.svg());
//        }

        if (this.background) {
            const background = document.createElementNS(SVG_NS, 'image');
            background.setAttribute('xlink:href', this.background);
            background.setAttribute('width', `${this.width}`);
            background.setAttribute('height', `${this.height}`);
            svgNode.appendChild(background);
        }

        if (this.flatMap !== null) {
            svgNode.appendChild(this.flatMap.generateSvg());
        }

        if (this.bondGraph !== null) {
            svgNode.appendChild(this.bondGraph.generateSvg());
        }

//        for (let transporter of this.transporters) {
//            svg.extend(transporter.svg());
//        }

        svgNode.appendChild(this.svgFactory.defines());

        return svgNode;
    }

    addManualPositionedElement(element)
    //=================================
    {
        if (!this._manualPositions.includes(element.id)) {
            this._manualPositions.push(element.id);
        }
        this.updateManualAdjustments();
    }

    addManualResizedElement(element)
    //==============================
    {
        if (!this._manualSizes.includes(element.id)) {
            this._manualSizes.push(element.id);
        }
        // Resizing also moves centre
        this.addManualPositionedElement(element);
    }

    updateManualAdjustments()
    //=======================
    {
        if (this.textEditor !== null) {
            const positions = ['<style id="manual_adjustments">'];
            for (let id of this._manualPositions) {
                const e = this.findElement(id);
                if (e !== null) {
                    positions.push(`    ${e.id} { position: ${e.positionToString()}; }`);
                }
            }
            for (let id of this._manualSizes) {
                const e = this.findElement(id);
                if (e !== null) {
                    positions.push(`    ${e.id} { size: ${e.sizeToString()}; }`);
                }
            }
            positions.push('</style>');

            const stylePositionRegExp = new RegExp(`<style id=(["'])manual_adjustments\\1>[\\s\\S]*</style>`);

            // NB. Ace editor search and replace appears to be broken so
            //     we simply use Javascript string methods
            const text = this.textEditor.getValue();
            if (text.search(stylePositionRegExp) >= 0) {
                this.textEditor.setValue(text.replace(stylePositionRegExp, positions.join("\n    ")));
            } else {
                const cellDiagramEndRegExp = new RegExp(`(\\n?)([ \\t]*)(</cell-diagram>)`);
                this.textEditor.setValue(text.replace(cellDiagramEndRegExp,
                    `$1    ${positions.join("\n    ")}\n$2$3`));
            }
            this.textEditor.clearSelection();
        }
    }

    setManualAdjustedElements(styleRules)
    //===================================
    {
        const [positioned, resized] = stylesheet.adjustedElements(styleRules);
        for (let id of positioned) {
            if (!this._manualPositions.includes(id)) {
                this._manualPositions.push(id);
            }
        }
        for (let id of resized) {
            if (!this._manualSizes.includes(id)) {
                this._manualSizes.push(id);
            }
        }
    }

}

//==============================================================================
