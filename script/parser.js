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

import * as SPECIFICITY from './specificity';
/*
import * as io from 'io';
import * as itertools from 'itertools';
import * as logging from 'logging';
import {etree} from 'lxml';
import * as cssselect2 from 'cssselect2';
import * as tinycss2 from 'tinycss2';
import * as tinycss2.color3 from 'tinycss2/color3';
*/
//==============================================================================

import * as SyntaxError from './syntaxerror';
import * as bg from './bondgraph';
import * as dia from './diagram';
import {GradientStore} from './svg_elements';

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
    function set_properties(cls, props) {
        var desc, value;
        var _pj_a = props;
        for (var p in _pj_a) {
            if (_pj_a.hasOwnProperty(p)) {
                value = props[p];
                if (((((! ((value instanceof Map) || (value instanceof WeakMap))) && (value instanceof Object)) && ("get" in value)) && (value.get instanceof Function))) {
                    desc = value;
                } else {
                    desc = {"value": value, "enumerable": false, "configurable": true, "writable": true};
                }
                Object.defineProperty(cls.prototype, p, desc);
            }
        }
    }
    container["in_es6"] = in_es6;
    container["set_properties"] = set_properties;
    return container;
}
_pj = {};
_pj_snippets(_pj);

//==============================================================================

var NAMESPACE = "http://www.cellml.org/celldl/1.0#";

function CellDL_namespace(tag) {
    return "{{{}}}{}".format(NAMESPACE, tag);
}

//==============================================================================

class StyleTokens extends object {
    constructor(tokens) {
        this._tokens = iter(tokens);
        this._buffer = [];
        this._value = null;
        this._skip_space = true;
    }

    static create(style, name) {
        var tokens;
        tokens = style.get(name, null);
        return (tokens ? this(tokens) : null);
    }

    __iter__() {
        return this;
    }

    __next__() {
        var token;
        while (true) {
            try {
                token = (this._buffer ? this._buffer.pop() : next(this._tokens));
            } catch(e) {
                if ((e instanceof StopIteration)) {
                    this._value = null;
                    throw StopIteration;
                } else {
                    throw e;
                }
            }
            if (((! this._skip_space) || (! _pj.in_es6(token.type, ["comment", "whitespace"])))) {
                this._skip_space = true;
                this._value = token;
                return token;
            }
        }
    }

    get value() {
        return this._value;
    }

    next(skip_space = true) {
        var token;
        this._skip_space = skip_space;
        try {
            token = next(this);
        } catch(e) {
            if ((e instanceof StopIteration)) {
                return null;
            } else {
                throw e;
            }
        }
        return token;
    }

    back() {
        this._buffer.append(this._value);
    }

    peek(skip_space = true) {
        var token;
        this._skip_space = skip_space;
        try {
            token = next(this);
        } catch(e) {
            if ((e instanceof StopIteration)) {
                return null;
            } else {
                throw e;
            }
        }
        this._buffer.append(token);
        return token;
    }
}

//==============================================================================

class StyleSheet {
    constructor() {
        this.stylesheet = [];
        this._order = 0;
    }

    addStyle(styleElement) {
        const css = styleElement.textContent;
        const rules = CSSOM.parse(css).cssRules;
        for (let rule of rules) {
            const selectors = rule.selectorText.split(',');
            for (let selector of selectors) {
                this.stylesheet.push({selector: selector,
                                style: rule.style,
                                specificity: SPECIFICITY.calculate(selector)[0]['specificityArray'],
                                order: this._order});
                this._order += 1;
            }
        }

        this.stylesheet.sort(function(a, b) {
            const order = SPECIFICITY.compare(a.specificity, b.specificity);
            if (order != 0) {
                return order;
            } else {
                return (a.order > b.order) ?  1
                     : (a.order < b.order) ? -1
                     :  0;
            }
        });
    }

    style(element) {
        let style = {};
        for (let rule of this.stylesheet) {
            if (element.matches(rule.selector)) {
                for (let i = 0; i < rule.style.length; ++i) {
                    const key = rule.style[i];
                    style[key] = rule.style[key];
                }
            }
        }
        return style;
    }

}

//==============================================================================

/* Convention is that `tokens` is at **last** token processed */

function getNumber(tokens) {
    /*
    :param tokens: `StyleTokens` of tokens
    :return: numeric value
    */
    var token;
    token = tokens.next();
    if ((token.type !== "number")) {
        throw new SyntaxError("Number expected.");
    } else {
        return (token.is_integer ? token.int_value : token.value);
    }
}

//==============================================================================

function getPercentage(tokens, default_value = null) {
    /*
    :param tokens: `StyleTokens` of tokens
    :return: Length
    */
    var modifier, percentage, token;
    token = tokens.peek();
    if (((token === null) || (token.type !== "percentage"))) {
        if ((default_value !== null)) {
            return default_value;
        } else {
            throw new SyntaxError("Percentage expected.");
        }
    }
    percentage = (token.is_integer ? token.int_value : token.value);
    tokens.next();
    token = tokens.peek(false);
    modifier = (((token !== null) && (token.type === "ident")) ? token.lower_value : "");
    if ((! _pj.in_es6(modifier, ["", "x", "y"]))) {
        throw new SyntaxError("Modifier ({}) must be 'x' or 'y'.".format(modifier));
    } else {
        if ((modifier !== "")) {
            tokens.next();
        }
    }
    return [percentage, ("%" + modifier)];
}

//==============================================================================

function getLength(tokens, default_value = null) {
    /*
    :param tokens: `StyleTokens` of tokens
    :return: Length

    `100`, `100x`, `100y`
    */
    var modifier, token, value;
    token = tokens.peek();
    if (((token !== null) && (token.type === "percentage"))) {
        return get_percentage(tokens, default_value);
    } else {
        if (((token === null) || (! _pj.in_es6(token.type, ["number", "dimension"])))) {
            if ((default_value !== null)) {
                return default_value;
            } else {
                throw new SyntaxError("Length expected.");
            }
        }
    }
    value = (token.is_integer ? token.int_value : token.value);
    modifier = ((token.type === "dimension") ? token.lower_unit : "");
    if ((! _pj.in_es6(modifier, ["", "x", "y"]))) {
        throw new SyntaxError("Modifier must be 'x' or 'y'.");
    }
    tokens.next();
    return [value, modifier];
}

//==============================================================================

function getCoordinates(tokens, allow_local = true) {
    /*
    Get a coordinate pair.

    :param tokens: `StyleTokens` of tokens
    :return: tuple(Length, Length)
    */
    var coords, got_comma, length, token;
    coords = [];
    got_comma = true;
    token = tokens.next();
    while ((token !== null)) {
        if ((token === ",")) {
            if (got_comma) {
                throw new SyntaxError("Unexpected comma.");
            }
            got_comma = true;
        } else {
            if ((got_comma && (_pj.in_es6(token.type, ["dimension", "number"]) || (allow_local && (token.type === "percentage"))))) {
                got_comma = false;
                tokens.back();
                length = get_length(tokens);
                coords.append(length);
            } else {
                throw new SyntaxError("Invalid syntax.");
            }
        }
        token = tokens.next();
    }
    if ((coords.length !== 2)) {
        throw new SyntaxError("Expected length pair.");
    }
    return coords;
}

//==============================================================================

function getColour(tokens) {
    var colour, gradient, stop, stop_colours, token;
    token = tokens.peek();
    if ((token.type === "function")) {
        tokens.next();
        if ((! _pj.in_es6(token.name, ["radial-gradient", "linear-gradient"]))) {
            throw new SyntaxError("Unknown colour gradient.");
        }
        gradient = token.name.slice(0, 6);
        tokens = new StyleTokens(token.arguments);
        stop_colours = [];
        token = tokens.peek();
        while ((token !== null)) {
            colour = get_colour_value(tokens);
            token = tokens.next();
            if (((token !== null) && (token.type === "percentage"))) {
                stop = token.value;
                token = tokens.next();
            } else {
                stop = null;
            }
            if ((! _pj.in_es6(token, [null, ","]))) {
                throw new SyntaxError("Gradient stop percentage expected.");
            }
            stop_colours.append([colour, stop]);
            token = tokens.peek();
        }
        return GradientStore.url(gradient, stop_colours);
    } else {
        return get_colour_value(tokens);
    }
}

//==============================================================================

function getColourValue(tokens) {
    var token;
    token = tokens.next();
    if ((token !== null)) {
        if ((token.type === "hash")) {
            return ("#" + token.value);
        } else {
            if ((token.type === "ident")) {
                return token.value;
            }
        }
    }
    throw new SyntaxError("Colour expected.");
}


//==============================================================================

class ElementWrapper extends object {
    constructor(element, stylesheets) {
        var styling;
        this._element = element;
        this._tag = element.etree_element.tag;
        this._text = element.etree_element.text;
        this._attributes = dict(element.etree_element.items());
        for (var name, _pj_c = 0, _pj_a = this._reserved_words, _pj_b = _pj_a.length; (_pj_c < _pj_b); _pj_c += 1) {
            name = _pj_a[_pj_c];
            if (_pj.in_es6(name, this._attributes)) {
                this._attributes[(name + "_")] = this._attributes.pop(name);
            }
        }
        this._style = {};
        for (var s, _pj_c = 0, _pj_a = stylesheets, _pj_b = _pj_a.length; (_pj_c < _pj_b); _pj_c += 1) {
            s = _pj_a[_pj_c];
            this._style.update(s.match(element));
        }
        styling = this._attributes.pop("style", null);
        if ((styling !== null)) {
            for (var d, _pj_c = 0, _pj_a = function () {
                var _pj_d = [], _pj_e = tinycss2.parse_declaration_list(styling, {"skip_whitespace": true});
                for (var _pj_f = 0, _pj_g = _pj_e.length; (_pj_f < _pj_g); _pj_f += 1) {
                    var obj = _pj_e[_pj_f];
                    if ((obj.type === "declaration")) {
                        _pj_d.push(obj);
                    }
                }
                return _pj_d;
            }.call(this), _pj_b = _pj_a.length; (_pj_c < _pj_b); _pj_c += 1) {
                d = _pj_a[_pj_c];
                this._style[d.lower_name] = StyleSheet.style_value(d);
            }
        }
        logging.debug("ELEMENT: %s %s %s", this._tag, this._attributes, this._style);
    }

    get element() {
        return this._element;
    }

    get attributes() {
        return this._attributes;
    }

    get style() {
        return this._style;
    }

    get tag() {
        return this._tag;
    }

    get text() {
        return this._text;
    }
}

_pj.set_properties(ElementWrapper, {"_reserved_words": ["class", "from"]});

//==============================================================================

class ElementChildren extends object {
    constructor(root, stylesheets = null) {
        this._root_element = root.element;
        this._stylesheets = (stylesheets ? stylesheets : []);
    }

    * __iter__() {
        for (var e, _pj_c = 0, _pj_a = this._root_element.iter_children(), _pj_b = _pj_a.length; (_pj_c < _pj_b); _pj_c += 1) {
            e = _pj_a[_pj_c];
            if ((! (e.etree_element instanceof etree._Element))) {
                continue;
            }
            yield new ElementWrapper(e, this._stylesheets);
        }
        throw StopIteration;
    }
}

//==============================================================================

export class Parser
/*===============*/
{
    constructor() {
        this.diagram = null;
        this.bondGraph = null;
        this.stylesheet = new StyleSheet;
    }

    parseContainer(element, container)
    /*==============================*/
    {
        for (var e, _pj_c = 0, _pj_a = new ElementChildren(element, this._stylesheets), _pj_b = _pj_a.length; (_pj_c < _pj_b); _pj_c += 1) {
            e = _pj_a[_pj_c];
            this._last_element = e;
            if ((e.tag === new CellDL_namespace("compartment"))) {
                this.parse_compartment(e, container);
            } else {
                if ((e.tag === new CellDL_namespace("quantity"))) {
                    this.parse_quantity(e, container);
                } else {
                    if (((e.tag === new CellDL_namespace("transporter")) && (container instanceof dia.Compartment))) {
                        this.parse_transporter(e, container);
                    } else {
                        throw new SyntaxError("Unexpected XML element <{}>".format(e.tag));
                    }
                }
            }
        }
    }

    parseCompartment(element, container)
    /*================================*/
    {
        var compartment;
        compartment = new dia.Compartment(container, {"style": element.style, "attributes": element.attributes});
        this._diagram.addCompartment(compartment);
        this.parseContainer(element, compartment);
    }

    parseQuantity(element, container)
    /*=============================*/
    {
        var quantity;
        quantity = new dia.Quantity(container, {"style": element.style, "attributes": element.attributes});
        this._diagram.addQuantity(quantity);
    }

    parseTransporter(element, compartment)
    /*==================================*/
    {
        var transporter;
        transporter = new dia.Transporter(compartment, {"style": element.style, "attributes": element.attributes});
        this._diagram.addRransporter(transporter);
    }

    parseBondGraph(element)
    /*===================*/
    {
        for (var e, _pj_c = 0, _pj_a = new ElementChildren(element, this._stylesheets), _pj_b = _pj_a.length; (_pj_c < _pj_b); _pj_c += 1) {
            e = _pj_a[_pj_c];
            this._last_element = e;
            if ((e.tag === new CellDL_namespace("potential"))) {
                this.parsePotential(e);
            } else {
                if ((e.tag === new CellDL_namespace("flow"))) {
                    this.parseFlow(e);
                } else {
                    throw new SyntaxError("Invalid <bond-graph> element");
                }
            }
        }
    }

    parsePotential(element)
    /*===================*/
    {
        var potential;
        potential = new bg.Potential(this._diagram, {"style": element.style, "attributes": element.attributes});
        if ((potential.quantity === null)) {
            throw new SyntaxError("Missing or unknown quantity.");
        }
        potential.setContainer(potential.quantity.container);
        this._diagram.addElement(potential);
        this._bond_graph.add{otential(potential);
    }

    parseFlow(element)
    /*==============*/
    {
        var component, container, flow;
        flow = new bg.Flow(this._diagram, {"style": element.style, "attributes": element.attributes});
        this._diagram.addElement(flow);
        container = ((flow.transporter !== null) ? flow.transporter.container : null);
        for (var e, _pj_c = 0, _pj_a = new ElementChildren(element, this._stylesheets), _pj_b = _pj_a.length; (_pj_c < _pj_b); _pj_c += 1) {
            e = _pj_a[_pj_c];
            this._last_element = e;
            if ((e.tag === new CellDL_namespace("component"))) {
                if (((! _pj.in_es6("from_", e.attributes)) || (! _pj.in_es6("to", e.attributes)))) {
                    throw new SyntaxError("Flow component requires 'from' and 'to' potentials.");
                }
                component = new bg.FlowComponent(this._diagram, flow, {"style": e.style, "attributes": e.attributes});
                if ((flow.transporter === null)) {
                    if ((container === null)) {
                        container = component.fromPotential.container;
                    } else {
                        if ((container !== component.from_potential.container)) {
                            throw new ValueError("All 'to' potentials must be in the same container.");
                        }
                    }
                    for (var p, _pj_f = 0, _pj_d = component.to_potentials, _pj_e = _pj_d.length; (_pj_f < _pj_e); _pj_f += 1) {
                        p = _pj_d[_pj_f];
                        if ((container !== p.container)) {
                            throw new ValueError("All 'from' and 'to' potentials must be in the same container.");
                        }
                    }
                }
                component.setContainer(container);
                this.diagram.add_element(component);
                flow.addComponent(component);
            } else {
                throw SyntaxError;
            }
        }
        this.bondGraph.addFlow(flow);
    }


    parse(xmldoc)
    /*=========*/
    {
        if (xmldoc.children.length != 1) {
            throw new SyntaxError("Invalid XML document");
        }

        const xmlroot = xmldoc.children[0];
        if (xmlroot.nodeName !== 'cell-diagram') {
            throw new SyntaxError("Root tag must be <cell-diagram>");
        }

        let diagramElement = null;
        let bondGraphElement = null;
        for (let element of xmlroot.children) {
            if (element.nodeName === 'bond-graph') {
                if ((bondGraphElement === null)) {
                    bondGraphElement = element;
                } else {
                    throw new SyntaxError("Can only declare a single <bond-graph>");
                }
            } else if (element.nodeName === 'diagram') {
                if ((diagramElement === null)) {
                    diagramElement = element;
                } else {
                    throw new SyntaxError("Can only declare a single <diagram>");
                }
            } else if (element.nodeName === 'style') {
                this.stylesheet.addStyle(element);
            } else {
                throw new SyntaxError("Unknown XML element: <${element.nodeName}>");
            }
        }

// Multiple stylesheets in order...
//    const elementStyle = stylesheet.style(element);

        if (diagramElement !== null) {
            this.diagram = new dia.Diagram({"style": diagramElement.style, "attributes": diagramElement.attributes});
            this.parseContainer(diagramElement, this.diagram);
        } else {
            this.diagram = new dia.Diagram();
        }

        if ((bondGraphElement !== null)) {
            this.bondGraph = new bg.BondGraph(this.diagram, {"style": bondGraphElement.style, "attributes": bondGraphElement.attributes});
            this.parseBondGraph(bondGraphElement);
        } else {
            this.bondGraph = new bg.BondGraph(this.diagram);
        }

        this.diagram.setBondGraph(this.bondGraph);

        this.diagram.layout();

        return this.diagram;
    }
}

//==============================================================================
