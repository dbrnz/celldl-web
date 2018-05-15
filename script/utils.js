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
        if (this == other) {
            throw new ReferenceError('Cannot extend a list with itself...');
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
