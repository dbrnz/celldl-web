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

//==============================================================================

function main(cellDL, svgElementId)
{
    fetch(cellDL)
        .then(response => response.text())
        .catch(error => console.error('Error getting XML:', error))
        .then(text => {
            const domParser = new DOMParser();
            const xmlDocument = domParser.parseFromString(text, "application/xml");
            try {
                CellDiagram.instance().reset();
                StyleSheet.instance().reset();

                const parser = new Parser();
                parser.parseDocument(xmlDocument)
                    .then(() => {
                        const cellDiagram = CellDiagram.instance();
                        cellDiagram.layout();

                        const svgElement = document.getElementById(svgElementId);
//                        svgElement.appendChild(cellDiagram.generateSvg());
                        svgElement.innerHTML = cellDiagram.generateSvg().outerHTML;
                    });
            } catch (error) {
                console.trace(error);
                alert(error);
            }
    });

}

export default main;

//==============================================================================
