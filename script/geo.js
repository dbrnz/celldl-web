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
import {setAttributes, List} from './utils.js';

// TEMP
const SVG_NS = 'http://www.w3.org/2000/svg';

//==============================================================================

// Two numbers are considered equal if closer than EPISILON

const EPISILON = 1.0e-6

//==============================================================================

class GeoObject
{
    drawSvg(parentNode)
    {
    }
}

//==============================================================================

export class Point extends GeoObject
{
    constructor(x, y)
    {
        super();
        this.x = x;
        this.y = y;
    }

    toString()
    {
        return `Point(${this.x}, ${this.y})`;
    }

    equal(other)
    {
        return (Math.abs(this.x - other.x) < EPISILON)
            && (Math.abs(this.y - other.y) < EPISILON);
    }

    notEqual(other)
    {
        return !this.equal(other)
    }

    add(offset)
    {
        return new Point((this.x + offset[0]), (this.y + offset[1]));
    }

    subtract(offset)
    {
        return new Point((this.x - offset[0]), (this.y - offset[1]));
    }

    offset(other)
    {
        return [(this.x - other.x), (this.y - other.y)];
    }

    distance(other)
    {
        return Math.sqrt(Math.pow((this.x - other.x), 2)
                       + Math.pow((this.y - other.y), 2));
    }

    drawSvg(parentNode)
    {
        const svgNode = document.createElementNS(SVG_NS, 'circle');
        setAttributes(svgNode, { class: this.constructor.name.toLowerCase(),
                                 cx: this.x, cy: this.y, r: 4,
                                 fill: 'red'});
        parentNode.appendChild(svgNode);
    }
}

//==============================================================================

export class ProjectiveLine extends GeoObject
{
    constructor(A, B, C)
    {
        if ((A === 0) && (B === 0)) {
            throw new exception.ValueError("Invalid projective line coordinates");
        }
        super();
        this.A = A;
        this.B = B;
        this.C = C;
        this.normSquared = Math.pow(this.A, 2) + Math.pow(this.B, 2);
    }

    toString() {
        return `Line (${A}, ${B}, ${C})`;
    }

    contains(point)
    {
        return Math.abs(this.A*point.x + this.B*point.y + this.C) < EPISILON;
    }

    parallelLine(offset) {
        return new ProjectiveLine(this.A, this.B, this.C + offset*Math.sqrt(this.normSquared));
    }

    distanceFrom(point) {
        return Math.abs(point.x*this.A + point.y*this.B + this.C)/Math.sqrt(this.normSquared);
    }

    translate(offset) {
        return new ProjectiveLine(this.A, this.B, this.C - (offset[0]*this.A + offset[1]*this.B));
    }

    drawSvg(parentNode)
    {
        const svgNode = document.createElementNS(SVG_NS, 'path');
        // check that A and B are both non-zero
        const start = new Point(0, -this.C/this.B);
        const end = new Point(-this.C/this.A, 0);
        setAttributes(svgNode, { class: this.constructor.name.toLowerCase(),
                                 d: `M${start.x},${start.y}L${end.x},${end.y}`,
                                 stroke: 'green'});
        parentNode.appendChild(svgNode);
    }
}

//==============================================================================

export class LineSegment extends ProjectiveLine
{
    constructor(start, end)
    {
        if (start instanceof Array) {
            start = new Point(...start);
        }
        if (end instanceof Array) {
            end = new Point(...end);
        }
        super(end.y - start.y, start.x - end.x, end.x*start.y - start.x*end.y);
        this.length = Math.sqrt(this.normSquared);
        this.start = start;
        this.end = end;
    }

    contains(point)
    {
        return super.contains(point)
            && (this.start.distance(point) <= this.length)
            && (this.start.distance(point) <= this.length);
    }

    translate(offset) {
        return new LineSegment(this.start.add(offset), this.end.add(offset));
    }

    drawSvg(parentNode)
    {
        const svgNode = document.createElementNS(SVG_NS, 'path');
        setAttributes(svgNode, { class: this.constructor.name.toLowerCase(),
                                 d: `M${this.start.x},${this.start.y}L${this.end.x},${this.end.y}`,
                                 stroke: 'green'});
        parentNode.appendChild(svgNode);
    }
}

//==============================================================================

export class LineString extends GeoObject
{
    constructor(endPoints, closed=false) {
        super();
        this._segments = [];
        this.coordinates = []
        if (endPoints.length > 0) {
            for (let n = 0; n < (endPoints.length - 1); n += 1) {
                const segment = new LineSegment(endPoints[n], endPoints[n + 1]);
                this._segments.push(segment);
                this.coordinates.push(segment.start);
            }
            if (closed) {
                const segment = new LineSegment(endPoints.slice(-1)[0], endPoints[0]);
                this._segments.push(segment);
                this.coordinates.push(segment.start);
            }
            this.coordinates.push(this._segments.slice(-1)[0].end);
        }
    }

    drawSvg(parentNode)
    {
        const points = this.coordinates;
        let pointCoords = [];
        for (let point of points.slice(1)) {
            pointCoords.push(`L${point.x},${point.y}`);
        }
        const svgNode = document.createElementNS(SVG_NS, 'path');
        setAttributes(svgNode, { class: this.constructor.name.toLowerCase(),
                                 d: `M${points[0].x},${points[0].y}${pointCoords.join('')}`});
        parentNode.appendChild(svgNode);
    }
}

//==============================================================================

export class Polygon extends GeoObject
{
    constructor(points)
    {
        super();
        this._boundary = new LineString(points, true);
    }

    drawSvg(parentNode)
    {
        const points = this._boundary.coordinates;
        let pointCoords = [];
        for (let point of points.slice(1)) {
            pointCoords.push(`${point.x},${point.y}`);
        }
        const svgNode = document.createElementNS(SVG_NS, 'polygon');
        setAttributes(svgNode, { class: this.constructor.name.toLowerCase(),
                                 points: `${points[0].x},${points[0].y} ${pointCoords.join(' ')}`,
                                 fill: 'none'});
        parentNode.appendChild(svgNode);
    }
}

//==============================================================================

export class Rectangle extends GeoObject
{
    constructor(topLeft, bottomRight)
    {
        if (topLeft instanceof Array) {
            topLeft = new Point(...topLeft);
        }
        if (bottomRight instanceof Array) {
            bottomRight = new Point(...bottomRight);
        }
        if ((topLeft === bottomRight)) {
            throw new exception.ValueError("Rectangle has no size");
        }
        super();
        this.width = Math.abs(topLeft.x - bottomRight.x);
        this.height = Math.abs(topLeft.y - bottomRight.y);
        this.centre = new Point((topLeft.x + bottomRight.x)/2.0, (topLeft.y + bottomRight.y)/2.0);
        this.topLeft = this.centre.subtract([this.width/2.0, this.height/2.0]);
        this.bottomRight = this.centre.add([this.width/2.0, this.height/2.0]);
    }

    contains(point)
    {
        const offset = point.offset(this.centre);
        return 0 < offset[0] && offset[0] < this.width
            && 0 < offset[1] && offset[1] < this.height;
    }

    drawSvg(parentNode)
    {
        const svgNode = document.createElementNS(SVG_NS, 'rect');
        setAttributes(svgNode, { class: this.constructor.name.toLowerCase(),
                                 x: this.topLeft.x, y: this.topLeft.y,
                                 width: this.width, height: this.height,
                                 fill: 'none'});
        parentNode.appendChild(svgNode);
    }
}

//==============================================================================

export class RoundedRectangle extends Rectangle
{
    constructor(topLeft, bottomRight, xCornerRadius = 0, yCornerRadius = 0)
    {
        super(topLeft, bottomRight);
        if (yCornerRadius === 0) {
            yCornerRadius = xCornerRadius;
        }
        if ((xCornerRadius < 0) || (xCornerRadius > this.width/2.0)
         || (yCornerRadius < 0) || (yCornerRadius > this.height/2.0)) {
            throw new exception.ValueError("Invalid corner radius");
        }
        this.xCornerRadius = xCornerRadius;
        this.yCornerRadius = yCornerRadius;
        if (xCornerRadius === 0 && yCornerRadius === 0) {
            this.innerRectangle = new Rectangle(topLeft, bottomRight);
            this.cornerEllipse = null;
        } else {
            const w_2 = (this.width - xCornerRadius)/2.0;
            const h_2 = (this.height - yCornerRadius)/2.0;
            this.innerRectangle = new Rectangle(new Point(this.centre.x).subtract([w_2, h_2]),
                                                new Point(this.centre.x).add([w_2, h_2]));
            this.cornerEllipse = new Ellipse(this.centre, xCornerRadius, yCornerRadius);
        }
    }

    contains(point)
    {
        if (xCornerRadius === 0 && yCornerRadius === 0) {
            return super.contains(point);
        } else {
            return this.innerRectangle.contains(point)
                || this.cornerEllipse.translate([-this.width/2.0, -this.height/2.0]).contains(point)
                || this.cornerEllipse.translate([-this.width/2.0,  this.height/2.0]).contains(point)
                || this.cornerEllipse.translate([ this.width/2.0, -this.height/2.0]).contains(point)
                || this.cornerEllipse.translate([ this.width/2.0,  this.height/2.0]).contains(point);
                // Or the side lobes...
        }
    }

    drawSvg(parentNode)
    {
        const svgNode = document.createElementNS(SVG_NS, 'rect');
        setAttributes(svgNode, { class: this.constructor.name.toLowerCase(),
                                 x: this.topLeft.x, y: this.topLeft.y,
                                 width: this.width, height: this.height,
                                 rx: this.xCornerRadius, ry: this.yCornerRadius,
                                 fill: 'none'});
        parentNode.appendChild(svgNode);
    }
}

//==============================================================================

export class Ellipse extends GeoObject
{
    constructor(centre, xRadius, yRadius)
    {
        if ((xRadius === 0) || (yRadius === 0)) {
            throw new exception.ValueError("Invalid radius");
        }
        if (centre instanceof Array) {
            centre = new Point(...centre);
        }
        super();
        this.centre = centre;
        this.xRadius = xRadius;
        this.yRadius = yRadius;
    }

    line_intersect(line)
    {
        const l = (this.centre.x !== 0) || (this.centre.y !== 0)
                ? line.translate([-this.centre.x, -this.centre.y])
                : line;
        const points = [];
        if (l.A === 0) {
            let y = -l.C/l.B;
            const x2 = Math.pow(this.xRadius, 2) - Math.pow(y*this.xRadius/this.yRadius, 2);
            if (x2 === 0) {
                points.push(new Point(0, y).add([this.centre.x, this.centre.y]));
            } else if ( x2 > 0) {
                const x = Math.sqrt(x2);
                points.push(new Point(-x, y).add([this.centre.x, this.centre.y]));
                points.push(new Point( x, y).add([this.centre.x, this.centre.y]));
            }
        } else {
            const d2 = Math.pow(l.A*this.xRadius, 2) + Math.pow(l.B*this.yRadius, 2);
            const a = -l.C*l.B*Math.pow(this.yRadius, 2)/d2;
            const b = d2 - Math.pow(l.C, 2);
            if (b === 0) {
                points.push(new Point(-(l.C + a*l.B)/l.A, a).add([this.centre.x, this.centre.y]));
            } else if (b > 0) {
                const c = -l.A*this.xRadius*this.yRadius*Math.sqrt(b)/d2;
                points.push(new Point(-(l.C + (a + c)*l.B)/l.A, a + c).add([this.centre.x, this.centre.y]));
                points.push(new Point(-(l.C + (a - c)*l.B)/l.A, a - c).add([this.centre.x, this.centre.y]));
            }
        }
        return points.filter(p => line.contains(p));
    }

    contains(point)
    {
        return (Math.pow((point.x - this.centre.x)/this.xRadius, 2)
              + Math.pow((point.y - this.centre.y)/this.yRadius, 2) < 1.0);
    }

    translate(offset)
    {
        return new Ellipse(this.centre.add(offset), this.xRadius, this.yRadius);
    }

    drawSvg(parentNode)
    {
        const svgNode = document.createElementNS(SVG_NS, 'ellipse');
        setAttributes(svgNode, { class: this.constructor.name.toLowerCase(),
                                 cx: this.centre.x, cy: this.centre.y,
                                 rx: this.xRadius, ry: this.yRadius,
                                 fill: 'none', stroke: 'blue'});
        parentNode.appendChild(svgNode);
    }
}

//==============================================================================

export class Circle extends Ellipse
{
    constructor(centre, radius)
    {
        if (centre instanceof Array) {
            centre = new Point(...centre);
        }
        super(centre, radius, radius);
        this.radius = radius;
    }

    drawSvg(parentNode)
    {
        const svgNode = document.createElementNS(SVG_NS, 'circle');
        setAttributes(svgNode, { class: this.constructor.name.toLowerCase(),
                                 cx: this.centre.x, cy: this.centre.y,
                                 r: this.radius,
                                 fill: 'none', stroke: 'blue'});
        parentNode.appendChild(svgNode);
    }
}

//==============================================================================

export function test()
{
    const circles = [new Ellipse(new Point(200, 200), 150, 100),
                     new Circle(new Point(400, 200), 80),
                     new Circle(new Point(200, 400), 80)
                    ];

    const lines = [new LineSegment(new Point(200, 100), new Point(200, 300)),
                   new LineSegment(new Point(400, 100), new Point(400, 300)),
                   new LineSegment(new Point(100, 400), new Point(300, 400)),
                   new LineSegment(new Point(  0,   0), new Point(200, 200))
                  ];

    const lxy = new LineSegment(new Point(200, 300), new Point(400, 100));
    const pxy = new ProjectiveLine(lxy.A, lxy.B, lxy.C);
    lines.push(pxy);
    lines.push(pxy.translate([50, 50]));

    const elements = new List();
    elements.extend(circles).extend(lines);

    for (let l of lines) {
        for (let c of circles) {
            let s = [];
            for (let p of c.line_intersect(l)) {
                elements.push(p);
                s.push(p.toString());
            }
            console.log(s);
        }
    }

    return elements;
}

//==============================================================================
