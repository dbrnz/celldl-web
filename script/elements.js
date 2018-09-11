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

    DiagramElement
      - position, size, geometry, connections
      - draggable
      - geometry is a Circle
      - can contain other DiagramElements
      - layout

      RectangularElement mixin
        - resizable
        - geometry is a Rectangle

******************************************************************************/

'use strict';

//==============================================================================

import * as exception from './exception.js';
import * as geo from './geometry.js';
import * as layout from './layout.js';
import * as stylesheet from './stylesheet.js';
import * as utils from './utils.js';

import {setAttributes} from './utils.js';
import {SVG_NS} from './svgElements.js';

//==============================================================================

const HIGHLIGHT_BORDER = 9;   // in layout.js ??
const HIGHLIGHT_COLOUR = "#004A9C";
const HIGHLIGHT_OPACITY = 0.8;

//==============================================================================

/**
 *  A very general diagram element with size and position.
 *
 *  * An element may be contained in another element.
 *  * An element may contain other elements.
 *  * An element may be connected to any other element, including itself.
 *  * An element is on a ``Layer`` of the diagram
**/

export class DiagramElement {
    constructor(diagram, domElement, requireId=true)
    {
        if (requireId && !('id' in domElement.attributes)) {
            throw new exception.KeyError("A diagram element must have an 'id'");
        }
        this.diagram = diagram;
        this.domElement = domElement;
        this.attributes = domElement.attributes;
        this.tagName = domElement.tagName;
        this.id = ('id' in this.attributes) ? `#${this.attributes.id.textContent}` : '';
        this.name = ('name' in this.attributes) ? this.attributes.name.textContent : this.id.substr(1);
        this.classes = ('class' in this.attributes) ? this.attributes.class.textContent.split(/\s+/) : [];
        // _name, _label, _classes and getters??
        this.classes.push('draggable');
        this.classes.push(this.tagName);
        this.label = ('label' in this.attributes) ? this.attributes.label.textContent : this.name;
        this.style = diagram.stylesheet.style(domElement);
        this.position = new layout.Position(diagram, this, this.style.position);
        this._textPosition = this.position;
        this.colour = ('color' in this.style) ? stylesheet.parseColour(this.diagram, this.style.color)
                                              : '#808080'; // TODO: specify defaults in one place
        this.display = ('display' in this.style) ? this.getStyleAsString("display")
                                                 : {};
        this.fontSize = ('font-size' in this.style) ? stylesheet.parseNumber(this.style['font-size'])
                                                    : 18; // TODO: specify defaults in one place
        this.fontStyle = this.getStyleAsString('font-style', '');
        this.fontWeight = this.getStyleAsString('font-weight', '');
        this.size = new layout.Size(this, this.style.size);
        this.stroke = this.getStyleAsString('stroke', 'none');
        this._strokeWidth = ('stroke-width' in this.style) ? stylesheet.parseLength(this.style['stroke-width'])
                                                           : layout.STROKE_WIDTH;
        this.textColour = ('text-color' in this.style) ? stylesheet.parseColour(this.diagram, this.style['text-color'])
                                                       : '#202020'; // TODO: specify defaults in one place
        this.geometry = null;

        // Any element may be connected to any other element, including itself
        this.connections = [];
        this._connectedTo = [];

        // Any element may be contained in another and/or may contain elements
        this.container = null;
        this.elements = [];

        diagram.addElement(this);
    }

    copyToNewDiagram(diagram)
    //=======================
    {
        const domElement = this.domElement.cloneNode(true);
        domElement.id = this.id.slice(1);
        try {
            return new this.constructor(diagram, domElement);
        } catch (error) {
            alert(error);
            return null;
        }
    }

    fromAttribute(attributeName, elementClasses=[DiagramElement])
    //===========================================================
    {
        if (attributeName in this.attributes) {
            const elementId = `#${this.attributes[attributeName].textContent}`;
            for (let elementClass of elementClasses) {
                const element = this.diagram.findElement(elementId, elementClass);
                if (element !== null) {
                    return element;
                }
            }
            const names = elementClasses.filter(c => c.name);
            const classNames = (names.length === 1) ? names[0]
                                                    : [names.slice(0, -1).join(', '),
                                                       names.slice(-1)[0]
                                                      ].join(' or ');
            throw new exception.KeyError(`Can't find ${classNames} with id '${elementId}'`);
        }
        return null;
    }

    toString()
    //========
    {
        let s = [this.tagName];
        if (this.id !== null) {
            s.push(`(${this.id})`);
        }
        return s.join(' ');
    }

    toXml()
    //=====
    {
        return `<${this.tagName} id="${this.id.slice(1)}"/>`;
    }

    get strokeWidth()
    //===============
    {
        return this.diagram.strokeWidthToPixels(this._strokeWidth);
    }

    getStyleAsString(name, defaultValue='')
    //=====================================
    {
        return stylesheet.styleAsString(this.style, name, defaultValue);
    }

    hasClass(name)
    //============
    {
        return this.classes.indexOf(name) >= 0;
    }

    get diagramId()
    //=============
    {
        return `${this.diagram.id}_${this.id.substr(1)}`;
    }

    diagramIdClass()
    //==============
    {
        let result = {};
        if (this.id !== null) result.id = this.diagramId;
        if (this.classes.length > 0) result.class = this.classes.join(" ");
        return result;
    }

    addElement(element)
    //=================
    {
        this.elements.push(element);
        element.container = this;
    }

    get coordinates()
    //===============
    {
        return this.position.coordinates;
    }

    assignDimensions()
    //================
    {
        this.size.assignSize();
        this.position.assignCoordinates();
    }

    _assignTextCoordinates()
    //======================
    {
        if (this._textPosition !== this.position) {
            this._textPosition.assignCoordinates(this);
        }
    }

    get hasCoordinates()
    //==================
    {
        return this.position.hasCoordinates;
    }

    parsePosition(defaultOffset=null, defaultDependency=null)
    //=======================================================
    {
        /*
        * Position as coords: absolute or % of container -- `(100, 300)` or `(10%, 30%)`
        * Position as offset: relation with absolute offset from element(s) -- `300 above #q1 #q2`
        */
        this.position.parsePosition(defaultOffset, defaultDependency);
        if ('text-position' in this.style) {
            if (this._textPosition === this.position) {
                this._textPosition = new layout.Position(this.diagram, this, this.style['text-position']);
            }
            this._textPosition.parsePosition(null, defaultDependency);
        } else if (this._textPosition !== this.position) {
            this._textPosition = this.position;
        }
    }

    lengthToPixels(length, index, addOffset=false)
    //============================================
    {
        if (length.units.indexOf('%') >= 0) {
            let pixels = utils.lengthToPixels(length, index, this.pixelWidth, this.pixelHeight);
            if (addOffset) {
                if (index === 0) {
                    pixels += (this.coordinates.x - this.pixelWidth/2);
                } else {
                    pixels += (this.coordinates.y - this.pixelHeight/2);
                }
            }
            return pixels;
        } else {
            return this.diagram.lengthToPixels(length, index);
        }
    }

    pixelsToLength(pixels, units, index, addOffset=false)
    //===================================================
    {
        if (units.indexOf('%') >= 0) {
            if (addOffset) {
                if (index === 0) {
                    pixels -= (this.coordinates.x - this.pixelWidth/2);
                } else {
                    pixels -= (this.coordinates.y - this.pixelHeight/2);
                }
            }
            return utils.pixelsToLength(pixels, units, index, this.pixelWidth, this.pixelHeight);
        } else {
            return this.diagram.pixelsToLength(pixels, units, index);
        }

    }

    positionToString()
    //================
    {
        return this.position.coordinatesToString();
    }

    sizeToString()
    //============
    {
        return this.size.toString();
    }

    get hasSize()
    //===========
    {
        return this.size.pixelWidth > 0 && this.size.pixelHeight > 0;
    }

    get pixelWidth()
    //==============
    {
        return this.size.pixelWidth;
    }

    get pixelHeight()
    //===============
    {
        return this.size.pixelHeight;
    }

    get sizeAsPixels()
    //================
    {
        return this.size.asPixels;
    }

    assignGeometry(radius=layout.ELEMENT_RADIUS)
    //==========================================
    {
        if (this.hasCoordinates) {
            this.geometry = new geo.Circle(this.coordinates, radius);
        }
    }

    location(point, delta)
    //====================
    {
        return this.geometry.location(point, delta);
    }

    layout(updateSvg=false)
    //=====================
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

        const dependents = this.position.dependents();

        for (let element of dependents) {
            element.assignDimensions();
            element.assignGeometry();
            element._assignTextCoordinates();
            if (updateSvg) {
                element.updateSvg(false);
            }
        }
        if (updateSvg) {
            for (let element of dependents) {
                element.redrawConnections();
            }
        }
    }

    /**
     * Move the element.
     *
     * @param {float[2]} offset - The distance, in pixels, to move.
     * @param {float[2]} grid - Spacing of a ``snap-to`` grid.
     * @param {boolean} drawConnections - Draw connections from/to the element after move.
     *
     * @return {float[2]} The offset actually moved.
    **/
    move(offset, grid=null, drawConnections=true)
    //===========================================
    {
        if (grid !== null) {
            // Adjust offset so that new position snaps to the the grid

            const [x, y] = this.position.coordinates.toOffset();
            // Don't want to move in opposite direction to offset
            offset = [utils.gridSnap(x + offset[0], grid[0]) - x,
                      utils.gridSnap(y + offset[1], grid[1]) - y];
        }

        if (offset[0] !== 0 || offset[1] !== 0) {
            this.position.moveByOffset(offset);
            if (this._textPosition !== this.position) {
                this._textPosition.moveByOffset(offset);
            }

            this.assignGeometry();

            // Moving us impacts all elements whose position depends on us
            // so recalculate the positions of our dependents and then
            // draw them in their new position.
            //
            // NB. This set is not necessarily our sub-elements

            this.layout(true);

            this.invalidateConnections();
            if (drawConnections) {
                this.redrawConnections();
            }
        }
        return offset;
    }

    resize(offset, edge, grid=null, drawConnections=true)
    //===================================================
    {
        // TODO: Implement general element resizing??
    }

    connectTo(elementId)
    //==================
    {
        this._connectedTo.push(elementId);
    }

    addConnection(connection)
    //=======================
    {
        // If the connection's elements have been assigned we
        // check all existing connections to/from this element
        // to find adjacent connections.

        if (connection.otherElement !== null) {
            const adjacent = new Array();
            const parent = connection.parentElement;
            const other = connection.otherElement;
            for (let c of this.connections) {
                if (c.parentElement === parent && c.otherElement === other
                 || c.parentElement === other && c.otherElement === parent) {
                    adjacent.push(c);
                }
            }
            // Set the spacing/drawing order for all adjacent connections

            if (adjacent.length > 0) {
                adjacent.push(connection);
                const adjacentCount = adjacent.length;
                let order = 1;
                for (let c of adjacent) {
                    c.setOrder(order, adjacentCount);
                    order += 1;
                }
            }
        }
        this.connections.push(connection);
    }

    invalidateConnections()
    //=====================
    {
        for (let connection of this.connections) {
            connection.invalidatePath();
        }
        for (let element of this.position.dependents()) {
            element.invalidateConnections();
        }
    }

    redrawConnections()
    //=================
    {
        for (let connection of this.connections) {
            if (connection.invalidPath) {
                connection.assignPath();
                connection.updateSvg();
            }
        }
        for (let element of this.elements) {
            element.redrawConnections();
        }
    }

    labelSize()
    //=========
    {
        return [0, 0]
    }

    appendLabelAsSvg(parentNode)
    //==========================
    {
        let [x, y] = this._textPosition.coordinates.toOffset();
        if (this.label.startsWith('$')) {
            // Pass this.textcolour to MathJax...
            // see https://groups.google.com/forum/#!msg/mathjax-users/fo93aucG5Bo/7dH3s8szbNYJ
            const rotation = Number.parseFloat(this.getStyleAsString("text-rotation", "0"));
            parentNode.appendChild(this.diagram.svgFactory.typeset(this.label.slice(1, -1),
                                                                   x, y, rotation, this.textColour));
        } else if (this.label !== "") {
            const svgNode = document.createElementNS(SVG_NS, 'g');
            const lines = this.label.split('\\n');
            const LINE_HEIGHT = this.fontSize; // Baseline to baseline height
            y -= LINE_HEIGHT*(lines.length - 1)/2;
            for (let line of lines) {
                const textNode = document.createElementNS(SVG_NS, 'text');
                const textAttributes = { x: x, y: y, fill: this.textColour,
                                         'dominant-baseline': "central",
                                         'text-anchor': "middle",
                                         'font-size': LINE_HEIGHT};
                const styleAttributes = [];
                if (this.fontStyle !== "") {
                    styleAttributes.push(`font-style: ${this.fontStyle};`)
                }
                if (this.fontWeight !== "") {
                    styleAttributes.push(`font-weight: ${this.fontWeight};`)
                }
                textAttributes.style = styleAttributes.join(' ');
                setAttributes(textNode, textAttributes);
                textNode.textContent = line;
                svgNode.appendChild(textNode);
                y += LINE_HEIGHT;
            }
            parentNode.appendChild(svgNode);
        }
    }

    generateSvg(highlight=false)
    //==========================
    {
        const svgNode = document.createElementNS(SVG_NS, 'g');
        setAttributes(svgNode, this.diagramIdClass(), this.display);
        if (this.geometry !== null) {
            const node = this.geometry.svgNode();
            setAttributes(node, { stroke: this.stroke, fill: this.colour,
                                  'stroke-width': this.strokeWidth});
            svgNode.appendChild(node);
            this.appendLabelAsSvg(svgNode);
            if (highlight) {
                const border = this.geometry.svgNode(HIGHLIGHT_BORDER + 2);
                setAttributes(border, { "fill": "none",
                                        "stroke": HIGHLIGHT_COLOUR,
                                        "stroke-width": HIGHLIGHT_BORDER,
                                        "stroke-opacity": HIGHLIGHT_OPACITY });
                svgNode.appendChild(border);
            }
        }
        return svgNode;
    }

    updateSvg(highlight)
    //==================
    {
        const svgNode = this.generateSvg(highlight);
        const currentNode = document.getElementById(this.diagramId);
        currentNode.outerHTML = svgNode.outerHTML;
    }
}

//==============================================================================

// A resizeable rectangular element

export class RectangularMixin
{
    assignGeometry()
    //==============
    {
        if (this.hasCoordinates) {
            const [width, height] = this.sizeAsPixels;
            const [x, y] = this.coordinates.toOffset();
            this.geometry = new geo.Rectangle([x - width/2, y - height/2],
                                              [x + width/2, y + height/2]);
        }
    }

    resize(offset, edge, grid=null, drawConnections=true)
    //===================================================
    {
        if (offset[0] === 0 && offset[1] === 0) {
            return [0, 0];
        }

        const [width, height] = this.sizeAsPixels;
        let [newWidth, newHeight] = [width, height];
        let [dx, dy] = [0, 0];

        const gridSnap = (value, step) => {
            const gridValue = utils.gridSnap(value, step);
            return (gridValue <= 0) ? 1 : gridValue;
        }

        if (edge.indexOf('left') >= 0) {
            newWidth = gridSnap(width - offset[0], grid[0]);
            dx = width - newWidth;
        } else if (edge.indexOf('right') >= 0) {
            newWidth = gridSnap(width + offset[0], grid[0]);
            dx = newWidth - width;
        }
        if (edge.indexOf('top') >= 0) {
            newHeight = gridSnap(height - offset[1], grid[1]);
            dy = height - newHeight;
        } else if (edge.indexOf('bottom') >= 0) {
            newHeight = gridSnap(height + offset[1], grid[1]);
            dy = newHeight - height;
        }

        this.size.setPixelSize([newWidth, newHeight]);

        // Reposition element so the centre of the element stays fixed

        this.move([dx/2, dy/2], null, drawConnections);

        // Return the edge's actual displacement

        return [dx, dy];
    }

}

//==============================================================================
