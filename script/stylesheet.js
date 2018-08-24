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

import * as exception from './exception.js';

import {Length} from './geometry.js';

//==============================================================================

// CSS parser from https://github.com/cwdoh/cssparser.js
import * as cssparser from '../thirdparty/cssparser.js';

// Specifity from https://github.com/keeganstreet/specificity
import * as SPECIFICITY from '../thirdparty/specificity.js';

//==============================================================================

// TODO: Implement inheritance and initial values as per
//       https://www.w3.org/TR/css-cascade-4

//==============================================================================

const DEFAULT_STYLESHEET = './styles/colours.css';

//==============================================================================

export class StyleSheet
{
    constructor() {
        this._parser = new cssparser.Parser();
        this.stylesheet = [];
        this._order = 0;
        this.classes = [];
    }

    loadDefaultStylesheet()
    //=====================
    {
        return this.fetchStyles(DEFAULT_STYLESHEET);
    }

    addStyles(cssText)
    //================
    {
        if (cssText.trim() === '') return;

        const ast = this._parser.parse(cssText);
        const rules = ast._props_.value;
        for (let rule of rules) {
            const selectors = cssparser.toSimple(rule._props_.selectors);
            let styling = cssparser.toAtomic(rule._props_.value);
            for (let selector of selectors) {
                this.stylesheet.push({selector: selector,
                                style: styling,
                                specificity: SPECIFICITY.calculate(selector)[0]['specificityArray'],
                                order: this._order});
                this._order += 1;
            }
            // Save names of class selectors
            const selectorClasses = cssparser.toAtomic(rule._props_.selectors);
            if (selectorClasses.type === "SELECTOR_LIST") {
                for (let selector of selectorClasses.value) {
                    if (selector.type === "CLASS_SELECTOR") {
                        const cls = selector.value.substr(1);
                        if (!this.classes.includes(cls)) {
                            this.classes.push(cls);
                        }
                    }
                }
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

        this.classes.sort();
    }

    async fetchStyles(cssUrl)
    //=======================
    {
        // Note: `fetch()` is a Promise

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

export function tokensToString(tokens)
{
    if (!tokens) {
        return '';
    } else if (tokens instanceof Array) {
        let text = [];
        for (let t of tokens) {
            text.push(tokensToString(t));
        }
        return text.join(', ');
    } else if (tokens.type === 'SEQUENCE') {
        let text = [];
        for (let t of tokens.value) {
            text.push(tokensToString(t));
        }
        return text.join(' ');
    } else if (tokens.type === 'FUNCTION') {
        return `${tokens.name.value}(TODO...)`;
    } else if (['DIMENSION', 'PERCENTAGE'].indexOf(tokens.type) >= 0) {
        return `${tokens.value}${tokens.unit}`;
    } else {
        return tokens.value;
    }
}

//==============================================================================

export function styleAsString(styling, name, defaultValue='')
{
    const text = tokensToString(styling[name]);

    return text ? text : defaultValue;
}

//==============================================================================

export function parseNumber(tokens)
{
    if (tokens.type !== "NUMBER") {
        throw new exception.StyleError(tokens, "Number expected");
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
            throw new exception.StyleError(tokens, "Percentage expected");
        }
    }
    const percentage = tokens.value;
    const units = tokens.unit;
    const modifier = units.substring(1);
    if (["", "w", "h"].indexOf(modifier) < 0) {
        throw new exception.StyleError(tokens, "Modifier (${modifier}) must be 'w' or 'h'");
    }
    return new Length(percentage, units);
}

//==============================================================================

export function parseLength(tokens, defaultValue=null, defaultUnits='%')
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
            throw new exception.StyleError(tokens, "Length expected.");
        }
    }
    const units = (tokens.type === "DIMENSION") ? tokens.unit : defaultUnit;
    if (["vw", "vh", "px", defaultUnits].indexOf(units) < 0) {
        throw new exception.StyleError(tokens, "Unknown units for length");
    }
    return new Length(tokens.value, units);
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

    if (tokens instanceof Array && tokens.length === 2) {
        for (let token of tokens) {
            if (token.type === 'SEQUENCE') {
// TODO                <offset> <reln> <id_list>
            } else if (["DIMENSION", "NUMBER"].indexOf(token.type) >= 0
                   || (allowLocal && token.type === "PERCENTAGE")) {
                offsets.push(parseLength(token));
            } else {
                throw new exception.StyleError(tokens, "Invalid syntax");
            }
        }
    } else {
        throw new exception.StyleError(tokens, "Expected pair of offsets");
    }
    return offsets;
}

//==============================================================================

export function parseSize(tokens)
{
    return parseOffsetPair(tokens, true);
}

//==============================================================================

export function parseColour(diagram, tokens)
{
    if (tokens.type === "FUNCTION") {
        const name = tokens.name.value;
        if (["radial-gradient", "linear-gradient"].indexOf(name) < 0) {
            throw new exception.StyleError(tokens, "Unknown colour gradient");
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
                            throw new exception.StyleError(tokens, "Gradient stop percentage expected");
                        }
                    } else {
                        colour = parseColourValue(token);
                        stop = null;
                    }
                    stopColours.push([colour, stop]);
                }
            }
        }
        return diagram.svgFactory.gradient(gradientType, stopColours);
    }
    return parseColourValue(tokens);
}

//==============================================================================

export function parseColourValue(tokens)
{
    if (['HASH', 'ID'].indexOf(tokens.type) >= 0) {
        return tokens.value;
    }
    throw new exception.StyleError(tokens, "Colour expected");
}

//==============================================================================

export function adjustedElements(cssText)
{
    const positioned = [];
    const resized = [];

    if (cssText.trim() !== '') {
        const parser = new cssparser.Parser();
        const ast = parser.parse(cssText);
        const rules = ast._props_.value;
        for (let rule of rules) {
            const styling = cssparser.toSimple(rule._props_.value);
            const id = cssparser.toSimple(rule._props_.selectors)[0];
            if (styling.position) positioned.push(id);
            if (styling.size) resized.push(id);
        }
    }

    return [positioned, resized];
}

//==============================================================================
