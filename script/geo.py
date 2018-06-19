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

    def __eq__(self, other):
        return self.x == other.x and self.y == other.y

    def __ne__(self, other):
        return self.x != other.x or self.y != other.y

    def __add__(self, offset):
        return Point(self.x + offset[0], self.y + offset[1])

    def __sub__(self, offset):
        return Point(self.x - offset[0], self.y - offset[1])

    def offset(self, other):
        return (self.x - other.x, self.y - other.y)


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

    def parallel_line(self, offset):
        return ProjectiveLine(self.A, self.B, self.C + offset*sqrt(self.norm2))

    def distance_from(self, point):
        return abs(point.x*self.A + point.y*self.B + self.C)/sqrt(self.norm2)

    def translate(self, offset):
        return ProjectiveLine(self.A, self.B, self.C - (offset[0]*self.A + offset[1]*self.B))


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
        if x_radius == 0 or y_radius == 0:
            raise ValueError('Invalid radius')
        if isinstance(centre, tuple):
            centre = Point(*centre)
        self.centre = centre
        self.x_radius = x_radius
        self.y_radius = y_radius

    def line_intersect(self, line):
        # Note: formulae were derived by using Sympy to find
        #       intersection points

        # Translate our line so that it corresponds to the ellipse
        # having its centre at the origin
        if self.centre.x != 0 or self.centre.y != 0:
            line = line.translate((-self.centre.x, -self.centre.y))

        if line.A == 0:
            y = -line.C/line.B
            x2 = self.x_radius**2 - (y*self.x_radius/self.y_radius)**2
            y += self.centre.y
            if x2 < 0:
                return []
            elif x2 == 0:
                return [Point(self.centre.x, y)]
            else:
                x = sqrt(x2) + self.centre.x
                return [Point(-x, y), Point(x, y)]
        else:
            d2 = (line.A*self.x_radius)**2 + (line.B*self.y_radius)**2
            a = -(line.C*line.B*self.y_radius**2)/d2
            b = d2 - line.C**2
            if b < 0:
                return []
            elif b == 0:
                return [Point(-(line.C + a*line.B)/line.A, a) + (self.centre.x, self.centre.y)]
            else:
                c = -line.A*self.x_radius*self.y_radius*sqrt(b)/d2
                return [Point(-(line.C + (a + c)*line.B)/line.A, (a + c)) + (self.centre.x, self.centre.y),
                        Point(-(line.C + (a - c)*line.B)/line.A, (a - c)) + (self.centre.x, self.centre.y)]

    def contains(self, point):
        return (((point.x - self.centre.x)/self.x_radius)**2
              + ((point.y - self.centre.y)/self.y_radius)**2) < 1.0

    def translate(self, offset):
        return Ellipse(self.centre + offset, self.x_radius, self.y_radius)


class Circle(Ellipse):
    def __init__(self, centre, radius):
        if isinstance(centre, tuple):
            centre = Point(*centre)
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
        if isinstance(top_left, tuple):
            top_left = Point(*top_left)
        if isinstance(bottom_right, tuple):
            bottom_right = Point(*bottom_right)
        if top_left == bottom_right:
            raise ValueError('Rectangle has no size')
        self.width = abs(top_left.x - bottom_right.x)
        self.height = abs(top_left.y - bottom_right.y)
        self.centre = Point((top_left.x + bottom_right.x)/2.0,
                            (top_left.y + bottom_right.y)/2.0)
        self.top_left = self.centre - (self.width/2.0, self.height/2.0)
        self.bottom_right = self.centre + (self.width/2.0, self.height/2.0)

    def contains(self, point):
        return ((0 < (point.x - self.centre.x) < self.width)
            and (0 < (point.y - self.centre.y) < self.height))

class RoundedRectangle(Rectangle):
    def __init__(self, top_left, bottom_right, x_corner_radius=0, y_corner_radius=0):
        super().__init__(top_left, bottom_right)
        if y_corner_radius == 0:
            y_corner_radius = x_corner_radius
        if (x_corner_radius < 0 or x_corner_radius > self.width/2.0
         or y_corner_radius < 0 or y_corner_radius > self.height/2.0):
            raise ValueError('Invalid corner radius')
        self.x_corner_radius = x_corner_radius
        self.y_corner_radius = y_corner_radius
        if x_corner_radius == 0 and y_corner_radius == 0:
            self.inner_rectangle = Rectangle(top_left, bottom_right)
            self.corner_ellipse = None
        else:
            w_2 = (self.width - x_corner_radius)/2.0
            h_2 = (self.height - y_corner_radius)/2.0
            self.inner_rectangle = Rectangle(Point(self.centre.x) - (w_2, h_2),
                                             Point(self.centre.x) + (w_2, h_2))
            self.corner_ellipse = Ellipse(self.centre, x_corner_radius, y_corner_radius)

    def contains(self, point):
        if x_corner_radius == 0 and y_corner_radius == 0:
            return super().contains(point)
        else:
            return (self.inner_rectangle.contains(point)
                 or self.corner_ellipse.translate(-self.width/2.0, -self.height/2.0).contains(point)
                 or self.corner_ellipse.translate(-self.width/2.0,  self.height/2.0).contains(point)
                 or self.corner_ellipse.translate( self.width/2.0, -self.height/2.0).contains(point)
                 or self.corner_ellipse.translate( self.width/2.0,  self.height/2.0).contains(point))


if __name__ == '__main__':
    c0 = Circle(Point(0, 0), 8)
    cx = Circle(Point(2, 0), 8)
    cy = Circle(Point(0, 2), 8)
    circles = [c0, cx, cy]

    l0 = LineSegment(Point(0, -1), (0, 1))
    lx = LineSegment(Point(2, -1), (2, 1))
    ly = LineSegment(Point(-1, 2), (1, 2))
    lines = [l0, lx, ly]

    for l in lines:
        for c in circles:
            print([str(p) for p in c.line_intersect(l)])
