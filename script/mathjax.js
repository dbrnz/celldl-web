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

//const MATHJAX_PATH = './thirdparty/MathJax/unpacked/MathJax.js';

//==============================================================================

//let mathJaxLoaded = false;

export function loadMathJax()
//===========================
{
}

//    if (mathJaxLoaded)
//        return;
/*
(function () {
    const config = document.createElement('script');
    config.setAttribute('type', 'text/x-mathjax-config');
    config.textContent = `MathJax.Hub.Config({
                            jax: ["input/TeX", "output/SVG"],
                            messageStyle: "none",
                            showProcessingMessages: false,
                            skipStartupTypeset: true,
                            showMathMenu: false,
                            showMathMenuMSIE: false,
                            TeX: {
                                extensions: window.Array(
                                    "AMSmath.js",
                                    "AMSsymbols.js",
                                    "autoload-all.js"
                                )
                            },
                            SVG: {
                                font: "STIX-Web",
                                useFontCache: true,
                                useGlobalCache: false,  // Can we set true and extract global <defs> ??
                                EqnChunk: 1000000,
                                EqnDelay: 0
                            },
                            tex2jax: {
                                inlineMath: [['$','$'],['\\(','\\)']]
                            }
                        });`;
    document.head.appendChild(config);
    const script = document.createElement("script");
    script.setAttribute('type', 'text/javascript');
    script.setAttribute('src', MATHJAX_PATH);
    document.head.appendChild(script);
})();
*/

//    mathJaxLoaded = true;


//==============================================================================

export class TypeSetter
{
    constructor(latex, id, destinationNode, colour, returnSvgElement=false)
    {
        latex = `\\color{${colour}}${latex}`;
        if (TypeSetter._cache.has(latex)) {
            const svgNode = TypeSetter._cache.get(latex);
            destinationNode.appendChild(svgNode);
            return Promise.resolve(null);
        }

        this.latex = latex;
        this.id = id;
        this.destinationNode = destinationNode;
        this.content = document.createElement("span");
        this.content.setAttribute('style', 'display: none');

        const math = document.createElement("script");
        math.setAttribute('type', 'math/tex');
        math.textContent = latex;
        this.content.appendChild(math);

        document.body.appendChild(this.content);

        const typesetPromise = new Promise(function(resolve, reject) {
            MathJax.Hub.Queue(["Typeset", MathJax.Hub, math, resolve]);
        });
        return returnSvgElement ? typesetPromise.then(TypeSetter.saveSvg(this))
                                : typesetPromise.then(TypeSetter.saveSvgContents(this));
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

    static saveSvg(self)
    //==================
    {
        return function() {
            var jax = MathJax.Hub.getAllJax(self.content)[0];
            if (!jax) return;

            const script = jax.SourceElement();
            const svgNode = script.previousSibling.getElementsByTagName('svg')[0];
            TypeSetter.suffixIds(svgNode, 'id', self.id);
            TypeSetter.suffixIds(svgNode, 'href', self.id, XLINK_NS);
/*
            const width = svgNode.getAttribute('width');
            const height = svgNode.getAttribute('height');
            const style = svgNode.getAttribute('style');

            const w = 6*Number.parseFloat(width.slice(0, -2));  // `6*`` == ex --> ??
            const h = 6*Number.parseFloat(height.slice(0, -2));
            const va = 6*Number.parseFloat(style.split(' ')[1].slice(0, -3));

            const textNode = document.createElementNS(SVG_NS, 'g');
            textNode.setAttribute('transform', `translate(${-w/2 - 2}, ${h/2 + va + 2}) scale(0.02)`);

            const svg = svgNode.innerHTML;
            textNode.insertAdjacentHTML('afterbegin', svg);

            TypeSetter._cache.set(self.latex, textNode);
            self.destinationNode.appendChild(textNode);
*/
            TypeSetter._cache.set(self.latex, svgNode);
            self.destinationNode.appendChild(svgNode);

            // We can now delete the content node

            self.content.remove();
        };
    }

    static saveSvgContents(self)
    //==========================
    {
        return function() {
            var jax = MathJax.Hub.getAllJax(self.content)[0];
            if (!jax) return;

            const script = jax.SourceElement();
            const svgNode = script.previousSibling.getElementsByTagName('svg')[0];
            TypeSetter.suffixIds(svgNode, 'id', self.id);
            TypeSetter.suffixIds(svgNode, 'href', self.id, XLINK_NS);

            const width = svgNode.getAttribute('width');
            const height = svgNode.getAttribute('height');
            const style = svgNode.getAttribute('style');

            const w = 6*Number.parseFloat(width.slice(0, -2));  // `6*`` == ex --> ??
            const h = 6*Number.parseFloat(height.slice(0, -2));
            const va = 6*Number.parseFloat(style.split(' ')[1].slice(0, -3));

            const textNode = document.createElementNS(SVG_NS, 'g');
            textNode.setAttribute('transform', `translate(${-w/2 - 2}, ${h/2 + va + 2}) scale(0.02)`);

            const svg = svgNode.innerHTML;
            textNode.insertAdjacentHTML('afterbegin', svg);

            TypeSetter._cache.set(self.latex, textNode);
            self.destinationNode.appendChild(textNode);

            // We can now delete the content node

            self.content.remove();
        };
    }
}

TypeSetter._cache = new Map();

//==============================================================================
