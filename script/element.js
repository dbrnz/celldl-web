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

import * as geo from './geometry.js';
import * as layout from './layout.js';
import * as parser from './parser.js';
import * as svgElements from './svgElements.js';

//==============================================================================

export class Element {
    constructor(container, attributes, style, className='Element') {
        this.id = ('id' in attributes) ? ('#' + attributes.id.textContent) : null;
        const name = ('name' in attributes) ? attributes.name.textContent
                   : ((this.id !== null) ? this.id : '');
        this.localName = name;
        this.container = container;
        if (container === null) {
            this.diagram = this;
            this.fullName = '/';
        } else {
            this.diagram = container.diagram;
            this.fullName = container.fullName + '/' + name;
        }
        this.className = className;
        this.classes = ('class' in attributes) ? attributes.class.textContent.split(/\s*/) : [];
        this.label = ('label' in attributes) ? attributes.label.textContent : name;
        this.style = style;
    }

    toString() {
        let s = [this.className];
        if (this.id !== null) {
            s.push('(${this.id}');
        }
        return s.join(' ');
    }

    get colour() {
        const key = ('colour' in this.style) ? 'colour'
                  : ('color' in this.style) ? 'color'
                  : null;
        return (key === null) ? '#808080'
                              : parser.parseColour(this.style[key]);
    }

    get stroke() {
        return this.getStyleAsString('stroke', 'none');
    }

    get strokeWidth() {
        return this.getStyleAsString('stroke-width', '1');
    }

    isClass(name) {
        return this.classes.indexOf(name) >= 0;
    }

    setContainer(container) {
        this.container = container;
    }

    display() {
        const d = this.getStyleAsString("display");
        return d ? ' display="${d}"' : '';
    }

    idClass() {
        let s = [''];
        if (this.id !== null)
            s.push('id="${this.id.substr(1)}"');
        if (this.classes)
            s.push('class="${this.classes.join(" ")}"');
        return s.join(' ');
    }
}

//==============================================================================

export class PositionedElement extends Element {
    constructor(container, attributes, style, className="positionedElement") {
        super(container, attributes, style, className);
        this.position = new layout.Position(this);
        this.position.addDependency(container);
        this.positionTokens = ('position' in this.style) ? this.style.position: null;
        this.cachedGeometry = null;
    }

    get geometry() {
        if (this.cachedGeometry === null && this.position.resolved) {
            this.cachedGeometry = geo.Point(this.position.pixels);
        }
        return this.cachedGeometry;
    }

    get pixelCoords() {
        return this.position.pixelCoords;
    }

    get positionResolved() {
        return this.position.resolved();
    }

    resolvePosition() {
        this.position.resolve();
    }

    parsePosition(defaultOffset=null, defaultDependency=null) {
        /*
        * Position as coords: absolute or % of container -- `(100, 300)` or `(10%, 30%)`
        * Position as offset: relation with absolute offset from element(s) -- `300 above #q1 #q2`
        */
        if (this.positionTokens !== null) {
            this.position.parse(this.positionTokens, defaultOffset, defaultDependency);
        }
    }

    labelAsSvg() {
        const [x, y] = this.position.pixelCoords;
        if (this.label.startswith("$")) {
            const rotation = Number.parseFloat(this.getStyleAsString("text-rotation", "0"));
            return svgElements.Text.typeset(this.label, x, y, rotation);
        } else {
            return '  <text text-anchor="middle" dominant-baseline="central" x="${x}" y="${y}">${this.label}</text>';
        }
    }

    svg(radius=layout.ELEMENT_RADIUS) {
        svg = ['<g${this.idClass()}${this.display()}>'];
        if (this.position.resolved) {
            const [x, y] = this.position.pixelCoords;
            svg.push('  <circle r="${radius}" cx="${x}" cy=$"{y}" stroke="${this.stroke}" stroke-width="${this.strokeWidth}" fill="${this.colour}"/>');
            svg.push(this.labelAsSvg());
        }
        svg.push("</g>");
        return svg;
    }
}

//==============================================================================
