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

//==============================================================================

export class Point
{
    constructor(x, y)
    {
        this.x = x;
        this.y = y;
    }

    toString()
    {
        return "Point({}, {})".format(this.x, this.y);
    }

    equal(other)
    {
        return ((this.x === other.x) && (this.y === other.y));
    }

    notEqual(other)
    {
        return ((this.x !== other.x) || (this.y !== other.y));
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
}

//==============================================================================

export class ProjectiveLine
{
    constructor(A, B, C)
    {
        if ((A === 0) && (B === 0)) {
            throw new exception.ValueError("Invalid projective line coordinates");
        }
        this.A = A;
        this.B = B;
        this.C = C;
        this.norm2 = Math.pow(this.A, 2) + Math.pow(this.B, 2);
    }

    toString() {
        return "Line ({}, {}, {})".format(A, B, C);
    }

    parallel_line(offset) {
        return new ProjectiveLine(this.A, this.B, this.C + offset*sqrt(this.norm2));
    }

    distance_from(point) {
        return abs(point.x*this.A + point.y*this.B + this.C)/sqrt(this.norm2);
    }

    translate(offset) {
        return new ProjectiveLine(this.A, this.B, this.C - offset[0]*this.A + offset[1]*this.B);
    }
}

//==============================================================================

export class LineSegment extends ProjectiveLine
{
    constructor(start, end)
    {
        if (start instanceof tuple) {
            start = new Point(...start);
        }
        if (end instanceof tuple) {
            end = new Point(...end);
        }
        super(end.y - start.y, start.x - end.x, end.x*start.y - start.x*end.y);
        this.start = start;
        this.end = end;
    }
}

//==============================================================================

export class Ellipse
{
    constructor(centre, x_radius, y_radius)
    {
        if ((x_radius === 0) || (y_radius === 0)) {
            throw new exception.ValueError("Invalid radius");
        }
        if (centre instanceof tuple) {
            centre = new Point(...centre);
        }
        this.centre = centre;
        this.x_radius = x_radius;
        this.y_radius = y_radius;
    }

    line_intersect(line)
    {
        if ((this.centre.x !== 0) || (this.centre.y !== 0)) {
            line = line.translate([-this.centre.x, -this.centre.y]);
        }
        if (line.A === 0) {
            let y = -line.C/line.B;
            const x2 = Math.pow(this.x_radius, 2) - Math.pow(y*this.x_radius/this.y_radius, 2);
            y += this.centre.y;
            if (x2 < 0) {
                return [];
            } else {
                if (x2 === 0) {
                    return [new Point(this.centre.x, y)];
                } else {
                    const x = sqrt(x2) + this.centre.x;
                    return [new Point(-x, y), new Point(x, y)];
                }
            }
        } else {
            const d2 = Math.pow(line.A*this.x_radius, 2) + Math.pow(line.B*this.y_radius, 2);
            const a = -line.C*line.B*Math.pow(this.y_radius, 2)/d2;
            const b = d2 - Math.pow(line.C, 2);
            if (b < 0) {
                return [];
            } else {
                if (b === 0) {
                    return [new Point(-(line.C + a*line.B)/line.A, a).add([this.centre.x, this.centre.y])];
                } else {
                    const c = -line.A*this.x_radius*this.y_radius*sqrt(b)/d2;
                    return [new Point(-(line.C + (a + c)*line.B)/line.A, a + c).add([this.centre.x, this.centre.y]),
                            new Point(-(line.C + (a - c)*line.B)/line.A, a - c).add([this.centre.x, this.centre.y])];
                }
            }
        }
    }

    contains(point)
    {
        return (Math.pow((point.x - this.centre.x)/this.x_radius, 2)
              + Math.pow((point.y - this.centre.y)/this.y_radius, 2) < 1.0);
    }

    translate(offset)
    {
        return new Ellipse(this.centre.add(offset), this.x_radius, this.y_radius);
    }
}

//==============================================================================

export class Circle extends Ellipse
{
    constructor(centre, radius)
    {
        if (centre instanceof tuple) {
            centre = new Point(...centre);
        }
        super(centre, radius, radius);
        this.radius = radius;
    }
}

//==============================================================================

export class LineString
{
    constructor(end_points, close = false) {
        this._segments = [];
        for (let n = 0; n < (end_points.length - 1); n += 1) {
            this._segments.append(new LineSegment(end_points[n], end_points[n + 1]));
        }
        if (close) {
            this._segments.append(new LineSegment(end_points.slice(-1)[0], end_points[0]));
        }
    }
}

//==============================================================================

export class Polygon
{
    constructor(points)
    {
        this._boundary = new LineString(points, true);
    }
}

//==============================================================================

export class Rectangle extends Polygon
{
    constructor(top_left, bottom_right)
    {
        if (top_left instanceof tuple) {
            top_left = new Point(...top_left);
        }
        if (bottom_right instanceof tuple) {
            bottom_right = new Point(...bottom_right);
        }
        if ((top_left === bottom_right)) {
            throw new exception.ValueError("Rectangle has no size");
        }
        this.width = abs(top_left.x - bottom_right.x);
        this.height = abs(top_left.y - bottom_right.y);
        this.centre = new Point((top_left.x + bottom_right.x)/2.0, (top_left.y + bottom_right.y)/2.0);
        this.top_left = this.centre.subtract([this.width/2.0, this.height/2.0]);
        this.bottom_right = this.centre.add([this.width/2.0, this.height/2.0]);
    }

    contains(point)
    {
        const offset = point.offset(this.centre);
        return 0 < offset[0] && offset[0] < this.width
            && 0 < offset[1] && offset[1] < this.height;
    }
}

//==============================================================================

export class RoundedRectangle extends Rectangle
{
    constructor(top_left, bottom_right, x_corner_radius = 0, y_corner_radius = 0)
    {
        super(top_left, bottom_right);
        if (y_corner_radius === 0) {
            y_corner_radius = x_corner_radius;
        }
        if (((((x_corner_radius < 0) || (x_corner_radius > (this.width / 2.0))) || (y_corner_radius < 0)) || (y_corner_radius > (this.height / 2.0)))) {
            throw new exception.ValueError("Invalid corner radius");
        }
        this.x_corner_radius = x_corner_radius;
        this.y_corner_radius = y_corner_radius;
        if (x_corner_radius === 0 && y_corner_radius === 0) {
            this.inner_rectangle = new Rectangle(top_left, bottom_right);
            this.corner_ellipse = null;
        } else {
            const w_2 = (this.width - x_corner_radius)/2.0;
            const h_2 = (this.height - y_corner_radius)/2.0;
            this.inner_rectangle = new Rectangle(new Point(this.centre.x).subtract([w_2, h_2]),
                                                 new Point(this.centre.x).add([w_2, h_2]));
            this.corner_ellipse = new Ellipse(this.centre, x_corner_radius, y_corner_radius);
        }
    }

    contains(point)
    {
        if (x_corner_radius === 0 && y_corner_radius === 0) {
            return super.contains(point);
        } else {
            return this.inner_rectangle.contains(point)
                || this.corner_ellipse.translate([-this.width/2.0, -this.height/2.0]).contains(point)
                || this.corner_ellipse.translate([-this.width/2.0,  this.height/2.0]).contains(point)
                || this.corner_ellipse.translate([ this.width/2.0, -this.height/2.0]).contains(point)
                || this.corner_ellipse.translate([ this.width/2.0,  this.height/2.0]).contains(point);
                // Or the side lobes...
        }
    }
}

//==============================================================================

export function test()
{
    const c0 = new Circle(new Point(0, 0), 8);
    const cx = new Circle(new Point(2, 0), 8);
    const cy = new Circle(new Point(0, 2), 8);
    const circles = [c0, cx, cy];
    const l0 = new LineSegment(new Point(0, (- 1)), [0, 1]);
    const lx = new LineSegment(new Point(2, (- 1)), [2, 1]);
    const ly = new LineSegment(new Point((- 1), 2), [1, 2]);
    const lines = [l0, lx, ly];

    for (let l of lines) {
        for (let c of circles) {
            let s = [];
            for (let p of c.line_intersect(l)) {
                s.push(p.toString());
            }
            console.log(s);
        }
    }
}

//==============================================================================
