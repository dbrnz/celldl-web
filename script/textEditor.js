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

import {displayDiagram} from './main.js';
import {Palette} from './palette.js';

//==============================================================================

import {saveAs} from '../thirdparty/FileSaver.js';

//==============================================================================

export class TextEditor
{
    constructor()
    {
        this.editor = ace.edit("celldl-editor");
        this.editor.setTheme("ace/theme/xcode");
        this.editor.setOptions({
            autoScrollEditorIntoView: true,
            hScrollBarAlwaysVisible: true
        });
        this.editor.session.setMode("ace/mode/xml");

        // Check editor.isClean() before loading a new file or closing window
        // and then editor.markClean()

        this.diagram = null;
        this.loadedFile = '';
        this.svgContainerNode = document.getElementById('cell-diagram');
        this.palette = new Palette(document.getElementById('palette'));
    }

    clearSelection()
    //==============
    {
        this.editor.clearSelection();
    }

    getValue()
    //========
    {
        return this.editor.getValue();
    }

    setValue(text, pos)
    //=================
    {
        this.editor.setValue(text, pos);
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

            this.loadedFile = file.name;
            reader.readAsText(file);
        });
    }

    loadCellDl(files)
    //===============
    {
        for (let file of files) {
            this.upLoadedFileAsText(file).then(text => {
                this.editor.setValue(text, 0);
                this.editor.clearSelection();
                this.previewSvg();
            });
            break;
        }
    }

    saveCellDl()
    //==========
    {
        const text = this.editor.getValue();
        const blob = new Blob([text], { type: "application/xml;charset=utf-8" });
        saveAs(blob, this.loadedFile);
    }

    previewSvg()
    //==========
    {
        displayDiagram(this, this.svgContainerNode, this.palette).then(
            (diagram) => { this.diagram = diagram; },
            (error) => {
                document.body.style.cursor = 'default';
                console.trace(error);
                alert(error);
                this.diagram = null;
            });
    }

    saveSvg(svgDiagram)
    //=================
    {
        const svg = svgDiagram.outerHTML;
        const blob = new Blob([svg], { type: "image/svg+xml" });
        const svgFileName = `${this.loadedFile.split('.')[0]}.svg`
        saveAs(blob, svgFileName);
    }

    exportSvg()
    //=========
    {
        // Render the diagram without selected elements and grid

        this.diagram.svgFactory.resetPromises();

        const svgDiagram = this.diagram.generateSvg();

        // Wait until all MathJax text has been rendered

        if (this.diagram.svgFactory.promises().length) {
            Promise.all(this.diagram.svgFactory.promises()).then(() => {
                this.saveSvg(svgDiagram);
            });
        } else {
            this.saveSvg(svgDiagram);
        }
    }

    connectionMatrix()
    //================
    {
        const connections = this.diagram.bondGraph.connectionMatrix();

        const html = ['<div>'];
        html.push(' <a href="" class="connection-popup-close" title="Close">X</a>');
        html.push(' <div class="connection-table">');
        let r = 1;
        for (let row of connections) {
            const odd = (r % 2) ? ' odd' : '';
            html.push(`  <div class="connection-row${odd}">`);
            let c = 1;
            for (let cell of row) {
                const odd = (c % 2) ? ' odd' : '';
                const value = (cell != 0) ? cell : '';
                html.push(`   <span class="connection-cell${odd}">${value}</span>`);
                c += 1;
            }
            html.push('  </div>');
            r += 1;
        }
        html.push(' </div>');
        html.push('</div>');
        const matrixHtml = html.join('\n');

        const matrixElement = document.getElementById('connection-matrix');
        matrixElement.innerHTML = matrixHtml;

        matrixElement.style.opacity = 1;
        matrixElement.style['pointer-events'] = 'auto';
    }
}

//==============================================================================
