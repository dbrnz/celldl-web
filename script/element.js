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

import {setAttributes} from './utils.js';
import {parseColour, styleAsString} from './stylesheet.js';
import {SVG_NS} from './svgElements.js';

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
        this.classes.push('draggable');
        this.classes.push(this.tagName);
        this.label = ('label' in this.attributes) ? this.attributes.label.textContent : this.name;
        this.style = diagram.stylesheet.style(domElement);
        this.position = new layout.Position(diagram);
        this.geometry = null;
        this.edges = [];
        diagram.addElement(this);
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
                                                    : [names.slice(0, -1).join(', '), names.slice(-1)[0]].join(' or ');

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

    get colour()
    //==========
    {
        return ('color' in this.style) ? parseColour(this.diagram, this.style.color)
                                       : '#808080'; // TODO: specify defaults in one place
    }

    get display()
    //===========
    {
        const d = this.getStyleAsString("display");
        return d ? {display: d} : {};
    }

    get textColour()
    //==============
    {
        return ('text-color' in this.style) ? parseColour(this.diagram, this.style['text-color'])
                                            : '#202020'; // TODO: specify defaults in one place
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

    getStyleAsString(name, defaultValue='')
    //=====================================
    {
        return styleAsString(this.style, name, defaultValue);
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
        this.position.assignCoordinates(unitConverter);
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

    labelAsSvg()
    //==========
    {
        const x = this.coordinates.x;
        const y = this.coordinates.y;
        if (this.label.startsWith('$')) {
            // Pass this.textcolour to MathJax...
            // see https://groups.google.com/forum/#!msg/mathjax-users/fo93aucG5Bo/7dH3s8szbNYJ
            const rotation = Number.parseFloat(this.getStyleAsString("text-rotation", "0"));
            return this.diagram.svgFactory.typeset(this.label.slice(1, -1), x, y, rotation, this.textColour);
        } else {
            const svgNode = document.createElementNS(SVG_NS, 'text');
            setAttributes(svgNode, { x: x, y: y, fill: this.textColour,
                                     'dominant-baseline': "central",
                                     'text-anchor': "middle"});
            svgNode.textContent = this.label;
            return svgNode;
        }
    }

    generateSvg()
    //===========
    {
        const svgNode = document.createElementNS(SVG_NS, 'g');
        setAttributes(svgNode, this.diagramIdClass(), this.display);
        if (this.geometry !== null) {
            const node = this.geometry.svgNode();
            setAttributes(node, { stroke: this.stroke, fill: this.colour,
                                  'stroke-width': this.strokeWidth});
            svgNode.appendChild(node);
            svgNode.appendChild(this.labelAsSvg());
        }
        return svgNode;
    }

    updateSvg()
    //=========
    {
        const svgNode = this.generateSvg();
        const currentNode = document.getElementById(this.diagramId);
        currentNode.outerHTML = svgNode.outerHTML;
    }
}

//==============================================================================
