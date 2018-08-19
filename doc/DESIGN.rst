Structure
=========

- Relationships, connections
- Diagram
    - Components
        - Group
            - Component
            - Group
        - Component
    - Bond graph
    - Cell diagram


Styling
=======

- Colours, positions, sizes

Positions
---------

- wrt. diagram or container: ``LENGTH_PAIR``
- wrt. other elements: ``LENGTH DIRECTION ID_LIST [, LENGTH DIRECTION ID_LIST]``
- ``boundary`` elements are in terms of their container: ``SIDE LENGTH``

::

    LENGTH ::= NUMBER[UNIT]

    UNIT ::= 'px' | %' | '%v' | '%w' | 'vw' | 'vh'

    LENGTH_PAIR ::= LENGTH, LENGTH

    DIRECTION ::= 'left' | 'right' | 'above' | 'below'

    SIDE ::= 'left' | 'right' | 'top' | 'bottom'

    ID_LIST ::= ID+   // One or more IDs

    ID ::= '#'ELEMENT_ID


- Hierarchical positioning
    - An element's position can depend on those of its siblings and any element
      at a higher level in the diagram. In the following, ``cm2`` may depend on
      ``gr1``, ``cm1``, ``gr2`` and ``gr0``, while ``gr3`` may depend on ``gr4``,
      ``cm3``, ``gr1``, ``cm1``, ``gr2`` and ``gr0``.
    - This means that ``Group.layout()`` needs to position the group's children before
      laying out any sub-groups.


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


