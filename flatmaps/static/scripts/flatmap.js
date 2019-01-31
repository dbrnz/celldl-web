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

/* export */ class FlatMap extends ol.Map
{
    /**
     * Create and display a new FlatMap
     *
     * @param      {string}  htmlElementId  The HTML element identifier in which to display the map
     * @param      {Object}  configuration  The maps's configuration
     * @param      {Array<number>}  configuration.size   A two-long array giving the map's [width, height]
     * @param      {boolean}  [configuration.debug=false]  Add a layer showing the grid tiles
     * @param      {boolean}  [configuration.layerSwitcher=false]  Add a control to control layer visibility
     * @param      {boolean}  [configuration.overviewMap=false]  Add a control to show an overview map
     * @param      {Array<Object>}  configuration.imageTileLayers  Details of raster image layers
     * @param      {string}  configuration.imageTileLayers.source  The layer's tiles are at `/tiles/{source}`
     * @param      {string}  [configuration.imageTileLayers.title=null]  The layer's title
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

        const mapGrid = new ol.tilegrid.TileGrid({
            origin: [0, 0],
            extent: mapExtent,
            tileSize: tileSize,
            resolutions: mapResolutions
        });

        const mapProjection = new ol.proj.Projection({
            units: 'm',
            worldExtent: mapExtent
        });

        const mapView =  new ol.View({
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

        this.projection = mapProjection;
        this.resolutions = mapResolutions;
        this.tileGrid = mapGrid;

        // Add a debugging grid if option set and make
        // sure it's visible if we can't switch layers

        if (configuration.debug) {
            this.addLayer(new ol.layer.Tile({
                title: 'Grid',
                visible: !configuration.layerSwitcher,
                source: new ol.source.TileDebug({
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
            const layerSwitcher = new ol.control.LayerSwitcher();
            this.addControl(layerSwitcher);
        }

        // Add an overview map if option set

        if (configuration.overviewMap) {
            this.addControl(new ol.control.OverviewMap({
                view: new ol.View({
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
        this.addLayer(new ol.layer.Tile({
            title: tileLayer.title,
            source: new ol.source.TileImage({
                tileGrid: this.tileGrid,
                tileUrlFunction: (coord, ratio, proj) =>
                    absoluteUrl(`./tiles/${tileLayer.source}/${coord[0]}/${coord[1]}/${coord[2]}`)
            })
        }));
    }
}

//==============================================================================
