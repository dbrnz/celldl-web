/******************************************************************************

Cell Diagramming Language

Copyright (c) 2018  David Brooks

Licensed under the Apache License, Version 2.0 (the 'License');
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an 'AS IS' BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

******************************************************************************/

'use strict';

//==============================================================================

//import * as mathjax from './mathjax.js';
import {List, format, setAttributes} from './utils.js';

//==============================================================================

export const SVG_NS = 'http://www.w3.org/2000/svg';
export const SVG_VERSION = '1.1';

//==============================================================================

const LINE_WIDTH = 2;

//==============================================================================

export class SvgElement
{
    constructor(id, idBase) {
        this.id = id;
        this.idBase = idBase;
    }
}

//==============================================================================

export class DefinesStore
{
    static reset()
    {
        DefinesStore._defines = new Map;
    }

    static add(id, defines)
    {
        if (!DefinesStore._defines.has(id)) {
            DefinesStore._defines.set(id, defines);
        }
    }

    static defines() {
        const defs = ['<defs>'];
        for (let defines of DefinesStore._defines.values()) {
            defs.push(defines);
        }
        defs.push('</defs>');

        const parser = new DOMParser();
        const svgNode = parser.parseFromString(defs.join(' '), "application/xml");
        return svgNode.documentElement;
    }
}

DefinesStore._defines = new Map;

//==============================================================================

export class Gradients
{
    static nextId() {
        Gradients._nextId += 1;
        return `_GRADIENT_${Gradients._nextId}_`;
    }

    static hash(gradientType, stopColours) {
        return `${gradientType}${stopColours.toString()}`;
    }

    static svg(id, gradientType, stopColours) {
        let n = 0;
        const nStops = stopColours.length;
        let stops = [];
        for (let stopcolour of stopColours) {
            let offset;
            if (n > 0) {
                offset = ` offset="${(stopcolour[1] !== null) ? stopcolour[1] : (100.0*n/(nStops - 1))}%"`;
            } else {
                offset = (stopcolour[1] !== null) ? ` offset="${stopcolour[1]}%"` : '';
            }
            stops.push(`<stop${offset} stop-color="${stopcolour[0]}"/>`);
            n += 1;
        }
        return `<${gradientType}Gradient id="${id}">${stops.join('\n')}</${gradientType}Gradient>`;
    }

    static url(gradientType, stopColours) {
        const hashValue = Gradients.hash(gradientType, stopColours);
        let id;
        if (hashValue in Gradients._gradientsToId) {
            id = Gradients._gradientsToId[hashValue]
        } else {
            id = Gradients.nextId();
            Gradients._gradientsToId[hashValue] = id;
            DefinesStore.add(id, Gradients.svg(id, gradientType, stopColours));
        }
        return `url(#${id})`;
    }
}

Gradients._gradientsToId = {};
Gradients._nextId = 0;

//==============================================================================

export class CellMembrane extends SvgElement
{
    constructor(id, width, height, idBase='cell_membrane',
                outerMarkers=9, innerMarkers=3, markerRadius=4,
                strokeWidth=1, strokeColour='#0092DF', fillColour='#BFDDFF') {
        /*
        :param outerMarkers: Number of outer markers in a corner.
        :param immerMarkers: Number of inner markers in a corner.
        */
        super(id, idBase);
        this.outerMarkers = outerMarkers;
        this.innerMarkers = innerMarkers;
        this.markerRadius = markerRadius;
        this.strokeWidth = strokeWidth;
        this.strokeColour = strokeColour;
        this.fillColour = fillColour;
        this.markerWidth = 2.0*markerRadius + this.strokeWidth;
        this.outerMarkerAngle = 90/this.outerMarkers;
        this.outerRadius = this.markerWidth/(2*Math.asin(Math.PI/(4*this.outerMarkers)));
        this.innerMarkerAngle = 90/this.innerMarkers;
        this.innerRadius = this.markerWidth/(2*Math.asin(Math.PI/(4*this.innerMarkers)));
        this.lineWidth = this.outerRadius - this.innerRadius;
        this.markerTail = 0.9*(this.lineWidth - this.markerRadius - this.strokeWidth);
        this.horizontalMarkers = Math.round(0.5 + (width - this.lineWidth/2.0 - 3*this.innerRadius)/this.markerWidth);
        this.verticalMarkers = Math.round(0.5 + (height - this.lineWidth/2.0 - 3 * this.innerRadius)/this.markerWidth);
        this.innerWidth = this.markerWidth * this.horizontalMarkers;
        this.innerHeight = this.markerWidth * this.verticalMarkers;
        this.outerWidth = this.innerWidth + 2*this.outerRadius;
        this.outerHeight = this.innerHeight + 2*this.outerRadius;
        // Add our definitions
        DefinesStore.add(idBase, format(CellMembrane.SVG_DEFS,
            {'RADIUS': markerRadius, 'TAIL': this.markerTail, 'WIDTH': strokeWidth,
             'STROKE': strokeColour, 'FILL': fillColour, 'ID_BASE': idBase,
             'OFFSET': -this.lineWidth/2.0, 'SPACING': -this.markerWidth/2.0}));
    }

    get width() {
        return (this.outerWidth - this.lineWidth);
    }

    get height() {
        return (this.outerHeight - this.lineWidth);
    }

    get thickness() {
        return this.lineWidth;
    }

    cornerPath(outerPath) {
        let count = 0;
        let dt = 1;
        let markerId;
        let R = 0;
        let transform = new List();

        if (outerPath) {
            R = this.outerRadius;
            dt = this.outerMarkerAngle*Math.PI/180;
            markerId = `${this.idBase}_inward_marker`;
            count = this.outerMarkers;
            transform.append(`rotate(${this.outerMarkerAngle/2.0})`);
        } else {
            R = this.innerRadius;
            dt = this.innerMarkerAngle*Math.PI/180;
            markerId = `${this.idBase}_outward_marker`;
            count = this.innerMarkers;
        }
        transform.append(`translate(0, ${R})`);
        let path = new List(['M0,0']);
        let t = 0;
        for (let n = 0; n <= count; n += 1) {
            path.append(`a0,0 0 0,0 ${R*(Math.sin(t + dt) - Math.sin(t))},${R*(Math.cos(t + dt) - Math.cos(t))}`);
            t += dt;
        }
        return `
      <g transform="${transform.join(' ')}">
        <path stroke="#FFFFFF" fill="none" marker-mid="url(#${markerId})" d="${path.join(' ')}"/>
      </g>`;
    }

    corner(position) {
        const outerRadius = this.outerRadius;
        const outerPath = this.cornerPath(true);
        const rotation = (position === 'top_left') ? 180
                       : (position === 'top_right') ? 270
                       : (position === 'bottom_left') ? 90
                       : 0;
        const translation = (position === 'top_left') ? [0, 0]
                          : (position === 'top_right') ? [0, this.innerWidth]
                          : (position === 'bottom_left') ? [this.innerHeight, 0]
                          : [this.innerWidth, this.innerHeight];
        let svg = new List();
        svg.append(`<g id="${this.idBase}_${position}" transform="translate(${outerRadius}, ${outerRadius}) rotate(${rotation}) translate(${translation[0]}, ${translation[1]})">`);
        svg.append(outerPath);
        svg.append(this.cornerPath(false));
        svg.append('</g>');
        return svg;
    }

    side(orientation) {
        let path = [];
        if (['top', 'bottom'].indexOf(orientation) >= 0) {
            path.push(`M${this.outerRadius},${this.lineWidth/2.0}`);
            for (let n = 0; n < this.horizontalMarkers; n += 1) {
                path.push(`l${this.markerWidth},0`);
            }
        } else {
            path.push(`M${this.lineWidth/2.0},${this.outerRadius}`);
            for (let n = 0; n < this.verticalMarkers; n += 1) {
                path.push(`l0,${this.markerWidth}`);
            }
        }
        const markerId = `${this.idBase}_marker`;
        const translation = (orientation === 'top') ?    [0, 0]
                          : (orientation === 'bottom') ? [this.markerWidth/2.0, this.height]
                          : (orientation === 'left') ?   [0, this.markerWidth/2.0]
                          :                              [this.width, 0];
        return new List([`
      <g id="${this.idBase}_${orientation}" transform="translate(${translation[0]}, ${translation[1]})">
        <path stroke="#FFFFFF" fill="none"  d="${path.join(' ')}"
              marker-start="url(#${markerId})" marker-mid="url(#${markerId})"/>
      </g>`]);
    }

    svg(outline=false) {
        let svg = new List();
        svg.append(`<g transform="translate(${-this.lineWidth/2.0},${-this.lineWidth/2.0})">`);
        svg.extend(this.corner('top_left'));
        svg.extend(this.corner('top_right'));
        svg.extend(this.corner('bottom_left'));
        svg.extend(this.corner('bottom_right'));
        svg.extend(this.side('top'));
        svg.extend(this.side('left'));
        svg.extend(this.side('bottom'));
        svg.extend(this.side('right'));
        if (outline) {
            svg.append(`<path stroke="#0000FF" fill="none" d="M0,0 L${this.outerWidth},0 L${this.outerWidth},${this.outerHeight} L0,${this.outerHeight} z"/>`);
        }
        svg.append('</g>');
        if (outline) {
            svg.append(`<path stroke="#FF0000" fill="none" d="M0,0 L${this.width},0 L${this.width},${this.height} L0,${this.height} z"/>`);
        }
        return svg.join('\n');
    }
}

CellMembrane.SVG_DEFS = ['',
                         '<g id="${ID_BASE}_base_element">',
                         '  <circle cx="0" cy="0" r="${RADIUS}" stroke-width="${WIDTH}"/>',
                         '  <line x1="${RADIUS}" y1="0" x2="${TAIL}" y2="0" stroke-width="${WIDTH}"/>',
                         '</g>',
                         '<!-- Inward pointing marker -->',
                         '<marker id="${ID_BASE}_inward_marker" markerUnits="userSpaceOnUse" style="overflow: visible" orient="auto">',
                         '  <use stroke="${STROKE}" fill="${FILL}" xlink:href="#${ID_BASE}_base_element" transform="rotate(270)"/>',
                         '</marker>',
                         '<!-- Outward pointing marker -->',
                         '<marker id="${ID_BASE}_outward_marker" markerUnits="userSpaceOnUse" style="overflow: visible" orient="auto">',
                         '  <use stroke="${STROKE}" fill="${FILL}" xlink:href="#${ID_BASE}_base_element" transform="rotate(90)"/>',
                         '</marker>',
                         '<!-- Straight segments are built from two base elements at 180 degrees to each other -->',
                         '<g id="${ID_BASE}_element">',
                         '  <use transform="translate(${OFFSET}, ${SPACING})" xlink:href="#${ID_BASE}_base_element"/>',
                         '  <use transform="rotate(180) translate(${OFFSET}, 0)" xlink:href="#${ID_BASE}_base_element"/>',
                         '</g>',
                         '<!-- Marker for straight segments -->',
                         '<marker id="${ID_BASE}_marker" markerUnits="userSpaceOnUse" style="overflow: visible" orient="auto">',
                         '  <use stroke="${STROKE}" fill="${FILL}" xlink:href="#${ID_BASE}_element" transform="rotate(90)"/>',
                         '</marker>'].join('\n      ');

//==============================================================================

class TransporterElement extends SvgElement
{
    constructor(id, coords, rotation, height, defs, definedHeight, idBase) {
        super(id, idBase);
        this.coords = coords;
        this.rotation = rotation;
        this.height = height;
        this.definedHeight = definedHeight;
        DefinesStore.add(idBase, format(defs, {'ID_BASE': idBase}));
    }

    svg() {
        let svg = new List([`<use xlink:href="#${this.idBase}_element" transform="translate(${this.coords[0]}, ${this.coords[1]})`]);
        const scaling = (this.height / Number.parseFloat(this.definedHeight));
        if ((scaling !== 1.0)) {
            svg.append(` scale(${scaling})`);
        }
        if ((this.rotation !== 0)) {
            svg.append(` rotate(${this.rotation})`);
        }
        svg.append('" />');
        return svg.join('');
    }
}

//==============================================================================

export class Channel extends TransporterElement
{
    constructor(id, coords, rotation, height=0.6*Channel.HEIGHT, idBase='channel') {
        super(id, coords, rotation, height, Channel.SVG_DEFS, Channel.HEIGHT, idBase);
    }
}

Channel.HEIGHT = 100;
Channel.WIDTH  =  50;
Channel.SVG_DEFS = ['',
                    '<linearGradient id="${ID_BASE}_fill">',
                    '  <stop offset="0%"    stop-color="#57FAFF"/>',
                    '  <stop offset="13.5%" stop-color="#45C8D2"/>',
                    '  <stop offset="30.4%" stop-color="#328F9F"/>',
                    '  <stop offset="46.8%" stop-color="#216175"/>',
                    '  <stop offset="62.4%" stop-color="#153C54"/>',
                    '  <stop offset="76.8%" stop-color="#0B223C"/>',
                    '  <stop offset="89.8%" stop-color="#06132E"/>',
                    '  <stop offset="100%"  stop-color="#040D29"/>',
                    '</linearGradient>',
                    '<path id="${ID_BASE}_sub_element" fill="url(#${ID_BASE}_fill)"',
                    '  d="M0,0 a10,10 0 0 1 20,0 v80 a10,10 0 0 1 -20,0 v-80 z"/>',
                    '<g id="${ID_BASE}_element" transform="translate(-10, -40)">',
                    '  <use opacity="0.85" xlink:href="#${ID_BASE}_sub_element" transform="translate(  0, -5)"/>',
                    '  <use opacity="0.85" xlink:href="#${ID_BASE}_sub_element" transform="translate( 15,  0)" />',
                    '  <use opacity="0.75" xlink:href="#${ID_BASE}_sub_element" transform="translate(-15,  0)" />',
                    '  <use opacity="0.60" xlink:href="#${ID_BASE}_sub_element" transform="translate( -1,  5)" />',
                    '</g>'].join('\n      ');



//==============================================================================

class Exchanger_TO_FINISH extends TransporterElement
{
    constructor(id, coords, rotation, height=40, idBase='exchanger') {
        super(id, coords, rotation, height, '', height, idBase);
    }
}

//==============================================================================

export class PMRChannel extends TransporterElement
{
    constructor(id, coords, rotation, height=0.6*PMRChannel.HEIGHT, idBase='pmr_channel') {
        super(id, coords, rotation, height, PMRChannel.SVG_DEFS, PMRChannel.HEIGHT, idBase);
    }
}

PMRChannel.HEIGHT = 80;
PMRChannel.WIDTH  = 44;
PMRChannel.SVG_DEFS = ['',
                       '<radialGradient id="${ID_BASE}_fill">',
                       '  <stop offset="0%"     stop-color="#FBFAE2"/>',
                       '  <stop offset="12.03%" stop-color="#FCFADD"/>',
                       '  <stop offset="26.62%" stop-color="#FFF9CD"/>',
                       '  <stop offset="42.55%" stop-color="#FCF6B4"/>',
                       '  <stop offset="59.43%" stop-color="#FDEF90"/>',
                       '  <stop offset="77.06%" stop-color="#FEE863"/>',
                       '  <stop offset="95.06%" stop-color="#FEE12A"/>',
                       '  <stop offset="100%"   stop-color="#FEDE12"/>',
                       '</radialGradient>',
                       '<path id="${ID_BASE}_element" fill="url(#${ID_BASE}_fill)"  transform="scale(1.1) translate(-22, -25)"',
                       '  stroke="#010101" stroke-width="2" stroke-linejoin="miter"',
                       '  d="M0,0 c0,-25 15,-30 22,-12 c7,-18 22,-13 22,12 v50 c0,25 -15,30 -22,12 c-7,18 -22,13 -22,-12 v-50 z"/>',
                       '<marker id="${ID_BASE}_arrow" orient="auto" style="overflow: visible">',
                       '  <path fill="010101" transform="rotate(90) translate(0, 0) scale(0.5)"',
                       '     d="M0,0l5,3.1l0.1-0.2l-3.3-8.2l-1.9-8.6l-1.9,8.6l-3.3,8.2l0.1,0.2l5-3.1z"/>',
                       '</marker>',
                       '<g id="${ID_BASE}_in_element">',
                       '  <path stroke="#010101" stroke-width="2" d="M0,-65 v130" marker-end="url(#${ID_BASE}_arrow)"/>',
                       '  <use xlink:href="#${ID_BASE}_element"/>',
                       '</g>',
                       '<g id="${ID_BASE}_out_element">',
                       '  <use xlink:href="#${ID_BASE}_in_element" transform="rotate(180)"/>',
                       '</g>',
                       '<g id="${ID_BASE}_inout_element">',
                       '  <use xlink:href="#${ID_BASE}_in_element"/>',
                       '  <use xlink:href="#${ID_BASE}_in_element" transform="rotate(180)"/>',
                       '</g>'].join('\n      ');

//==============================================================================

export class PMRChannelIn extends PMRChannel
{
    constructor(id, coords, rotation, height=0.6*PMRChannel.HEIGHT, idBase='pmr_channel') {
        super(id, coords, rotation, height, idBase);
        this.idBase += '_in';
    }
}

//==============================================================================

export class PMRChannelOut extends PMRChannel
{
    constructor(id, coords, rotation, height=0.6*PMRChannel.HEIGHT, idBase='pmr_channel') {
        super(id, coords, rotation, height, idBase);
        this.idBase += '_out';
    }
}

//==============================================================================

export class PMRChannelInOut extends PMRChannel
{
    constructor(id, coords, rotation, height=0.6*PMRChannel.HEIGHT, idBase='pmr_channel') {
        super(id, coords, rotation, height, idBase);
        this.idBase += '_inout';
    }
}

//==============================================================================

class Arrow
{
    static nextId() {
        Arrow._nextId += 1;
        return `_ARROW_${Arrow._nextId}_`;
    }

    static svg(id, colour) {
        return `
            <marker id="${id}" orient="auto" style="overflow: visible">
              <path fill="${colour}" transform="rotate(90) translate(0, 13) scale(0.5)"
                    d="M0,0l5,3.1l0.1-0.2l-3.3-8.2l-1.9-8.6l-1.9,8.6l-3.3,8.2l0.1,0.2l5-3.1z"/>
            </marker>`;
    }

    static url(colour) {
        let id;
        if (colour in Arrow.ColourToId) {
            id = Arrow.ColourToId[colour];
        } else {
            id = Arrow.nextId();
            Arrow.ColourToId[colour] = id;
            DefinesStore.add(id, Arrow.svg(id, colour));
        }
        return `url(#${id})`;
    }
}

Arrow.ColourToId = {};
Arrow._nextId = 0;

//==============================================================================

export function svgLine(lineString, colour, lineStyle='')
{
    const points = lineString.coordinates;
    let pointLocations = [];
    for (let point of points.slice(1)) {
        pointLocations.push(`L${point[0]},${point[1]}`);
    }
    const svgNode = document.createElementNS(SVG_NS, 'path');
    setAttributes(svgNode, {fill: "none", stroke: colour,
                            'stroke-width': LINE_WIDTH,
                            'marker-end': Arrow.url(colour),
                            d: `M${points[0][0]},${points[0][1]}${pointLocations.join('')}`
                  });
    if (lineStyle === 'dashed') setAttributes(svgNode, {'stroke-dasharray': '10,5'});

    return svgNode;
}

//==============================================================================

export class Text
{
    static nextId() {
        Text._nextId += 1;
        return `_TEXT_${Text._nextId}_`;
    }

    static typeset(s, x, y, rotation=0) {
        const [svg, size] = mathjax.typeset(s, Text.nextId());
        const [w, h, va] = [(6 * Number.parseFloat(size[0].slice(0, (-2)))),
                            (6 * Number.parseFloat(size[1].slice(0, (-2)))),
                            (6 * Number.parseFloat(size[2].slice(0, (-2))))];
        return `<g transform="translate(${x - w/2}, ${y + h/2}) scale(0.015)">${svg}</g>`;
    }
}

Text._nextId = 0;

//==============================================================================
