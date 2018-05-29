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
import * as layout from './layout.js';
import * as stylesheet from './stylesheet.js';

import {CellDiagram} from './cellDiagram.js';
import {List} from './utils.js';

//==============================================================================

export class DiagramElement {
    constructor(attributes, style, className='Element')
    {
        if (!('id' in attributes)) {
            throw new SyntaxError("A diagram element must have an 'id'")
        }
        this.id = `#${attributes.id.textContent}`;
        this.name = ('name' in attributes) ? attributes.name.textContent : this.id.substr(1);
        this.classes = ('class' in attributes) ? attributes.class.textContent.split(/\s+/) : [];
        this.label = ('label' in attributes) ? attributes.label.textContent : this.name;
        this.style = style;
        this.className = className;
        this.position = new layout.Position(this);
    }

    static fromAttribute(attributes, attributeName, elementClass=DiagramElement)
    /*========================================================================*/
    {
        if (attributeName in attributes) {
            const elementId = `#${attributes[attributeName].textContent}`;
            const element = CellDiagram.instance().findElement(elementId, elementClass);
            // TODO: lookup later...
            return (element == null) ? elementId : element;
        }
        return null;
    }

    toString()
    /*======*/
    {
        let s = [this.className];
        if (this.id !== null) {
            s.push(`(${this.id})`);
        }
        return s.join(' ');
    }

    get colour()
    /*========*/
    {
        return ('color' in this.style) ? stylesheet.parseColour(this.style.color)
                                       : '#808080' // TODO: specify defaults in one place
    }

    get display()
    /*=========*/
    {
        const d = this.getStyleAsString("display");
        return d ? ` display="${d}"` : '';
    }

    get textColour()
    /*============*/
    {
        return ('text-color' in this.style) ? stylesheet.parseColour(this.style['text-color'])
                                            : '#202020'; // TODO: specify defaults in one place
    }

    get stroke()
    /*========*/
    {
        return this.getStyleAsString('stroke', 'none');
    }

    get strokeWidth()
    /*=============*/
    {
        return this.getStyleAsString('stroke-width', '1');
    }

    getStyleAsString(name, defaultValue='')
    /*===================================*/
    {
        if (name in this.style) {
            const tokens = this.style[name];
            if (['ID', 'HASH', 'NUMBER'].indexOf(tokens.type) >= 0) {
                return tokens.value;
            } else if (['DIMENSION', 'PERCENTAGE'].indexOf(tokens.type) >= 0) {
                return `${tokens.value}${tokens.unit}`;
            }
        }
        return defaultValue;
    }

    hasClass(name)
    /*==========*/
    {
        return this.classes.indexOf(name) >= 0;
    }

    idClass()
    /*=====*/
    {
        let s = [''];
        if (this.id !== null)
            s.push(`id="${this.id.substr(1)}"`);
        if (this.classes.length > 0)
            s.push(`class="${this.classes.join(" ")}"`);
        return s.join(' ');
    }

    get coordinates()
    /*=============*/
    {
        return this.position.coordinates;
    }

    assignCoordinates(unitConverter)
    /*============================*/
    {
        this.position.assignCoordinates(unitConverter);
        console.log(`${this.toString()} at ${this.coordinates}`)
    }

    get hasCoordinates()
    /*================*/
    {
        return this.position.hasCoordinates;
    }

    get hasValidPosition()
    /*==================*/
    {
        return this.position.valid;
    }

    parsePosition(defaultOffset=null, defaultDependency=null)
    /*=====================================================*/
    {
        /*
        * Position as coords: absolute or % of container -- `(100, 300)` or `(10%, 30%)`
        * Position as offset: relation with absolute offset from element(s) -- `300 above #q1 #q2`
        */
        if ('position' in this.style) {
            this.position.parse(this.style.position, defaultOffset, defaultDependency);
        }
    }

    labelAsSvg()
    /*========*/
    {
        const [x, y] = this.coordinates;
        if (this.label.startsWith('$')) {
            return `  <text text-anchor="middle" dominant-baseline="central" x="${x}" y="${y}">${this.name}</text>`;
            // Pass this.textcolour to MathJax...
//            const rotation = Number.parseFloat(this.getStyleAsString("text-rotation", "0"));
//            return svgElements.Text.typeset(this.label, x, y, rotation);
        } else {
            return `  <text text-anchor="middle" dominant-baseline="central" x="${x}" y="${y}" fill="${this.textColour}">${this.label}</text>`;
        }
    }

    generateSvg(radius=layout.ELEMENT_RADIUS)
    /*=====================================*/
    {
        let svg = new List([`<g${this.idClass()}${this.display}>`]);
        if (this.hasCoordinates) {
            const [x, y] = this.coordinates;
            svg.append(`  <circle r="${radius}" cx="${x}" cy="${y}" stroke="${this.stroke}" stroke-width="${this.strokeWidth}" fill="${this.colour}"/>`);
            svg.append(this.labelAsSvg());
        }
        svg.append('</g>');
        return svg;
    }
}

//==============================================================================
