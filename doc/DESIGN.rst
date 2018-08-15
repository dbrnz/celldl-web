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

- wrt. diagram or container

    + `LENGTH, LENGTH`

- wrt. other elements

    + `LENGTH RELATION ID_LIST [, LENGTH RELATION ID_LIST]`

- `boundary` elements are in terms of their container:

    + `SIDE LENGTH`

::

LENGTH ::= NUMBER[UNIT]

UNIT ::= 'px' | %' | '%v' | '%w' | 'vw' | 'vh'

SIDE ::= 'left' | 'right' | 'top' | 'bottom'

ID_LIST ::= ID+   // One or more IDs

ID ::= '#'ELEMENT_ID

RELATION ::= 'left' | 'right' | 'above' | 'below'


Diagram layout
==============

- Group positions are wrt parent group and sibling groups.

    + Position dependency graph of siblings

- Component positions are wrt groups and components.

    + Position dependency graph

- First layout (position) groups.
- Then position components.
- Units for positions and sizes:

    + absolute (no units or `px`)
    + wrt. container (`%`, `%w`, `%h`)
    + wrt. diagram's viewport (`vw`, `vh`)

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

    + absolute (no units or `px`)
    + wrt. diagram viewport's diagonal (`%`)


Editing
=======

* Maintain a live SVG display of CellDL XML editor contents.
* Each bond graph element has line number of source.
* `add` element results in CellDL XML being added.
* Modifying attributes also updates CellDL.

Moving and resizing elements
----------------------------

- Those with `type="boundary"` are to be constrained to a boundary.
- When a group's geometry changes then positions/sizes of sibling and child groups
  need recalculating and that of *all* components that have some (indirect)
  dependency on the group.
- When a component's geometry changes then positions/sizes of *all* components that
  have some (indirect) dependency on the component.