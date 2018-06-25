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

// Code and ideas from http://www.petercollingridge.co.uk/tutorials/svg/interactive/dragging/
// and from http://www.codedread.com/blog/archives/2005/12/21/how-to-enable-dragging-in-svg/


export class DiagramEditor
{
    constructor()
    {
        this.svgNode = null
        this.selectedNode = null;
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
                const diagramElement = CellDiagram.instance().findElement(`#${node.id}`);
                if (diagramElement !== null) {
                    this.diagramElement = diagramElement;
                    this.selectedNode = node;
                    this.startPosition = this.getMousePosition(event);
/*
                // Get all the transforms currently on this node

                const transforms = this.selectedNode.transform.baseVal;

                // Ensure the first transform is a translate transform

                if (transforms.length === 0
                 || transforms.getItem(0).type !== SVGTransform.SVG_TRANSFORM_TRANSLATE) {
                    // Create an transform that translates by (0, 0)

                    const translate = this.svgNode.createSVGTransform();
                    translate.setTranslate(0, 0);

                    // Add the translation to the front of the transforms list
                    this.selectedNode.transform.baseVal.insertItemBefore(translate, 0);
                }
                // Get initial translation amount

                this.transform = transforms.getItem(0);
                this.offset.x -= this.transform.matrix.e;
                this.offset.y -= this.transform.matrix.f;

                // set this.diagramElement from svgNode.id
*/
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
            // call diagramElement.move() ??
            /* Ideally want Element.svgNode to be actual node on screen but this
               would require us not to set innerHTML...
            */
            CellDiagram.instance().reposition(this.diagramElement,
                                             [position.x - this.startPosition.x,
                                              position.y - this.startPosition.y]);
            this.startPosition = position;
        }
        event.stopPropagation();
    }

    endMouseMove(event) {
        this.selectedNode = null;
        // clear diagramElement;
    }
}

//==============================================================================
