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

import {SVG_NS, XLINK_NS} from './svgElements.js';

//==============================================================================

export class TypeSetter
{
    constructor(latex, destinationNode, colour)
    {
        let svgNode = null;
        latex = `\\color{${colour}}{${latex}}`;
        if (TypeSetter._cache.has(latex)) {
            const svgNode = TypeSetter._cache.get(latex);
        } else {
            MathJax.Reset();
            svgNode = TypeSetter.cleanSvg(destinationNode.id, MathJax.Typeset(latex, true).children[0]);
            TypeSetter._cache.set(self.latex, svgNode);
        }
        destinationNode.appendChild(svgNode);
        return Promise.resolve(null);
    }

    static suffixIds(rootNode, attribute, id_base, NS=null)
    //=====================================================
    {
        const idElements = (NS === null) ? rootNode.querySelectorAll(`[${attribute}]`)
                                         : rootNode.querySelectorAll(`[*|${attribute}]`);
        for (let e of idElements) {
            const idAttribute = e.attributes[attribute];
            if (NS === idAttribute.namespaceURI) {
                idAttribute.value += `_${id_base}`;
            }
        }
    }

    static cleanSvg(id, svgNode)
    //==========================
    {
        TypeSetter.suffixIds(svgNode, 'id', id);
        TypeSetter.suffixIds(svgNode, 'href', id, XLINK_NS);

        const viewBox = svgNode.getAttribute('viewBox').split(/\s*,\s*| \s*/);
        const x = Number.parseFloat(viewBox[0]);
        const y = Number.parseFloat(viewBox[1]);
        const w = Number.parseFloat(viewBox[2]);
        const h = Number.parseFloat(viewBox[3]);

        const textNode = document.createElementNS(SVG_NS, 'g');
        // MathJax SVG  TeX font has an x-height of 442 (= viewBox[3]/ex-width)
        textNode.setAttribute('transform', `scale(${10/442}) translate(${-x-w/2}, ${-y-h/2})`);

        const svg = svgNode.innerHTML;
        textNode.insertAdjacentHTML('afterbegin', svg);

        return textNode;
    }
}

TypeSetter._cache = new Map();

//==============================================================================
