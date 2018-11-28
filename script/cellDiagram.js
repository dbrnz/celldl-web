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

import * as background from './background.js';
import * as bondgraph from './bondgraph.js';
import * as config from '../config.js';
import * as exception from './exception.js';
import * as flatmap from './flatmap.js';
import * as geo from './geometry.js';
import * as layout from './layout.js';
import * as stylesheet from './stylesheet.js';
import * as utils from './utils.js';

import {CELLDL_NAMESPACE, DiagramElement} from './elements.js';
import {CyElementList} from './cytoscape.js';
import {SvgFactory, SVG_NS, SVG_VERSION} from './svgElements.js';

//==============================================================================

export class CellDiagram {
    constructor(id, textEditor=null)
    {
        this.id = id;
        this.stylesheet = new stylesheet.StyleSheet();
        this.textEditor = textEditor;
        this._elements = [];
        this._elementsById = {};
        this._connections = [];
        this._connectionsById = {};
        this.width = 0;
        this.height = 0;
        this.diagonal = 0;
        this.background = null;
        this.flatMap = null;
        this.bondGraph = null;
        this.svgFactory = new SvgFactory(id);
        this.position = new layout.Position(this, this, null);
        this.size = new layout.Size(this, null);
        this._manualPositions = [];
        this._manualSizes = [];
    }

    parseDocument(xmlDocument)
    //========================
    {
        if (xmlDocument === null || xmlDocument.children.length != 1) {
            throw new exception.SyntaxError(xmlDocument, "Invalid XML document");
        }

        const xmlRoot = xmlDocument.children[0];

        if (xmlRoot.hasAttribute('xmlns') && xmlRoot.getAttribute('xmlns') !== CELLDL_NAMESPACE) {
            throw new exception.SyntaxError(xmlRoot, "Not a CellDL document");
        } else if (xmlRoot.nodeName !== 'cell-diagram') {
            throw new exception.SyntaxError(xmlRoot, "Root tag must be <cell-diagram>");
        }

        let asyncFetchs = [];
        asyncFetchs.push(this.stylesheet.loadDefaultStylesheet());

        // Scan for top level elements, make sure there are no more than one
        // of each, but don't create diagram elements until all stylesheets
        // have been loaded

        let bondGraphElement = null;
        let flatMapElement = null;
        let diagramElement = null;

        for (let domElement of xmlRoot.children) {
            if (domElement.nodeName === 'background') {
                if (this.background === null) {
                    this.background = new background.Background(this, domElement);
                    this.position.addDependent(this.background);
                    asyncFetchs.push(this.background.loadImage());
                } else {
                    throw new exception.SyntaxError(domElement, "Can only declare a single <background>");
                }
            } else if (domElement.nodeName === 'bond-graph') {
                if (bondGraphElement === null) {
                    bondGraphElement = domElement;
                } else {
                    throw new exception.SyntaxError(domElement, "Can only declare a single <bond-graph>");
                }
            } else if (domElement.nodeName === 'flat-map') {
                if (flatMapElement === null) {
                    flatMapElement = domElement;
                } else {
                    throw new exception.SyntaxError(domElement, "Can only declare a single <flat-map>");
                }
            } else if (domElement.nodeName === 'diagram') {
                if ((diagramElement === null)) {
                     diagramElement = domElement;
                } else {
                    throw new exception.SyntaxError(domElement, "Can only declare a single <diagram>");
                }
            } else if (domElement.nodeName === 'style') {
                if (domElement.hasAttribute('src')) {
                    asyncFetchs.push(this.stylesheet.fetchStyles(domElement.getAttribute('src')));
                } else {
                    this.stylesheet.addStyles(domElement.textContent);
                    if (domElement.id === 'manual_adjustments') {
                        this.setManualAdjustedElements(domElement.textContent);
                    }
                }
            } else {
                throw new exception.SyntaxError(domElement, "Unknown CellDL element");
            }
        }

        // The graphical editor requires a <bond-graph> node on which to addXML()
        // But what if an empty/new document...

        if (bondGraphElement === null) {
            bondGraphElement = document.createElementNS(CELLDL_NAMESPACE, 'bond-graph');
            // and then parseBondGraph creates diagram.bondGraph
        }

        // Only parse top level XML elements after all stylesheets have been loaded
        return Promise.all(asyncFetchs)
                      .then(() => {
                            const style = this.stylesheet.style(xmlRoot);
                            if ('width' in style) {
                                this.width = stylesheet.parseNumber(style.width);
                            }
                            if ('height' in style) {
                                this.height = stylesheet.parseNumber(style.height);
                            }
                            if (bondGraphElement !== null) {
                                this.bondGraph = new bondgraph.BondGraph(this, bondGraphElement);
                                this.position.addDependent(this.bondGraph);
                            }
                            if (flatMapElement !== null) {
                                this.flatMap = new flatmap.FlatMap(this, flatMapElement);
                                this.position.addDependent(this.flatMap);
                            }
                        },
                        error => { throw error ; })
                      .catch(error => { throw error; });
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
        if (connection.id !== '') {
            if (connection.id in this._connectionsById) {
                throw new exception.KeyError(`Duplicate connection 'id': ${connection.id}`);
            }
            this._connectionsById[connection.id] = connection;
        }
        this._connections.push(connection);
    }

    connections()
    //===========
    {
         return this._connections;
    }

    findConnection(id)
    //================
    {
        return (id in this._connectionsById) ? this._connectionsById[id] : null;
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

    clusterConnections(edges)
    //=======================
    {
        const angleStrength = 0.5;
        const neighbours = 4;
        const groupCompare = null;
        const delta = 0.8;   // 80%

        const bundler = new Bundler();
        bundler.options.angleStrength = angleStrength;
        bundler.options.sort = groupCompare;

        bundler.setNodes(edges);
        bundler.buildNearestNeighborGraph(neighbours);
        bundler.MINGLE();

        bundler.graph.each(node => {
            const edges = node.unbundleEdges(delta);
            for (let edge of edges) {
                const connection = this.findConnection(edge[0].node.id);
                if (connection) {
                    const points = [];
                    for (let e of edge) {
                        points.push(e.unbundledPos);
                    }
                    // Best way to do this??
                    connection._path = new geo.PolyLine(points);
                }
            }
        });
    }

    layoutConnections()
    //=================
    {
        // Assign paths to all connections

        const connectionEdges = [];
        for (let connection of this._connections) {
            connection.assignPath();
            const path = connection.path;
            if (path) {  // && config.cluster_edges
                const start = path.start;
                const end = path.end;
                if (start && end) {
                    connectionEdges.push({ id: connection.id,
                                           name: connection.id,
                                           data: { coords: [start.x,start.y,
                                                            end.x,end.y] }
                                        });
                }
            }
        }
        if (connectionEdges.length) {
            this.clusterConnections(connectionEdges);
        }

    }

    layout(width=config.DIAGRAM.WIDTH, height=config.DIAGRAM.HEIGHT)
    //==============================================================
    {
        if (this.width === 0) this.width = width;
        if (this.height === 0) this.height = height;
        this.diagonal = Math.sqrt(this.width*this.width + this.height*this.height);

        // Set our position and size

        this.position.setCoordinates(new geo.Point(this.width/2, this.height/2));
        this.size.setPixelSize([this.width, this.height]);

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

        // Layout the diagram

        this.position.layoutDependents();
        this.layoutConnections();
    }

    cyElements()
    //==========
    {
        const cyElementList = new CyElementList;
        if (this.flatMap !== null) {
            cyElementList.extend(this.flatMap.cyElements());
        }
        if (this.bondGraph !== null) {
            cyElementList.extend(this.bondGraph.cyElements());
        }
// Add custom styles...
        return cyElementList.elements;
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

        if (this.background !== null) {
            svgNode.appendChild(this.background.generateSvg());
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

        svgNode.appendChild(this.svgFactory.definitions());

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
