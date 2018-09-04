Structure
=========

- Diagram
    - Made up of different types of ``Elements``.
    - Relationships and connections between elements.
    - Flatmap
        - Group
            - Component
            - Group
        - Component
    - Bond graph
      - Nodes and edges.
    - Cell diagram

Sets of elements
----------------

* A Diagram knows of all its constituent elements -- used for lookup by ``id``,
layout/positioning, and generating SVG.

Container elements
------------------

* An element may be a ``container`` element, meaning that other elements (including other container elements) may be contained by the element.
* All of a flatmap's ``Components`` may be containers (this means that the concept of a ``Groups`` is no longer required).


Styling
=======

- Colours, positions, sizes

Colours
-------

- Default stylesheet is implicitely loaded from web


Positions
---------

::

    POSITION ::= LENGTH_PAIR | RELATIVE_POSITION | BOUNDARY_POSITION

    LENGTH_PAIR ::= LENGTH, LENGTH

    LENGTH ::= NUMBER[UNITS]  // No UNITS ==> '%'

    UNITS ::= 'px' | '%' | '%v' | '%w' | 'vw' | 'vh'

    RELATIVE_POSITION ::= LENGTH DIRECTION ID_LIST [, LENGTH DIRECTION ID_LIST]

    DIRECTION ::= 'left' | 'right' | 'above' | 'below'

    ID_LIST ::= ID+          // One or more IDs

    ID ::= '#'ELEMENT_ID

    // type="boundary" elements are in terms of their container

    BOUNDARY_POSITION ::= SIDE LENGTH

    SIDE ::= 'left' | 'right' | 'top' | 'bottom'

- Extend to allow relative positions from the side of an element?? ::

    RELATIVE_SIDE_POSITION ::= LENGTH DIRECTION ID SIDE


- Hierarchical positioning
    - An element's position can depend on those of its siblings and any element
      at a higher level in the diagram. In the following, ``cm2`` may depend on
      ``gr1``, ``cm1``, ``gr2`` and ``gr0``, while ``gr3`` may depend on ``gr4``,
      ``cm3``, ``gr1``, ``cm1``, ``gr2`` and ``gr0``.
    - This means that ``Group.layout()`` needs to position the group's children before
      laying out any sub-groups.
    - **This is being replaced by general position dependencies**

::

                gr0
                /|\
               / | \
              /  |  \
             /   |   \
           gr1  cm1  gr2
           /         /|\
          /         / | \
         /         /  |  \
        /         /   |   \
      cm2       gr3  gr4  cm3


Sizes
-----

::

  SIZE ::= ::= LENGTH, LENGTH


Position and size dependencies
++++++++++++++++++++++++++++++

Lengths, sizes and positions may depend either implicitely or explicitly on the sizes and
positions of other elements and/or the diagram's dimensions:

* Viewport units (`vw` and `vh`) are in terms of the diagram's size.
* Percentage units (`%`, `%w`, `%h`) are in terms of the size of the element's container.
* A relatively positioned element explicitly specifies those elements it depends on.


Diagram layout
==============

- Group positions are wrt parent group and sibling groups.
    - Position dependency graph of siblings

- Component positions are wrt groups and components.
    - Position dependency graph

- First layout (position) groups.
- Then position components.
- Units for positions and sizes:
    - absolute (no units or ``px``)
    - wrt. container (``%``, ``%w``, ``%h``)
    - wrt. diagram's viewport (``vw``, ``vh``)

::

    layout(list_of_elements):
        build dependency graph
        position elements in dependency order


- Diagram
    - Components
        - Group
            - Component
            - Group
        - Component


- Stroke-width units (element boundaries and connecting lines):
    - absolute (no units or ``px``)
    - wrt. diagram viewport's diagonal (``%``)


Rendering SVG
=============

1. Draw all containers in XML order.
2. Draw all connections.
3. Draw all non-container elements (in XML order).

Should we draw connections last??


Connections
===========

- Lines between components (elments).
- ``line-start`` and ``line-end`` style attributes:

::

    CONSTRAINT :: = [SIDE_CONSTRAINT] ANGLE UNTIL [OFFSET] ID_LIST [LINE_OFFSET]

    SIDE_CONSTRAINT ::= LENGTH [SIDE]

    ANGLE ::= NUMBER

    UNTIL ::= 'until-x' | 'until-y'

    LINE_OFFSET ::= 'offset(' LENGTH_PAIR ')'

    OFFSET ::= LENGTH DIRECTION


Graphical editor
================

* Maintain a live SVG display of CellDL XML editor contents.
* Each bond graph element has line number of source.
* Adding an element results in CellDL XML being added.
* Modifying attributes also updates CellDL.

Moving and resizing elements
----------------------------

- Those with ``type="boundary"`` are to be constrained to a boundary.
- When a group's geometry changes then positions/sizes of sibling and child groups
  need recalculating and that of **all** components that have some (indirect)
  dependency on the group.
- When a component's geometry changes then positions/sizes of **all** components that
  have some (indirect) dependency on the component.

Saving moved/resized state
--------------------------

- ``<style id="manual_adjustments">`` block contains rules, selected by element ID, for each
   moved/resized element.
- ``Position`` objects have ``toText()`` and ``adjust(offset)`` methods that respectively return
  a textual representation of the current position rule and adjust the current rule by an offset.


Context menu
------------

- Based on https://github.com/callmenick/Custom-Context-Menu


Diagram class hierarchy
=======================

::

    DiagramElement
      - position, size, geometry, connections
      - draggable
      - geometry is a Circle

      ContainerElement extends DiagramElement
        - contains DiagramElement objects, ``this.elements``
        - ``layoutElements``

      RectangularElement mixin
        - resizable
        - geometry is a Rectangle

    Group == ContainerElement + RectangularElement mixin

    Component == DiagramElement + RectangularElement mixin

    Diagram == ContainerElement but **not** draggable and no connections.


