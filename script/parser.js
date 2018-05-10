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

import * as cssparser from './cssparser.js';
import * as SPECIFICITY from './specificity.js';
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

import * as SyntaxError from './syntaxerror.js';
import * as bg from './bondgraph.js';
import * as dia from './diagram.js';
import {GradientStore} from './svg_elements.js';

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

//==============================================================================

class StyleSheet {
    constructor() {
        this.stylesheet = [];
        this._order = 0;
        this._parser = new cssparser.Parser();
    }

    addStyle(styleElement) {
        const css = styleElement.textContent;
        const ast = this._parser.parse(css);
        const rules = ast._props_.value;
        for (let rule of rules) {
            let selectors = cssparser.toSimple(rule._props_.selectors);
            let styling = cssparser.toAtomic(rule._props_.value);
            for (let selector of selectors) {
                this.stylesheet.push({selector: selector,
                                style: styling,
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
        let styling = {};
        for (let rule of this.stylesheet) {
            if (element.matches(rule.selector)) {
                const style = rule.style;
                if (style.type === 'DECLARATION_LIST') {
                    for (let declaration of style.value) {
                        styling[declaration.property.value] = declaration.value;
                    }
                }
            }
        }
        return styling;
    }

}

//==============================================================================

export class styleTokensIterator {
    constructor(tokens) {
        this.tokens = (tokens === null) ? []
                    : (tokens.type === 'SEQUENCE') ? tokens.value;
                                                   : [tokens];
        this.length = this.tokens.length;
        this.position = 0;
        }

    next() {
        if (this.position < this.length) {
            const value = this.tokens[this.position];
            this.position += 1;
            return { value: value, done: false };
        }
        return { value: undefined, done: true };
    }

    peek() {
        if (this.position < this.length) {
            return { value: this.tokens[this.position], done: false };
        }
        return { value: undefined, done: true };
    }

    reset() {
        this.position = 0;
    }

    static fromStyleElement(style, name) {
        return new styleTokensIterator((name in style) ? style[name] : null);
    }
}

//==============================================================================

function getNumber(tokenIterator) {
    if ((tokens.type !== "NUMBER")) {
        throw new SyntaxError("Number expected.");
    } else {
        return tokens.value;
    }
}

//==============================================================================

function getPercentage(tokenIterator, defaultValue=null) {
    /*
    :param tokens: `StyleTokens` of tokens
    :return: Length
    */
    var modifier, percentage, token;
    token = tokens.next();
    if (((token === null) || (token.type !== "PERCENTAGE"))) {
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

function getLength(tokens, defaultValue=null) {
    /*
    :param tokens: `StyleTokens` of tokens
    :return: Length

    `100`, `100x`, `100y`
    */
    if (tokens !== null && tokens.type === "PERCENTAGE") {
        return getPercentage(tokens, default_value);
    } else if (tokens === null || !(tokens.type in ["NUMBER", "DIMENSION"])) {
        if (defaultValue !== null) {
            return defaultValue;
        } else {
            throw new SyntaxError("Length expected.");
        }
    }
    const modifier = (token.type === "DIMENSION") ? token.unit : "";
    if (!(modifier in ["", "x", "y"])) {
        throw new SyntaxError("Modifier must be 'x' or 'y'.");
    }
    return [token.value, modifier];
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
            if (e.nodeName === "compartment") {
                this.parse_compartment(e, container);
            } else {
                if (e.nodeName === "quantity") {
                    this.parse_quantity(e, container);
                } else {
                    if ((e.nodeName === "transporter") && (container instanceof dia.Compartment)) {
                        this.parseTransporter(e, container);
                    } else {
                        throw new SyntaxError("Unexpected XML element <${e.nodeName}>");
                    }
                }
            }
        }
    }

    parseCompartment(element, container)
    /*================================*/
    {
        const compartment = new dia.Compartment(container, element.attributes. this.stylesheet.style(element));
        this.diagram.addCompartment(compartment);
        this.parseContainer(element, compartment);
    }

    parseQuantity(element, container)
    /*=============================*/
    {
        const quantity = new dia.Quantity(container, element.attributes. this.stylesheet.style(element));
        this.diagram.addQuantity(quantity);
    }

    parseTransporter(element, compartment)
    /*==================================*/
    {
        const transporter = new dia.Transporter(compartment, element.attributes. this.stylesheet.style(element));
        this.diagram.addTransporter(transporter);
    }

    parseBondGraph(element)
    /*===================*/
    {
        for (var e, _pj_c = 0, _pj_a = new ElementChildren(element, this._stylesheets), _pj_b = _pj_a.length; (_pj_c < _pj_b); _pj_c += 1) {
            e = _pj_a[_pj_c];
            this._last_element = e;
            if (e.nodeName === "potential") {
                this.parsePotential(e);
            } else {
                if (e.nodeName === "flow") {
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
        let potential = new bg.Potential(this.diagram, element.attributes, this.stylesheet.style(element));
        if (potential.quantity === null) {
            throw new SyntaxError("Missing or unknown quantity.");
        }
        potential.setContainer(potential.quantity.container);
        this.diagram.addElement(potential);
        this.bondGraph.addPotential(potential);
    }

    parseFlow(element)
    /*==============*/
    {
        const flow = new bg.Flow(this.diagram, element.attributes, this.stylesheet.style(element));
        this.diagram.addElement(flow);

        let container = ((flow.transporter !== null) ? flow.transporter.container : null);
        for (var e, _pj_c = 0, _pj_a = new ElementChildren(element, this._stylesheets), _pj_b = _pj_a.length; (_pj_c < _pj_b); _pj_c += 1) {
            e = _pj_a[_pj_c];
            this._last_element = e;
            if (e.nodeName === "component") {
                if (((! _pj.in_es6("from_", e.attributes)) || (! _pj.in_es6("to", e.attributes)))) {
                    throw new SyntaxError("Flow component requires 'from' and 'to' potentials.");
                }
                const component = new bg.FlowComponent(this.diagram, flow, e.attributes, this.stylesheet.style(e));
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

        if (diagramElement !== null) {
            this.diagram = new dia.Diagram(diagramElement.attributes, this.stylesheet.style(diagramElement));
            this.parseContainer(diagramElement, this.diagram);
        } else {
            this.diagram = new dia.Diagram();
        }

        if ((bondGraphElement !== null)) {
            this.bondGraph = new bg.BondGraph(this.diagram,
                                              bondGraphElement.attributes, this.stylesheet.style(bondGraphElement));
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
