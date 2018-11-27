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
import * as geo from './geometry.js';

//==============================================================================

export class SvgDocument
{
    constructor(svgText)
    {
        const domParser = new DOMParser();
        this._document = domParser.parseFromString(svgText, "image/svg+xml");
        const svgNode = this._document.documentElement;
        if (svgNode.nodeName !== 'svg') {
            throw new Error(svgNode, "Background is not in SVG format...");
        }

        // get viewport/width/height/x/y
        const width = svgNode.getAttribute('width');
        const height = svgNode.getAttribute('height');
        const viewbox = svgNode.getAttribute('viewBox');

        const dims = viewbox.split(' ').filter(e => e);
        this._width = parseFloat(dims[2]);
        this._height = parseFloat(dims[3]);
    }

    /**
     *  @return [float, float]: Centroid as percentage of image width/height
    **/
    centroid(nodeId)
    //==============
    {
        let node = this._document.getElementById(nodeId);
        if (!node) {
            return undefined;
        }

        //const transform = this._getTransform(node);

        if (node.nodeName === 'use') {
            href = node.getAttribute('xlink:href');
            if (!href) {
                href = node.getAttribute('href');
            }
            if (href && href.startsWith('#')) {
                node = this._document.getElementById(href.slice(1));
                // get any transform attribute on this element
            }
            if (!href || !node) {
                return undefined;
            }
        }
        //const transform = node.getCTM(); // this is identity
                                           // can skew/translate/multiply

        if (node.nodeName === 'path') {
            const poly = geo.Polygon.fromSvgPath(node.getAttribute('d'));
            const c = poly.centroid();

            // Now need to apply transforms...

            return [new geo.Length(100*c.x/this._width, '%'),
                    new geo.Length(100*c.y/this._height, '%')];
        }

        return undefined;
    }
}

//==============================================================================

/*
    switch (node.nodeName) {
        case 'svg':
            break;

        case 'g':
            for (let n of g.children) {

            }
            break;

        case 'path':
            style = parseStyle(node, style);
            if ( node.hasAttribute( 'd' ) && isVisible( style ) ) path = parsePathNode(node, style);
            break;

        case 'rect':
            style = parseStyle(node, style);
            if ( isVisible( style ) ) path = parseRectNode(node, style);
            break;

        case 'polygon':
            style = parseStyle(node, style);
            if ( isVisible( style ) ) path = parsePolygonNode(node, style);
            break;

        case 'polyline':
            style = parseStyle(node, style);
            if ( isVisible( style ) ) path = parsePolylineNode(node, style);
            break;

        case 'circle':
            style = parseStyle(node, style);
            if ( isVisible( style ) ) path = parseCircleNode(node, style);
            break;

        case 'ellipse':
            style = parseStyle(node, style);
            if ( isVisible( style ) ) path = parseEllipseNode(node, style);
            break;

        case 'line':
            style = parseStyle(node, style);
            if ( isVisible( style ) ) path = parseLineNode(node, style);
            break;

        default:
            break;
    }


    _getTransform(node, topNode)
    //==========================
    {
        while (node !== topNode){
            const transform = node.getAttribute('transform');
            if (transform) {

            }
            node = node.parentElement;
        }
    }
    */

//==============================================================================

/*

const TEST_SVG = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" viewBox="0 0 500 500">
  <g transform="translate(-150, 0) rotate(10)">
    <g transform="translate(350, 50)">
      <ellipse id="e1" cy="100" rx="40" ry="100" fill="blue"/>
    </g>
    <path transform="translate(150, 50) scale(2)"
       id="p1"
       d="m 123.59822,12.005952 c 24.21281,-1.054217 45.02962,8.909967 64.25595,23.8125 4.53571,5.039682 4.53571,10.079364 -1e-5,15.119046 -9.94132,5.563742 -15.91203,17.745154 -23.05654,27.970239 -5.29167,6.501106 -10.58333,8.478619 -15.875,7.9375 -6.17361,0.384313 -12.34722,0.196713 -18.52084,-3.401787 -9.24216,-6.820056 -17.84439,-9.800476 -26.08035,-10.583331 -3.48765,-1.468974 -6.606578,-3.122307 -4.15774,-7.559524 v 0 c 19.55806,-13.047501 7.81566,-18.269888 4.91369,-25.702382 -1.96314,-9.662894 -12.544811,-25.583773 18.52084,-27.592261 z"
       style="fill:#ecf29f;fill-opacity:1;stroke:none;stroke-width:0.26458332px;stroke-linecap:butt;stroke-linejoin:miter;stroke-opacity:1" />
    <g transform="translate(400, 70) rotate(90 40 100) scale(0.5)" clip-path="url(#IonMaskClipPath)">
      <ellipse  id="e2" cy="100" rx="40" ry="110" fill="green"/>
    </g>
 </g>
</svg>`;

const test = new SvgDocument(TEST_SVG);

const c = test.centroid('p1');
console.log(c);

*/

//==============================================================================

/*

* get viewbox/width/height of SVG element

* find element with ID
  * if USE, get href/url and find defined element.

* if element is a shape (arc, ellipse, circle, rect, polygon, path) then calculate its centroid.

* if a group then average centroid of group's elements

* get all transform attributes on ID element and ID's parent elements,
multiplying them to get overall transform.

* apply transform to centroid.


//  Find all geometric objects (closed paths, circles, ellipses, rectangles) with an ID and find
//  their centroids.

Finding centroid of a region identified by an id.


    findCoordinates(id)
    //=================
    {
        // Can only do when this.svgParse is resolved...
    }



      Read SVG then rewrite ids (prefix with 'background.' and display in <g id='background></g>')

      Provide means to get coordinates --> viewport units given id.

        el = document.getElementById(ID);
        el.getClientRect();

        getBoundingClientRect()

    */

//==============================================================================
