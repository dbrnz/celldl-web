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
import {Parser} from './parser.js';
import {StyleSheet} from './stylesheet.js';
import {Text} from './svgElements.js';

//==============================================================================

function displayDiagram(cellDlText, svgNodeId)
{
    const domParser = new DOMParser();
    const xmlDocument = domParser.parseFromString(cellDlText, "application/xml");
    document.body.style.cursor = 'wait';

    try {
        CellDiagram.instance().reset();
        StyleSheet.instance().reset();

        const parser = new Parser();
        parser.parseDocument(xmlDocument)
            .then(() => {
                const cellDiagram = CellDiagram.instance();
                cellDiagram.layout();  // Pass width/height to use as defaults...

                const svgDiagram = cellDiagram.generateSvg();

                Promise.all(Text.promises()).then(() => {
                    const svgNode = document.getElementById(svgNodeId);

                    // Remove any children from the node we are displaying SVG in

                    for (let child of svgNode.children) {
                        child.remove();
                    }

                    // Show the SVG diagram

                    svgNode.insertAdjacentHTML('afterbegin', svgDiagram.outerHTML);
                    document.body.style.cursor = 'default';
                });
            });
    } catch (error) {
        document.body.style.cursor = 'default';
        console.trace(error);
        alert(error);
    }
}

export default displayDiagram;

//==============================================================================
