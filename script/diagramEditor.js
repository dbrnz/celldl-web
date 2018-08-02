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

import * as geo from './geometry.js';

//==============================================================================

class HistoryEvent {
    constructor(operation, element, attributes={})
    {
        this.operation = operation;
        this.element = element;
        this.attributes = attributes;
    }

    undo()
    //====
    {

    }

    redo()
    //====
    {

    }
}

//==============================================================================

class HistoryStack {
    constructor()
    {
        this.reset();
    }

    reset()
    {
        this.history = [];
        this.nextEventPos = 0;
    }

    push(operation, element, attributes={})
    //=====================================
    {
        // do we limit size and wrap??
        const event = new HistoryEvent(operation, element, attributes);

        if (this.nextEventPos < this.history.length) {
            this.history[this.nextEventPos] = event;
        }
        else {
            this.history.push(event);
        }
        this.nextEventPos += 1;
    }

    undo()
    //====
    {
        if (this.nextEventPos > 0) {
            this.nextEventPos -= 1;
            this.history[this.nextEventPos].undo();
        }
    }

    redo()
    //====
    {
        if (this.nextEventPos < this.history.length) {
            this.history[this.nextEventPos].redo();
            this.nextEventPos += 1;
        }
    }
}

//==============================================================================

export class DiagramEditor
{
    constructor(diagram, palette)
    {
        this.diagram = diagram;
        this.palette = palette;
        this.svgNode = null;
        this.bondgraphNode = null;
        this.diagramElement = null;
        this.moving = false;
        this.undoStack = new HistoryStack();
    }

    svgLoaded(svgNode)
    {
        this.svgNode = svgNode;
        this.bondgraphNode = document.getElementById(`${this.diagram.id}_bondgraph`);
        svgNode.addEventListener('mousedown', this.startMouseMove.bind(this));
        svgNode.addEventListener('mousemove', this.mouseMove.bind(this));
        svgNode.addEventListener('mouseup', this.endMouseMove.bind(this));
        svgNode.addEventListener('mouseleave', this.endMouseMove.bind(this));
        svgNode.addEventListener('touchstart', this.startMouseMove.bind(this));
        svgNode.addEventListener("touchmove", this.mouseMove.bind(this));
        svgNode.addEventListener('touchend', this.endMouseMove.bind(this));
        svgNode.addEventListener('touchleave', this.endMouseMove.bind(this));
        svgNode.addEventListener('touchcancel', this.endMouseMove.bind(this));

        // Also listen for keys, for example `^Z`, `Shift^Z` (undo, redo)

        this.undoStack.reset();
    }

    getMousePosition(event)
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
// TODO: Unselect any palette element...
                    diagramElement.updateSvg(true);
                    if (event.altKey) {
                        if (this.diagramElement !== diagramElement) {
                            this.diagram.bondGraph.connect(this.diagramElement, diagramElement);
                            diagramElement.updateSVG(true);
                        }
                    }
                    this.diagramElement = diagramElement;
                    this.startPosition = this.getMousePosition(event);
                    this.elementStartCoordinates = diagramElement.coordinates;
                    this.elementCurrentCoordinates = diagramElement.coordinates;
                    this.moving = true;
                    break;
                }
            } else if (node.tagName === 'svg') {
                if (nodePosition === 0) {
                    // if `svg` is first node in path then are we in clear space
                    if (this.diagramElement !== null) {
                        this.diagramElement.updateSvg(false);
                        this.diagramElement = null;
                    }
                    const newElement = this.palette.copySelectedElementTo(this.diagram);
                    if (newElement) {
                        const coords = this.getMousePosition(event);
                        // We are able to create a new element in the diagram
                        newElement.position.coordinates = new geo.Point(coords.x, coords.y);
                        newElement.assignGeometry();

                        // Note: If we use `appendChild` then `url()` links in the SVG
                        //       are not resolved
                        const elementSvg = newElement.generateSvg();

                        // We could have new <defs> if say a new element type is
                        // not in the current diagram...

                        const definesSvg = this.diagram.svgFactory.defines(false);
                        this.bondgraphNode.insertAdjacentHTML('beforeend', definesSvg.outerHTML);

                        this.bondgraphNode.insertAdjacentHTML('beforeend', elementSvg.outerHTML);
                        //this.bondgraphNode.appendChild(elementSvg);

                        this.diagramElement = newElement;

                        // Need to insert node into diagram's bondgraph...
                        this.diagram.bondGraph.addElement(newElement);
                    }
                }
                break;
            }
            nodePosition += 1;
        }
        event.stopPropagation();
    }

    mouseMove(event)
    //==============
    {
        if (this.moving && this.diagramElement !== null) {
            event.preventDefault();
            const position = this.getMousePosition(event);
            this.diagramElement.move([position.x - this.startPosition.x,
                                      position.y - this.startPosition.y]);
            this.diagramElement.updateSvg(true);
            this.startPosition = position;
            this.elementCurrentCoordinates = this.diagramElement.coordinates;
        }
        event.stopPropagation();
        return false;
    }

    endMouseMove(event)
    //=================
    {
        // push operation, element, starting attributes,
        // ending attributes on history stack

        // Add/update CSS rule giving element's final position

        if (this.diagramElement != null) {
            this.diagram.addManualPositionedElement(this.diagramElement);
        }

        this.moving = false;
    }
}

//==============================================================================
