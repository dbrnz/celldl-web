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

//import 'jsts/org/locationtech/jts/geom/GeometryFactory' as 'geo';

import Coordinate      from './jsts/org/locationtech/jts/geom/Coordinate'
import GeometryFactory from './jsts/org/locationtech/jts/geom/GeometryFactory'

const factory = new GeometryFactory()

function Point(c) {
  return factory.createPoint(new Coordinate(c[0], c[1]))
}

//==============================================================================

import * as layout from './layout';
import * as parser from './parser';

import * as svg_elements from './svg_elements';

import * as SyntaxError from './SyntaxError';

//==============================================================================

export class Element {
    constructor(container, class_name = "Element", _class = null, id = null, name = null, label = null, style = null) {
        this._id = ((id !== null) ? ("#" + id) : null);
        if ((name === null)) {
            name = ((id !== null) ? id : "");
        }
        this._local_name = name;
        if ((this === container)) {
            this._container = null;
            this._diagram = this;
            this._full_name = "/";
        } else {
            this._container = container;
            this._diagram = container.diagram;
            this._full_name = (((container && container.full_name) && name) ? ((container.full_name + "/") + name) : null);
        }
        this._class_name = class_name;
        this._classes = ((_class !== null) ? _class.split(/\s*/) : []);
        this._label = (label ? label : name);
        this._style = ((style !== null) ? style : {});
        // Now invoke any PositionedElement mix-in...
    }

    toString() {
        let s = [this._class_name];
        if (this._id) {
            s.append("({})".format(this._id));
        }
        return " ".join(s);
    }

    get full_name() {
        return this._full_name;
    }

    get id() {
        return this._id;
    }

    get label() {
        return this._label;
    }

    get local_name() {
        return this._local_name;
    }

    get diagram() {
        return this._diagram;
    }

    get container() {
        return this._container;
    }

    get style() {
        return this._style;
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

    is_class(name) {
        return this.classes.indexOf(name) > - 1;
    }

    set_container(container) {
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

export class PositionedElement {
    constructor() {
        this._position = new layout.Position(this);
        this._position.add_dependency(this._container);
        this._position_tokens = parser.StyleTokens.create(this._style, "position");
        this._geometry = null;
    }

    get position() {
        return this._position;
    }

    get position_resolved() {
        return ((this._position !== null) && this._position.resolved);
    }

    get coords() {
        return this._position.coords;
    }

    get geometry() {
        if (((this._geometry === null) && this.position.has_coords)) {
            this._geometry = Point(this.coords);
        }
        return this._geometry;
    }

    resolve_position() {
        this._position.resolve();
    }

    parse_geometry(default_offset = null, default_dependency = null) {
        /*
        * Position as coords: absolute or % of container -- `(100, 300)` or `(10%, 30%)`
        * Position as offset: relation with absolute offset from element(s) -- `300 above #q1 #q2`
        */
        if ((this._position_tokens !== null)) {
            this.position.parse(this._position_tokens, default_offset, default_dependency);
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
        svg = ["<g{}{}>".format(this.id_class(), this.display())];
        if (this.position.has_coords) {
            [x, y] = this.coords;
            svg.append("  <circle r=\"{}\" cx=\"{}\" cy=\"{}\" stroke=\"{}\" stroke-width=\"{}\" fill=\"{}\"/>".format(radius, x, y, this.stroke, this.stroke_width, this.colour));
            svg.append(this.label_as_svg());
        }
        svg.append("</g>");
        return svg;
    }
}

//==============================================================================
