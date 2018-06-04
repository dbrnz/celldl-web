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
import * as layout from './layout.js';
import * as stylesheet from './stylesheet.js';
import * as svgElements from './svgElements.js';

import {DiagramElement} from './element.js';
import {List} from './utils.js';
import {SVG_NS, SVG_VERSION} from './svgElements.js';

//==============================================================================

// The cell diagram we are creating

let cellDiagramInstance = null;

//==============================================================================

export class CellDiagram {
    constructor()
    {
        if (cellDiagramInstance === null) {
            cellDiagramInstance = this;
            this.reset();
        }
        return cellDiagramInstance;
    }

    reset()
    //=====
    {
        this._elements = [];
        this._elementsById = {};
        this._edges = [];
        this.width = 0;
        this.height = 0;
    }

    static instance()
    //===============
    {
        if (cellDiagramInstance === null) {
            return new CellDiagram();
        } else {
            return cellDiagramInstance;
        }
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
        return [this.width, this.height]
    }

    addElement(element)
    //=================
    {
        this._elements.push(element);
        if (element.id in this._elementsById) {
            throw new exception.KeyError(element.domElement, `Duplicate element 'id': ${element.id}`);
        }
        this._elementsById[element.id] = element;
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

    layout(drawDependencyGraph=false)
    //===============================
    {
        /*
        Set positions (and sizes) of all components in the diagram.

        We position and size all compartments before positioning
        other elements.
        */
        let dependencyGraph = new jsnx.DiGraph();

        for (let element of this._elements) {
            element.resolveReferences();
            element.parsePosition();
            if (element.hasValidPosition) {
                dependencyGraph.addNode(element);
            }
        }
        for (let node of dependencyGraph) {
            for (let dependency of node.position.dependencies) {
                dependencyGraph.addEdge(dependency, node);
            }
        }

        if (drawDependencyGraph) {
            jsnx.draw(dependencyGraph, {
                element: '#canvas',
                withLabels: true,
                stickyDrag: true,
                edgeStyle: {
                    'stroke-width': 10,
                    fill: '#999'
                }
            });
        }

        const unitConverter = new layout.UnitConverter([this.width, this.height], [this.width, this.height]);
        for (let node of jsnx.topologicalSort(dependencyGraph)) {
            node.assignCoordinates(unitConverter);
//                if (node instanceof Compartment) {
//                    node.setPixelSize(node.container.unitConverter.toPixelPair(node.size.size, false));
//                    node.setUnitConverter(new layout.UnitConverter(this.pixelSize, node.pixelSize, node.position.pixels));
//                }
        }

        for (let edge of this._edges) {
            edge.resolveReferences();
            edge.parseLine();
            edge.assignPath(unitConverter);
        }

 // Space flow lines going through a transporter
 //       bondGraph.setOffsets();
    }

    generateSvg()
    //===========
    {
        svgElements.DefinesStore.reset()

        const svgNode = document.createElementNS(SVG_NS, 'svg');
        svgNode.setAttribute('xmlns', SVG_NS);
        svgNode.setAttribute('version', SVG_VERSION);
        svgNode.setAttribute('viewBox', `0 0 ${this.width} ${this.height}`);

//        for (let c of this.compartments) {
//            svg.extend(c.svg());
//        }

        svgNode.appendChild(bondgraph.generateSvg(svgNode));

//        for (let transporter of this.transporters) {
//            svg.extend(transporter.svg());
//        }

        svgNode.appendChild(svgElements.DefinesStore.defines());

        return svgNode;
    }
}

//==============================================================================
