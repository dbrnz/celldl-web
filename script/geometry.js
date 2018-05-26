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

import * as dia from './diagram.js';

//==============================================================================

export class Point {
    constructor(x=0.0, y=0.0) {
        this.coords = [x, y];
    }

    get x() {
        return this.coords[0];
    }

    get y() {
        return this.coords[1];
    }

    toString() {
        return `<Point (${this.coords[0]}, ${this.coords[1]})>`;
    }

    copy() {
        return new Point(this.x, this.y);
    }
}

//==============================================================================

class GeometricObject {
    constructor(pos = null, size = null) {
        this._position = LengthTuple.from_text(pos);
        this._size = LengthTuple.from_text(size);
    }

    get position() {
        return this._position;
    }

    get size() {
        return this._size;
    }

    get width() {
        return this._size[0];
    }

    get height() {
        return this._size[1];
    }

    svg() {
        return "";
    }
}

//==============================================================================

export class Box {
    constructor(container = null, ref = null, kwds = {}) {
        this._ref = ref;
        if ((! this.size)) {
            throw new ValueError("Box cannot have zero size");
        }
        if (this.size.is_pixels) {
            this._pixel_size = this.size;
            if ((container === null)) {
                this._size = new LengthTuple([new Length(1.0), new Length(1.0)]);
            } else {
                if (container.pixel_size) {
                    this._size = this.size.make_percentage_of(container.pixel_size);
                } else {
                    throw new ValueError("Cannot use pixels if container's pixel size is unknown");
                }
            }
        } else {
            if ((! this.size.is_percentage)) {
                if (((container === null) || (! container.pixel_size))) {
                    throw new ValueError("Cannot use pixels if container's pixel size is unknown");
                }
                this._size = this.size.make_percentage_of(container.pixel_size);
                this._pixel_size = (this._size * container.pixel_size);
            } else {
                this._pixel_size = (this._size * container.pixel_size);
            }
        }
        if ((! this.position)) {
            this._position = new LengthTuple([new Length(), new Length()]);
        }
        if ((! this.position.is_percentage)) {
            if (((container === null) || (! container.pixel_size))) {
                throw new ValueError("Cannot use pixels if container's pixel size is unknown");
            }
            this._position = this.position.make_percentage_of(container.pixel_size);
        }
        this._boxes = [];
        this._items = [];
        if (container) {
            container.add_box(this);
        }
    }

    get pixel_size() {
        return this._pixel_size;
    }

    add_box(box) {
        this._boxes.append(box);
    }

    add_item(item) {
        this._items.append(item);
    }

    layout_diagram_elements(container_offset, container_size) {
        var bottom_right, element, size, top_left;
        top_left = (container_offset + (container_size * this.position));
        size = (container_size * this.size);
        bottom_right = (top_left + size);
        if ((this._ref !== null)) {
            element = dia.Element.find(this._ref);
            if ((element === null)) {
                throw new KeyError("Unknown diagram element '{}".format(this._ref));
            } else {
                element.set_position([top_left[0].length, top_left[1].length]);
                element.set_size([size[0].length, size[1].length]);
            }
        }
        for (var box, _pj_c = 0, _pj_a = this._boxes, _pj_b = _pj_a.length; (_pj_c < _pj_b); _pj_c += 1) {
            box = _pj_a[_pj_c];
            box.layout_diagram_elements(top_left, size);
        }
        for (var item, _pj_c = 0, _pj_a = this._items, _pj_b = _pj_a.length; (_pj_c < _pj_b); _pj_c += 1) {
            item = _pj_a[_pj_c];
            item.layout_diagram_elements(top_left, size);
        }
    }
}

//==============================================================================

class Geometry extends Box {
    constructor(kwds = {}) {
        super();
    }

    layout_diagram_elements(diagram) {
        var height, width;
        width = diagram.style.get("width");
        if ((width === null)) {
            width = this._pixel_size[0].length;
        }
        height = diagram.style.get("height");
        if ((height === null)) {
            height = this._pixel_size[1].length;
        }
        diagram.set_size([width, height]);
        super.layout_diagram_elements(new LengthTuple([new Length(0, "px"), new Length(0, "px")]), new LengthTuple([new Length(width, "px"), new Length(height, "px")]));
    }
}

//==============================================================================

class Item extends GeometricObject {
    constructor(container = null, ref = null, pos = null, boundary = null, kwds = {}) {
        var position;
        super();
        this._ref = ref;
        position = LengthTuple.from_text(pos);
        if (((! position.is_percentage) && ((container === null) || (! container.pixel_size)))) {
            throw new ValueError("Cannot use pixels if container's pixel size is unknown");
        }
        if ((boundary === null)) {
            this._position = position.make_percentage_of(container.pixel_size);
        } else {
            if ((boundary === "top")) {
                pos = [position[0], new Length(0.0)];
            } else {
                if ((boundary === "left")) {
                    pos = [new Length(0.0), position.slice((- 1))[0]];
                } else {
                    if ((boundary === "bottom")) {
                        pos = [position[0], new Length(1.0)];
                    } else {
                        if ((boundary === "right")) {
                            pos = [new Length(1.0), position.slice((- 1))[0]];
                        }
                    }
                }
            }
            this._position = new LengthTuple(pos).make_percentage_of(container.pixel_size);
        }
        if (container) {
            container.add_item(this);
        }
    }

    layout_diagram_elements(container_offset, container_size) {
        var element, offset, pos;
        offset = (container_offset + (container_size * this.position));
        pos = [offset[0].length, offset[1].length];
        if ((this._ref !== null)) {
            element = dia.Element.find(this._ref);
            if ((element === null)) {
                throw new KeyError("Unknown diagram element '{}".format(this._ref));
            } else {
                element.set_position(pos);
            }
        }
    }
}

//==============================================================================
