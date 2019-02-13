/******************************************************************************

Flatmap viewer and annotation tool

Copyright (c) 2019  David Brooks

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

import Feature from 'ol';
import Overlay from 'ol';

import Projection from 'ol/proj/Projection';
import {Vector as VectorSource} from 'ol/source.js';
import Circle from 'ol/geom/Circle';

import GeoJSON from 'ol/format/GeoJSON.js';
import {Vector as VectorLayer} from 'ol/layer.js';

import {Fill, Stroke, Style, Text} from 'ol/style.js';

import ContextMenu from 'ol-contextmenu';

//==============================================================================

import * as utils from '/static/scripts/utils.js';

//==============================================================================

    /**
     * Elements that make up the popup.
     */
    const container = document.getElementById('popup');
    const content = document.getElementById('popup-content');
    const closer = document.getElementById('popup-closer');

    /**
     * Create an overlay to anchor the popup to the map
     */
    const overlay = new Overlay({
      element: container,
      autoPan: true,
      autoPanAnimation: {
        duration: 250
      }
    });

    /**
     * Add a click handler to hide the popup
     * @return {boolean} Don't follow the href
     */
    closer.onclick = function() {
      overlay.setPosition(undefined);
      closer.blur();
      return false;
    };

    map.addOverlay(overlay);

//==============================================================================

    // From our SVG coordinates to PNG pixels
    const imageOffset = 200;
    const PNGscale = 25;

    const featureJSON = {
      "type": "FeatureCollection",
      "features": [
/*            { "type": "Feature",
          "geometry": {
            "type": "Polygon",
            "coordinates": [[
              [ 2000, 7000],
              [ 4000, 7000],
              [ 4000, 9000],
              [ 2000, 7000]
            ]]
          },
          "properties": {
            "name": "Triangle!"
          }
        },
*/
        pointFeature([PNGscale*(562-imageOffset), PNGscale*618], 'xii'),
        pointFeature([PNGscale*(562-imageOffset), PNGscale*605], 'ix'),
        pointFeature([PNGscale*(562-imageOffset), PNGscale*594], 'x')
      ]
    };

    function pointFeature(coordinates, name)
    {
      return {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: coordinates
        },
        properties: {
          name: name
        }
      };
    }

/*
    const vectorSource = new ol.source.Vector({  dataProjection: ??
      features: (new ol.format.GeoJSON()).readFeatures(featureJSON)
    });
*/

//==============================================================================

/*
    const select = new ol.interaction.Select({filter: (feature, layer) => {
      return (feature === circleFeature);
    }});

    const translate = new ol.interaction.Translate({
      features: select.getFeatures()
    });
        // interactions: ol.interaction.defaults().eend([select]), //, translate]),

*/

//==============================================================================

    /* GeoJSON */

    const vectorSource = new VectorSource({
      format: new GeoJSON({dataProjection: 'user:1000'}),
      url: utils.absoluteUrl('json/features')
    });

    const circleFeature = new Feature(new Circle([9050, 15150], 600));
    vectorSource.addFeature(circleFeature);

    const featureStyle = new Style({
      fill: new Fill({color: 'pink'}),
      text: new Text({
        fill: new Fill({color: 'green'})
      })
    });

    const labels = new VectorLayer({
      title: "Labels",
      source: vectorSource,
      style: (feature, resolution) => {
        //console.log(`style for ${feature.get('name')} at RES: ${resolution}`);
        const styleText = featureStyle.getText();
        const fontSize = 4*Math.sqrt(map.resolutions[0]/resolution);
        styleText.setFont(`bold ${fontSize}px "Open Sans", "Arial Unicode MS", "sans-serif"`);
        styleText.setText(feature.get('name'));
        return featureStyle;
      }
    });

    map.addLayer(labels);

//==============================================================================

/*
    const labeledGanglia = new ol.layer.Group({title: "Ganglia",
                                               layers: [labels, newTileLayer('ganglia')]
                                             });
    // map.addLayer(labeledGanglia);

*/

//==============================================================================

    /* TopoJSON */
/*
    const topologySource = new ol.source.Vector({
      format: new ol.format.TopoJSON({dataProjection: 'user:1000'}),
      url: `${window.location.href}/json/topology`
    });
*/

//==============================================================================

    /* Vector Tiles */

/*
    <!-- Tiled GeoJSON -->
    <!-- <script src="https://mapbox.github.io/geojson-vt/geojson-vt-dev.js"></script> -->
    <script src="/static/third-party/geojson-vt-dev.js"></script>
*/

    /**
     * Map GeoJSON features to Mapbox vector tiles
     *
     * @param      {<type>}  key     The key
     * @param      {<type>}  value   The value
     * @return     {Object}  { description_of_the_return_value }
     */
    function replacer(key, value)
    {
      if (value.geometry) {
        var type;
        var rawType = value.type;
        var geometry = value.geometry;

        if (rawType === 1) {
          type = 'MultiPoint';
          if (geometry.length == 1) {
            type = 'Point';
            geometry = geometry[0];
          }
        } else if (rawType === 2) {
          type = 'MultiLineString';
          if (geometry.length == 1) {
            type = 'LineString';
            geometry = geometry[0];
          }
        } else if (rawType === 3) {
          type = 'Polygon';
          if (geometry.length > 1) {
            type = 'MultiPolygon';
            geometry = [geometry];
          }
        }

        return {
          'type': 'Feature',
          'geometry': {
            'type': type,
            'coordinates': geometry
          },
          'properties': value.tags
        };
      } else {
        return value;
      }
    }

    const tilePixels = new Projection({
      code: 'TILE_PIXELS',
      units: 'tile-pixels'
    });

    function normaliseCoordinates(coords)
    {
      return [(coords[0]/10000) + 0.5, coords[1]/18000];  /* */
    }

/*
    const url = `${window.location.href}/json/triangle`;
    fetch(url).then(function(response) {
      return response.json();
    }).then(function(json) {
      const tileIndex = geojsonvt(json, {
        pointNormaliseFunction: normaliseCoordinates,
        pointTransformFunction: (x, y, extent, z2, tx, ty) => {
          console.log('Transform:', x, y, extent, z2, tx, ty)
          return [
            Math.round(extent * (x * z2 - tx)),
            Math.round(extent * (y * z2 - ty))
          ];
        },
        extent: 256,
        buffer: 16,
//*
        maxZoom: 7,
        indexMaxZoom: 7,
        indexMaxPoints: 0,
* //
        debug: 0
      });
      const vectorSource = new ol.source.VectorTile({
        format: new ol.format.GeoJSON(), // {dataProjection: 'user:1000'}),
        tileGrid: map.tileGrid,
        tileLoadFunction: function(tile) {
          const format = tile.getFormat();
          const tileCoord = tile.getTileCoord();
          const data = tileIndex.getTile(tileCoord[0], tileCoord[1], tileCoord[2]);
console.log(`Request vector tile at ${tileCoord}, tiles=${data}`);
          const features = format.readFeatures(
            JSON.stringify({
              type: 'FeatureCollection',
              features: data ? data.features : []
            }, replacer));
          tile.setLoader(function() {
            tile.setFeatures(features);
            tile.setProjection(tilePixels);  // 'user:1000'
          });
        },
        url: 'data:' // arbitrary url, we don't use it in the tileLoadFunction
      });
      const vectorLayer = new ol.layer.VectorTile({
        title: "Vector tiles",
        source: vectorSource,
        style: new ol.style.Style({
          stroke: new ol.style.Stroke({
            color: '#f00',
            width: 20
          }),
          fill: new ol.style.Fill({color: 'blue'})
        })
      });

      map.addLayer(vectorLayer);
    });
*/

//==============================================================================

    /**
     * Add a click handler to the map to render the popup.
     */
    map.on('singleclick', function(evt) {
      const coordinate = evt.coordinate;
      const coords = `(${coordinate[0]}, ${coordinate[1]})`;
      //content.innerHTML = '<p>Clicked at <code>' + coords + '</code></p>';
      content.innerHTML = '<form>Prompt: <input type="text" id="xx"/><input type="button" value="XX"/></form>';
      overlay.setPosition(coordinate);
    });


//==============================================================================

    /* Context menu */

    function actionClick(action, evt)
    {
      alert(`Action ${action}...`)
    }

    const contextmenu = new ContextMenu({
      width: 170,
      defaultItems: true, // defaultItems are (for now) Zoom In/Zoom Out
      items: [
        {
          text: 'Some Actions',
          items: [{ // <== this is a submenu
            text: 'Action 1',
            callback: (...args) => actionClick('1', ...args)
          }, {
            text: 'Other action',
            callback: (...args) => actionClick('2', ...args)
          }]
        }, {
          text: 'Add a Marker',
          icon: '/static/images/marker.png',
          callback: (...args) => actionClick('3', ...args)
        },
        '-' // this is a separator
      ]
    });
    contextmenu.on('open', function (evt) {
      setTimeout(() => contextmenu.close(), 5000);
    });
    map.addControl(contextmenu);

//==============================================================================
