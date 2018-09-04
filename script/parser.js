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

import * as bondgraph from './bondgraph.js';
import * as exception from './exception.js';
import * as flatmap from './flatmap.js';

//==============================================================================

var CELLDL_NAMESPACE = "http://www.cellml.org/celldl/1.0#";

//==============================================================================

export class Parser
{
    constructor(diagram) {
        this.diagram = diagram;
        this.bondGraphElement = null;
        this.flatMapElement = null;
        this.diagramElement = null;
    }

    //==========================================================================

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

    //==========================================================================

    parseFlatMap(element)
    //===================
    {
        this.diagram.flatMap = new flatmap.FlatMap(this.diagram, element);
        for (let e of element.children) {
            if        (e.nodeName === "component") {
                this.diagram.flatMap.addElement(this.parseComponent(e));
            } else if (e.nodeName === "connection") {
                this.diagram.flatMap.addConnection(this.parseConnection(e));
            } else if (e.nodeName === "group") {
                this.diagram.flatMap.addElement(this.parseGroup(e));
            } else {
                throw new exception.SyntaxError(e, "Invalid element for <flat-map>");
            }
        }
    }

    parseComponent(element)
    //=====================
    {
        const component = new flatmap.Component(this.diagram, element);
        for (let e of element.children) {
            if (e.nodeName === "component") {
                component.addElement(this.parseComponent(e));
            } else {
                throw new exception.SyntaxError(e, "Invalid element for <component>");
            }
        }
        return component;
    }

    parseConnection(element)
    //======================
    {
        return new flatmap.ComponentConnection(this.diagram, element);
    }

    parseGroup(element)
    //=================
    {
        const group = new flatmap.Group(this.diagram, element);
        for (let e of element.children) {
            if        (e.nodeName === "component") {
                group.addElement(this.parseComponent(e));
            } else if (e.nodeName === "group") {
                group.addElement(this.parseGroup(e));
            } else {
                throw new exception.SyntaxError(e, "Invalid element for <group>");
            }
        }
        return group;
    }

    //==========================================================================

    parseBondGraph(element)
    //=====================
    {
        this.diagram.bondGraph = new bondgraph.BondGraph(this.diagram, element);
        for (let e of element.children) {
            if        (e.nodeName === "flow") {
                this.diagram.bondGraph.addElement(this.parseFlow(e));
            } else if (e.nodeName === "gyrator") {
                this.diagram.bondGraph.addElement(this.parseGyrator(e));
            } else if (e.nodeName === "potential") {
                this.diagram.bondGraph.addElement(this.parsePotential(e));
            } else if (e.nodeName === "quantity") {
                this.diagram.bondGraph.addElement(this.parseQuantity(e));
            } else if (e.nodeName === "reaction") {
                this.diagram.bondGraph.addElement(this.parseReaction(e));
            } else if (e.nodeName === "transformer") {
                this.diagram.bondGraph.addElement(this.parseTransformer(e));
            } else {
                throw new exception.SyntaxError(e, "Invalid element for <bond-graph>");
            }
        }
    }

    parseFlow(element)
    //================
    {
        const flow = new bondgraph.Flow(this.diagram, element);

//        let container = (flow.transporter !== null) ? flow.transporter.container : null;
        for (let e of element.children) {
            if (e.nodeName === "component") {
                if (!("input" in e.attributes || "output" in e.attributes)) {
                    throw new exception.SyntaxError(e, "A flow component requires an 'input' or 'output'");
                }
                flow.addComponent(e);
            } else {
                throw new exception.SyntaxError(e, `Unexpected <flow> element`);
            }
        }
        return flow;
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

    parseGyrator(element)
    //===================
    {
        const gyrator = new bondgraph.Gyrator(this.diagram, element);
        for (let e of element.children) {
            if        (e.nodeName === 'input') {
                gyrator.addInput(e);
            } else if (e.nodeName === 'output') {
                gyrator.addOutput(e);
            } else {
                throw new exception.SyntaxError(e, `Unexpected <gyrator> element`);
            }
        }
        return gyrator;
    }

    parsePotential(element)
    //=====================
    {
        return new bondgraph.Potential(this.diagram, element);
    }

    parseQuantity(element)
    //====================
    {
        return new bondgraph.Quantity(this.diagram, element);
    }

    parseReaction(element)
    //====================
    {
        const reaction = new bondgraph.Reaction(this.diagram, element);
        for (let e of element.children) {
            if (e.nodeName === 'input') {
                reaction.addInput(e);
            } else if (e.nodeName === 'output') {
                reaction.addOutput(e);
            } else if (e.nodeName === 'modulator') {
                reaction.addModulator(e);
            } else {
                throw new exception.SyntaxError(e, `Unexpected <reaction> element`);
            }
        }
        return reaction;
    }

    parseTransformer(element)
    //=======================
    {
        const transformer = new bondgraph.Transformer(this.diagram, element);
        for (let e of element.children) {
            if (e.nodeName === 'input') {
                transformer.addInput(e);
            } else if (e.nodeName === 'output') {
                transformer.addOutput(e);
            } else {
                throw new exception.SyntaxError(e, `Unexpected <transformer> element`);
            }
        }
        return transformer;
    }

    //==========================================================================

    parseDocument(xmlDocument)
    //========================
    {
        if (xmlDocument === null || xmlDocument.children.length != 1) {
            throw new exception.SyntaxError(xmlDocument, "Invalid XML document");
        }

        const xmlRoot = xmlDocument.children[0];

        if ('xmlns' in xmlRoot.attributes
         && xmlRoot.attributes.xmlns.textContent !== CELLDL_NAMESPACE) {
            throw new exception.SyntaxError(xmlRoot, "Not a CellDL document");
        } else if (xmlRoot.nodeName !== 'cell-diagram') {
            throw new exception.SyntaxError(xmlRoot, "Root tag must be <cell-diagram>");
        }

        const stylesheet = this.diagram.stylesheet;

        let stylePromises = [];
        stylePromises.push(stylesheet.loadDefaultStylesheet());

        for (let element of xmlRoot.children) {
            if (element.nodeName === 'bond-graph') {
                if (this.bondGraphElement === null) {
                    this.bondGraphElement = element;
                } else {
                    throw new exception.SyntaxError(element, "Can only declare a single <bond-graph>");
                }
            } else if (element.nodeName === 'flat-map') {
                if (this.flatMapElement === null) {
                    this.flatMapElement = element;
                } else {
                    throw new exception.SyntaxError(element, "Can only declare a single <flat-map> block");
                }
            } else if (element.nodeName === 'diagram') {
                if ((this.diagramElement === null)) {
                    this.diagramElement = element;
                } else {
                    throw new exception.SyntaxError(element, "Can only declare a single <diagram>");
                }
            } else if (element.nodeName === 'style') {
                if ('src' in element.attributes) {
                    stylePromises.push(stylesheet.fetchStyles(element.attributes.src.textContent));
                } else {
                    stylesheet.addStyles(element.textContent);
                    if (element.id === 'manual_adjustments') {
                        this.diagram.setManualAdjustedElements(element.textContent);
                    }
                }
            } else {
                throw new exception.SyntaxError(element, "Unknown XML element");
            }
        }

        // The graphical editor requires a <bond-graph> node...

        if (this.bondGraphElement === null) {
            this.bondGraphElement = document.createElementNS(CELLDL_NAMESPACE, 'bond-graph');
        }

        return Promise.all(stylePromises)
                      .then(() => {
                            this.diagram.initialise(stylesheet.style(xmlRoot));
//                            if (this.diagramElement !== null) {
//                                this.diagram = new dia.Diagram(this.diagramElement.attributes,
//                                                               stylesheet.style(this.diagramElement));
//                                this.parseContainer(this.diagramElement, this.diagram);
//                            } else {
//                                this.diagram = new dia.Diagram();
//                            }

                            this.parseBondGraph(this.bondGraphElement);

                            if (this.flatMapElement !== null) {
                                this.parseFlatMap(this.flatMapElement);
                            }
                        });
    }
}

//==============================================================================
