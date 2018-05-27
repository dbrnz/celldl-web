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

import '../thirdparty/jsnetworkx.js';

//==============================================================================

import * as layout from './layout.js';
import * as stylesheet from './stylesheet.js';
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
            return cellDiagram.findElement(elementId, elementClass);
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
        const key = ('colour' in this.style) ? 'colour'
                  : ('color' in this.style) ? 'color'
                  : null;
        return (key === null) ? '#808080' // TODO: specify defaults in one place
                              : stylesheet.parseColour(this.style[key]);
    }

    get display()
    /*=========*/
    {
        const d = this.getStyleAsString("display");
        return d ? ` display="${d}"` : '';
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

    get pixelCoords()
    /*=============*/
    {
        return this.position.pixelCoords;
    }

    get hasPixelCoords()
    /*================*/
    {
        return this.position.hasPixelCoords;
    }

    resolvePixelCoords()
    /*================*/
    {
        this.position.resolvePixelCoords();
    }

    setPixelCoords(pixelCoords)
    /*=======================*/
    {
        this.position.pixelCoords = pixelCoords;
    }

    get hasPosition()
    /*===============*/
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
        const [x, y] = this.pixelCoords;
        if (this.label.startsWith('$')) {
            return `  <text text-anchor="middle" dominant-baseline="central" x="${x}" y="${y}">${this.name}</text>`;
//            const rotation = Number.parseFloat(this.getStyleAsString("text-rotation", "0"));
//            return svgElements.Text.typeset(this.label, x, y, rotation);
        } else {
            return `  <text text-anchor="middle" dominant-baseline="central" x="${x}" y="${y}">${this.label}</text>`;
        }
    }

    generateSvg(radius=layout.ELEMENT_RADIUS)
    /*=====================================*/
    {
        let svg = new List([`<g${this.idClass()}${this.display()}>`]);
        if (this.hasPixelCoords) {
            const [x, y] = this.pixelCoords;
            svg.append(`  <circle r="${radius}" cx="${x}" cy="${y}" stroke="${this.stroke}" stroke-width="${this.strokeWidth}" fill="${this.colour}"/>`);
            svg.append(this.labelAsSvg());
        }
        svg.append('</g>');
        return svg;
    }

}

//==============================================================================

class CellDiagram {
    constructor()
    {
        this._elements = [];
        this._elementsById = {}
    }

    addElement(element)
    /*===============*/
    {
        this._elements.push(element);
        if (element.id in this._elementsById) {
            throw new Error(`Duplicate element 'id': ${element.id}`);
        }
        this._elementsById[element.id] = element;
    }

    elements(elementClass=DiagramElement)
    /*=================================*/
    {
        return this._elements.filter(e => e instanceof elementClass);
    }

    findElement(id, elementClass=DiagramElement)
    /*========================================*/
    {
        const e = (id in this._elementsById) ? this._elementsById[id] : null;
        return (e instanceof elementClass) ? e : null;
    }

    layout()
    /*====*/
    {
        /*
        Set positions (and sizes) of all components in the diagram.

        We position and size all compartments before positioning
        other elements.
        */
        let dependencyGraph = new jsnx.DiGraph();

        for (let element of this._elements) {
            element.parsePosition();
            if (element.hasPosition) {
                dependencyGraph.addNode(element);
            }
        }
        for (let node of dependencyGraph) {
            for (let dependency of node.position.dependencies) {
                dependencyGraph.addEdge(dependency, node);
            }
        }

jsnx.draw(dependencyGraph, {
    element: '#canvas',
    withLabels: true,
    stickyDrag: true
    }
);

//        this.setPixelCoords([0, 0]);
//        this.setUnitConverter(new layout.UnitConverter(this.pixelSize, this.pixelSize));
//        for (let e of jsnx.topologicalSort(g)) {
//            if (e !== this && !e.hasPixelCoords) {
//                e.resolvePixelCoords();
//                if (e instanceof Compartment) {
//                    e.setPixelSize(e.container.unitConverter.toPixelPair(e.size.size, false));
//                    e.setUnitConverter(new layout.UnitConverter(this.pixelSize, e.pixelSize, e.position.pixels));
//                }
//            }
//
//        }
//        bondGraph.setOffsets();
    }

    generateSvg()
    /*=========*/
    {
        /*
        Drawing order:
        0. All <defs>  ==>  first allocate SVG Element classes
        1. All compartment boundaries
        2. All flow lines
        3. Everything else (transporters, quantities, potentials, flow components)
        Transporter SVG elements need to generate SVG from super class (Exchanger, Channel, etc)
        with <defs> only once for each superclass...
        */
        let svg = new List(['<?xml version="1.0" encoding="UTF-8"?>']);
        svg.append(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  version="1.1" width="${this.width}" height="${this.height}"
  viewBox="0 0 ${this.width} ${this.height}">`);
        for (let c of this.compartments) {
            svg.extend(c.svg());
        }
        svg.extend(bondGraph.generateSvg());
        for (let transporter of this.transporters) {
            svg.extend(transporter.svg());
        }
        svg.append('<defs>');
        svg.extend(svgElements.DefinesStore.defines());
        svg.append('</defs>');
        svg.append('</svg>');
        return svg.join('\n');
    }
}

export const cellDiagram = new CellDiagram();

//==============================================================================
