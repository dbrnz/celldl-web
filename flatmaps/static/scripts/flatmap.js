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

import {Map as olMap} from 'ol';
import {View as olView} from 'ol';

import Projection from 'ol/proj/Projection';
import TileGrid from 'ol/tilegrid/TileGrid';
import TileImage from 'ol/source/TileImage';
import TileLayer from 'ol/layer/Tile';

import {OverviewMap} from 'ol/control.js';
import {TileDebug} from 'ol/source.js';

import LayerSwitcher from 'ol-layerswitcher';

//==============================================================================

import * as utils from '/static/scripts/utils.js';

//==============================================================================

export class FlatMap extends olMap
{
    /**
     * Create and display a new FlatMap
     *
     * @param      {string}  htmlElementId  The HTML element identifier in which to display the map
     * @param      {Object}  configuration  The maps's configuration
     * @param      {string}  configuration.id  An identifier for the map
     * @param      {Array<number>}  configuration.size   A two-long array giving the map's [width, height]
     * @param      {boolean}  [configuration.debug=false]  Add a layer showing the grid tiles
     * @param      {boolean}  [configuration.editable=false]  Allow features to be edited
     * @param      {string}  [features]  The map's features are in `/{id}/features/{features}`
     * @param      {boolean}  [configuration.layerSwitcher=false]  Add a control to control layer visibility
     * @param      {boolean}  [configuration.overviewMap=false]  Add a control to show an overview map
     * @param      {Array<Object>}  configuration.imageTileLayers  Details of raster image layers
     * @param      {string}  [configuration.imageTileLayers.title]  The layer's title. A layer will only appear in the
     *                                                              layer switcher if it has title
     * @param      {string}  [configuration.imageTileLayers.featureSource]  The layer's features are in `/{id}/features/{featureSource}`
     * @param      {string}  [configuration.imageTileLayers.rasterSource]  The layer's tiles are in `/{id}/tiles/{rasterSource}/`
     */
    constructor(htmlElementId, configuration)
    {
        const tileSize = 256;
        const maxDimension = Math.max(configuration.size[0], configuration.size[1]);

        let maxZoom = 0;
        for (let dimension = maxDimension/tileSize; dimension >= 1; ) {
            dimension /= 2;
            maxZoom += 1;
        }

        const startResolution = 2**maxZoom;
        const mapResolutions = new Array(22);
        for (let i = 0, ii = mapResolutions.length; i < ii; ++i) {
            mapResolutions[i] = startResolution / Math.pow(2, i);
        }

        const mapExtent = [0, 0, configuration.size[0], configuration.size[1]];

        const mapGrid = new TileGrid({
            origin: [0, 0],
            extent: mapExtent,
            tileSize: tileSize,
            resolutions: mapResolutions
        });

        const mapProjection = new Projection({
            units: 'm',
            worldExtent: mapExtent
        });

        const mapView =  new olView({
            projection: mapProjection,
            resolutions: mapResolutions,
            center: [configuration.size[0]/2,
                     configuration.size[1]/2],
            zoom: 2,
            maxZoom: maxZoom
          });

        super({
            target: htmlElementId,
            view: mapView,
            loadTilesWhileInteracting: true,
            loadTilesWhileAnimating: true
          });

        this.id = configuration.id;
        this.projection = mapProjection;
        this.resolutions = mapResolutions;
        this.tileGrid = mapGrid;

        // Add a debugging grid if option set and make
        // sure it's visible if we can't switch layers

        if (configuration.debug) {
            this.addLayer(new TileLayer({
                title: 'Grid',
                visible: !configuration.layerSwitcher,
                source: new TileDebug({
                  tileGrid: mapGrid,
                  projection: mapProjection
                })
            }));
        }

        // Add image tile layers

        for (let tileLayer of configuration.imageTileLayers) {
            this.addImageTileLayer(tileLayer);
        }

        // Add a layer switcher if option set

        if (configuration.layerSwitcher) {
            const layerSwitcher = new LayerSwitcher();
            this.addControl(layerSwitcher);
        }

        // Add an overview map if option set

        if (configuration.overviewMap) {
            this.addControl(new OverviewMap({
                view: new olView({
                    projection: mapProjection,
                    resolutions: mapResolutions,
                    center: [configuration.size[0]/2,
                             configuration.size[1]/2],
                    zoom: 3,
                    maxZoom: maxZoom
                })
              })
            );
        }
    }

    addImageTileLayer(tileLayer)
    {
        this.addLayer(new TileLayer({
            title: tileLayer.title,
            source: new TileImage({
                tileGrid: this.tileGrid,
                tileUrlFunction: (coord, ratio, proj) =>
                    utils.absoluteUrl(`/${this.id}/tiles/${tileLayer.rasterSource}/${coord[0]}/${coord[1]}/${coord[2]}`)
            })
        }));
    }
}

//==============================================================================
