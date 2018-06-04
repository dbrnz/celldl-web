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

const MATHJAX_PATH = './thirdparty/MathJax/unpacked/MathJax.js';

//==============================================================================

import * as exception from './exception.js';

//==============================================================================

function suffix_ids(xml, attribute, id_base, new_attrib = null) {
    for (let e of xml.findall(".//*[@{}]".format(attribute))) {
        if ((new_attrib === null)) {
            e.attrib[attribute] += ("_" + id_base);
        } else {
            e.attrib[new_attrib] = ((e.attrib[attribute] + "_") + id_base);
            delete e.attrib[attribute];
        }
    }
}

//==============================================================================

function clean_svg(svg, id_base) {
    var h, s, title, va, vb, w, xml;
    if ((! svg.startsWith("<svg "))) {
        throw new exception.ValueError(svg);
    }
    xml = etree.fromstring(svg);
    xml.tag = "{http://www.w3.org/2000/svg}g";

    w = xml.attrib.get("width", null);
    h = xml.attrib.get("height", null);

    s = xml.attrib.get("style", "N 0").split();
    va = ((s[0] === "vertical-align:") ? s[1].slice(0, (- 1)) : null);


    vb = xml.attrib.get("viewBox", null);
    xml.attrib.clear();
    title = xml.find("{http://www.w3.org/2000/svg}title");
    if ((title !== null)) {
        xml.remove(title);
    }


    suffix_ids(xml, "id", id_base);
    suffix_ids(xml, "{http://www.w3.org/1999/xlink}href", id_base);

    return [etree.tostring(xml, {"encoding": "unicode"}), [w, h, va, vb]];
}

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
    constructor(latex, x, y, rotation, nodeId)
    {
        this.x = x;
        this.y = y;
        this.rotation = rotation;
        this.nodeId = nodeId;
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
        return typesetPromise.then(TypeSetter.saveSvg(this));
    }

    static saveSvg(self)
    {
        return function() {
            var jax = MathJax.Hub.getAllJax(self.content)[0];
            if (!jax) return;

            const script = jax.SourceElement();
            const svg = script.previousSibling.getElementsByTagName("svg")[0];
            const width = svg.getAttribute('width');
            const height = svg.getAttribute('height');
            const style = svg.getAttribute('style');

            const w = 6*Number.parseFloat(width.slice(0, -2));  // `6*`` == ex --> ??
            const h = 6*Number.parseFloat(height.slice(0, -2));
            const va = 6*Number.parseFloat(style.split(' ')[1].slice(0, -3));

/*        const [w, h, va] = [(6 * Number.parseFloat(size[0].slice(0, (-2)))),
                            (6 * Number.parseFloat(size[1].slice(0, (-2)))),
                            (6 * Number.parseFloat(size[2].slice(0, (-2))))];
*/
            const destination = document.getElementById(self.nodeId);
            destination.setAttribute('transform', `translate(${self.x - w/2}, ${self.y + h/2 + va}) scale(0.015)`);
            destination.insertAdjacentHTML('afterbegin', svg.innerHTML);

            // can now delete content node...

            self.content.remove();
        }
    }
}

//==============================================================================
