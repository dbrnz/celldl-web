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
import * as stylesheet from './stylesheet.js';

import {setAttributes} from './utils.js';
import {SVG_NS} from './svgElements.js';

//==============================================================================

const HIGHLIGHT_BORDER = 7;   // in layout.js ??

//==============================================================================

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
        this.position = new layout.Position(diagram);
        this.textPosition = new layout.Position(diagram);
        this.size = ('size' in this.style) ? stylesheet.parseSize(this.style['size']) : null;
        this.pixelWidth = null;
        this.pixelHeight = null;
        this.geometry = null;
        this.edges = [];
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

    resolveReferences()
    //=================
    {
        // Sub-classes will override this method
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

    get colour()
    //==========
    {
        return ('color' in this.style) ? stylesheet.parseColour(this.diagram, this.style.color)
                                       : '#808080'; // TODO: specify defaults in one place
    }

    get display()
    //===========
    {
        const d = this.getStyleAsString("display");
        return d ? {display: d} : {};
    }

    get fontSize()
    //============
    {
        return ('font-size' in this.style) ? stylesheet.parseNumber(this.style['font-size'])
                                           : 18; // TODO: specify defaults in one place
    }

    get fontStyle()
    //=============
    {
        return this.getStyleAsString('font-style', '');
    }

    get fontWeight()
    //==============
    {
        return this.getStyleAsString('font-weight', '');
    }

    get stroke()
    //==========
    {
        return this.getStyleAsString('stroke', 'none');
    }

    get strokeWidth()
    //===============
    {
        return this.getStyleAsString('stroke-width', '1');
    }

    get textColour()
    //==============
    {
        return ('text-color' in this.style) ? stylesheet.parseColour(this.diagram, this.style['text-color'])
                                            : '#202020'; // TODO: specify defaults in one place
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

    get coordinates()
    //===============
    {
        return this.position.coordinates;
    }

    assignCoordinates(unitConverter)
    //==============================
    {
        if (this.size !== null) {
            this.setSizeAsPixels(unitConverter.toPixelPair(this.size, false));
        }
        this.position.assignCoordinates(unitConverter);
    }

    assignTextCoordinates(unitConverter)
    //==================================
    {
        if (this.textPosition !== this.position) {
            this.textPosition.assignCoordinates(unitConverter);
        }
    }

    get hasCoordinates()
    //==================
    {
        return this.position.hasCoordinates;
    }

    get hasValidPosition()
    //====================
    {
        return this.position.valid;
    }

    parsePosition(defaultOffset=null, defaultDependency=null)
    //======================================================
    {
        /*
        * Position as coords: absolute or % of container -- `(100, 300)` or `(10%, 30%)`
        * Position as offset: relation with absolute offset from element(s) -- `300 above #q1 #q2`
        */
        if ('position' in this.style) {
            this.position.parse(this.style.position, defaultOffset, defaultDependency);
        }
        if ('text-position' in this.style) {
            this.textPosition.parse(this.style['text-position'], null, defaultDependency);
        } else {
            this.textPosition = this.position;
        }
    }

    get sizeAsPixels()
    //================
    {
        return (this.pixelWidth !== null) ? [this.pixelWidth, this.pixelHeight] : null;
    }

    setSizeAsPixels(pixelSize)
    //========================
    {
        [this.pixelWidth, this.pixelHeight] = pixelSize;
    }

    assignGeometry(radius=layout.ELEMENT_RADIUS)
    //==========================================
    {
        if (this.hasCoordinates) {
            this.geometry = new geo.Circle(this.coordinates, radius);
        }
    }

    addEdge(edge)
    //===========
    {
        this.edges.push(edge);
    }

    labelSize()
    //=========
    {
        return [0, 0]
    }

    appendLabelAsSvg(parentNode)
    //==========================
    {
        let [x, y] = this.textPosition.coordinates.asOffset();
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
                                        "stroke": "#004A9C",
                                        "stroke-width": HIGHLIGHT_BORDER,
                                        "stroke-opacity": 0.5 });
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
