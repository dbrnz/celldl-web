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
import {StyleSheet} from './stylesheet.js';

//==============================================================================

export function displayDiagram(textEditor, svgContainerNode, palette)
{
    return new Promise((resolve, reject) => {
        // Remove any existing content from our SVG container

        for (let child of svgContainerNode.children) {
            child.remove();
        }

        const cellDlText = textEditor.getValue();
        if (cellDlText === '') {
            reject("No CellDL to display");
        }

        const domParser = new DOMParser();
        const xmlDocument = domParser.parseFromString(cellDlText, "application/xml");
        document.body.style.cursor = 'wait';

        try {
            const cellDiagram = new CellDiagram('diagram', textEditor);
            cellDiagram.parseDocument(xmlDocument)
                .then(() => {
                    cellDiagram.layout();  // Pass width/height to use as defaults...

                    const svgDiagram = cellDiagram.generateSvg();

                    // Wait until all MathJax text has been rendered

                    cellDiagram.svgFactory.promises().then(() => {
                        // Show the SVG diagram
                        // Note: If we use `appendChild` then `url()` links in the SVG
                        //       document are not resolved
                        svgContainerNode.insertAdjacentHTML('afterbegin', svgDiagram.outerHTML);

                        // Reset busy wheel
                        document.body.style.cursor = 'default';

                        const svgNode = svgContainerNode.children[0];

                        const diagramEditor = new DiagramEditor(cellDiagram, palette);

                        const grid = diagramEditor.gridSvg();
                        if (grid !== null) {
                            svgNode.insertAdjacentHTML('beforeend', grid.outerHTML);
                         }

                        diagramEditor.svgLoaded(svgNode);

                        resolve(cellDiagram);
                    });
                });
        } catch (error) {
            document.body.style.cursor = 'default';
            console.trace(error);
            reject(error);
        }
    });
}

//==============================================================================
