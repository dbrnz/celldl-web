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

import * as config from '../config.js';
import * as exception from './exception.js';
import * as geo from './geometry.js';
import * as layout from './layout.js';
import * as stylesheet from './stylesheet.js';
import * as utils from './utils.js';

import {setAttributes} from './utils.js';
import {SVG_NS} from './svgElements.js';

//==============================================================================

export const CELLDL_NAMESPACE = "http://www.cellml.org/celldl/1.0#";

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
        if (requireId && !(domElement && domElement.hasAttribute('id'))) {
            throw new exception.KeyError("A diagram element must have an 'id'");
        }
        this.diagram = diagram;
        this._domElement = domElement;
        this.tagName = domElement.tagName;
        this.id = (domElement.id != '') ? `#${domElement.id}` : '';
        this.name = domElement.hasAttribute('name') ? domElement.getAttribute('name') : this.id.substr(1);
        this.classes = domElement.hasAttribute('class') ? domElement.getAttribute('class').split(/\s+/) : [];
        // _name, _label, _classes and getters??
        this.classes.push('draggable');
        this.classes.push(this.tagName);
        this.label = domElement.hasAttribute('label') ? domElement.getAttribute('label') : this.name;
        this.style = diagram.stylesheet.style(domElement);
        this.position = new layout.Position(diagram, this, this.style.position);
        this._textPosition = this.position;
        this.colour = ('color' in this.style) ? stylesheet.parseColour(this.diagram, this.style.color)
                                              : '#808080'; // TODO: specify defaults in one place
        this._opacity = ('opacity' in this.style) ? this.getStyleAsString('opacity')
                                                  : '1';
        this.display = ('display' in this.style) ? { display: this.getStyleAsString('display') }
                                                 : {};
        this.fontSize = ('font-size' in this.style) ? stylesheet.parseNumber(this.style['font-size'])
                                                    : 18; // TODO: specify defaults in one place
        this.fontStyle = this.getStyleAsString('font-style', '');
        this.fontWeight = this.getStyleAsString('font-weight', '');
        this._radius = ('radius' in this.style) ? stylesheet.parseLength(this.style['radius'])
                                                : config.DEFAULT.RADIUS;
        this.shape = this.getStyleAsString('shape', '');
        this.size = new layout.Size(this, this.style.size);
        this.stroke = this.getStyleAsString('stroke', 'none');
        this._strokeWidth = ('stroke-width' in this.style) ? stylesheet.parseLength(this.style['stroke-width'])
                                                           : config.STROKE.WIDTH;
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

    fromAttribute(idAttributeName, elementClasses=[DiagramElement])
    //=============================================================
    {
        if (this._domElement.hasAttribute(idAttributeName)) {
            const elementId = `#${this._domElement.getAttribute(idAttributeName)}`;
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

    get domElement()
    //==============
    {
        return this._domElement;
    }

    asNewDomElement()
    //===============
    {
        const element = document.createElementNS(CELLDL_NAMESPACE, this.tagName);
        element.id = this.id.slice(1);
        return element;
    }

    get radius()
    //==========
    {
        return this.diagram.strokeWidthToPixels(this._radius);
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

    assignTextCoordinates()
    //=====================
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

    /**
     * Position as coords: absolute or % of container -- `(100, 300)` or `(10%, 30%)`
     * Position as offset: relation with absolute offset from element(s) -- `300 above #q1 #q2`
    **/
    parsePosition(defaultOffset=config.DEFAULT.OFFSET, defaultDependency=null)
    //========================================================================
    {
        //  set position to mid-point of inputs and outputs...
        //if (this.position._tokens === null) ???
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

    assignGeometry()
    //==============
    {
        if (this.hasCoordinates) {
            this.geometry = new geo.Circle(this.coordinates, this.radius);
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
        this.position.layoutDependents(updateSvg);
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

            const [x, y] = this.position.coordinates.asArray();
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


            if (config.CYTOSCAPE) {
                this.layout();
            } else {
                this.layout(true); // true to update SVG
                this.invalidateConnections();
                if (drawConnections) {
                    this.redrawConnections();
                }
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

    cyElement()
    //=========
    {
        const strokeWidth = (this.stroke === 'none') ? 0 : this.strokeWidth;
        const width = this.geometry.width + strokeWidth;  // Also take text width into account... max(...)
        const height = this.geometry.height + strokeWidth;
        const position = this.geometry.centre;
        const element = {
            data: { id: this.id },
            position: position.copy()
        };

        if (this.elements.length === 0) {
            element.data.width = width;
            element.data.height = height;
            element.data.shape = this.geometry.cyShape;
            const svgNode = this.generateSvg();
            svgNode.setAttribute('transform', `translate(${width/2-position.x}, ${height/2-position.y})`);
            element.scratch = {
                _elementAsSvg: {
                        svgNode,
                        svgFactory: this.diagram.svgFactory
                    }
            };
        } else if (this.colour === 'none') {
            element.data.colour = 'white';
            element.data.opacity = 0;
        } else if (this.colour) {
            element.data.colour = this.colour;
            element.data.opacity = this._opacity;
        }
        if (this.stroke === 'none') {
            element.data.stroke = 'white';
            element.data['strokeOpacity'] = 0;
            element.data['strokeWidth'] = 0;
        } else if (this.stroke) {
            element.data.stroke = this.stroke;
            element.data['strokeOpacity'] = 1;
            element.data['strokeWidth'] = strokeWidth;
        }

        if (this.container) {
            element.data['parent'] = this.container.id;
        }
        if (this.classes) {
            element.classes = this.classes.join(" ");
        }

        // We now will wait until all MathJax has been rendered
        return element;
    }

    appendLabelAsSvg(parentNode)
    //==========================
    {
        let [x, y] = this._textPosition.coordinates.asArray();
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
                                         'font-size': 0.8*LINE_HEIGHT};
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
                                  'opacity': this._opacity,
                                  'stroke-width': this.strokeWidth});
            svgNode.appendChild(node);
            this.appendLabelAsSvg(svgNode);
            if (highlight) {
                const border = this.geometry.svgNode(config.HIGHLIGHT.BORDER + 2);
                setAttributes(border, { "fill": "none",
                                        "stroke": config.HIGHLIGHT.COLOUR,
                                        "stroke-width": config.HIGHLIGHT.BORDER,
                                        "stroke-opacity": config.HIGHLIGHT.OPACITY });
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
            const [x, y] = this.coordinates.asArray();
            if (this.shape === 'rounded-rectangle') {
                this.geometry = new geo.RoundedRectangle([x - width/2, y - height/2],
                                                         [x + width/2, y + height/2],
                                                         0.2*width, 0.2*height);
            } else {
                this.geometry = new geo.Rectangle([x - width/2, y - height/2],
                                                  [x + width/2, y + height/2]);
            }
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
