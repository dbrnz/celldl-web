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

//==============================================================================

const WIDTH = 60;
const HEIGHT = 400;

const PALETTE_XML = `<cell-diagram xmlns="http://www.cellml.org/celldl/1.0#">
    <bond-graph>
        <quantity id="q"/>
        <potential id="u" label="$\\mu$"/>
        <flow id="v" label="$\\nu$"/>
        <reaction id="k"/>
        <gyrator id="r"/>
        <transformer id="z"/>
    </bond-graph>
    <style>
        #q { position: 50%, 10%; }
        #u { position: 50%, 25%; }
        #v { position: 50%, 40%; }
        #k { position: 50%, 55%; }
        #r { position: 50%, 70%; }
        #z { position: 50%, 85%; }
    </style>
</cell-diagram>`;


export class Palette
{
    constructor(containerNode)
    {
        const domParser = new DOMParser();
        const xmlDocument = domParser.parseFromString(PALETTE_XML, "application/xml");
        try {
            this.diagram = new CellDiagram('palette');
            this.diagram.parseDocument(xmlDocument)
                .then(() => {
                    this.diagram.layout(WIDTH, HEIGHT);   // Pass width/height to use as defaults...

                    const svgDiagram = this.diagram.generateSvg(); //false, true);

                    // Wait until all MathJax text has been rendered

                    Promise.all(this.diagram.svgFactory.promises()).then(() => {
                        // Show the SVG diagram
                        // Note: If we use `appendChild` then `url()` links in the SVG
                        //       document are not resolved
                        containerNode.insertAdjacentHTML('afterbegin', svgDiagram.outerHTML);

                        this.svgNode = containerNode.children[0];
                        this.initialiseMouseHandlers();
                    });
                });
        } catch (error) {
            document.body.style.cursor = 'default';
            console.trace(error);
            alert(error);
        }
    }

    initialiseMouseHandlers()
    //=======================
    {
        this.diagramElement = null;
        this.svgNode.addEventListener('mousedown', this.startMouseMove.bind(this));
        this.svgNode.addEventListener('touchstart', this.startMouseMove.bind(this));
    }

    getMousePosition(event)
    //=====================
    {
        const CTM = this.svgNode.getScreenCTM();
        if (event.touches) {
            event = event.touches[0];
        }
        return {
            x: (event.clientX - CTM.e) / CTM.a,
            y: (event.clientY - CTM.f) / CTM.d
        };
    }

    startMouseMove(event)
    //===================
    {
        let nodePosition = 0;
        for (let node of event.composedPath()) {
            if (node.classList.contains('draggable')) {
                const diagramElement = this.diagram.findElementById(node.id);
                if (diagramElement !== null) {
                    if (this.diagramElement !== null
                     && this.diagramElement !== diagramElement) {
                        this.diagramElement.updateSvg(false);
                    }
                    diagramElement.updateSvg(true);
                    this.diagramElement = diagramElement;
                    break;
                }
            } else if (node.tagName === 'svg') {
                if (nodePosition === 0) {
                    // if `svg` is first node in path then are we in clear space
                    if (this.diagramElement !== null) {
                        this.diagramElement.updateSvg(false);
                        this.diagramElement = null;
                    }
                }
                break;
            }
            nodePosition += 1;
        }
        event.stopPropagation();
    }

    copySelectedElementTo(diagram)
    //============================
    {
        const selected = this.diagramElement;
        this.diagramElement = null;
        if (selected !== null) {
            selected.updateSvg(false);
            return diagram.bondGraph.parseDomElement(selected.asNewDomElement());
        }
        return null;
    }
}

/*
quantity
potential
flow

reaction
gyrator
transformer

Generate SVG and position above nodes

Event listeners: hover -> tooltip
                 click -> select


If toolbar has a selected node then a click in the diagram, in "clear space",
will result in a new node being added to the digram (shown in 'select' state) and
the toolbar node is unselected.

Maybe Alt-click (or ctrl-click -- is there a stsandard??) doesn't unselect toolbar
node?

Clicking on a selected TB node will unselect it.

Use a dotted border around the elements bounding box to indicate selection.

*/

//==============================================================================
