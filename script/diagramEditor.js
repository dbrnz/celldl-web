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
        this.currentElement = null;
        this.currentLocation = null;
        this.currentNode = null;
        this.movedElement = null;
        this.moving = false;
        this.undoStack = new HistoryStack();
    }

    svgLoaded(svgNode)
    {
        this.svgNode = svgNode;
        this.bondgraphNode = document.getElementById(`${this.diagram.id}_bondgraph`);
        svgNode.addEventListener('mousedown', this.mouseDown.bind(this));
        svgNode.addEventListener('mousemove', this.mouseMove.bind(this));
        svgNode.addEventListener('mouseup', this.mouseUp.bind(this));
        svgNode.addEventListener('mouseleave', this.mouseUp.bind(this));
        svgNode.addEventListener('touchstart', this.mouseDown.bind(this));
        svgNode.addEventListener("touchmove", this.mouseMove.bind(this));
        svgNode.addEventListener('touchend', this.mouseUp.bind(this));
        svgNode.addEventListener('touchleave', this.mouseUp.bind(this));
        svgNode.addEventListener('touchcancel', this.mouseUp.bind(this));

        // Also listen for keys, for example `^Z`, `Shift^Z` (undo, redo)

        this.undoStack.reset();
    }

    getMousePosition(event)
    {
        const CTM = this.svgNode.getScreenCTM();
        if (event.touches) {
            event = event.touches[0];
        }
        return new geo.Point((event.clientX - CTM.e)/CTM.a,
                             (event.clientY - CTM.f)/CTM.d);
    }






    mouseMove(event)
    //==============
    {
        // `boundary` types (of components) must stay on a boundary...

        if (this.moving && this.movedElement !== null) {
            event.preventDefault();
            const position = this.getMousePosition(event);
            this.movedElement.move([position.x - this.startPosition.x,
                                    position.y - this.startPosition.y]);
            this.movedElement.updateSvg(true);
            this.startPosition = position;
            this.elementCurrentCoordinates = this.movedElement.coordinates;
        } else {
            this.currentElement = null;
            for (let node of event.composedPath()) {
                if (node.tagName === 'svg') {
                    break;  // Don't look for elements outside of SVG diagram
                } else if (node.classList && node.classList.contains('draggable')) { //resizeable
                    const diagramElement = this.diagram.findElementById(node.id);
                    if (diagramElement !== null) {
                        const coords = this.getMousePosition(event);

                        // inside, left, right, top, bottom, top-left, top-right, bottom-left, bottom-right
                        // Check if close to boundary...
                        const location = diagramElement.geometry.location(coords, diagramElement.strokeWidth);

                        //console.log(coords, location);

                        if        (location === 'inside') {
                            node.style.cursor = 'move';  // grab ??
                        } else if (['left', 'right'].indexOf(location) >= 0) {
                            node.style.cursor = 'ew-resize';
                        } else if (['top', 'bottom'].indexOf(location) >= 0) {
                            node.style.cursor = 'ns-resize';
                        } else if (['top-left', 'bottom-right'].indexOf(location) >= 0) {
                            node.style.cursor = 'nwse-resize';
                        } else if (['top-right', 'bottom-left'].indexOf(location) >= 0) {
                            node.style.cursor = 'nesw-resize';
                        } else {
                            node.style.cursor = 'pointer';
                        }

                        this.currentNode = node;
                        this.currentElement = diagramElement;
                        this.currentLocation = location;
                        break;
                    }
                }
            }
        }
        event.stopPropagation();
        return false;
    }

    mouseDown(event)
    //==============
    {
        //event.preventDefault(); ???

        if (this.currentElement !== null) {
            const diagramElement = this.currentElement;

            if (this.movedElement !== null
             && this.movedElement !== diagramElement) {
                this.movedElement.updateSvg(false);
            }
// TODO: Unselect any palette element...
            diagramElement.updateSvg(true);

            // Test drawing connections...
            if (event.altKey) {
                if (this.movedElement !== diagramElement) {
                    this.diagram.bondGraph.connect(this.diagramElement, diagramElement);
                    diagramElement.updateSVG(true);
                }
            }

            this.movedElement = diagramElement;
            this.startPosition = this.getMousePosition(event);
            this.elementStartCoordinates = diagramElement.coordinates;
            this.elementCurrentCoordinates = diagramElement.coordinates;
            this.currentNode.style.cursor = 'move';
            this.moving = true;

        } else {
            // If `svg` is first node in path then are we in clear space
            // We also need to allow adding elements to a Group...

            if (this.movedElement !== null) {
                this.movedElement.updateSvg(false);
                this.movedElement = null;
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

                // New element is not selected, this.moving is false
//                 this.movedElement = newElement;

                // Need to insert node into diagram's bondgraph...
                this.diagram.bondGraph.addElement(newElement);
            }
        }
        event.stopPropagation();
    }

    mouseUp(event)
    //============
    {
        // push operation, element, starting attributes,
        // ending attributes on history stack

        // Add/update CSS rule giving element's final position

        if (this.movedElement != null) {
            this.diagram.addManualPositionedElement(this.movedElement);
        }
        this.moving = false;
    }
}

//==============================================================================
