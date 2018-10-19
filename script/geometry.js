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
import * as utils from './utils.js';

import {SVG_NS} from './svgElements.js';
import {setAttributes, List} from './utils.js';

//==============================================================================

// Two numbers are considered equal if closer than EPISILON

const EPISILON = 1.0e-6;

//==============================================================================

export class Length {
    constructor(length=0, units='') {
        this.length = length;
        this.units = units;
    }

    toString()
    //========
    {
        return `${this.length}${this.units}`;
    }
}

//==============================================================================

class GeoObject
{
    location(coords)
    //==============
    {
        return null;
    }

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

    asArray()
    //=======
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

    translate(offset)
    //===============
    {
        return new Point((this.x + offset[0]), (this.y + offset[1]));
    }

    scale(multiplier)
    //===============
    {
        return new Point(multiplier*this.x, multiplier*this.y);
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

export class Curve extends GeoObject
{

}

//==============================================================================

export class ProjectiveLine extends Curve
{
    constructor(A, B, C)
    {
        super();
        this.A = A;
        this.B = B;
        this.C = C;
        this.normSquared = Math.pow(this.A, 2) + Math.pow(this.B, 2);
    }

    get valid()
    //=========
    {
        return (this.A !== 0 || this.B !== 0);
    }

    checkValid()
    //==========
    {
        if (!this.valid) {
            throw new exception.ValueError("Invalid Projective Line");
        }
    }

    toString()
    //========
    {
        this.checkValid();
        return `Line (${this.A}, ${this.B}, ${this.C})`;
    }

    outside(point)
    //============
    {
        this.checkValid();
        return Math.abs(this.A*point.x + this.B*point.y + this.C) >= EPISILON;
    }

    parallelLine(offset)
    //==================
    {
        this.checkValid();
        return new ProjectiveLine(this.A, this.B, this.C + offset*Math.sqrt(this.normSquared));
    }

    distanceFrom(point)
    //=================
    {
        this.checkValid();
        return Math.abs(point.x*this.A + point.y*this.B + this.C)/Math.sqrt(this.normSquared);
    }

    translate(offset)
    //===============
    {
        this.checkValid();
        return new ProjectiveLine(this.A, this.B, this.C - (offset[0]*this.A + offset[1]*this.B));
    }

    intersection(other)
    //=================
    {
        this.checkValid();
        let c = this.A*other.B - other.A*this.B;
        return (c === 0.0) ? null
                           : new Point((this.B*other.C - other.B*this.C)/c,
                                       (other.A*this.C - this.A*other.C)/c);
    }

    svgNode()
    //=======
    {
        this.checkValid();
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
        if (this.length === 0) {
            return !this.start.equal(point);
        } else {
            return super.outside(point)
                || (this.start.distance(point) > this.length)
                || (this.end.distance(point) > this.length);
        }
    }

    intersection(other)
    //=================
    {
        if (this.length === 0) {
            // We are a point
            if (other.length === 0) {
                // And so is `other`
                return this.start.equal(other.start) ? this.start : null;
            } else {
                // Otherwise are we on `other`?
                return other.outside(this.start) ? null : this.start;
            }
        } else if (other.length === 0) {
            // `other` is a point, is it on us?
            return this.outside(other.start) ? null : other.start;
        } else {
            // Find intersection of two lines
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
    }

    ratio(fraction)
    //=============
    {
        return new Point((1 - fraction)*this.start.x + fraction*this.end.x,
                         (1 - fraction)*this.start.y + fraction*this.end.y)
    }

    translate(offset)
    //===============
    {
        return new LineSegment(this.start.translate(offset), this.end.translate(offset));
    }

    truncateEnd(length)
    //=================
    {
        return new LineSegment(this.start,
                               this.end.translate([(this.start.x - this.end.x)*length/this.length,
                                                   (this.start.y - this.end.y)*length/this.length]));
    }

    truncateStart(length)
    //===================
    {
        return new LineSegment(this.start.translate([(this.end.x - this.start.x)*length/this.length,
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

    addSegment(lineSegment)
    //=====================
    {
        this.lineSegments.append(lineSegment);
    }

    get length()
    //==========
    {
        return this.lineSegments.length;
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
        if (points.length > 1) {
            for (let n = 0; n < (points.length - 1); n += 1) {
                const segment = new LineSegment(points[n], points[n + 1]);
                if (segment.length > 0) {
                    this.lineSegments.push(segment);
                    this.coordinates.push(segment.start);
                }
            }
            if (closed) {
                const segment = new LineSegment(points.slice(-1)[0], points[0]);
                if (segment.length > 0) {
                    this.lineSegments.push(segment);
                    this.coordinates.push(segment.start);
                }
            }
            if (this.lineSegments.length > 0) {
                this.coordinates.push(this.lineSegments.slice(-1)[0].end);
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

export class BezierCurve extends Curve
{
    constructor(points, biezerJsCurve=null)
    {
        super();
        if (biezerJsCurve) {
            this._curve = biezerJsCurve;
        } else {
            this._curve = new Bezier(points);
        }
    }

    static cubicFromPoints(p1, p2, p3, t=0.5, d1=undefined)
    //=====================================================
    {
        return new BezierCurve(null, Bezier.cubicFromPoints(p1, p2, p3, t, d1));
    }

    static quadraticFromPoints(p1, p2, p3, t=0.5)
    //===========================================
    {
        return new BezierCurve(null, Bezier.quadraticFromPoints(p1, p2, p3, t));
    }

    at(t)
    //===
    {
        const pt = this._curve.get(t);
        return new Point(pt.x, pt.y);
    }

    slice(t1, t2)
    //===========
    {
        return new BezierCurve(null, this._curve.split(t1, t2));
    }

    split(t)
    //======
    {
        const parts = this._curve.split(t);
        return [new BezierCurve(null, parts.left),
                new BezierCurve(null, parts.right)];
    }

    svgNode()
    //=======
    {
        const path = document.createElementNS(SVG_NS, 'path');
        const pts = this._curve.points;
        if        (this._curve.order === 2) {
            path.setAttribute('d', `M ${pts[0].x},${pts[0].y} Q ${pts[1].x},${pts[1].y} ${pts[2].x},${pts[2].y}`);
        } else if (this._curve.order === 3) {
            path.setAttribute('d', `M ${pts[0].x},${pts[0].y} C ${pts[1].x},${pts[1].y} ${pts[2].x},${pts[2].y} ${pts[3].x},${pts[3].y}`);
        }
        return path;
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

    static fromSvgPath(svgPath)
    //=========================
    {
        const path = svgPath.trim().replace(/,/g, ' ').replace(/\n/g, ' ').split(' ').filter(e => e);
        let lastcmd = null;
        let lastpos = null;
        const points = new utils.List();
        let n = 0;
        while (n < path.length) {
            let cmd = null;
            let pos = null;

            if (/^[A-Z]$/i.test(path[n])) {  // Check if alpha
                cmd = path[n];
                n += 1;
            } else {
                cmd = lastcmd;
            }

            if (cmd === 'm' && lastpos === null) {
                cmd = 'M';
            }

            if   (cmd === 'M') {
                pos = new Point(parseFloat(path[n]), parseFloat(path[n+1]));
                n += 2;
            } else if (cmd == 'm') {
                pos = lastpos.translate([parseFloat(path[n]), parseFloat(path[n+1])]);
                n += 2;
            } else if (cmd == 'L') {
                pos = new Point(parseFloat(path[n]), parseFloat(path[n+1]));
                n += 2;
            } else if (cmd == 'l') {
                pos = lastpos.translate([parseFloat(path[n]), parseFloat(path[n+1])]);
                n += 2;
            } else if (cmd == 'H') {
                pos = new Point(parseFloat(path[n]), lastpos.y);
                n += 1;
            } else if (cmd == 'h') {
                pos = lastpos.translate([parseFloat(path[n]), 0]);
                n += 1;
            } else if (cmd == 'V') {
                pos = new Point([lastpos.x, parseFloat(path[n])]);
                n += 1;
            } else if (cmd == 'v') {
                pos = lastpos.translate([0, parseFloat(path[n])]);
                n += 1;
            } else if (cmd == 'C') {  // S s
                pos = new Point(parseFloat(path[n+4]), parseFloat(path[n+5]));
                points.extend(Polygon._lineariseBezier([lastpos,
                                                        new Point(parseFloat(path[n]), parseFloat(path[n+1])),
                                                        new Point(parseFloat(path[n+2]), parseFloat(path[n+3])),
                                                        pos]));
                n += 6;
            } else if (cmd == 'c') {
                pos = lastpos.translate([parseFloat(path[n+4]), parseFloat(path[n+5])]);
                points.extend(Polygon._lineariseBezier([lastpos,
                                                        lastpos.translate([parseFloat(path[n]), parseFloat(path[n+1])]),
                                                        lastpos.translate([parseFloat(path[n+2]), parseFloat(path[n+3])]),
                                                        pos]));
                n += 6;
            } else if (cmd == 'Q') {  // T t
                pos = new Point(parseFloat(path[n+2]), parseFloat(path[n+3]));
                points.extend(Polygon._lineariseBezier([lastpos,
                                                        new Point(parseFloat(path[n]), parseFloat(path[n+1])),
                                                        pos]));
                n += 4;
            } else if (cmd == 'q') {
                pos = lastpos.translate([parseFloat(path[n+2]), parseFloat(path[n+3])]);
                points.extend(Polygon._lineariseBezier([lastpos,
                                                        lastpos.translate([parseFloat(path[n]), parseFloat(path[n+1])]),
                                                        pos]));
                n += 4;
            } else if ('zZ'.indexOf(cmd) >= 0) {
                ;   // Close the curve
            } else {
                continue;
            }

            // 'M/m' should just move and not draw...
            if (pos !== null) {
                points.push(pos);
                lastpos = pos;
                lastcmd = cmd;
            }
        }

        if (points[0] === points.slice(-1)[0]) {
            points.pop();
        }
        return new Polygon(points);
    }

    static _lineariseBezier(points)
    //=============================
    {
        const curve = new Bezier(points);
        const pts = [];
        for (let n = 1; n < Polygon._CURVE_LINEAR_PARTS; ++n) {
            const pt = curve.get(n/Polygon._CURVE_LINEAR_PARTS);
            pts.push(new Point(pt.x, pt.y));
        }
        return pts;
    }

    lineIntersections(line)
    //=====================
    {
        return this.edges.lineIntersections(line);
    }


    /*
     * ANSI C code from the article
     * "Centroid of a Polygon"
     * by Gerard Bashein and Paul R. Detmer,
       (gb@locke.hs.washington.edu, pdetmer@u.washington.edu)
     * in "Graphics Gems IV", Academic Press, 1994
     */

    /*********************************************************************
    polyCentroid: Calculates the centroid (xCentroid, yCentroid) and area
    of a polygon, given its vertices (x[0], y[0]) ... (x[n-1], y[n-1]). It
    is assumed that the contour is closed, i.e., that the vertex following
    (x[n-1], y[n-1]) is (x[0], y[0]).  The algebraic sign of the area is
    positive for counterclockwise ordering of vertices in x-y plane;
    otherwise negative.
    Returned values:  0 for normal execution;  1 if the polygon is
    degenerate (number of vertices < 3);  and 2 if area = 0 (and the
    centroid is undefined).
    **********************************************************************/

    centroid()
    //========
    {
        const points = this.boundary.coordinates;
        const n = points.length;
        if (n < 3) {
            return null;
        }
        let a = 0;
        let x = 0;
        let y = 0;
        let q = points.slice(-1)[0];
        for (let p of points) {
            const f = q.x*p.y - p.x*q.y;
            a += f;
            x += f*(p.x + q.x);
            y += f*(p.y + q.y);
            q = p;
        }
        this.area = a/2.0;
        a *= 3.0;
        return a ? (new Point(x/a, y/a)) : null;
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

Polygon._CURVE_LINEAR_PARTS = 4;   // For linerising a Bezier curve

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
        this.topLeft = this.centre.translate([-this.width/2.0, -this.height/2.0]);
        this.bottomRight = this.centre.translate([this.width/2.0, this.height/2.0]);
        this.edges = new LineSegmentSet([new LineSegment(topLeft, topLeft.translate([this.width, 0])),
                                         new LineSegment(bottomRight.translate([0, -this.height]), bottomRight),
                                         new LineSegment(bottomRight, bottomRight.translate([-this.width, 0])),
                                         new LineSegment(topLeft.translate([0, this.height]), topLeft)
                                        ]);
    }

    toString()
    //========
    {
        return `RECT(${this.width}x${this.height}): ${this.topLeft} - ${this.bottomRight}`;
    }

    outside(point)
    //============
    {
        const offset = point.offset(this.centre);
        return Math.abs(offset[0]) > this.width/2.0
            || Math.abs(offset[1]) > this.height/2.0;
    }

    boundedProjection(other, delta)
    //=============================
    {
        const leftSide = ((this.bottomRight.x - delta) < other.topLeft.x);
        const rightSide = ((this.topLeft.x + delta) > other.bottomRight.x);
        const above = ((this.bottomRight.y - delta) < other.topLeft.y);
        const below = ((this.topLeft.y + delta) > other.bottomRight.y);

        const edgeSet = new LineSegmentSet([]);
        if        ((leftSide || rightSide) && !(above || below)) {
            const yTop = Math.max(this.topLeft.y, other.topLeft.y);
            const yBottom = Math.min(this.bottomRight.y, other.bottomRight.y);
            if (leftSide) {
                edgeSet.addSegment(new LineSegment([this.bottomRight.x, yTop], [this.bottomRight.x, yBottom]));
                edgeSet.addSegment(new LineSegment([other.topLeft.x, yTop], [other.topLeft.x, yBottom]));
            } else {
                edgeSet.addSegment(new LineSegment([this.topLeft.x, yTop], [this.topLeft.x, yBottom]));
                edgeSet.addSegment(new LineSegment([other.bottomRight.x, yTop], [other.bottomRight.x, yBottom]));
            }
        } else if (!(leftSide || rightSide) && (above || below)) {
            const xLeft = Math.max(this.topLeft.x, other.topLeft.x);
            const xRight = Math.min(this.bottomRight.x, other.bottomRight.x);
            if (above) {
                edgeSet.addSegment(new LineSegment([xLeft, this.bottomRight.y], [xRight, this.bottomRight.y]));
                edgeSet.addSegment(new LineSegment([xLeft, other.topLeft.y], [xRight, other.topLeft.y]));
            } else {
                edgeSet.addSegment(new LineSegment([xLeft, this.topLeft.y], [xRight, this.topLeft.y]));
                edgeSet.addSegment(new LineSegment([xLeft, other.bottomRight.y], [xRight, other.bottomRight.y]));
            }
        }
        return edgeSet;
    }

    lineIntersections(line)
    //=====================
    {
        return new List(this.edges.lineIntersections(line));
    }

    location(point, delta)
    //====================
    {
        const offset = point.offset(this.centre);
        const W2 = 2*Math.abs(offset[0]);
        const H2 = 2*Math.abs(offset[1]);
        if        (W2 > (this.width + delta) || H2 > (this.height + delta)) {
            return 'outside';
        } else if (W2 < (this.width - delta) && H2 < (this.height - delta)) {
            return 'inside';
        } else if (W2 > (this.width - delta)) {
            if (H2 > (this.height - delta)) {
                if (offset[0] < 0) {
                    return (offset[1] < 0) ? 'top-left' : 'bottom-left';
                } else {
                    return (offset[1] < 0) ? 'top-right' : 'bottom-right';
                }
            } else {
                return (offset[0] < 0) ? 'left' : 'right';
            }
        } else {
            return (offset[1] < 0) ? 'top' : 'bottom';
        }
    }
/*


                       H2 > +delta

                 +---------------------+
                 |                     |
                 |     H2 < -delta     |
                 |                     |
                 |                     |
W2 > +delta      |     W2 < -delta     |      W2 > +delta
                 |                     |
                 |                     |
                 |     H2 < -delta     |
                 |                     |
                 +---------------------+

                      H2 > +delta

*/

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
        this.edges = new LineSegmentSet([new LineSegment(topLeft.translate([xCornerRadius, 0]),
                                                         topLeft.translate([this.width - xCornerRadius, 0])),
                                         new LineSegment(bottomRight.translate([0, yCornerRadius - this.height]),
                                                         bottomRight.translate([0, -yCornerRadius])),
                                         new LineSegment(bottomRight.translate([-xCornerRadius, 0]),
                                                         bottomRight.translate([xCornerRadius - this.width, 0])),
                                         new LineSegment(topLeft.translate([0, this.height - yCornerRadius]),
                                                         topLeft.translate([0, yCornerRadius]))
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
                points.push(new Point(0, y).translate([this.centre.x, this.centre.y]));
            } else if ( x2 > 0) {
                const x = Math.sqrt(x2);
                points.push(new Point(-x, y).translate([this.centre.x, this.centre.y]));
                points.push(new Point( x, y).translate([this.centre.x, this.centre.y]));
            }
        } else {
            const d2 = Math.pow(l.A*this.xRadius, 2) + Math.pow(l.B*this.yRadius, 2);
            const a = -l.C*l.B*Math.pow(this.yRadius, 2)/d2;
            const b = d2 - Math.pow(l.C, 2);
            if (b === 0) {
                points.push(new Point(-(l.C + a*l.B)/l.A, a).translate([this.centre.x, this.centre.y]));
            } else if (b > 0) {
                const c = -l.A*this.xRadius*this.yRadius*Math.sqrt(b)/d2;
                points.push(new Point(-(l.C + (a + c)*l.B)/l.A, a + c).translate([this.centre.x, this.centre.y]));
                points.push(new Point(-(l.C + (a - c)*l.B)/l.A, a - c).translate([this.centre.x, this.centre.y]));
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

    location(point, delta)
    //====================
    {
        if        (this.outside(point.translate([delta, delta]))) {
            return 'outside';
        } else if (!this.outside(point.translate([-delta, -delta]))) {
            return 'inside';
        } else {
            return 'boundary'; // TODO: 'l, r, t, b, t-l, t-r, b-l, b-r'
        }
    }

    translate(offset)
    //===============
    {
        return new Ellipse(this.centre.translate(offset), this.xRadius, this.yRadius);
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
