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


//==============================================================================

export class DiagramEditor
{
    constructor(diagram)
    {
        this.diagram = diagram;
        this.svgNode = null
        this.selectedNode = null;
        this.diagramElement = null;
    }

    svgLoaded(svgNode)
    {
        this.svgNode = svgNode;
        svgNode.addEventListener('mousedown', this.startMouseMove.bind(this));
        svgNode.addEventListener('mousemove', this.mouseMove.bind(this));
        svgNode.addEventListener('mouseup', this.endMouseMove.bind(this));
        svgNode.addEventListener('mouseleave', this.endMouseMove.bind(this));
        svgNode.addEventListener('touchstart', this.startMouseMove.bind(this));
        svgNode.addEventListener("touchmove", this.mouseMove.bind(this));
        svgNode.addEventListener('touchend', this.endMouseMove.bind(this));
        svgNode.addEventListener('touchleave', this.endMouseMove.bind(this));
        svgNode.addEventListener('touchcancel', this.endMouseMove.bind(this));
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
    {
        for (let node of event.composedPath()) {
            if (node.classList.contains('draggable')) {
                const diagramElement = this.diagram.findElement(`#${node.id}`);
                if (diagramElement !== null) {
                    this.diagramElement = diagramElement;
                    this.selectedNode = node;
                    this.startPosition = this.getMousePosition(event);
                    break;
                }
            } else if (node.tagName === 'svg') {
                break;
            }
        }
        event.stopPropagation();
    }

    mouseMove(event) {
        if (this.selectedNode) {
            event.preventDefault();
            const position = this.getMousePosition(event);
            this.diagram.reposition(this.diagramElement,
                                    [position.x - this.startPosition.x,
                                     position.y - this.startPosition.y]);
            this.startPosition = position;
        }
        event.stopPropagation();
    }

    endMouseMove(event) {
        this.selectedNode = null;
        this.diagramElement = null;
    }
}

//==============================================================================
