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
import * as exception from './exception.js';

import {CellDiagram} from './cellDiagram.js';
import {StyleSheet} from './stylesheet.js';

//import * as dia from './diagram.js';

//==============================================================================

var CELLDL_NAMESPACE = "http://www.cellml.org/celldl/1.0#";

//==============================================================================

export class Parser
{
    constructor() {
        this.bondGraphElement = null;
        this.diagramElement = null;
    }

//    parseContainer(element, container)
//    //================================
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
//                        throw new exception.SyntaxError(e, `Unexpected XML element <${e.nodeName}>`);
//                    }
//                }
//            }
//        }
//    }
//
//    parseCompartment(element, container)
//    //==================================
//    {
//        const compartment = this.newDiagramElement(element, dia.Compartment, container);
//        this.diagram.addCompartment(compartment);
//        this.parseContainer(element, compartment);
//    }
//
//    parseTransporter(element, compartment)
//    //====================================
//    {
//        const transporter = this.newDiagramElement(element, dia.Transporter, compartment);
//        this.diagram.addTransporter(transporter);
//    }

    parseBondGraph(element)
    //=====================
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
                throw new exception.SyntaxError(e, "Invalid element for <bond-graph>");
            }
        }
    }

    parseFlow(element)
    //================
    {
        const flow = new bondgraph.Flow(element);

//        let container = (flow.transporter !== null) ? flow.transporter.container : null;
        for (let e of element.children) {
            if (e.nodeName === "component") {
                if (!("input" in e.attributes || "output" in e.attributes)) {
                    throw new exception.SyntaxError(e, "Flow component requires an 'input' or 'output'");
                }
                const component = new bondgraph.FlowComponent(e, flow);
                flow.addComponent(component);
            } else {
                throw new exception.SyntaxError(e, `Unexpected <flow> element`);
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
                            throw new exception.SyntaxError(element, "All inputs must be in the same container");
                        }
                    }
                    for (let p of component.outputs) {
                        if (container !== p.container) {
                            throw new exception.SyntaxError(element, "All 'from' and 'to' potentials must be in the same container");
                        }
                    }
                }
*/
    }

    parseGyrator(element)
    //===================
    {
        const gyrator = new bondgraph.Gyrator(element);
    }

    parsePotential(element)
    //=====================
    {
        const potential = new bondgraph.Potential(element);
    }

    parseQuantity(element)
    //====================
    {
        const quantity = new bondgraph.Quantity(element);
    }

    parseReaction(element)
    //====================
    {
        const reaction = new bondgraph.Reaction(element);
    }

    parseTransformer(element)
    //=======================
    {
        const transformer = new bondgraph.Transformer(element);
    }

    parseDocument(xmlDocument)
    //========================
    {
        if (xmlDocument === null || xmlDocument.children.length != 1) {
            throw new exception.SyntaxError(xmlDocument, "Invalid XML document");
        }

        const xmlRoot = xmlDocument.children[0];

        if ('xmlns' in xmlRoot.attributes
         && xmlRoot.attributes.xmlns.textContent !== CELLDL_NAMESPACE) {
            throw new exception.SyntaxError(xmlroot, "Not a CellDL document");
        } else if (xmlRoot.nodeName !== 'cell-diagram') {
            throw new exception.SyntaxError(xmlroot, "Root tag must be <cell-diagram>");
        }

        let stylePromises = [];
        for (let element of xmlRoot.children) {
            if (element.nodeName === 'bond-graph') {
                if ((this.bondGraphElement === null)) {
                    this.bondGraphElement = element;
                } else {
                    throw new exception.SyntaxError(element, "Can only declare a single <bond-graph>");
                }
            } else if (element.nodeName === 'diagram') {
                if ((this.diagramElement === null)) {
                    this.diagramElement = element;
                } else {
                    throw new exception.SyntaxError(element, "Can only declare a single <diagram>");
                }
            } else if (element.nodeName === 'style') {
                if ('src' in element.attributes) {
                    stylePromises.push(StyleSheet.instance().fetchStyles(element.attributes.src.textContent));
                } else {
                    StyleSheet.instance().addStyles(element.textContent);
                }
            } else {
                throw new exception.SyntaxError(element, "Unknown XML element");
            }
        }

        return Promise.all(stylePromises)
                      .then(() => {
                            CellDiagram.instance().initialise(StyleSheet.instance().style(xmlRoot));
//                            if (this.diagramElement !== null) {
//                                this.diagram = new dia.Diagram(this.diagramElement.attributes,
//                                                               StyleSheet.instance().style(this.diagramElement));
//                                this.parseContainer(this.diagramElement, this.diagram);
//                            } else {
//                                this.diagram = new dia.Diagram();
//                            }
                            if (this.bondGraphElement !== null) {
                                this.parseBondGraph(this.bondGraphElement);
                            }
                        });
    }
}

//==============================================================================
