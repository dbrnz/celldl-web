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
        this.selectedElement = null;
        this.moving = false;
        this.resizable = false;
        this.resizing = false;
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

        if ((this.moving || this.resizing) && this.selectedElement !== null) {
            event.preventDefault();
            const mousePosition = this.getMousePosition(event);
            if (this.moving) {
                this.selectedElement.move([mousePosition.x - this.startMousePosition.x,
                                           mousePosition.y - this.startMousePosition.y]);
            } else {
                this.selectedElement.resize([mousePosition.x - this.startMousePosition.x,
                                             mousePosition.y - this.startMousePosition.y],
                                            this.currentLocation);
            }
            this.selectedElement.updateSvg(true);
            this.startMousePosition = mousePosition;
        } else {
            this.currentElement = null;
            for (let node of event.composedPath()) {
                if (node.tagName === 'svg') {
                    break;  // Don't look for elements outside of SVG diagram
                } else if (node.classList && node.classList.contains('draggable')) { //resizeable
                    const diagramElement = this.diagram.findElementById(node.id);
                    if (diagramElement !== null) {
                        const coords = this.getMousePosition(event);
                        // Check if close to or on boundary...
                        const location = diagramElement.location(coords, diagramElement.strokeWidth+2);
                        if        (['left', 'right'].indexOf(location) >= 0) {
                            this.resizable = true;
                            node.style.cursor = 'ew-resize';
                        } else if (['top', 'bottom'].indexOf(location) >= 0) {
                            this.resizable = true;
                            node.style.cursor = 'ns-resize';
                        } else if (['top-left', 'bottom-right'].indexOf(location) >= 0) {
                            this.resizable = true;
                            node.style.cursor = 'nwse-resize';
                        } else if (['top-right', 'bottom-left'].indexOf(location) >= 0) {
                            this.resizable = true;
                            node.style.cursor = 'nesw-resize';
                        } else {
                            this.resizable = false;
                            node.style.cursor = 'hand';
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
        if (this.currentElement !== null) {
            const diagramElement = this.currentElement;

            if (this.selectedElement !== null
             && this.selectedElement !== diagramElement) {
                this.selectedElement.updateSvg(false);
            }
// TODO: Unselect any palette element...
            diagramElement.updateSvg(true);

            // Test drawing connections...
            if (event.altKey) {
                if (this.selectedElement !== diagramElement) {
                    this.diagram.bondGraph.connect(this.diagramElement, diagramElement);
                    diagramElement.updateSVG(true);
                }
            }

            this.selectedElement = diagramElement;
            this.startMousePosition = this.getMousePosition(event);
            if (this.resizable) {
                this.resizing = true;
            } else {
                this.currentNode.style.cursor = 'move';
                this.moving = true;
            }
        } else {
            // If `svg` is first node in path then are we in clear space
            // We also need to allow adding elements to a Group...

            if (this.selectedElement !== null) {
                this.selectedElement.updateSvg(false);
                this.selectedElement = null;
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

        if (this.selectedElement != null) {
            if (this.moving) {
                this.diagram.addManualPositionedElement(this.selectedElement);
            } else if (this.resizing) {
                this.diagram.addManualResizedElement(this.selectedElement);
            }
        }
        this.moving = false;
        this.resizing = false;
    }
}

//==============================================================================
