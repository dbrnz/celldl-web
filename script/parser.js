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

import * as cssparser from '../thirdparty/cssparser.js';
import * as SPECIFICITY from '../thirdparty/specificity.js';

//==============================================================================

import * as bondgraph from './bondgraph.js';
//import * as dia from './diagram.js';
import {StyleSheet} from './stylesheet.js';

//==============================================================================

var CELLDL_NAMESPACE = "http://www.cellml.org/celldl/1.0#";

//==============================================================================

export class Parser
{
    constructor(cellDiagram) {
        this.cellDiagram = cellDiagram;
        this.stylesheet = new StyleSheet();
    }

    newDiagramElement(element, elementClass)
    /*====================================*/
    {
        const diagramElement = new elementClass(element.attributes, this.stylesheet.style(element));
        this.cellDiagram.addElement(diagramElement);
        return diagramElement;
    }

//    parseContainer(element, container)
//    /*==============================*/
//    {
//        for (let e of element.children) {
//            if (e.nodeName === "compartment") {
//                this.parseCompartment(e, container);
//            } else {
//                if (e.nodeName === "quantity") {
//                    this.parseQuantity(e, container);
//                } else {
//                    if ((e.nodeName === "transporter") && (container instanceof dia.Compartment)) {
//                        this.parseTransporter(e, container);
//                    } else {
//                        throw new SyntaxError(`Unexpected XML element <${e.nodeName}>`);
//                    }
//                }
//            }
//        }
//    }
//
//    parseCompartment(element, container)
//    /*================================*/
//    {
//        const compartment = this.newDiagramElement(element, dia.Compartment, container);
//        this.diagram.addCompartment(compartment);
//        this.parseContainer(element, compartment);
//    }
//
//    parseTransporter(element, compartment)
//    /*==================================*/
//    {
//        const transporter = this.newDiagramElement(element, dia.Transporter, compartment);
//        this.diagram.addTransporter(transporter);
//    }

    parseBondGraph(element)
    /*===================*/
    {
        for (let e of element.children) {
            if        (e.nodeName === "flow") {
                this.parseFlow(e);
            } else if (e.nodeName === "gyrator") {
                this.parseGyrator(e);
            } else if (e.nodeName === "potential") {
                this.parsePotential(e);
            } else if (e.nodeName === "quantity") {
                this.parseQuantity(e);
            } else if (e.nodeName === "reaction") {
                this.parseReaction(e);
            } else if (e.nodeName === "transformer") {
                this.parseTransformer(e);
            } else {
                throw new SyntaxError("Invalid <bond-graph> element");
            }
        }
    }

    parseFlow(element)
    /*==============*/
    {
        const transporterId = ('transporter' in element.attributes) ? element.attributes.transporter : null;
        const flow = this.newDiagramElement(element, bondgraph.Flow, transporterId);

//        let container = (flow.transporter !== null) ? flow.transporter.container : null;
        for (let e of element.children) {
            if (e.nodeName === "component") {
                if (!("input" in e.attributes || "output" in e.attributes)) {
                    throw new SyntaxError("Flow component requires an 'input' or 'output'");
                }
                const component = new bondgraph.FlowComponent(e.attributes, this.stylesheet.style(e), flow);
                flow.addComponent(component);
            } else {
                throw SyntaxError;
            }
        }
        // check we have at least one input and one output
        // each component has its own styling
        // inherit styles from parent
/*
                if (flow.transporter === null) {
                    if (container === null) {
                        container = component.fromPotential.container;
                    } else {
                        if (container !== component.fromPotential.container) {
                            throw new ValueError("All inputs must be in the same container");
                        }
                    }
                    for (let p of component.outputs) {
                        if (container !== p.container) {
                            throw new ValueError("All 'from' and 'to' potentials must be in the same container");
                        }
                    }
                }
*/
    }

    parseGyrator(element)
    /*=================*/
    {
        const gyrator = this.newDiagramElement(element, bondgraph.Gyrator);
    }

    parsePotential(element)
    /*===================*/
    {
        const potential = this.newDiagramElement(element, bondgraph.Potential);
    }

    parseQuantity(element)
    /*==================*/
    {
        const quantity = this.newDiagramElement(element, bondgraph.Quantity);
    }

    parseReaction(element)
    /*==================*/
    {
        const reaction = this.newDiagramElement(element, bondgraph.Reaction);
    }

    parseTransformer(element)
    /*=====================*/
    {
        const transformer = this.newDiagramElement(element, bondgraph.Transformer);
    }

    parseDocument(xmlDocument)
    /*======================*/
    {
        if (xmlDocument === null || xmlDocument.children.length != 1) {
            throw new SyntaxError("Invalid XML document");
        }

        const xmlRoot = xmlDocument.children[0];

        if ('xmlns' in xmlRoot.attributes
         && xmlRoot.attributes.xmlns.textContent !== CELLDL_NAMESPACE) {
            throw new SyntaxError("Not a CellDL document");
        } else if (xmlRoot.nodeName !== 'cell-diagram') {
            throw new SyntaxError("Root tag must be <cell-diagram>");
        }

        let diagramElement = null;
        let bondGraphElement = null;
        for (let element of xmlRoot.children) {
            if (element.nodeName === 'bond-graph') {
                if ((bondGraphElement === null)) {
                    bondGraphElement = element;
                } else {
                    throw new SyntaxError("Can only declare a single <bond-graph>");
                }
            } else if (element.nodeName === 'diagram') {
                if ((diagramElement === null)) {
                    diagramElement = element;
                } else {
                    throw new SyntaxError("Can only declare a single <diagram>");
                }
            } else if (element.nodeName === 'style') {
                if ('src' in element.attributes) {
                    this.stylesheet.getStyles(element.attributes.src.textContent);
                } else {
                    this.stylesheet.addStyles(element.textContent);
                }
            } else {
                throw new SyntaxError("Unknown XML element: <${element.nodeName}>");
            }
        }

//        if (diagramElement !== null) {
//            this.diagram = new dia.Diagram(diagramElement.attributes, this.stylesheet.style(diagramElement));
//            this.parseContainer(diagramElement, this.diagram);
//        } else {
//            this.diagram = new dia.Diagram();
//        }

        if ((bondGraphElement !== null)) {
            this.parseBondGraph(bondGraphElement);
        }
    }
}

//==============================================================================
