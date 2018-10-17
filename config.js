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

import * as geo from './script/geometry.js';

//==============================================================================

/**
 * Default diagram size (in SVG pixels)
**/
export const DIAGRAM = { WIDTH:  500,
                         HEIGHT: 500 };

// Default position and radius of an element

export const DEFAULT = { POSITION: [ new geo.Length(50, '%'), new geo.Length(10, '%')],
                         SIZE:     [ new geo.Length(), new geo.Length()],
                         OFFSET: new geo.Length(),
                         RADIUS: new geo.Length(15, 'px')
                        };

export const STROKE = { WIDTH: new geo.Length(2.5, 'px') };

export const FLOW = { OFFSET: new geo.Length(6, '%w') };

export const QUANTITY = { OFFSET: new geo.Length(6, '%w'),
                          WIDTH:  50,     // SVG pixels
                          HEIGHT: 33 };   // SVG pixels

export const TRANSPORTER = { RADIUS: new geo.Length(15, 'px'),
                             EXTRA: new geo.Length(2.5, '%'),
                             WIDTH: new geo.Length(5, '%') };

//==============================================================================

// Highlighting of selected element

export const HIGHLIGHT = { BORDER: 5,
                           COLOUR: "#004A9C",
                           OPACITY: 0.8 };

//==============================================================================

// Layout grid

export const GRID = { X_SPACING: new geo.Length(1, 'vw'),
                      Y_SPACING: new geo.Length(1, 'vh'),
                      OPACITY: 0.2,
                      COLOUR: "blue" };

//==============================================================================
