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

import * as dia from './diagram.js';
import * as SyntaxError from './SyntaxError.js';

//==============================================================================

var _pj;
function _pj_snippets(container) {
    function in_es6(left, right) {
        if (((right instanceof Array) || ((typeof right) === "string"))) {
            return (right.indexOf(left) > (- 1));
        } else {
            if (((right instanceof Map) || (right instanceof Set) || (right instanceof WeakMap) || (right instanceof WeakSet))) {
                return right.has(left);
            } else {
                return (left in right);
            }
        }
    }
    container["in_es6"] = in_es6;
    return container;
}
_pj = {};
_pj_snippets(_pj);

//==============================================================================

class Length {
    constructor(length = 0, units = "%") {
        this._length = length;
        this._units = units;
    }

    get length() {
        return this._length;
    }

    get units() {
        return this._units;
    }

    static from_text(text) {
        var length, units;
        if (text.endswith("%")) {
            length = (Number.parseFloat(text.slice(0, (- 1))) / 100.0);
            units = "%";
        } else {
            if (text.endswith("px")) {
                length = Number.parseFloat(text.slice(0, (- 2)));
                units = "px";
            } else {
                throw new SyntaxError("Missing units: '%' or 'px' required");
            }
        }
        return this(length, units);
    }

    toString() {
        if ((this.units === "%")) {
            return "{:g}%".format((100.0 * this.length));
        } else {
            return "{:g}px".format(this.length);
        }
    }

    __eq__(other) {
        if ((this.units !== other.units)) {
            throw new TypeError("Units are different");
        } else {
            return (this.length === other.length);
        }
    }

    __ne__(other) {
        return (! (this === other));
    }

    __lt__(other) {
        if ((this.units !== other.units)) {
            throw new TypeError("Units are different");
        } else {
            return (this.length < other.length);
        }
    }

    __le__(other) {
        return ((this < other) || (this === other));
    }

    __gt__(other) {
        return (! (this <= other));
    }

    __ge__(other) {
        return (! (this < other));
    }

    __add__(other) {
        if ((this.units !== other.units)) {
            throw new TypeError("Units are different");
        } else {
            return new Length((this.length + other.length), this.units);
        }
    }

    __sub__(other) {
        if ((this.units !== other.units)) {
            throw new TypeError("Units are different");
        } else {
            return new Length((this.length - other.length), this.units);
        }
    }

    __mul__(other) {
        if ((this.units !== other.units)) {
            return new Length((this.length * other.length), "px");
        } else {
            if (this.is_percentage) {
                return new Length((this.length * other.length), "%");
            } else {
                throw new TypeError("Cannot multiply pixel lengths");
            }
        }
    }

    __truediv__(other) {
        if ((this.units !== other.units)) {
            throw new TypeError("Units are different");
        } else {
            if ((other.length === 0)) {
                throw ZeroDivisionError;
            } else {
                return new Length((this.length / other.length), "%");
            }
        }
    }

    get is_percentage() {
        return (this._units === "%");
    }

    get is_pixels() {
        return (this._units === "px");
    }

    make_percentage_of(base) {
        if (this.is_percentage) {
            return this;
        } else {
            if (base.is_percentage) {
                throw new TypeError("Base length must be in pixels");
            } else {
                return new Length((this.length / base.length), "%");
            }
        }
    }

    scale(ratio) {
        return new Length((ratio * this.length), this.units);
    }
}

//==============================================================================

class LengthTuple {
    constructor(lengths) {
        this._lengths = tuple(lengths);
    }

    static from_text(text) {
        return this((text ? function () {
            var _pj_a = [], _pj_b = text.split();
            for (var _pj_c = 0, _pj_d = _pj_b.length; (_pj_c < _pj_d); _pj_c += 1) {
                var x = _pj_b[_pj_c];
                _pj_a.push(Length.from_text(x));
            }
            return _pj_a;
        }.call(this) : []));
    }

    get length() {
        return this._lengths.length;
    }

    toString() {
        return "({})".format(", ".join(function () {
            var _pj_a = [], _pj_b = this._lengths;
            for (var _pj_c = 0, _pj_d = _pj_b.length; (_pj_c < _pj_d); _pj_c += 1) {
                var l = _pj_b[_pj_c];
                _pj_a.push(l.toString());
            }
            return _pj_a;
        }.call(this)));
    }

    * __iter__() {
        for (var length, _pj_c = 0, _pj_a = this._lengths, _pj_b = _pj_a.length; (_pj_c < _pj_b); _pj_c += 1) {
            length = _pj_a[_pj_c];
            yield length;
        }
        throw StopIteration;
    }

    __eq__(other) {
        var l, n;
        if ((this.length !== other.length)) {
            return false;
        } else {
            for (var nl, _pj_c = 0, _pj_a = enumerate(this._lengths), _pj_b = _pj_a.length; (_pj_c < _pj_b); _pj_c += 1) {
                nl = _pj_a[_pj_c];
                [n, l] = nl;
                if ((l !== other[n])) {
                    return false;
                }
            }
            return true;
        }
    }

    __ne__(other) {
        return (! (this === other));
    }

    __add__(other) {
        if ((this.length !== other.length)) {
            throw new TypeError("Lengths are of different dimension");
        } else {
            return new LengthTuple(function () {
                var _pj_a = [], _pj_b = enumerate(this._lengths);
                for (var _pj_c = 0, _pj_d = _pj_b.length; (_pj_c < _pj_d); _pj_c += 1) {
                    var nl = _pj_b[_pj_c];
                    _pj_a.push((nl[1] + other[nl[0]]));
                }
                return _pj_a;
            }.call(this));
        }
    }

    __sub__(other) {
        if ((this.length !== other.length)) {
            throw new TypeError("Lengths are of different dimension");
        } else {
            return new LengthTuple(function () {
                var _pj_a = [], _pj_b = enumerate(this._lengths);
                for (var _pj_c = 0, _pj_d = _pj_b.length; (_pj_c < _pj_d); _pj_c += 1) {
                    var nl = _pj_b[_pj_c];
                    _pj_a.push((nl[1] - other[nl[0]]));
                }
                return _pj_a;
            }.call(this));
        }
    }

    __mul__(other) {
        if ((this.length !== other.length)) {
            throw new TypeError("Lengths are of different dimension");
        } else {
            return new LengthTuple(function () {
                var _pj_a = [], _pj_b = enumerate(this._lengths);
                for (var _pj_c = 0, _pj_d = _pj_b.length; (_pj_c < _pj_d); _pj_c += 1) {
                    var nl = _pj_b[_pj_c];
                    _pj_a.push((nl[1] * other[nl[0]]));
                }
                return _pj_a;
            }.call(this));
        }
    }

    __truediv__(other) {
        if ((this.length !== other.length)) {
            throw new TypeError("Lengths are of different dimension");
        } else {
            return new LengthTuple(function () {
                var _pj_a = [], _pj_b = enumerate(this._lengths);
                for (var _pj_c = 0, _pj_d = _pj_b.length; (_pj_c < _pj_d); _pj_c += 1) {
                    var nl = _pj_b[_pj_c];
                    _pj_a.push((nl[1] / other[nl[0]]));
                }
                return _pj_a;
            }.call(this));
        }
    }

    __getitem__(index) {
        return this._lengths[index];
    }

    __contains__(value) {
        return _pj.in_es6(value, this._lengths);
    }

    get is_percentage() {
        for (var l, _pj_c = 0, _pj_a = this._lengths, _pj_b = _pj_a.length; (_pj_c < _pj_b); _pj_c += 1) {
            l = _pj_a[_pj_c];
            if ((! l.is_percentage)) {
                return false;
            }
        }
        return true;
    }

    get is_pixels() {
        for (var l, _pj_c = 0, _pj_a = this._lengths, _pj_b = _pj_a.length; (_pj_c < _pj_b); _pj_c += 1) {
            l = _pj_a[_pj_c];
            if ((! l.is_pixels)) {
                return false;
            }
        }
        return (this.length > 0);
    }

    make_percentage_of(base) {
        if ((this.length !== base.length)) {
            throw new TypeError("Lengths are of different dimension");
        } else {
            return new LengthTuple(function () {
                var _pj_a = [], _pj_b = enumerate(this._lengths);
                for (var _pj_c = 0, _pj_d = _pj_b.length; (_pj_c < _pj_d); _pj_c += 1) {
                    var nl = _pj_b[_pj_c];
                    _pj_a.push(nl[1].make_percentage_of(base[nl[0]]));
                }
                return _pj_a;
            }.call(this));
        }
    }
    scale(ratio) {
        return new LengthTuple(function () {
            var _pj_a = [], _pj_b = this._lengths;
            for (var _pj_c = 0, _pj_d = _pj_b.length; (_pj_c < _pj_d); _pj_c += 1) {
                var l = _pj_b[_pj_c];
                _pj_a.push(l.scale(ratio));
            }
            return _pj_a;
        }.call(this));
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
