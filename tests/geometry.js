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

import * as geo from '../scripts/geometry.js';

//==============================================================================

export test_polygon_centroid()
{
    const R2 = geo.Polygon.fromSvgPath(`m 123.59822,12.005952 c 24.21281,-1.054217 45.02962,8.909967 64.25595,23.8125
                                                                 4.53571,5.039682 4.53571,10.079364 -1e-5,15.119046
                                                                -9.94132,5.563742 -15.91203,17.745154 -23.05654,27.970239
                                                                -5.29167,6.501106 -10.58333,8.478619 -15.875,7.9375
                                                                -6.17361,0.384313 -12.34722,0.196713 -18.52084,-3.401787
                                                                -9.24216,-6.820056 -17.84439,-9.800476 -26.08035,-10.583331
                                                                -3.48765,-1.468974 -6.606578,-3.122307 -4.15774,-7.559524
                                                              v  0
                                                              c 19.55806,-13.047501 7.81566,-18.269888 4.91369,-25.702382
                                                                -1.96314,-9.662894 -12.544811,-25.583773 18.52084,-27.592261
                                                              z`);
    const c2 = R2.centroid();
    console.assert((c2.x === 141.96308819633583 && c2.y === 51.140290386524335), "Polygon centroid failure...");
}

//==============================================================================
