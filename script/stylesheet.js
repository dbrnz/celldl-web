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

import * as cssparser from '../thirdparty/cssparser.js';
import * as SPECIFICITY from '../thirdparty/specificity.js';

//==============================================================================

import * as layout from './layout.js';
import {Gradients} from './svgElements.js';

//==============================================================================

// TODO: Implement inheritance and initial values as per
//       https://www.w3.org/TR/css-cascade-4

//==============================================================================

export class StyleSheet
{
    constructor() {
        this.stylesheet = [];
        this._order = 0;
        this._parser = new cssparser.Parser();
    }

    addStyles(cssText)
    //================
    {
        const ast = this._parser.parse(cssText);
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

    async fetchStyles(cssUrl)
    //=======================
    {
        return fetch(cssUrl)
                    .then(response => response.text())
                    .catch(error => console.error('Error getting stylesheet:', error))
                    .then(text => {
                        this.addStyles(text);
                    });
    }

    style(element)
    //============
    {
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

export function parseNumber(tokens)
{
    if (tokens.type !== "NUMBER") {
        throw new SyntaxError("Number expected");
    } else {
        return tokens.value;
    }
}

//==============================================================================

export function parsePercentageOffset(tokens, defaultValue=null)
{
    /*
    :param tokens: `StyleTokens` of tokens
    :return: Length
    */
    if (tokens.type !== 'PERCENTAGE') {
        if (defaultValue !== null) {
            return defaultValue;
        } else {
            throw new SyntaxError("Percentage expected");
        }
    }
    const percentage = tokens.value;
    const unit = tokens.unit;
    const modifier = unit.substring(1);
    if (["", "x", "y"].indexOf(modifier) < 0) {
        throw new SyntaxError("Modifier (${modifier}) must be 'x' or 'y'");
    }
    return new layout.Offset(percentage, unit);
}

//==============================================================================

export function parseOffset(tokens, defaultValue=null)
{
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
        throw new SyntaxError("Modifier must be 'x' or 'y'");
    }
    return new layout.Offset(tokens.value, unit);
}

//==============================================================================

export function parseOffsetPair(tokens, allowLocal=true)
{
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
                throw new SyntaxError("Invalid syntax");
            }
        }
    } else {
        throw new SyntaxError("Expected pair of offsets");
    }
    return offsets;
}

//==============================================================================

export function parseColour(tokens)
{
    if (tokens.type === "FUNCTION") {
        const name = tokens.name.value;
        if (["radial-gradient", "linear-gradient"].indexOf(name) < 0) {
            throw new SyntaxError("Unknown colour gradient");
        }
        const gradientType = name.substr(0, 6);
        let stopColours = [];
        if ('parameters' in tokens) {
            const parameters = tokens.parameters;
            if (parameters instanceof Array) {
                let colour, stop;
                for (let token of parameters) {
                    if (token.type === 'SEQUENCE') {
                        colour = parseColourValue(token.value[0]);
                        if (token.value[1].type === "PERCENTAGE") {
                            stop = token.value[1].value;
                        } else {
                            throw new SyntaxError("Gradient stop percentage expected");
                        }
                    } else {
                        colour = parseColourValue(token);
                        stop = null;
                    }
                    stopColours.push([colour, stop]);
                }
            }
        }
        return Gradients.url(gradientType, stopColours);
    }
    return parseColourValue(tokens);
}

//==============================================================================

export function parseColourValue(tokens)
{
    if (['HASH', 'ID'].indexOf(tokens.type) >= 0) {
        return tokens.value;
    }
    throw new SyntaxError("Colour expected");
}

//==============================================================================
