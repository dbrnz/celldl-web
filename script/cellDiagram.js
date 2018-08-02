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

import '../thirdparty/jsnetworkx.js';

//==============================================================================

import * as bondgraph from './bondgraph.js';
import * as exception from './exception.js';
import * as geo from './geometry.js';
import * as components from './components.js';
import * as layout from './layout.js';
import * as stylesheet from './stylesheet.js';

import {DiagramElement} from './element.js';
import {SvgFactory, SVG_NS, SVG_VERSION} from './svgElements.js';

//==============================================================================

export class CellDiagram {
    constructor(id, stylesheet, editor=null)
    {
        this.id = id;
        this.stylesheet = stylesheet;
        this.editor = editor;
        this._elements = [];
        this._elementsById = {};
        this._edges = [];
        this.width = 0;
        this.height = 0;
        this.componentGroups = new components.ComponentGroups(this);
        this.bondGraph = new bondgraph.BondGraph(this);
        this.svgFactory = new SvgFactory(id);
        this._manualPositions = [];
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

    addEdge(edge)
    //===========
    {
        this._edges.push(edge);
    }

    edges()
    //=====
    {
         return this._edges;
    }

/* FUTURE ??
    edgesTo(fromId)
    //=============
    {
         return Array.from(this._edges).filter(edge => edge.id.split(' ')[1] === fromId)
    }

    elementsFrom(element)
    //===================
    {
        return this.edgesFrom(element.id).filter(id => this._elementsById[id])
    }

    elementsTo(element)
    //===================
    {
        return this.edgesTo(element.id).filter(id => this._elementsById[id])
    }
*/

    layout(width=0, height=0)
    //=======================
    {
        /*
        Set positions (and sizes) of all components in the diagram.

        We position and size all compartments before positioning
        other elements.
        */
        if (this.width === 0) this.width = width;
        if (this.height === 0) this.height = height;

        let dependencyGraph = new jsnx.DiGraph();

        for (let element of this._elements) {
            element.resolveReferences();
            element.parsePosition();
            if (!element.hasValidPosition) {
                element.position.coordinates = new geo.Point(25, 20);
            }
            dependencyGraph.addNode(element);

        }
        for (let node of dependencyGraph) {
            for (let dependency of node.position.dependencies) {
                dependencyGraph.addEdge(dependency, node);
            }
        }

        for (let edge of this._edges) {
            edge.resolveReferences();
        }


        const diagramUnitConverter = new layout.UnitConverter([this.width, this.height]);

// Each group has its own unit converter
        this.componentGroups.setUnitConverter(diagramUnitConverter);

        for (let node of jsnx.topologicalSort(dependencyGraph)) {
            if (!(node instanceof components.Group)) {
                node.assignCoordinates(diagramUnitConverter);
            }
            node.assignGeometry();
        }
/*
            if (node instanceof components.Group) {
                // push current UC ??
                // node.group ??

                // diagram.uc

                node.setSizeAsPixels(node.container.unitConverter.toPixelPair(node.size.size, false));
                node.setUnitConverter(new layout.UnitConverter(this.pixelSize, node.pixelSize, node.position.asPixels));
            }
*/

        for (let edge of this._edges) {
            edge.parseLine();
            edge.setUnitConverter(diagramUnitConverter);
            edge.assignPath();
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

        const componentGroupsSvg = this.componentGroups.generateSvg();
        const bondgraphSvg = this.bondGraph.generateSvg();

//        for (let transporter of this.transporters) {
//            svg.extend(transporter.svg());
//        }

        svgNode.appendChild(this.svgFactory.defines());

        svgNode.appendChild(componentGroupsSvg);
        svgNode.appendChild(bondgraphSvg);

        return svgNode;
    }

    addManualPositionedElement(element)
    //=================================
    {
        if (!this._manualPositions.includes(element.id)) {
            this._manualPositions.push(element.id);
        }

        if (this.editor !== null) {
            const positions = ['<style id="manual_positions">'];
            for (let id of this._manualPositions) {
                const e = this.findElement(id);
                if (e !== null) {
                    let w = 100*e.coordinates.x/this.width;
                    if (w < 0) w = 0; else if (w > 100) w = 100;
                    let h = 100*e.coordinates.y/this.height;
                    if (h < 0) h = 0; else if (h > 100) h = 100;
                    positions.push(`    ${e.id} { position: ${w.toFixed(2)}%, ${h.toFixed(2)}%; }`);
                }
            }
            positions.push('</style>');

            const stylePositionRegExp = new RegExp(`<style id=(["'])manual_positions\\1>[\\s\\S]*</style>`);

            // NB. Ace editor search and replace appears to be broken so
            //     we simply use Javascript string methods
            const text = this.editor.getValue();
            if (text.search(stylePositionRegExp) >= 0) {
                this.editor.setValue(text.replace(stylePositionRegExp, positions.join("\n    ")));
            } else {
                const cellDiagramEndRegExp = new RegExp(`(\\n?)([ \\t]*)(</cell-diagram>)`);
                this.editor.setValue(text.replace(cellDiagramEndRegExp,
                    `$1    ${positions.join("\n    ")}\n$2$3`));
            }
            this.editor.clearSelection();
        }
    }

    setManualPositionedElements(styleRules)
    //=====================================
    {
        const ids = stylesheet.positionedElements(styleRules);
        for (let id of ids) {
            if (!this._manualPositions.includes(id)) {
                this._manualPositions.push(id);
            }
        }
    }

}

//==============================================================================
