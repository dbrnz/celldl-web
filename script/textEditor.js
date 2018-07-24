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
import {ToolBar} from './toolbar.js';

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
        this.toolbar = new ToolBar(document.getElementById('toolbar'));
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
        this.diagram = displayDiagram(this.editor, this.svgContainerNode, this.toolbar);
    }

    exportSvg()
    //=========
    {
        if (this.diagram !== null) {
            const svg = this.svgContainerNode.innerHTML;
            // after ensuring there are no selected elements...
            const blob = new Blob([svg], { type: "image/svg+xml" });
            const svgFileName = `${this.loadedFile.split('.')[0]}.svg`

            saveAs(blob, svgFileName);
        }
    }
}

//==============================================================================
