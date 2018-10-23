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
import {setAttributes} from './utils.js';

//==============================================================================

class Cell
{
    constructor(topLeft, size)
    {
        this._topLeft = [topLeft[0], topLeft[1]];
        this._size = [size[0], size[1]];
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
        // Store normalised edge angle -- calculate once and pass as parameter?
        this._edges.push(edge);
    }

    generateSvg()
    //===========
    {
        const fill = (this._nodes.length && this._edges.length) ? "red"
                   : (this._nodes.length) ? "green"
                   : (this._edges.length) ? "blue"
                   : "none";
        const svgNode = document.createElementNS(SVG_NS, 'rect');
        setAttributes(svgNode, { x: this._topLeft[0], y: this._topLeft[1],
                                 width: this._size[0], height: this._size[1],
                                 fill: fill, opacity: 0.7
                               });
        return svgNode;
    }
}

//==============================================================================

class Edge
{
    constructor(nodes)
    {
        this.start = nodes[0].coordinates;
        this.end = nodes[1].coordinates;
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
        const startPos = [this._topLeft[0] - 0.5*this._gridStepSize[0],
                          this._topLeft[1] - 0.5*this._gridStepSize[1]];
        for (let i = 0; i < this._gridSteps; i += 1) {
            for (let j = 0; j < this._gridSteps; j += 1) {
                this._cellMatrix.set([i, j], new Cell(startPos, this._gridStepSize));
                startPos[1] += this._gridStepSize[1];
            }
            startPos[0] += this._gridStepSize[0];
            startPos[1] = this._topLeft[1] - 0.5*this._gridStepSize[1];
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
        const slope = (end.y - start.y)*this._gridStepSize[0]/((end.x - start.x)*this._gridStepSize[1]);
        const yIncrement = (slope >= 0) ? 1 : -1;
        let error = (0.5 + (start.y - this._topLeft[1])/this._gridStepSize[1]) - startCoords[1];
        if (slope < 0) error = 1 - error;
        let y = startCoords[1];
        //console.log('from', start.asArray(), startCoords, '  to', end.asArray(), endCoords, '  slope', slope, '  error', error);
        for (let x = startCoords[0]; x < endCoords[0]; x += 1) {
            if (x > startCoords[0]) {
                this._cellMatrix.get([x, y]).add_edge(edge);
            }
            error += Math.abs(slope);
            //console.log(x, y, error);
            while (error > 1.0) {
                error -= 1;
                y += yIncrement;
                if (x > startCoords[0] && error > 1) {
                    this._cellMatrix.get([x, y]).add_edge(edge);
                }
            }
        }
    }

    // Switch X and Y for steep gradients

    addEdgeLineHigh(start,startCoords, end,endCoords, edge)
    //=====================================================
    {
        const slope = (end.x - start.x)*this._gridStepSize[1]/((end.y - start.y)*this._gridStepSize[0]);
        const xIncrement = (slope >= 0) ? 1 : -1;
        let error = (0.5 + (start.x - this._topLeft[0])/this._gridStepSize[0]) - startCoords[0];
        if (slope < 0) error = 1 - error;
        let x = startCoords[0];
        //console.log('from', start.asArray(), startCoords, '  to', end.asArray(), endCoords, '  slope', slope, '  error', error);
        for (let y = startCoords[1]; y < endCoords[1]; y += 1) {
            if (y > startCoords[1]) {
                this._cellMatrix.get([x, y]).add_edge(edge);
            }
            error += Math.abs(slope);
            //console.log(x, y, error);
            while (error > 1.0) {
                error -= 1;
                x += xIncrement;
                if (y > startCoords[1] && error > 1) {
                    this._cellMatrix.get([x, y]).add_edge(edge);
                }
            }
        }
    }

    add_edge(edge)
    //============
    {
        const startCoords = this.gridCoords(edge.start.asArray());
        const endCoords = this.gridCoords(edge.end.asArray());
        if        (startCoords[0] === endCoords[0]) {
            if (endCoords[1] > startCoords[1]) {
                for (let y = startCoords[1] + 1; y < endCoords[1]; y += 1) {
                    this._cellMatrix.get([startCoords[0], y]).add_edge(edge);
                }
            } else {
                for (let y = startCoords[1] - 1; y > endCoords[1]; y -= 1) {
                    this._cellMatrix.get([startCoords[0], y]).add_edge(edge);
                }
            }
        } else if (startCoords[1] === endCoords[1]) {
            if (endCoords[0] > startCoords[0]) {
                for (let x = startCoords[0] + 1; x < endCoords[0]; x += 1) {
                    this._cellMatrix.get([x, startCoords[1]]).add_edge(edge);
                }
            } else {
                for (let x = startCoords[0] - 1; x > endCoords[0]; x -= 1) {
                    this._cellMatrix.get([x, startCoords[1]]).add_edge(edge);
                }
            }
        } else if (Math.abs(edge.end.y - edge.start.y) < Math.abs(edge.end.x - edge.start.x)) {
            if (edge.start.x > edge.end.x) {
                this.addEdgeLineLow(edge.end,endCoords, edge.start,startCoords, edge);
            } else {
                this.addEdgeLineLow(edge.start,startCoords, edge.end,endCoords, edge);
            }
        } else {
            if (edge.start.y > edge.end.y) {
                this.addEdgeLineHigh(edge.end,endCoords, edge.start,startCoords, edge);
            } else {
                this.addEdgeLineHigh(edge.start,startCoords, edge.end,endCoords, edge);
            }
        }

        /*
        Find cell line.start() is in;
        Find cell line.end() is in;
        Use line.direction() to get a step amount in terms of unit cell size;
        Mark cells, starting with the starting cell, stepping until the ending cell.

        */
    }

    generateSvg()
    //===========
    {
        const GRID_COLOUR = "red";
        const GRID_OPACITY = 0.7;

        const gridId = `cluster_grid`;
        const gridStrokeWidth = 2.0;
        const gridStrokeDash = `${gridStrokeWidth} ${gridStrokeWidth}`;
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
        const svgDocument = parser.parseFromString(gridSvg, "application/xml");
        const svgNode = svgDocument.documentElement;

        for (let i = 0; i < this._gridSteps; i += 1) {
            for (let j = 0; j < this._gridSteps; j += 1) {
                svgNode.appendChild(this._cellMatrix.get([i, j]).generateSvg());
            }
        }
        return svgNode;
    }
}


//==============================================================================

export class EdgeClusterer
{
    constructor(gridSteps=15, directionThreshold=15, alpha=0.7, beta=0.3)
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
            if (x > xMax) xMax = x;
            if (y < yMin) yMin = y;
            if (y > yMax) yMax = y;
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
                grid.add_edge(new Edge(edge));
            }
            return grid.generateSvg();
        } else {
            return document.createElementNS(SVG_NS, 'g');
        }
    }

}

//==============================================================================
