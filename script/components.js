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

/******************************************************************************

    Group == ContainerElement + RectangularElement mixin

    Component == DiagramElement + RectangularElement mixin

    ComponentGroups == ContainerElement but **not** draggable and no connections.

******************************************************************************/

'use strict';

//==============================================================================

import {aggregation} from '../thirdparty/aggregation/src/aggregation-es6.js';

//==============================================================================

import * as exception from './exception.js';
import * as geo from './geometry.js';
import * as layout from './layout.js';

import * as elements from './elements.js';
import {Connection} from './connections.js';
import {SVG_NS} from './svgElements.js';

//==============================================================================

export class ComponentGroups extends elements.ContainerElement
{
    constructor(diagram, domElement)
    {
        super(diagram, domElement, false);
        if (this.id === '') {
            this.id = `${this.diagram.id}_components`;
        }
        this.components = [];
        this.connections = [];
        this.groups = [];
    }

    addComponent(component)
    //=====================
    {
        super.addElement(component);
        this.components.push(component);
        component.group = this;
    }

    addConnection(connection)
    //=======================
    {
        this.connections.push(connection);
        this.diagram.addConnection(connection);
    }

    addGroup(group)
    //=============
    {
        super.addElement(group);
        this.groups.push(group);
        group.group = this;
    }

    layout()
    //======
    {
        this.setSizeAsPixels([this.diagram.width, this.diagram.height]);
        super.setOrigin(new geo.Point(0, 0));
        super.layoutElements();
    }

    generateSvg()
    //===========
    {
        const svgNode = document.createElementNS(SVG_NS, 'g');
        svgNode.id = this.id;
        for (let group of this.groups) {
            svgNode.appendChild(group.generateSvg());
        }
        for (let connection of this.connections) {
            svgNode.appendChild(connection.generateSvg());
        }
        for (let component of this.components) {
            svgNode.appendChild(component.generateSvg());
        }
        return svgNode;
    }
}

//==============================================================================

export class Component extends aggregation(elements.DiagramElement, elements.RectangularMixin)
{
    constructor(diagram, domElement)
    {
        super(diagram, domElement);

        // Get `type` attribute; if `boundary` then constrain position to
        // boundary of group. `position` style attribute then has different
        // meaning??

        this.group = null;
    }

    setGroup(group)
    //=============
    {
        this.group = group;
        this.position.addDependency(group);
    }

    assignCoordinates(container)
    //==========================
    {
        // Set our position and size in terms of our container

        super.assignCoordinates(container);

        // Just in case no size has been specified

        if (this.sizeAsPixels === null) {
            this.setSizeAsPixels([100, 50]);  // TODO: Get default size from layout constants
        }
    }

}

//==============================================================================

export class ComponentConnection extends Connection
{
    constructor(diagram, domElement)
    {
        if (!("from" in domElement.attributes)) {
            throw new exception.KeyError(`Expected 'from' attribute`);
        }
        const fromComponent = diagram.findElement(`#${domElement.attributes["from"].textContent}`, Component);
        if (fromComponent === null) {
            throw new exception.KeyError(`No component with 'from' id`);
        }
        super(diagram, domElement, domElement.attributes["to"].textContent,
              false, fromComponent, [Component]);
    }

    lineAsPath(fromComponent, toComponent)
    //====================================
    {
        const overlappedSet = fromComponent.geometry.boundedProjection(toComponent.geometry, 10);
        if (overlappedSet.length < 2) {
            return super.lineAsPath(fromComponent, toComponent);
        } else {
            return new geo.LineString([overlappedSet.lineSegments[0].middle(),
                                       overlappedSet.lineSegments[1].middle()])
        }
    }
}

//==============================================================================

export class Group extends aggregation(elements.ContainerElement, elements.RectangularMixin)
{
    constructor(diagram, domElement)
    {
        super(diagram, domElement);
        this.groups = [];
        this.group = null;
    }

    addComponent(component)
    //=====================
    {
        super.addElement(component);
        component.setGroup(this);
    }

    addGroup(group)
    //=============
    {
        super.addElement(group);
        this.groups.push(group);
        //group.position.addDependency(this);
        group.group = this;
    }

    assignCoordinates(container)
    //==========================
    {
        // Set our position and size in terms of our container

        super.assignCoordinates(container);

        // Just in case no size has been specified

        if (this.sizeAsPixels === null) {
            this.setSizeAsPixels([300, 200]);  // TODO: Get default size from layout constants
        }

        // Set the position of our label

        this.assignTextCoordinates(this);
    }

    move(offset, drawConnections=true)
    //================================
    {
        super.move(offset, false);
        for (let element of this.elements) {
            element.move(offset, false);
        }
        if (drawConnections) {
            this.redrawConnections();
        }
    }

    resize(offset, edge, drawConnections=true)
    //========================================
    {
        if (super.resize(offset, edge, false)) {
            // Set the origin of our container superclass to
            // our new top-left corner

            this.setOrigin(this.geometry.topLeft);

            // Child elements may depend on our size and so need
            // their positions reassigned

            this.clearElementCoordinates();
            this.layoutElements();

            // Draw connections using new sizes and positions

            if (drawConnections) {
                this.redrawConnections();
            }
        }
    }

}

//==============================================================================
