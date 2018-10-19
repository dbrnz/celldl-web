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

//import * as math from '../thirdparty/math.js';

import {SVG_NS} from './svgElements.js';

//==============================================================================

class Cell
{
    constructor()
    {
        this._nodes = [];
        this._edges = [];
    }

    add_node(node)
    //============
    {
        this._nodes.push(node);
    }

    add_edge(edge)
    //============
    {
        this._edges.push(edge);
    }
}

//==============================================================================

class Grid
{
    // `gridSteps` is number of horizontal and vertical divisions (stripes)
    //  that make up the grid.

    constructor(gridSteps, boundingBox)
    {
        // We make the size 1 bigger so that the bounding box's extremities
        // are in the middle of the grid's outermost cells

        this._gridSteps = gridSteps + 1;
        this._topLeft = boundingBox[0];
        // Allow for zero width/height bBox...
        this._gridStepSize = [(boundingBox[1][0] - boundingBox[0][0])/gridSteps,
                              (boundingBox[1][1] - boundingBox[0][1])/gridSteps]
        this._cellMatrix = math.zeros(this._gridSteps, this._gridSteps);
        for (let i = 0; i < this._gridSteps; i += 1) {
            for (let j = 0; j < this._gridSteps; j += 1) {
                this._cellMatrix.set([i, j], new Cell());
            }
        }
    }

    gridCoords(position)
    //==================
    {
        return [Math.floor(0.5 + (position[0] - this._topLeft[0])/this._gridStepSize[0]),
                Math.floor(0.5 + (position[1] - this._topLeft[1])/this._gridStepSize[1])];
    }

    add_node(node)
    //============
    {
        const i = this.gridCoords(node.coordinates.asArray());
        this._cellMatrix.get(i).add_node(node);
    }

    // The following is based on Bresenham's algorithm from
    // https://en.wikipedia.org/wiki/Bresenham%27s_line_algorithm

    // For gradients between -1 and 1

    addEdgeLineLow(start,startCoords, end,endCoords, edge)
    //====================================================
    {
        const slope = (end.y - start.y)/(end.x - start.x);
        const yIncrement = (slope >= 0) ? 1 : -1;
        let error = (0.5 + (start.y - this._topLeft[1])/this._gridStepSize[1]) - startCoords[1];
        let y = startCoords[1];
        for (let x = startCoords[0]; x <= endCoords[0]; x += 1) {
            this._cellMatrix.get([x, y]).add_edge(edge);
            error += Math.abs(slope);
            if (error > 1.0) {
                error -= 1;
                y += yIncrement;
            }
        }
    }

    // Switch X and Y for steep gradients

    addEdgeLineHigh(start,startCoords, end,endCoords, edge)
    //=====================================================
    {
        const slope = (end.x - start.x)/(end.y - start.y);
        const xIncrement = (slope >= 0) ? 1 : -1;
        let error = (0.5 + (start.x - this._topLeft[0])/this._gridStepSize[0]) - startCoords[0];
        let x = startCoords[0];
        for (let y = startCoords[1]; y <= endCoords[1]; y += 1) {
            this._cellMatrix.get([x, y]).add_edge(edge);
            error += Math.abs(slope);
            if (error > 1.0) {
                error -= 1;
                x += xIncrement;
            }
        }
    }

    add_edge(edge)
    //============
    {
        //connection.path is a linestring

        //path.coordinates[0]
        //path.coordinates.slice(-1)[0]

        const start = edge[0].coordinates;
        const startCoords = this.gridCoords(start.asArray());
        const end = edge[1].coordinates;
        const endCoords = this.gridCoords(end.asArray());
        if        (startCoords[0] === endCoords[0]) {
            for (let y = startCoords[1]; y <= endCoords[1]; y += 1) {
                this._cellMatrix.get([startCoords[0], y]).add_edge(edge);
            }
        } else if (startCoords[1] === endCoords[1]) {
            for (let x = startCoords[0]; x <= endCoords[0]; x += 1) {
                this._cellMatrix.get([x, startCoords[1]]).add_edge(edge);
            }
        } else if (Math.abs(end.y - start.y) < Math.abs(end.x - start.x)) {
            if (start.x > end.x) {
                this.addEdgeLineLow(end,endCoords, start,startCoords, edge);
            } else {
                this.addEdgeLineLow(start,startCoords, end,endCoords, edge);
            }
        } else {
            if (start.y > end.y) {
                this.addEdgeLineHigh(end,endCoords, start,startCoords, edge);
            } else {
                this.addEdgeLineHigh(start,startCoords, end,endCoords, edge);
            }
        }

        /*
        Find cell line.start() is in;
        Find cell line.end() is in;
        Use line.direction() to get a step amount in terms of unit cell size;
        Mark cells, starting with the starting cell, stepping until the ending cell.

        */
    }

    svgNode()
    //=======
    {
        const GRID_COLOUR = "red";
        const GRID_OPACITY = 0.7;

        const gridId = `cluster_grid`;
        const gridStrokeWidth = 2.0;
        const gridStrokeDash = `${2*gridStrokeWidth} ${2*gridStrokeWidth}`;
        const gridFraction = 1.0/this._gridSteps;

        const gridSvg = `<g class="grid_">
  <defs>
    <pattern id="${gridId}"
             width="${gridFraction}" height="${gridFraction}">
      <rect stroke="${GRID_COLOUR}" stroke-opacity="${GRID_OPACITY}"
            stroke-width="${gridStrokeWidth}" stroke-dasharray="${gridStrokeDash}"
            fill="none" width="100%" height="100%"/>
    </pattern>
  </defs>
  <rect fill="url(#${gridId})"
      x = "${this._topLeft[0] - 0.5*this._gridStepSize[0]}" y = "${this._topLeft[1] - 0.5*this._gridStepSize[1]}"
      stroke="${GRID_COLOUR}" stroke-opacity="${GRID_OPACITY}"
      stroke-width="${gridStrokeWidth/2}"
      width="${this._gridSteps*this._gridStepSize[0]}" height="${this._gridSteps*this._gridStepSize[1]}"/>
</g>`;
        const parser = new DOMParser();
        const svgNode = parser.parseFromString(gridSvg, "application/xml");
        return svgNode.documentElement;
    }
}


//==============================================================================

export class EdgeClusterer
{
    constructor(gridSteps=4, directionThreshold=15, alpha=0.7, beta=0.3)
    {
        this._gridSteps = gridSteps;
        this._directionThreshold = directionThreshold;
        this._alpha = alpha;
        this._beta = beta;
    }

    static boundingBox(graph)
    //=======================
    {
        let [xMin, xMax] = [Infinity, -Infinity];
        let [yMin, yMax] = [Infinity, -Infinity];
        for (let node of graph.nodes()) {
            const [x, y] = node.coordinates.asArray();
            if (x < xMin) xMin = x;
            else if (x > xMax) xMax = x;
            if (y < yMin) yMin = y;
            else if (y > yMax) yMax = y;
        }
        if (xMin === xMax) xMax = xMin + 1;
        if (yMin === yMax) yMax = yMin + 1;
        return [[xMin, yMin], [xMax, yMax]];
    }


    cluster(graph)
    //============
    {
        if (graph.size() > 0) {
            const grid = new Grid(this._gridSteps, EdgeClusterer.boundingBox(graph));
            for (let node of graph.nodes()) {
                grid.add_node(node);
            }
            for (let edge of graph.edges()) {
                grid.add_edge(edge);
            }
            return grid.svgNode();
        } else {
            return document.createElementNS(SVG_NS, 'g');
        }
    }

}

//==============================================================================
