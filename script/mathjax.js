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

function suffix_ids(xml, attribute, id_base, new_attrib = null) {
    for (var e, _pj_c = 0, _pj_a = xml.findall(".//*[@{}]".format(attribute)), _pj_b = _pj_a.length; (_pj_c < _pj_b); _pj_c += 1) {
        e = _pj_a[_pj_c];
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
    if ((! svg.startswith("<svg "))) {
        throw new ValueError(svg);
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

export function typeset(latex, id_base) {
    var headers, http_client, mathjax, request, response, svg;
    if ((latex.startswith("$") && latex.endswith("$"))) {
        latex = latex.slice(1, (- 1));
    }
    mathjax = json.dumps({"format": "TeX", "math": latex, "svg": true, "width": 10000, "linebreaks": false});
    headers = {"Content-Type": "application/json"};
    request = new HTTPRequest("http://localhost:8003/", {"method": "POST", "headers": headers, "body": mathjax});
    http_client = new HTTPClient();
    try {
        response = http_client.fetch(request);
        svg = clean_svg(response.body, id_base);
    } catch(e) {
        if ((e instanceof HTTPError)) {
            svg = "<text>ERROR 1</text>";
        } else {
            if ((e instanceof IOError)) {
                svg = "<text>ERROR 2</text>";
            } else {
                throw e;
            }
        }
    }
    http_client.close();
    return svg;
}

//==============================================================================
