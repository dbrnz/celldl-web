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

export class List extends Array {
    constructor(iterable=null) {
        super();
        if (iterable !== null)
            this.extend(iterable);
    }

    append(element) {
        super.push(element);
        return this;
    }

    contains(element) {
        return (super.indexOf(element) >= 0);
    }

    extend(other) {
        if (this === other) {
            throw new exception.ValueError('Cannot extend a list with itself...');
        } else {
            for (let element of other) {
                super.push(element);
            }
        }
        return this;
    }
}

//==============================================================================

// From https://stackoverflow.com/a/47327873

export function format(template, params)
{
    let tpl = template.replace(/\${(?!this\.)/g, "${this.");
    let tpl_func = new Function(`return \`${tpl}\``);

    return tpl_func.call(params);
}

//==============================================================================

export function setAttributes(domNode, ...attributeObjects)
{
    for (let attributeObject of attributeObjects) {
        for (let attributePair of Object.entries(attributeObject)) {
            if (attributePair[1] !== '')
                domNode.setAttribute(...attributePair);
        }
    }
}

//==============================================================================

export function lengthToPixels(length, index, width, height)
{
    if        (length.units.indexOf('w') >= 0) {
        return length.length*width/100;
    } else if (length.units.indexOf('h') >= 0) {
        return length.length*height/100;
    } else if (index === 0) {
        return length.length*width/100;
    } else if (index === 1) {
        return length.length*height/100;
    } else {
        return length.length;
    }
}

//==============================================================================

export function offsetToPixels(container, size, addOffset=false)
{
    return [container.lengthToPixels(size[0], 0, addOffset),
            container.lengthToPixels(size[1], 1, addOffset)];
}

//==============================================================================

export function pixelsToLength(pixels, units, index, width, height)
{
    let length = pixels;

    if        (units.indexOf('w') >= 0) {
        length = 100*pixels/width;
    } else if (units.indexOf('h') >= 0) {
        length = 100*pixels/height;
    } else if (index === 0) {
        length = 100*pixels/width;
    } else if (index === 1) {
        length = 100*pixels/height;
    }

    return new Length(length, units);
}

//==============================================================================

export function pixelsToOffset(offset, container, units, addOffset=false)
{
    return [container.pixelsToLength(offset[0], units[0], 0, addOffset),
            container.pixelsToLength(offset[1], units[1], 1, addOffset)];
}

//==============================================================================

// Return value on ``grid[index]``

export function gridSnap(value, grid, index)
{
    return (grid !== null) ? grid[index]*Math.round(value/grid[index]) : value;
}

//==============================================================================
