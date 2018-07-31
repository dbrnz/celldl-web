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
import {SVG_NS} from './svgElements.js';
import {setAttributes, List} from './utils.js';

//==============================================================================

// Two numbers are considered equal if closer than EPISILON

const EPISILON = 1.0e-6;

//==============================================================================

class GeoObject
{
    svgNode()
    //=======
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
    //========
    {
        return `Point(${this.x}, ${this.y})`;
    }

    valueAt(index)
    //============
    {
        return (index === 0) ? this.x
             : (index === 1) ? this.y
             : undefined;
    }

    setValueAt(index, value)
    //======================
    {
        if      (index === 0) this.x = value;
        else if (index === 1) this.y = value;
    }

    asOffset()
    //========
    {
        return [this.x, this.y];
    }

    assign(other)
    //===========
    {
        this.x = other.x;
        this.y = other.y;
    }

    equal(other)
    //==========
    {
        return (Math.abs(this.x - other.x) < EPISILON)
            && (Math.abs(this.y - other.y) < EPISILON);
    }

    notEqual(other)
    //=============
    {
        return !this.equal(other);
    }

    add(offset)
    //=========
    {
        return new Point((this.x + offset[0]), (this.y + offset[1]));
    }

    subtract(offset)
    //==============
    {
        return new Point((this.x - offset[0]), (this.y - offset[1]));
    }

    offset(other)
    //===========
    {
        return [(this.x - other.x), (this.y - other.y)];
    }

    distance(other)
    //=============
    {
        return Math.sqrt(Math.pow((this.x - other.x), 2)
                       + Math.pow((this.y - other.y), 2));
    }

    outside(other)
    //============
    {
        return this.notEqual(other);
    }

    svgNode()
    //=======
    {
        const svgNode = document.createElementNS(SVG_NS, 'circle');
        setAttributes(svgNode, { cx: this.x, cy: this.y });
        return svgNode;
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

    toString()
    //========
    {
        return `Line (${this.A}, ${this.B}, ${this.C})`;
    }

    outside(point)
    //============
    {
        return Math.abs(this.A*point.x + this.B*point.y + this.C) >= EPISILON;
    }

    parallelLine(offset)
    //==================
     {
        return new ProjectiveLine(this.A, this.B, this.C + offset*Math.sqrt(this.normSquared));
    }

    distanceFrom(point)
    //=================
    {
        return Math.abs(point.x*this.A + point.y*this.B + this.C)/Math.sqrt(this.normSquared);
    }

    translate(offset)
    //===============
    {
        return new ProjectiveLine(this.A, this.B, this.C - (offset[0]*this.A + offset[1]*this.B));
    }

    intersection(other)
    //=================
    {
        let c = this.A*other.B - other.A*this.B;
        return (c === 0.0) ? null
                           : new Point((this.B*other.C - other.B*this.C)/c,
                                       (other.A*this.C - this.A*other.C)/c);
    }

    svgNode()
    //=======
    {
        const svgNode = document.createElementNS(SVG_NS, 'path');
        // check that A and B are both non-zero
        const start = new Point(0, -this.C/this.B);
        const end = new Point(-this.C/this.A, 0);
        setAttributes(svgNode, { d: `M${start.x},${start.y}L${end.x},${end.y}`});
        return svgNode;
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

    outside(point)
    //============
    {
        return super.outside(point)
            || (this.start.distance(point) > this.length)
            || (this.end.distance(point) > this.length);
    }

    intersection(other)
    //=================
    {
        let point = super.intersection(other);
        let validPoint = point !== null
                      && this.start.distance(point) <= this.length
                      && this.end.distance(point) <= this.length;
        if (other instanceof LineSegment) {
            validPoint = validPoint
                      && other.start.distance(point) <= other.length
                      && other.end.distance(point) <= other.length;
        }
        return validPoint ? point : null;
    }

    translate(offset)
    //===============
    {
        return new LineSegment(this.start.add(offset), this.end.add(offset));
    }

    truncateEnd(length)
    //=================
    {
        return new LineSegment(this.start,
                               this.end.subtract([(this.end.x - this.start.x)*length/this.length,
                                                  (this.end.y - this.start.y)*length/this.length]));
    }

    truncateStart(length)
    //===================
    {
        return new LineSegment(this.start.add([(this.end.x - this.start.x)*length/this.length,
                                               (this.end.y - this.start.y)*length/this.length]),
                               this.end);
    }

    svgNode()
    //=======
    {
        const svgNode = document.createElementNS(SVG_NS, 'path');
        setAttributes(svgNode, { d: `M${this.start.x},${this.start.y}L${this.end.x},${this.end.y}`});
        return svgNode;
    }
}

//==============================================================================

export class LineSegmentSet extends GeoObject
{
    constructor(lineSegments) {
        super();
        this.lineSegments = new List(lineSegments);
    }

    add(lineSegment)
    //==============
    {
        this.lineSegments.append(lineSegment);
    }

    lineIntersections(line)
    //=====================
    {
        const points = [];
        for (let lineSegment of this.lineSegments) {
            points.push(lineSegment.intersection(line));
        }
        return points.filter(p => (p !== null));
    }
}

//==============================================================================

export class LineString extends GeoObject
{
    constructor(points, closed=false) {
        super();
        this.lineSegments = [];
        this.coordinates = [];
        try {
            if (points.length > 0) {
                for (let n = 0; n < (points.length - 1); n += 1) {
                    const segment = new LineSegment(points[n], points[n + 1]);
                    this.lineSegments.push(segment);
                    this.coordinates.push(segment.start);
                }
                if (closed) {
                    const segment = new LineSegment(points.slice(-1)[0], points[0]);
                    this.lineSegments.push(segment);
                    this.coordinates.push(segment.start);
                }
                this.coordinates.push(this.lineSegments.slice(-1)[0].end);
            }
        }
        catch (error) {
            // We may have two identical consecutive points
            if (error instanceof exception.ValueError) {
                this.lineSegments = [];
                this.coordinates = [];
            } else {
                throw error;
            }
        }
    }

    svgNode()
    //=======
    {
        const points = this.coordinates;
        let pointCoords = [];
        for (let point of points.slice(1)) {
            pointCoords.push(`L${point.x},${point.y}`);
        }
        const svgNode = document.createElementNS(SVG_NS, 'path');
        if (points.length > 0) {
            setAttributes(svgNode, { d: `M${points[0].x},${points[0].y}${pointCoords.join('')}`});
        }
        return svgNode;
    }
}

//==============================================================================

export class Polygon extends GeoObject
{
    constructor(points)
    {
        super();
        this.boundary = new LineString(points, true);
        this.edges = new LineSegmentSet(this.boundary.lineSegments);
    }

    lineIntersections(line)
    //=====================
    {
        return this.edges.lineIntersections(line);
    }

    svgNode()
    //=======
    {
        const points = this.boundary.coordinates;
        let pointCoords = [];
        for (let point of points.slice(1)) {
            pointCoords.push(`${point.x},${point.y}`);
        }
        const svgNode = document.createElementNS(SVG_NS, 'polygon');
        setAttributes(svgNode, { points: `${points[0].x},${points[0].y} ${pointCoords.join(' ')}`});
        return svgNode;
    }
}

//==============================================================================

export class Rectangle extends Polygon
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
        super([topLeft, [bottomRight.x, topLeft.y], bottomRight, [topLeft.x, bottomRight.y]]);
        this.width = Math.abs(topLeft.x - bottomRight.x);
        this.height = Math.abs(topLeft.y - bottomRight.y);
        this.centre = new Point((topLeft.x + bottomRight.x)/2.0, (topLeft.y + bottomRight.y)/2.0);
        this.topLeft = this.centre.subtract([this.width/2.0, this.height/2.0]);
        this.bottomRight = this.centre.add([this.width/2.0, this.height/2.0]);
        this.edges = new LineSegmentSet([new LineSegment(topLeft, topLeft.add([this.width, 0])),
                                         new LineSegment(bottomRight.subtract([0, this.height]), bottomRight),
                                         new LineSegment(bottomRight, bottomRight.subtract([this.width, 0])),
                                         new LineSegment(topLeft.add([0, this.height]), topLeft)
                                        ]);
    }

    outside(point)
    //============
    {
        const offset = point.offset(this.centre);
        return Math.abs(offset[0]) > this.width/2.0
            || Math.abs(offset[1]) > this.height/2.0;
    }

    lineIntersections(line)
    //=====================
    {
        return new List(this.edges.lineIntersections(line));
    }

    svgNode(expand=0)
    //===============
    {
        const svgNode = document.createElementNS(SVG_NS, 'rect');
        setAttributes(svgNode, { x: this.topLeft.x - expand/2,
                                 y: this.topLeft.y - expand/2,
                                 width: this.width + expand,
                                 height: this.height + expand});
        return svgNode;
    }
}

//==============================================================================

export class RoundedRectangle extends Rectangle
{
    constructor(topLeft, bottomRight, xCornerRadius = 0, yCornerRadius = 0)
    {
        if (topLeft instanceof Array) {
            topLeft = new Point(...topLeft);
        }
        if (bottomRight instanceof Array) {
            bottomRight = new Point(...bottomRight);
        }
        super(topLeft, bottomRight);
        if (yCornerRadius === 0
         || xCornerRadius === 0) {   // This catches a degenerate case
            yCornerRadius = xCornerRadius;
        }
        if (xCornerRadius < 0 || xCornerRadius > this.width/2.0
         || yCornerRadius < 0 || yCornerRadius > this.height/2.0) {
            throw new exception.ValueError("Invalid corner radius");
        }
        this.edges = new LineSegmentSet([new LineSegment(topLeft.add([xCornerRadius, 0]),
                                                         topLeft.add([this.width - xCornerRadius, 0])),
                                         new LineSegment(bottomRight.subtract([0, this.height - yCornerRadius]),
                                                         bottomRight.subtract([0, yCornerRadius])),
                                         new LineSegment(bottomRight.subtract([xCornerRadius, 0]),
                                                         bottomRight.subtract([this.width - xCornerRadius, 0])),
                                         new LineSegment(topLeft.add([0, this.height - yCornerRadius]),
                                                         topLeft.add([0, yCornerRadius]))
                                        ]);
        this.xCornerRadius = xCornerRadius;
        this.yCornerRadius = yCornerRadius;
        this.cornerEllipse = (xCornerRadius !== 0 && yCornerRadius !== 0)
                           ? new Ellipse(this.centre, xCornerRadius, yCornerRadius)
                           : null;
    }

    outside(point)
    //============
    {
        let outside = super.outside(point);

        // Check if outside corner 1/4 ellipses.
        if (!outside && this.cornerEllipse !== null) {
            const w2 = this.width/2.0 - this.xCornerRadius;
            const h2 = this.height/2.0 - this.yCornerRadius;
            outside = (point.x <= this.centre.x - w2 && point.y <= this.centre.y - h2)
                        ? this.cornerEllipse.translate([-w2, -h2]).outside(point)
                     : (point.x >= this.centre.x + w2 && point.y <= this.centre.y - h2)
                        ? this.cornerEllipse.translate([ w2, -h2]).outside(point)
                     : (point.x >= this.centre.x + w2 && point.y >= this.centre.y + h2)
                        ? this.cornerEllipse.translate([ w2,  h2]).outside(point)
                     : (point.x <= this.centre.x - w2 && point.y >= this.centre.y + h2)
                        ? this.cornerEllipse.translate([-w2,  h2]).outside(point)
                     : false;
        }
        return outside;
    }

    lineIntersections(line)
    //=====================
    {
        const points = new List(this.edges.lineIntersections(line));

        // Add points on corner 1/4 ellipses.
        const w2 = this.width/2.0 - this.xCornerRadius;
        const h2 = this.height/2.0 - this.yCornerRadius;

        points.extend(this.cornerEllipse.translate([-w2, -h2])
                      .lineIntersections(line).filter(p => (p.x <= this.centre.x - w2)
                                                        && (p.y <= this.centre.y - h2)));
        points.extend(this.cornerEllipse.translate([ w2, -h2])
                      .lineIntersections(line).filter(p => (p.x >= this.centre.x + w2)
                                                        && (p.y <= this.centre.y - h2)));
        points.extend(this.cornerEllipse.translate([ w2,  h2])
                      .lineIntersections(line).filter(p => (p.x >= this.centre.x + w2)
                                                        && (p.y >= this.centre.y + h2)));
        points.extend(this.cornerEllipse.translate([-w2,  h2])
                      .lineIntersections(line).filter(p => (p.x <= this.centre.x - w2)
                                                        && (p.y >= this.centre.y + h2)));
        return points;
    }

    svgNode(expand=0)
    //===============
    {
        const svgNode = document.createElementNS(SVG_NS, 'rect');
        setAttributes(svgNode, { x: this.topLeft.x - expand/2,
                                 y: this.topLeft.y - expand/2,
                                 width: this.width + expand,
                                 height: this.height + expand,
                                 rx: this.xCornerRadius + expand/2,
                                 ry: this.yCornerRadius + expand/2});
        return svgNode;
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

    lineIntersections(line)
    //=====================
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
        return points.filter(p => !line.outside(p));
    }

    outside(point)
    //============
    {
        return (Math.pow((point.x - this.centre.x)/this.xRadius, 2)
              + Math.pow((point.y - this.centre.y)/this.yRadius, 2) > 1.0);
    }

    translate(offset)
    //===============
    {
        return new Ellipse(this.centre.add(offset), this.xRadius, this.yRadius);
    }

    svgNode(expand=0)
    //===============
    {
        const svgNode = document.createElementNS(SVG_NS, 'ellipse');
        setAttributes(svgNode, { cx: this.centre.x, cy: this.centre.y,
                                 rx: this.xRadius + expand/2,
                                 ry: this.yRadius + expand/2});
        return svgNode;
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

    svgNode(expand=0)
    //===============
    {
        const svgNode = document.createElementNS(SVG_NS, 'circle');
        setAttributes(svgNode, { cx: this.centre.x, cy: this.centre.y,
                                 r: this.radius + expand/2});
        return svgNode;
    }
}

//==============================================================================

export function test()
{
    const rr = new RoundedRectangle(new Point(280, 340), new Point(460, 440), 25, 20);

    const regions = [new Ellipse(new Point(200, 200), 150, 100),
                     new Circle(new Point(400, 200), 80),
                     new Rectangle(new Point(140, 340), new Point(240, 440)),
                     rr
                    ];

    const lines = [new LineSegment(new Point(200, 100), new Point(200, 300)),
                   new LineSegment(new Point(400, 100), new Point(400, 300)),
                   new LineSegment(new Point(100, 400), new Point(300, 400)),
                   new LineSegment(new Point(  0, 100), new Point(200, 200)),
                   new LineSegment(new Point(170, 370), new Point(400, 500)),
                   new LineSegment(new Point(250, 500), new Point(355, 330)),
                  ];

    const lxy = new LineSegment(new Point(200, 300), new Point(400, 100));
    const pxy = new ProjectiveLine(lxy.A, lxy.B, lxy.C);
    lines.push(pxy);
    lines.push(pxy.translate([50, 50]));

    const points = [new Point(455, 345), new Point(450, 350), rr.centre, new Point(400, 340)];

    const intersections = [];
    for (let l of lines) {
        for (let r of regions) {
            for (let p of r.lineIntersections(l)) {
                intersections.push(p);
            }
        }
    }

    const svgNode = document.createElementNS(SVG_NS, 'g');

    for (let element of regions) {
        const node = element.svgNode();
        setAttributes(node, {stroke: 'blue', fill: 'none'});
        svgNode.appendChild(node);
    }
    for (let element of lines) {
        const node = element.svgNode();
        setAttributes(node, {stroke: 'green'});
        svgNode.appendChild(node);
    }
    for (let element of intersections) {
        const node = element.svgNode();
        setAttributes(node, {r: 4, fill: 'red'});
        svgNode.appendChild(node);
    }

    for (let p of points) {
        const node = p.svgNode();
        setAttributes(node, {r: 2, fill: rr.outside(p) ? 'blue' : 'red'});
        svgNode.appendChild(node);
    }

    return svgNode;
}

//==============================================================================
