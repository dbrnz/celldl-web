Specification
-------------

* Map consists of layers
* Layer order -- bottom layer is base.
* Layer name
* Image file (==> dimensions and dpi)
* Transform image (affine) onto map layer
* Create tiles for tile map server (TMS)

Layers
------

* Implement reordering of layers

Features
--------

* Primitives: point, polygon, polyline
* Multiples of primitives?
* Splines??  Chaikin's algorithm (https://www.npmjs.com/package/chaikin-smooth,
  https://openlayers.org/en/latest/examples/chaikin.html)
* Show feature labels on hover
* Behaviour when clicked; when double-clicked; when right clicked.
* Selection

Tiled features
~~~~~~~~~~~~~~

* https://openlayers.org/en/latest/examples/geojson-vt.html
* https://blog.mapbox.com/rendering-big-geodata-on-the-fly-with-geojson-vt-4e4d2a5dd1f2

Edit mode
~~~~~~~~~

* From context menu of selected feature
* Allow features to be dragged
* Click/select brings up annotation dialog
* Pulldown list of names/labels/URIs
* Filter by system (layer) name
* Send JSON back to server -- layer, URI, feature type, coordinates

Backend JSON storage
--------------------

* NO SQL engine?
* Versioning?
* ``/<map>/features`` AND ``/<map>/features/<layer>``

* https://github.com/topojson/topojson-server/
* https://github.com/topojson/topojson-client
