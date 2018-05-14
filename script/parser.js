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

//==============================================================================

import * as bg from './bondgraph.js';
import * as dia from './diagram.js';
import {GradientStore} from './svgElements.js';

//==============================================================================

var CELLDL_NAMESPACE = "http://www.cellml.org/celldl/1.0#";

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

export function parseNumber(tokens) {
    if (tokens.type !== "NUMBER") {
        throw new SyntaxError("Number expected.");
    } else {
        return tokens.value;
    }
}

//==============================================================================

export function parsePercentageOffset(tokens, defaultValue=null) {
    /*
    :param tokens: `StyleTokens` of tokens
    :return: Length
    */
    if (tokens.type !== 'PERCENTAGE') {
        if (defaultValue !== null) {
            return defaultValue;
        } else {
            throw new SyntaxError("Percentage expected.");
        }
    }
    const percentage = tokens.value;
    const unit = tokens.unit;
    const modifier = unit.substring(1);
    if (["", "x", "y"].indexOf(modifier) < 0) {
        throw new SyntaxError("Modifier (${modifier}) must be 'x' or 'y'.");
    }
    return layout.Offset(percentage, unit);
}

//==============================================================================

export function parseOffset(tokens, defaultValue=null) {
    /*
    :param tokens: `StyleTokens` of tokens
    :return: Length

    `100`, `100x`, `100y`
    */
    if (tokens.type === "PERCENTAGE") {
        return parsePercentageOffset(tokens, defaultValue);
    } else if (["NUMBER", "DIMENSION"].indexOf(tokens.type) < 0) {
        if (defaultValue !== null) {
            return defaultValue;
        } else {
            throw new SyntaxError("Length expected.");
        }
    }
    const unit = (tokens.type === "DIMENSION") ? tokens.unit : "";
    if (["", "x", "y"].indexOf(unit) < 0) {
        throw new SyntaxError("Modifier must be 'x' or 'y'.");
    }
    return layout.Offset(tokens.value, unit};
}

//==============================================================================

export function parseOffsetPair(tokens, allowLocal=true) {
    /*
    Get a coordinate pair.

    :param tokens: `StyleTokens` of tokens
    :return: tuple(Length, Length)
    */
    let offsets = [];

    if (tokens instanceof Array && tokens.length == 2) {
        for (let token of tokens) {
            if (token.type === 'SEQUENCE') {
// TODO                <offset> <reln> <id_list>
            } else if (["DIMENSION", "NUMBER"].indexOf(token.type) >= 0
                   || (allowLocal && token.type === "PERCENTAGE")) {
                offsets.push(parseOffset(token));
            } else {
                throw new SyntaxError("Invalid syntax.");
            }
        }
    } else {
        throw new SyntaxError("Expected pair of offsets.");
    }
    return offsets;
}

//==============================================================================

export function parseColour(tokens) {
    const token = tokens.peek();
    if (!token.done()) {
        const value = token.value;


        if (value.type === "FUNCTION") {
            const name = value.name.value;
            if (["radial-gradient", "linear-gradient"].indexOf(name) < 0) {
                throw new SyntaxError("Unknown colour gradient.");
            }
            if ('parameters' in value) {
                const parameters = value.parameters;

                if (parameters instanceof Array) {
// TODO...
                }
            }

            gradient = token.name.slice(0, 6);
            tokens = new StyleTokens(token.arguments);
            stop_colours = [];
            token = tokens.peek();
            while ((token !== null)) {
                colour = parseColourValue(tokens);
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
        }
    }
    return parseColourValue(tokens);
}

//==============================================================================

export function parseColourValue(tokens) {
    const token = tokens.next();
    if (!token.done()) {
        const value = token.value;
        if (['HASH', 'ID'].indexOf(value.type) >= 0) {
            return value.value;
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
        for (let e of element.children) {
            if (e.nodeName === "compartment") {
                this.parseCompartment(e, container);
            } else {
                if (e.nodeName === "quantity") {
                    this.parseQuantity(e, container);
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
        const compartment = new dia.Compartment(container, element.attributes, this.stylesheet.style(element));
        this.diagram.addCompartment(compartment);
        this.parseContainer(element, compartment);
    }

    parseQuantity(element, container)
    /*=============================*/
    {
        const quantity = new dia.Quantity(container, element.attributes, this.stylesheet.style(element));
        this.diagram.addQuantity(quantity);
    }

    parseTransporter(element, compartment)
    /*==================================*/
    {
        const transporter = new dia.Transporter(compartment, element.attributes, this.stylesheet.style(element));
        this.diagram.addTransporter(transporter);
    }

    parseBondGraph(element)
    /*===================*/
    {
        for (let e of element.children) {
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
        const transporterId = ('transporter' in element.attributes) ? element.attributes.transporter : null;
        const flow = new bg.Flow(this.diagram, transporterId, element.attributes, this.stylesheet.style(element));
        this.diagram.addElement(flow);
        let container = ((flow.transporter !== null) ? flow.transporter.container : null);
        for (let e of element.children) {
            if (e.nodeName === "component") {
                if (!("from" in e.attributes && "to" in e.attributes)) {
                    throw new SyntaxError("Flow component requires 'from' and 'to' potentials.");
                }
                const component = new bg.FlowComponent(this.diagram, flow, e.attributes, this.stylesheet.style(e));
                if (flow.transporter === null) {
                    if (container === null) {
                        container = component.fromPotential.container;
                    } else {
                        if (container !== component.from_potential.container) {
                            throw new ValueError("All 'to' potentials must be in the same container.");
                        }
                    }
                    for (let p of component.to_potentials) {
                        if (container !== p.container) {
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

        // check xmlroot.attributes.xmlns.value (textContent) === CELLDL_NAMESPACE
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

        this.diagram.layoutElements();

        return this.diagram;
    }
}

//==============================================================================
