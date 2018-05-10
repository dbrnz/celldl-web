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

import * as geo from './geometry.js';

//==============================================================================

import * as layout from './layout.js';
import * as parser from './parser.js';
import * as svg_elements from './svg_elements.js';
import * as SyntaxError from './SyntaxError.js';

//==============================================================================

export class Element {
    constructor(container, attributes, style, className="Element") {
        this.id = ('id' in attributes) ? ("#" + attributes.id) : null;
        const name = ('name' in attributes) ? attributes.name
                   : ((this.id !== null) ? thid.id : "");
        this.localName = name;
        this.container = container;
        if (container === null) {
            this.diagram = this;
            this.fullName = "/";
        } else {
            this.diagram = container.diagram;
            this.fullName = container.fullName + "/" + name;
        }
        this.className = className;
        this.classes = ('class' in attributes) ? attribute.class.split(/\s*/) : [];
        this.label = ('label' in attributes) ?  attributes.label : name;
        this.style = style;
    }

    toString() {
        let s = [this._class_name];
        if (this._id) {
            s.append("({})".format(this._id));
        }
        return " ".join(s);
    }

    get colour() {
        const tokens = this._style.get("colour", this._style.get("color", null));
        if ((tokens === null)) {
            return "#808080";
        }
        return parser.get_colour(new parser.StyleTokens(tokens));
    }

    get stroke() {
        return this.get_style_as_string("stroke", "none");
    }

    get stroke_width() {
        return this.get_style_as_string("stroke-width", "1");
    }

    isClass(name) {
        return this.classes.indexOf(name) > - 1;
    }

    setContainer(container) {
        this._container = container;
    }

    display() {
        const d = this.get_style_as_string("display");
        return (d ? " display=\"{}\"".format(d) : "");
    }

    id_class() {
        let s = [""];
        if ((this._id !== null))
            s.append("id=\"{}\"".format(this._id.slice(1)));
        if (this._classes)
            s.append("class=\"{}\"".format(" ".join(this._classes)));
        return " ".join(s);
    }
}

//==============================================================================

export class PositionedElement extends Element {
    constructor(container, attributes, style, className="positionedElement") {
        super(container, attributes, style, className);
        this.position = new layout.Position(this);
        this.position.addDependency(container);
        this.positionTokens = parser.StyleTokens.create(style, "position");
        this.geometry = null;
    }

    get positionResolved() {
        return ((this.position !== null) && this.position.resolved);
    }

    get coords() {
        return this.position.coords;
    }

    get geometry() {
        if ((this.geometry === null) && this.position.hasCoords) {
            this.geometry = Point(this.coords);
        }
        return this.geometry;
    }

    resolvePosition() {
        this.position.resolve();
    }

    parse_geometry(defaultOffset = null, defaultDependency = null) {
        /*
        * Position as coords: absolute or % of container -- `(100, 300)` or `(10%, 30%)`
        * Position as offset: relation with absolute offset from element(s) -- `300 above #q1 #q2`
        */
        if (this._position_tokens !== null) {
            this.position.parse(this.positionTokens, defaultOffset, defaultDependency);
        }
    }

    label_as_svg() {
        var rotation, x, y;
        [x, y] = this.coords;
        if (this.label.startswith("$")) {
            rotation = Number.parseFloat(this.get_style_as_string("text-rotation", "0"));
            return svg_elements.Text.typeset(this.label, x, y, rotation);
        } else {
            return "  <text text-anchor=\"middle\" dominant-baseline=\"central\" x=\"{}\" y=\"{}\">{}</text>".format(x, y, this.label);
        }
    }

    svg(radius = layout.ELEMENT_RADIUS) {
        var svg, x, y;
        svg = ["<g{}{}>".format(this.idClass(), this.display())];
        if (this.position.hasCoords) {
            [x, y] = this.coords;
            svg.append("  <circle r=\"{}\" cx=\"{}\" cy=\"{}\" stroke=\"{}\" stroke-width=\"{}\" fill=\"{}\"/>".format(radius, x, y, this.stroke, this.stroke_width, this.colour));
            svg.append(this.label_as_svg());
        }
        svg.append("</g>");
        return svg;
    }
}

//==============================================================================
