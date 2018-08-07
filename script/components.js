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
import * as geo from './geometry.js';
import * as layout from './layout.js';

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
        component.group = this;
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
        group.group = this;
    }

    setUnitConverter(diagramUnitConverter)
    //====================================
    {
        this.unitConverter = diagramUnitConverter;
        for (let group of this.groups) {
            group.assignCoordinates(diagramUnitConverter);
            if (group.size !== null) {
                group.setSizeAsPixels(this.unitConverter.toPixelPair(group.size, false));
            }
            group.setUnitConverter(diagramUnitConverter.globalSize);
        }
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

export class Component extends DiagramElement
{
    constructor(diagram, domElement)
    {
        super(diagram, domElement);
        this.group = null;
    }

    setGroup(group)
    //=============
    {
        this.group = group;
        this.position.addDependency(group);
    }

    assignCoordinates(unitConverter)
    //==============================
    {
        if (this.group !== null) {
            unitConverter = this.group.unitConverter;
        }
        super.assignCoordinates(unitConverter);
        if (this.sizeAsPixels === null) {
            this.setSizeAsPixels([100, 50]);
        }
        super.assignTextCoordinates(unitConverter);
    }

    assignGeometry()
    //==============
    {
        if (this.hasCoordinates) {
            const [width, height] = this.sizeAsPixels;
            const x = this.coordinates.x;
            const y = this.coordinates.y;
            this.geometry = new geo.Rectangle([x - width/2, y - height/2],
                                              [x + width/2, y + height/2]);
        }
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
        const fromComponent = diagram.findElement(`#${domElement.attributes["from"].textContent}`, Component);
        if (fromComponent === null) {
            throw new exception.KeyError(`No component with 'from' id`);
        }
        super(diagram, domElement, domElement.attributes["to"].textContent,
              false, fromComponent, [Component]);
    }

    getLineStringAsPath(fromComponent, toComponent)
    //=============================================
    {
        const overlapEdgeSet = fromComponent.geometry.boundedProjection(toComponent.geometry);
        if (overlapEdgeSet.length < 2) {
            return super.getLineStringAsPath(fromComponent, toComponent);
        } else {
            return new geo.LineString([overlapEdgeSet.lineSegments[0].middle(),
                                       overlapEdgeSet.lineSegments[1].middle()])
        }
    }
}

//==============================================================================

export class Group extends DiagramElement
{
    constructor(diagram, domElement)
    {
        super(diagram, domElement);
        this.elements = [];
        this.groups = [];
        this.group = null;
        this.unitConverter = null;
    }

    addComponent(component)
    //=====================
    {
        this.elements.push(component);
        component.setGroup(this);
    }

    addGroup(group)
    //=============
    {
        this.elements.push(group);
        this.groups.push(group);
        group.position.addDependency(this);
        group.group = this;
    }

    setUnitConverter(diagramSize)
    //===========================
    {
        const [width, height] = this.sizeAsPixels;
        this.unitConverter = new layout.UnitConverter(diagramSize, this.sizeAsPixels,
                                                      this.coordinates.subtract([width/2, height/2]).asOffset());
        this.assignTextCoordinates(this.unitConverter);

        for (let group of this.groups) {
            group.assignCoordinates(this.unitConverter);
            group.setUnitConverter(diagramSize);
        }
    }

    assignCoordinates(unitConverter)
    //==============================
    {
        super.assignCoordinates(this.group === null ? unitConverter
                                                    : this.group.unitConverter);
        if (this.sizeAsPixels === null) {
            this.setSizeAsPixels([300, 200]);
        }
    }

    assignGeometry()
    //==============
    {
        if (this.hasCoordinates) {
            const [width, height] = this.sizeAsPixels;
            const x = this.coordinates.x;
            const y = this.coordinates.y;
            this.geometry = new geo.Rectangle([x - width/2, y - height/2],
                                              [x + width/2, y + height/2]);
        }
    }

    move(offset, drawEdges=true)
    //==========================
    {
        super.move(offset, false);
        for (let element of this.elements) {
            element.move(offset, false);
        }
        if (drawEdges) {
            this.redrawEdges();
        }
    }

    redrawEdges()
    //===========
    {
        super.redrawEdges();
        for (let element of this.elements) {
            element.redrawEdges();
        }
    }

    generateSvg(highlight=false)
    //==========================
    {
        const svgNode = super.generateSvg(highlight);
        for (let element of this.elements) {
            svgNode.appendChild(element.generateSvg());
        }
        return svgNode;
    }
}

//==============================================================================
