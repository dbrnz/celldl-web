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

import * as exception from './exception.js';

import {DiagramElement} from './element.js';
import {Edge} from './edge.js';
import {setAttributes} from './utils.js';
import {SVG_NS} from './svgElements.js';

//==============================================================================

export class ComponentGroups
{
    constructor(diagram)
    {
        this.diagram = diagram;
        this.id = `${this.diagram.id}_components`;
        this.components = [];
        this.connections = [];
        this.groups = [];
    }

    addComponent(component)
    //=====================
    {
        this.components.push(component);
    }

    addConnection(connection)
    //=======================
    {
        this.connections.push(connection);
        this.diagram.addEdge(connection);
    }

    addGroup(group)
    //=============
    {
        this.groups.push(group);
    }

    generateSvg()
    //===========
    {
        const svgNode = document.createElementNS(SVG_NS, 'g');
        svgNode.id = this.id;
        for (let connection of this.connections) {
            svgNode.appendChild(connection.generateSvg());
        }
        for (let group of this.groups) {
            svgNode.appendChild(group.generateSvg());
        }
        for (let component of this.components) {
            svgNode.appendChild(component.generateSvg());
        }
        return svgNode;
    }
}

//==============================================================================

export class Component extends DiagramElement
{
    constructor(diagram, domElement)
    {
        super(diagram, domElement);
    }
}

//==============================================================================

export class Connection extends Edge
{
    constructor(diagram, domElement)
    {
        if (!("from" in domElement.attributes)) {
            throw new exception.KeyError(`Expected 'from' attribute`);
        }
        const fromElement = diagram.findElement(`#${domElement.attributes["from"].textContent}`, Component);
        if (fromElement === null) {
            throw new exception.KeyError(`No component with 'from' id`);
        }
        super(diagram, domElement, domElement.attributes["to"].textContent,
              false, fromElement, [Component]);
    }
}

//==============================================================================

export class Group extends DiagramElement
{
    constructor(diagram, domElement)
    {
        super(diagram, domElement);
        this.components = [];
        this.groups = [];
    }

    addComponent(component)
    //=====================
    {
        this.components.push(component);
    }

    addGroup(group)
    //=============
    {
        this.groups.push(group);
    }

    generateSvg()
    //===========
    {
        const svgNode = document.createElementNS(SVG_NS, 'g');
        setAttributes(svgNode, this.diagramIdClass(), this.display);
        for (let group of this.groups) {
            svgNode.appendChild(group.generateSvg());
        }
        for (let component of this.components) {
            svgNode.appendChild(component.generateSvg());
        }
        return svgNode;
    }
}

//==============================================================================
