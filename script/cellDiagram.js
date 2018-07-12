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

import {DiagramElement} from './element.js';
import {SvgFactory, SVG_NS, SVG_VERSION} from './svgElements.js';

//==============================================================================

export class CellDiagram {
    constructor(id, stylesheet)
    {
        this.id = id;
        this.stylesheet = stylesheet;
        this._elements = [];
        this._elementsById = {};
        this._edges = [];
        this.width = 0;
        this.height = 0;
        this.bondGraph = new bondgraph.BondGraph(this);
        this.svgFactory = new SvgFactory(id);
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
            if (element.hasValidPosition) {
                dependencyGraph.addNode(element);
            }
        }
        for (let node of dependencyGraph) {
            for (let dependency of node.position.dependencies) {
                dependencyGraph.addEdge(dependency, node);
            }
        }

        for (let edge of this._edges) {
            edge.resolveReferences();
        }

        const unitConverter = new layout.UnitConverter([this.width, this.height], [this.width, this.height]);
        for (let node of jsnx.topologicalSort(dependencyGraph)) {
            node.assignCoordinates(unitConverter);
            node.assignGeometry();
//                if (node instanceof Compartment) {
//                    node.setPixelSize(node.container.unitConverter.toPixelPair(node.size.size, false));
//                    node.setUnitConverter(new layout.UnitConverter(this.pixelSize, node.pixelSize, node.position.pixels));
//                }
        }

        for (let edge of this._edges) {
            edge.parseLine();
            edge.assignPath(unitConverter);
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

        const bondgraphSvg = this.bondGraph.generateSvg();

//        for (let transporter of this.transporters) {
//            svg.extend(transporter.svg());
//        }

        svgNode.appendChild(this.svgFactory.defines());

        svgNode.appendChild(bondgraphSvg);

        return svgNode;
    }

    highlight(element, highlight)
    //===========================
    {
        element.updateSvg(highlight);
    }

    reposition(element, offset, highlight=false)
    //==========================================
    {
        element.position.addOffset(offset);
        element.assignGeometry();

        for (let edge of element.edges) {
            edge.reassignPath();
            edge.updateSvg();
        }

        element.updateSvg(highlight);
    }



}

//==============================================================================
