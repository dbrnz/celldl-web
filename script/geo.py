'''
>>>
>>> x, y, R, A, B, C = symbols('x y R A B C')

line = A*x + B*y + C

circle = x**2 + y**2 - R**2

intersection = nonlinsolve([circle, line], [x, y])

x0, y0 = list(intersection)[0]

>>> (x0*A + C)/B
       ____________________
      /  2  2    2  2    2
  A*\/  A *R  + B *R  - C       B*C
- ------------------------- + -------
            2    2             2    2
           A  + B             A  + B
>>> y0
     ____________________
    /  2  2    2  2    2
A*\/  A *R  + B *R  - C       B*C
------------------------- - -------
          2    2             2    2
         A  + B             A  + B
>>>


x1, y1 = list(intersection)[1]

>>> (x1*A + C)/B
     ____________________
    /  2  2    2  2    2
A*\/  A *R  + B *R  - C       B*C
------------------------- + -------
          2    2             2    2
         A  + B             A  + B
>>> y1
       ____________________
      /  2  2    2  2    2
  A*\/  A *R  + B *R  - C       B*C
- ------------------------- - -------
            2    2             2    2
           A  + B             A  + B


ellipse = (x/Rx)**2 + (y/Ry)**2 - 1

eint = nonlinsolve([line, ellipse], [x, y])


>>> (x0*A + C)/B
             ______________________
            /  2   2    2   2    2              2
  A*Rx*Ry*\/  A *Rx  + B *Ry  - C         B*C*Ry
- --------------------------------- + ---------------
            2   2    2   2             2   2    2   2
           A *Rx  + B *Ry             A *Rx  + B *Ry

>>> y0
           ______________________
          /  2   2    2   2    2              2
A*Rx*Ry*\/  A *Rx  + B *Ry  - C         B*C*Ry
--------------------------------- - ---------------
          2   2    2   2             2   2    2   2
         A *Rx  + B *Ry             A *Rx  + B *Ry


>>> (x1*A + C)/B
           ______________________
          /  2   2    2   2    2              2
A*Rx*Ry*\/  A *Rx  + B *Ry  - C         B*C*Ry
--------------------------------- + ---------------
          2   2    2   2             2   2    2   2
         A *Rx  + B *Ry             A *Rx  + B *Ry

>>> y1
             ______________________
            /  2   2    2   2    2              2
  A*Rx*Ry*\/  A *Rx  + B *Ry  - C         B*C*Ry
- --------------------------------- - ---------------
            2   2    2   2             2   2    2   2
           A *Rx  + B *Ry             A *Rx  + B *Ry

'''
from math import sqrt


class Point(object):
    def __init__(self, x, y):
        self.x = x
        self.y = y

    def __str__(self):
        return 'Point({}, {})'.format(self.x, self.y)


class ProjectiveLine(object):
    def __init__(self, A, B, C):
        # Coordinates are in the projective plane
        # such that Ax + By + C = 0
        if (A == 0 and B == 0):
            raise ValueError('Invalid projective line coordinates')
        self.A = A
        self.B = B
        self.C = C
        self.norm2 = self.A**2 + self.B**2

    def __str__(self):
        return 'Line ({}, {}, {})'.format(A, B, C)

    def intersect_circle(self, circle):
        # Note: formulae were derived by using Sympy to find
        #       intersection points

        # Translate our line so that it corresponds to the circle
        # having its centre at the origin
        if circle.centre.x == 0 and circle.centre.y == 0:
            line = self
        else:
            line = self.translate(-circle.centre.x, -circle.centre.y)

        if line.A == 0:
            y = -line.C/line.B
            x2 = circle.radius**2 - y**2
            y += circle.centre.y
            if x2 < 0:
                return []
            elif x2 == 0:
                return [Point(circle.centre.x, y)]
            else:
                x = sqrt(x2) + circle.centre.x
                return [Point(-x, y), Point(x, y)]
        else:
            a = -line.C*line.B/line.norm2
            b = line.norm2*circle.radius**2 - line.C**2
            if b < 0:
                return []
            elif b == 0:
                return [Point(-(line.C + a*line.B)/line.A + circle.centre.x, a + circle.centre.y)]
            else:
                c = -line.A*sqrt(b)/line.norm2
                return [Point(-(line.C + (a + c)*line.B)/line.A + circle.centre.x, (a + c) + circle.centre.y),
                        Point(-(line.C + (a - c)*line.B)/line.A + circle.centre.x, (a - c) + circle.centre.y)]

    def intersect_ellipse(self, ellipse):
        # Note: formulae were derived by using Sympy to find
        #       intersection points

        # Translate our line so that it corresponds to the ellipse
        # having its centre at the origin
        if ellipse.centre.x == 0 and ellipse.centre.y == 0:
            line = self
        else:
            line = self.translate(-ellipse.centre.x, -ellipse.centre.y)

        if line.A == 0:
            y = -line.C/line.B
            x2 = ellipse.x_radius**2 - (y*ellipse.x_radius/ellipse.y_radius)**2
            y += ellipse.centre.y
            if x2 < 0:
                return []
            elif x2 == 0:
                return [Point(ellipse.centre.x, y)]
            else:
                x = sqrt(x2) + ellipse.centre.x
                return [Point(-x, y), Point(x, y)]
        else:
            d2 = (line.A*ellipse.x_radius)**2 + (line.B*ellipse.y_radius)**2
            a = -(line.C*line.B*ellipse.y_radius**2)/d2
            b = d2 - line.C**2
            if b < 0:
                return []
            elif b == 0:
                return [Point(-(line.C + a*line.B)/line.A + ellipse.centre.x, a + ellipse.centre.y)]
            else:
                c = -line.A*ellipse.x_radius*ellipse.y_radius*sqrt(b)/d2
                return [Point(-(line.C + (a + c)*line.B)/line.A + ellipse.centre.x, (a + c) + ellipse.centre.y),
                        Point(-(line.C + (a - c)*line.B)/line.A + ellipse.centre.x, (a - c) + ellipse.centre.y)]

    def parallel_line(self, offset):
        return ProjectiveLine(self.A, self.B, self.C + offset*sqrt(self.norm2))

    def distance_from(self, point):
        return abs(point.x*self.A + point.y*self.B + self.C)/sqrt(self.norm2)

    def translate(self, x_offset, y_offset):
        return ProjectiveLine(self.A, self.B, self.C - (x_offset*self.A + y_offset*self.B))


class LineSegment(ProjectiveLine):
    def __init__(self, start, end):
        if isinstance(start, tuple):
            start = Point(*start)
        if isinstance(end, tuple):
            end = Point(*end)
        super().__init__(end.y - start.y,
                         start.x - end.x,
                         end.x*start.y - start.x*end.y)
        self.start = start
        self.end = end

class Ellipse(object):
    def __init__(self, centre, x_radius, y_radius):
        self.centre = centre
        self.x_radius = x_radius
        self.y_radius = y_radius


class Circle(Ellipse):
    def __init__(self, centre, radius):
        super().__init__(centre, radius, radius)
        self.radius = radius


class LineString(object):
    def __init__(self, end_points, close=False):
        self._segments = []
        for n in range(len(end_points)-1):
            self._segments.append(LineSegment(end_points[n], end_points[n+1]))
        if close:
            self._segments.append(LineSegment(end_points[-1], end_points[0]))


class Polygon(object):
    def __init__(self, points):
        self._boundary = LineString(points, True)


class Rectangle(Polygon):
    def __init__(self, top_left, bottom_right):
        pass

class RoundedRectangle(object):
    def __init__(self, top_left, bottom_right, corner_radius):
        pass


if __name__ == '__main__':
    c0 = Circle(Point(0, 0), 8)
    cx = Circle(Point(2, 0), 8)
    cy = Circle(Point(0, 2), 8)

    l0 = LineSegment(Point(0, -1), (0, 1))
    lx = LineSegment(Point(2, -1), (2, 1))
    ly = LineSegment(Point(-1, 2), (1, 2))
    lines = [l0, lx, ly]

    for l in lines:
        print([str(p) for p in l.intersect_circle(c0)])
        print([str(p) for p in l.intersect_ellipse(c0)])

    for l in lines:
        print([str(p) for p in l.intersect_circle(cx)])
        print([str(p) for p in l.intersect_ellipse(cx)])

    for l in lines:
        print([str(p) for p in l.intersect_circle(cy)])
        print([str(p) for p in l.intersect_ellipse(cy)])
