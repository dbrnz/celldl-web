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

import {SVG_NS} from './svgElements.js';

//==============================================================================

export class Cytoscape
{
    constructor(containerId)
    {
        this._cy = cytoscape({
            container:
                document.getElementById(containerId),
            style: [
                {   selector: 'node',
                    css: {
                        shape: 'roundrectangle',
                    }
                },
                {   selector: 'node[colour]',
                    css: {
                        'background-color': 'data(colour)',
                        'background-opacity': 'data(opacity)'
                    }
                },
                {   selector: 'node[image]',
                    css: {
                        'background-image': 'data(image)',
                        'background-fit': 'cover',
                        'background-clip': 'none',
                        'background-opacity': 0
                    }
                },
                {   selector: 'node[shape]',
                    css: {
                        shape: 'data(shape)',
                        'background-image': e => Cytoscape._cyElementSvg(e),
                        'background-fit': 'cover',
                        'background-clip': 'none',
                        'background-opacity': 0
                    }
                },
                {   selector: 'node[stroke]',
                    css: {
                        'border-color': 'data(stroke)',
                        'border-opacity': 'data(strokeOpacity)',
                        'border-width': 'data(strokeWidth)'
                    }
                },
                {   selector: 'node[width]',
                    css: {
                        width: 'data(width)',
                        height: 'data(height)'
                    }
                },
                {   selector: 'edge',
                    css: {
                        'curve-style': 'bezier',
                        'target-arrow-shape': 'triangle-backcurve'
                    }
                },
                {   selector: 'edge[colour]',
                    css: {
                        'line-color': 'data(colour)',
                        'target-arrow-color': 'data(colour)'
                    }
                },
                {
                    selector: 'edge[cy-expand-collapse-meta-edge]',
                    css: {
                        'curve-style': 'unbundled-bezier',
                        'control-point-distances': '0 0 0',
                    }
                },
                // edge handle styling
                {
                    selector: '.eh-handle',
                    style: {
                        'background-color': 'red',
                        'width': 12,
                        'height': 12,
                        'shape': 'ellipse',
                        'overlay-opacity': 0,
                        'border-width': 0,
                        'border-opacity': 0
                    }
                },
                {
                    selector: '.eh-hover',
                    style: {
                        'background-color': 'red'
                  }
                },
                {
                    selector: '.eh-source',
                    style: {
                        'border-width': 4,
                        'border-color': 'red',
                        'border-opacity': 1
                    }
                },
                {
                    selector: '.eh-target',
                    style: {
                        'border-width': 4,
                        'border-color': 'red',
                        'border-opacity': 1
                    }
                },
                {
                    selector: '.eh-preview, .eh-ghost-edge',
                    style: {
                        'background-color': 'red',
                        'line-color': 'red',
                        'target-arrow-color': 'red',
                        'source-arrow-color': 'red'
                    }
                },
                {
                    selector: '.eh-ghost-edge.eh-preview-active',
                    style: {
                        'opacity': 0
                    }
                }
            ],
            layout: {
                name: 'preset',
                fit: true,
                padding: 0
            }
        });

        this._diagram = null;

        this._tapStartElement = null;
        this._tapStartPos = null;
        this._cy.on('tapstart tapend', 'node', this._tapEvent.bind(this));

        this._cyBottomLayer = this._cy.cyCanvas({ zIndex: -1 });
        this._cyCtx = this._cyBottomLayer.getCanvas().getContext("2d");
        this._cyBackgroundImage = null;
        this._cy.on("render cyCanvas.resize", this._renderBottomLayer.bind(this));

        this._cy.edgehandles({
            handlePosition: node => 'middle middle'
        });

        this._cy.expandCollapse({
            layoutBy: {
                name: 'preset',
                animate: false,
                randomize: false,
                fit: true
            },
            fisheye: true,
            animate: false,
            undoable: false
        });
    }

    asPng(options={})
    //===============
    {
        const opts = Object.assign({scale: 1, full: true}, options);
        return this._cy.png(opts);
    }

    asSvg(options={})
    //===============
    {
        const opts = Object.assign({scale: 1, full: true}, options);
        return this._cy.svg(opts);
    }

    /**
      * Display a diagram using Cytoscape
      *
     **/
    display(diagram)
    //==============
    {
        this._diagram = diagram;

        // Zoom to fit diagram to canvas
        const dw = diagram.width;
        const dh = diagram.height
        const sw = this._cyBottomLayer.getCanvas().width;
        const sh = this._cyBottomLayer.getCanvas().height;
        this._cy.zoom((dw*sh > dh*sw) ? sw/dw : sh/dh);

        // Set the background image if one is specified
        if (diagram.background !== null) {
            this._cyBackgroundImage = diagram.background.svgImage;
        }

        const cyElements = diagram.cyElements();

//console.log(JSON.stringify(cyElements, null, 4));
        this._cy.add(cyElements);

        this._cy.fit();
    }

   /**
      * Remove existing content from our container
      * and reset zoom and pan.
    **/
    reset()
    //=====
    {
        this._cy.remove('*');
        this._cy.reset();
        this._cyBackgroundImage = null;
        this._cyBottomLayer.clear(this._cyCtx);
        this._diagram = null;
    }

    resize()
    //======
    {
        this._cy.resize();
    }

    _tapEvent(evt)
    //============
    {
        const pos = evt.position;
        if (evt.type === 'tapstart') {
            console.log(`Start move ${evt.target.id()} at (${pos.x}, ${pos.y})`);
            this._dragging = true;  // Or save node id and check this matches...
        } else if (evt.type === 'tapdrag' && this._dragging) {
            console.log(`Moving ${evt.target.id()} to (${pos.x}, ${pos.y})`);
        } else if (evt.type === 'tapend') {
            console.log(`Moved ${evt.target.id()} to (${pos.x}, ${pos.y})`);
            //this._dragging = false;
        }
    }

    _renderBottomLayer(evt)
    //=====================
    {
        // Draw the background image if it's been set
        if (this._cyBackgroundImage !== null) {
            this._cyBottomLayer.resetTransform(this._cyCtx);
            this._cyBottomLayer.clear(this._cyCtx);
            this._cyBottomLayer.setTransform(this._cyCtx);
            this._cyCtx.save();
            this._cyCtx.drawImage(this._cyBackgroundImage, 0, 0, this._diagram.width, this._diagram.height);
            this._cyCtx.restore();
        }
    }

    static _cyElementSvg(e)
    //=====================
    {
        const width = e.data('width');
        const height = e.data('height');
        const svg = [[`<svg xmlns="${SVG_NS}" xmlns:xlink="http://www.w3.org/1999/xlink"`,
                      `viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`].join(' ')];
        const elementAsSvg = e.scratch()._elementAsSvg;
        const elementSvg = elementAsSvg.svgNode.outerHTML;
        const defs = new Map();
        const urlIds = elementSvg.match(/url\(#[^)]+\)/g);
        if (urlIds) {
            for (let urlId of urlIds) {
                const id = urlId.substring(5, urlId.length-1);
                if (!defs.has(id)) {
                    const definition = elementAsSvg.svgFactory.getDefinition(id);
                    if (definition) {
                        defs.set(id, definition);
                    }
                }
            }
        }
        if (defs.size > 0) {
            svg.push(`<defs>${Array.from(defs.values()).join('\n')}</defs>`)
        }
        svg.push(elementSvg);
        svg.push('</svg>')
        // TODO: See https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/Base64_encoding_and_decoding#The_Unicode_Problem
        // for a better way to do this.
        return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg.join('\n'))) )}`;
    }
}

//==============================================================================

export class CyElementList
{
    constructor(nodes=[], edges=[])
    {
        this._elements = { nodes: nodes, edges: edges };
    }

    get elements()
    //============
    {
        return this._elements;
    }

    extend(elements)
    //==============
    {
        for (let n of elements.nodes) {
            this._elements.nodes.push(n);
        }
        for (let e of elements.edges) {
            this._elements.edges.push(e);
        }
    }
}

//==============================================================================
