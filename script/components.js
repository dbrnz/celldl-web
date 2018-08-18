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

//import {aggregation} from '../thirdparty/aggregation/src/aggregation-es6.js';

//==============================================================================

import * as exception from './exception.js';
import * as geo from './geometry.js';
import * as layout from './layout.js';
import * as utils from './utils.js';

import {DiagramElement} from './element.js';
import {Connection} from './connections.js';
import {SVG_NS} from './svgElements.js';

//==============================================================================

export let Container = mixwith.Mixin((superclass) => class extends superclass
{
    constructor(...args)
    {
        super(...args)
        this.diagram = args[0];
        this.width = 0;
        this.height = 0;
        this.elements = [];
        this.origin = [0, 0]
    }

    addElement(element)
    //=================
    {
        this.elements.push(element);
    }

    setDimensions(origin, width, height)
    //==================================
    {
        this.origin[0] = origin.x;
        this.origin[1] = origin.y;
        this.width = width;
        this.height = height;
    }

    lengthToPixels(length, index, addOffset=false)
    //============================================
    {
        let pixels = (length.unit.indexOf('%') >= 0) ? utils.lengthToPixels(length, index, this.width, this.height)
                                                     : this.diagram.lengthToPixels(length, index);
        if (addOffset) {
            pixels += this.origin[index];
        }
        return pixels;
    }

    offsetToPixels(size, addOffset=false)
    //===================================
    {
        return [this.lengthToPixels(size[0], 0, addOffset),
                this.lengthToPixels(size[1], 1, addOffset)];
    }

    layoutElements()
    //==============
    {
        /*
        - Hierarchical positioning
        - An element's position can depend on those of its siblings and any element
          at a higher level in the diagram. In the following, ``cm2`` may depend on
          ``gr1``, ``cm1``, ``gr2`` and ``gr0``, while ``gr3`` may depend on ``gr4``,
          ``cm3``, ``gr1``, ``cm1``, ``gr2`` and ``gr0``.
        - This means we need to position the container's elements before laying out
          any sub-containers.
        */

        // Need to ensure dependencies are amongst or above our elements

        for (let element of layout.dependencyGraph(this.elements)) {
            element.assignCoordinates(this);
            element.assignGeometry();
        }

        for (let container of this.elements.filter((e) => mixwith.hasMixin(e, Container))) {
            const g = container.geometry;
            container.setDimensions(g.topLeft, g.width, g.height);
            container.layoutElements();
        }
    }

});

//==============================================================================

export class ComponentGroups extends mixwith.mix(Object).with(Container)
{
    constructor(diagram)
    {
        super(diagram);
        this.id = `${this.diagram.id}_components`;
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
        super.setDimensions(new geo.Point(0, 0), this.diagram.width, this.diagram.height);
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

class RectangularElement extends DiagramElement
{
    constructor(diagram, domElement)
    {
        super(diagram, domElement);
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

    resize(offset, edge, drawConnections=true)
    //========================================
    {
        let [width, height] = this.sizeAsPixels;
        let dx = 0;
        let dy = 0;
        if (edge.indexOf('left') >= 0) {
            width -= offset[0];
            dx = offset[0]/2;
        } else if (edge.indexOf('right') >= 0) {
            width += offset[0];
            dx = offset[0]/2;
        }
        if (edge.indexOf('top') >= 0) {
            height -= offset[1];
            dy = offset[1]/2;
        } else if (edge.indexOf('bottom') >= 0) {
            height += offset[1];
            dy = offset[1]/2;
        }
        this.setSizeAsPixels([width, height]);


        this.move([dx, dy], drawConnections);

        /* This will move our centre but any child elements
           need to move by a different offset...

           e.g. when top edge is moved then elements on top edge
           move by [0, offset[1]] and elements on bottom edge
           stay fixed.

           Simplest to recalculate positions??

        */
    }
}

//==============================================================================

export class Component extends RectangularElement
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

export class Group extends mixwith.mix(RectangularElement).with(Container)
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
        super.addElement(component);
        this.elements.push(component);
        component.setGroup(this);
    }

    addGroup(group)
    //=============
    {
        super.addElement(group);
        this.elements.push(group);
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

    redrawConnections()
    //=================
    {
        super.redrawConnections();
        for (let element of this.elements) {
            element.redrawConnections();
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
