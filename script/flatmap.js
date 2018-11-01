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

    Group == DiagramElement + RectangularElement mixin

    Component == DiagramElement + RectangularElement mixin

    FlatMap == DiagramElement but **not** draggable and no connections.

******************************************************************************/

'use strict';

//==============================================================================

import {aggregation} from '../thirdparty/aggregation/src/aggregation-es6.js';

//==============================================================================

import * as exception from './exception.js';
import * as geo from './geometry.js';

import {DiagramElement, RectangularMixin} from './elements.js';
import {Connection} from './connections.js';
import {SVG_NS} from './svgElements.js';

//==============================================================================

export class FlatMap extends DiagramElement
{
    constructor(diagram, domElement)
    {
        super(diagram, domElement, false);
        this.id = this.id || `${this.diagram.id}_flatmap`;
        this.container = diagram;
        this.size.setSize([new geo.Length(100, '%'), new geo.Length(100, '%')]);
        this.position.setOffset([new geo.Length(50, '%'), new geo.Length(50, '%')]);
        for (let element of domElement.children) {
            this.parseDomElement(element);
        }
    }

    parseDomElement(domElement)
    //=========================
    {
        if        (domElement.nodeName === "component") {
            this.addElement(new Component(this.diagram, domElement, this));
        } else if (domElement.nodeName === "connection") {
            this.addConnection(new ComponentConnection(this.diagram, this, domElement));
        } else {
            throw new exception.SyntaxError(domElement, "Invalid element for <flat-map>");
        }
    }

    addConnection(connection)
    //=======================
    {
        super.addConnection(connection);
        this.diagram.addConnection(connection);
    }

    addElement(element)
    //=================
    {
        super.addElement(element);
        this.position.addDependent(element);
    }

    asGraph()
    //=======
    {
        const graph = new jsnx.Graph();
        for (let element of this.elements.filter(e => e.elements.length === 0)) {
            graph.addNode(element);
        }
        for (let connection of this.connections) {
            graph.addEdge(connection.parentElement, connection.otherElement);
        }
        return graph;
    }

    generateSvg()
    //===========
    {
        const svgNode = document.createElementNS(SVG_NS, 'g');
        svgNode.id = this.id;


        const dependents = this.position.dependents();
        for (let element of dependents.filter(d => d.elements.length > 0)) {
            svgNode.appendChild(element.generateSvg());
        }
        for (let connection of this.connections) {
            svgNode.appendChild(connection.generateSvg());
        }
        for (let element of dependents.filter(d => d.elements.length === 0)) {
            svgNode.appendChild(element.generateSvg());
        }
        return svgNode;
    }
}

//==============================================================================

export class Component extends aggregation(DiagramElement, RectangularMixin)
{
    constructor(diagram, domElement, flatMap)
    {
        super(diagram, domElement);

        // Get `type` attribute; if `boundary` then constrain position to
        // boundary of group. `position` style attribute then has different
        // meaning??

        for (let element of domElement.children) {
            if (element.nodeName === "component") {
                const component = new Component(diagram, element, flatMap);
                flatMap.addElement(component);
                // NB. Element must be added to component **after** adding it to flatmap
                this.addElement(component);
            } else {
                throw new exception.SyntaxError(element, "Invalid element for <component>");
            }
        }
    }

    assignDimensions()
    //================
    {
        // Set our position and size in terms of our container

        super.assignDimensions();

        // Just in case no size has been specified

        if (!this.hasSize) {
            this.size.setPixelSize([200, 100]);  // TODO: Get default size from layout constants
        }
    }
}

//==============================================================================

export class ComponentConnection extends Connection
{
    constructor(diagram, flatMap, domElement)
    {
        if (!domElement.hasAttribute('from')) {
            throw new exception.KeyError(`Expected 'from' attribute`);
        }
        const fromComponent = diagram.findElement(`#${domElement.getAttribute('from')}`, Component);
        if (fromComponent === null) {
            throw new exception.KeyError(`No component with 'from' id`);
        }
        super(diagram, domElement, domElement.getAttribute('to'),
              false, fromComponent, [Component]);
    }

    lineAsPath(fromComponent, toComponent)
    //====================================
    {
        const overlappedSet = fromComponent.geometry.boundedProjection(toComponent.geometry, 10);
        if (overlappedSet.length < 2) {
            return super.lineAsPath(fromComponent, toComponent);
        } else {
            // The following spaces connections wider than the more
            // simple spacing of `this.order/(this.adjacent + 1)`.

            // We equally space the end points of `count` adjacent lines over
            // the interval [1/(count+2), (count+1)/(count+2)], with the first
            // and last line end points at the respective interval boundary.

            const count = this.adjacent;
            const offset = (count === 1) ? 0.5
                                         : (1 + (this.order - 1)*count/(count - 1))/(count + 2);

            return new geo.PolyLine([overlappedSet.lineSegments[0].ratio(offset),
                                     overlappedSet.lineSegments[1].ratio(offset)])
        }
    }
}

//==============================================================================

export class Group extends aggregation(DiagramElement, RectangularMixin)
{
    assignDimensions()
    //================
    {
        // Set our position and size in terms of our container

        super.assignDimensions();

        // Just in case no size has been specified

        if (!this.hasSize) {
            this.size.setPixelSize([300, 200]);  // TODO: Get default size from layout constants
        }
    }
}

//==============================================================================
