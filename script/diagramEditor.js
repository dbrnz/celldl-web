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

import * as config from '../config.js';
import * as geo from './geometry.js';
import * as utils from './utils.js';

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
//        this.grid = [diagram.lengthToPixels(config.GRID.X_SPACING, 0),
//                     diagram.lengthToPixels(config.GRID.Y_SPACING, 1)];
        this.grid = [0, 0];
    }

    svgLoaded(svgNode)
    //================
    {
        this.svgNode = svgNode;
        this.bondgraphNode = this.diagram.bondGraph.documentElement();
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

        // And allow arrow keys to move/resize (move by 1 grid unit if snap, else ?? some very fine grid??)

        this.undoStack.reset();
    }

    getMousePosition(event, gridSnap=false)
    //=====================================
    {
        const CTM = this.svgNode.getScreenCTM();
        if (event.touches) {
            event = event.touches[0];
        }
        const coords = [(event.clientX - CTM.e)/CTM.a,
                        (event.clientY - CTM.f)/CTM.d];
        if (gridSnap) {
            return new geo.Point(utils.gridSnap(coords[0], this.grid[0]),
                                 utils.gridSnap(coords[1], this.grid[1]));
        } else {
            return new geo.Point(...coords);
        }
    }

    mouseMove(event)
    //==============
    {
        // `boundary` types (of components) must stay on a boundary...

        if ((this.moving || this.resizing) && this.selectedElement !== null) {
            event.preventDefault();
            const mousePosition = this.getMousePosition(event);
            const movedOffset = (this.moving) ? this.selectedElement.move(
                                                    [mousePosition.x - this.startMousePosition.x,
                                                     mousePosition.y - this.startMousePosition.y],
                                                    this.grid)
                                              : this.selectedElement.resize(
                                                    [mousePosition.x - this.startMousePosition.x,
                                                     mousePosition.y - this.startMousePosition.y],
                                                    this.currentLocation, this.grid);
            this.startMousePosition = this.startMousePosition.translate(movedOffset);
            this.selectedElement.updateSvg(true);
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
                // Insert node into CellDL source. Will create the <bond-graph>
                // element if there's none
                this.diagram.addBondGraphElement(newElement);

                // Set its position on the grid
                const coords = this.getMousePosition(event, true);
                newElement.position.setCoordinates(new geo.Point(coords.x, coords.y));
                newElement.assignGeometry();

                // Add it to the set of manuually positioned elements
                this.diagram.addManualPositionedElement(newElement);

                // Note: If we use `appendChild` then `url()` links in the SVG
                //       are not resolved
                const elementSvg = newElement.generateSvg();
                this.bondgraphNode.insertAdjacentHTML('beforeend', elementSvg.outerHTML);

                // We could have new <defs> if say a new element type is
                // not in the current diagram...
                const definesSvg = this.diagram.svgFactory.defines(false);
                this.bondgraphNode.insertAdjacentHTML('beforeend', definesSvg.outerHTML);

                // New element is not selected, this.moving is false
//                 this.movedElement = newElement;
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

    gridSvg()
    //=======
    {
        if (this.grid === null) {
            return null;
        }
        else {
            const gridId = `${this.diagram.id}_grid`;
            const gridStrokeWidth = Math.min(this.grid[0], this.grid[1])/50;
            const gridStrokeDash = `${10*gridStrokeWidth} ${10*gridStrokeWidth}`;
            const grid = `<g class="grid_>
  <defs>
    <pattern id="${gridId}" patternUnits="userSpaceOnUse"
             width="${this.grid[0]}" height="${this.grid[1]}"
             x="-0.5" y="-0.5">
      <path stroke="${config.GRID.COLOUR}" stroke-opacity="${config.GRID.OPACITY}"
            stroke-width="${gridStrokeWidth}" stroke-dasharray="${gridStrokeDash}"
            d="M0,0 L0,${this.grid[1]}"/>
      <path stroke="${config.GRID.COLOUR}" stroke-opacity="${config.GRID.OPACITY}"
            stroke-width="${gridStrokeWidth}" stroke-dasharray="${gridStrokeDash}"
            d="M0,0 L${this.grid[0]},0"/>
    </pattern>
  </defs>
  <rect fill="url(#${gridId})"
      stroke="${config.GRID.COLOUR}" stroke-opacity="${config.GRID.OPACITY}"
      stroke-width="${gridStrokeWidth/2}" stroke-dasharray="${gridStrokeDash}"
      width="${this.diagram.width}" height="${this.diagram.height}"/>
</g>`;
            const parser = new DOMParser();
            const svgNode = parser.parseFromString(grid, "application/xml");
            return svgNode.documentElement;
        }
    }
}

//==============================================================================
