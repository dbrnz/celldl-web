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

import {CellDiagram} from './cellDiagram.js';
import {DiagramEditor} from './diagramEditor.js';
import {Palette} from './palette.js';
import {StyleSheet} from './stylesheet.js';
import {TextEditor} from './textEditor.js';

import {saveAs} from '../thirdparty/FileSaver.js';
import {SVG_NS} from './svgElements.js';

//==============================================================================

class CellDlFile
{
    constructor(htmlContainerId, paletteId)
    {
        this._editor = new TextEditor();
        // Check editor.isClean() before loading a new file or closing window
        // and then editor.markClean()

        this._loadedFile = '';
        this._cy = cytoscape({
            container:
                document.getElementById(htmlContainerId),
            style: [
                {   selector: 'node',
                    css: {
                        shape: 'roundrectangle',
                    }
                },
                {   selector: 'node[shape]',
                    css: {
                        shape: 'data(shape)',
                        'background-image': e => CellDlFile.cyElementSvg(e),
                        'background-fit': 'cover',
                        'background-clip': 'none',
                        'background-opacity': 0
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
                        'target-arrow-shape': 'triangle'
                    }
                },
                {   selector: 'edge[colour]',
                    css: {
                        'line-color': 'data(colour)'
                    }
                }
            ],
            layout: {
                name: 'preset',
                fit: true,
                padding: 0
            }
        });
        this._palette = new Palette(document.getElementById(paletteId));
        this.diagram = null;

        // Start with an empty diagram
        this._editor.setValue(`<cell-diagram>
    <style>
        cell-diagram {
            width:  500;  /* SVG 'pixels' */
            height: 500;  /* SVG 'pixels' */
        }
    </style>
</cell-diagram>`);
        this._editor.clearSelection();
        this.previewSvg();
    }

    upLoadedFileAsText(file)
    //======================
    {
        const reader = new FileReader();

        return new Promise((resolve, reject) => {
            reader.onerror = () => {
                reader.abort();
                reject(reader.error);
            }
            reader.onload = () => {
                resolve(reader.result);
            }

            this._loadedFile = file.name;
            reader.readAsText(file);
        });
    }

    load(fileList)
    //============
    {
    // Also want to be able to load remote file by URL
        for (let file of fileList) {
            this.upLoadedFileAsText(file).then(text => {
                this._editor.setValue(text, 0);
                this._editor.clearSelection();
                this.previewSvg();
            });
            break;
        }
    }

    save()
    //====
    {
        const text = this._editor.getValue();
        const blob = new Blob([text], { type: "application/xml;charset=utf-8" });
        saveAs(blob, this.loadedFile);
    }

    displayDiagram()
    //==============
    {
        return new Promise((resolve, reject) => {
            // Remove any existing content from our container

            this._cy.remove('*');

            const cellDlText = this._editor.getValue();
            if (cellDlText === '') {
                reject("No CellDL to display");
            }

            const domParser = new DOMParser();
            const xmlDocument = domParser.parseFromString(cellDlText, "application/xml");
            document.body.style.cursor = 'wait';

            const cellDiagram = new CellDiagram('diagram', this._editor);
            try {
              cellDiagram.parseDocument(xmlDocument)
                .then(() => {
                    try {
                        cellDiagram.layout();  // Pass width/height to use as defaults...

                        const cyElements = cellDiagram.cyElements();
//console.log(JSON.stringify(cyElements, null, 4));
                        this._cy.add(cyElements);

                        // Reset busy wheel
                        document.body.style.cursor = 'default';

                        resolve(cellDiagram);
                    } catch (error) {
                        reject(error);
                    }
                }, error => { throw error; })
                .catch(error => {
                    reject(error);
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    static cyElementSvg(e)
    //====================
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
//        console.log(svg.join('\n'));
        return `data:image/svg+xml;utf8,<?xml version="1.0" encoding="UTF-8"?>${encodeURIComponent(svg.join('\n'))}`;
    }

    previewSvg()
    //==========
    {
        this.displayDiagram().then(
            (diagram) => { this._diagram = diagram; },
            (error) => {
                document.body.style.cursor = 'default';
                console.trace(error);
                alert(error);
                this._diagram = null;
            });
    }

    saveSvg(svgDiagram)
    //=================
    {
        const svg = svgDiagram.outerHTML;
        const blob = new Blob([svg], { type: "image/svg+xml" });
        const svgFileName = `${this._loadedFile.split('.')[0]}.svg`
        saveAs(blob, svgFileName);
    }

    exportSvg()
    //=========
    {
        // Render the diagram without selected elements and grid

        const svgDiagram = this._diagram.generateSvg();
        this.saveSvg(svgDiagram);
    }

    connectionMatrix(connectionMatrixId)
    //==================================
    {
        const connections = this._diagram.bondGraph.adjacencyMatrix();

        const html = ['<div>'];
        // NB. close must be a button we listen for as `href` refreshes page...
        html.push(' <a href="" class="connection-popup-close" title="Close">X</a>');
        html.push(' <div class="connection-table">');
        let r = 1;
        for (let row of connections) {
            const cls = (r == 1) ? ' label'
                       : (r % 2) ? ' odd'
                       : '';
            html.push(`  <div class="connection-row${cls}">`);
            let c = 1;
            for (let cell of row) {
                const cls_id = (r == 1 && c == 1) ? '" id="cell00'
                             : (r == 1 || c == 1) ? ' label'
                             : (c % 2) ? ' odd'
                             : '';
                const value = (cell != 0) ? cell : '';
                html.push(`   <span class="connection-cell${cls_id}">${value}</span>`);
                c += 1;
            }
            html.push('  </div>');
            r += 1;
        }
        html.push(' </div>');
        html.push('</div>');
        const matrixHtml = html.join('\n');

        const matrixElement = document.getElementById(connectionMatrixId);
        matrixElement.innerHTML = matrixHtml;

        matrixElement.style.opacity = 1;
        matrixElement.style['pointer-events'] = 'auto';
    /*
        close
            opacity:0;
            pointer-events: none;
            clear innerHtml
    */
    }
}

//==============================================================================

export function main(htmlContainerId, paletteId)
{
    const cellDlFile = new CellDlFile(htmlContainerId, paletteId);

    // Expose editor's functions to HTML elements

    window.loadCellDl = (fileList) => cellDlFile.load(fileList);
    window.saveCellDl = () => cellDlFile.save();
    window.previewSvg = () => cellDlFile.previewSvg();
    window.exportSvg = () => cellDlFile.exportSvg();
    window.connectionMatrix = () => cellDlFile.connectionMatrix();

}

//==============================================================================

