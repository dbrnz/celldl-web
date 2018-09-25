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
import * as utils from './utils.js';

import {DiagramElement} from './elements.js';
import {SvgDocument} from './svgDocument.js';
import {SVG_NS} from './svgElements.js';

//==============================================================================

export class Background extends DiagramElement
{
    constructor(diagram, domElement)
    {
        super(diagram, domElement, false);
        this.diagram = diagram;
        this.id = `${this.diagram.id}_background`;
        this._image = domElement.getAttribute('image');
        this.container = diagram;
        this.size.setSize([new geo.Length(100, '%'), new geo.Length(100, '%')]);
        this.position.setOffset([new geo.Length(50, '%'), new geo.Length(50, '%')]);
        this.svgDocument = null;
        if (this._image) {
            if (!this._image.endsWith('.svg')) {
                throw new exception.SyntaxError(domElement, "Only SVG background images are currently supported");
            }
        }
        for (let element of domElement.children) {
            if (element.nodeName === "region") {
                this.addElement(new Region(this.diagram, element, this));
            } else {
                throw new exception.SyntaxError(element, "Invalid element for <background>");
            }
        }
    }

    addElement(element)
    //=================
    {
        super.addElement(element);
        this.position.addDependent(element);
    }

    async loadBackgroundImage()
    //=========================
    {
        // Note: `fetch()` is a Promise

        return self._imageParsedPromise = fetch(this._image)
                                        .then(response => response.text())
                                        .catch(error => console.error('Error getting background:', error))
                                        .then(text => { this.parseBackgroundSvg(text); });
    }

    parseBackgroundSvg(svgText)
    //=========================
    {
        this.svgDocument = new SvgDocument(svgText);
        for (let region of this.elements) {
            region.setPositionOffset();
        }
    }

    generateSvg()
    //===========
    {
        const svgNode = document.createElementNS(SVG_NS, 'image');
        utils.setAttributes(svgNode, {'xlink:href': this._image,
                                       width: `${this.diagram.width}`,
                                       height: `${this.diagram.height}`,
                                       preserveAspectRatio: "none"});
        return svgNode;
    }
}

//==============================================================================

class Region extends DiagramElement
{
    constructor(diagram, domElement, background)
    {
        super(diagram, domElement);
        this._background = background;
        if (domElement.hasAttribute('region')) {
            this.regionId = domElement.getAttribute('region');
        } else {
            throw new exception.SyntaxError(domElement, "Missing 'region' attribute");
        }
    }

    setPositionOffset()
    //=================
    {
        const offset = this._background.svgDocument.centroid(this.regionId);
        this.position.setOffset(offset);
    }

    layout()
    //======
    {
        this.position.assignCoordinates(this.diagram);
    }
}

//==============================================================================
