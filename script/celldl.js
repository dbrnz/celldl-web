import * as SPECIFICITY from './specificity.js';

/*
class Parser {
    diagram = null;
    bond_graph = null;
    stylesheets = new Array();
    last_element = null;  // For error handling

    parse_container(element, container) {
        for (let e of element.children) {
            this.last_element = e;
            // check e.namespaceURI == 'http://www.cellml.org/celldl/1.0#'
            if (e.tagName == 'compartment')
                this.parse_compartment(e, container);
            else if (e.tagName == 'quantity')
                self.parse_quantity(e, container);
            else if (e.tagName == 'transporter' && container instanceof Compartment)
                self.parse_transporter(e, container)
            else
                throw new SyntaxError("Unexpected XML element <{}>".format(e.tagName))
        }
    }

    parse_compartment(element, container) {
        let compartment = new Compartment(container, element.style, element.attributes);
        this.diagram.add_compartment(compartment);
        this.parse_container(element, compartment);
    }

    parse_quantity(element, container) {
      let quantity = new Quantity(container, style=element.style, **element.attributes);
      this.diagram.add_quantity(quantity);
    }

    parse_transporter(element, compartment) {
      let transporter = new Transporter(compartment, style=element.style, **element.attributes);
      this.diagram.add_transporter(transporter);
      # TODO: no pos attribute ==> set position wrt previous transporter
    }

    parse_bond_graph(element) {
      for e in ElementChildren(element, this.stylesheets) {
        this.last_element = e
        if e.tag == CellDL_namespace('potential'):
          self.parse_potential(e)
        elif e.tag == CellDL_namespace('flow'):
          self.parse_flow(e)
        else:
          raise SyntaxError("Invalid <bond-graph> element")
      }
    }

    parse_potential(element) {
      let potential = new Potential(this.diagram, style=element.style, **element.attributes);
      if potential.quantity is None:
          raise SyntaxError("Missing or unknown quantity.")
      potential.set_container(potential.quantity.container);
      this.diagram.add_element(potential);  ## Add to container...
      this.bond_graph.add_potential(potential);
    }

    parse_flow(element) {
        flow = bg.Flow(this.diagram, style=element.style, **element.attributes)
        this.diagram.add_element(flow)  ## Add to container?? But does flow have a container??
                                         ## set to transporter's if flow has one.
                                         ## If no transporter then are all from/to flow components
                                         ## in the same container??
                                         ## Diffusion across a cell boundary??
        container = flow.transporter.container if flow.transporter is not None else None
        for e in ElementChildren(element, this.stylesheets):
            this.last_element = e
            if e.tag == CellDL_namespace('component'):
                if 'from_' not in e.attributes or 'to' not in e.attributes:
                    raise SyntaxError("Flow component requires 'from' and 'to' potentials.")
                component = bg.FlowComponent(this.diagram, flow, style=e.style, **e.attributes)
                if flow.transporter is None:
                    if container is None:
                        container = component.from_potential.container
                    elif container != component.from_potential.container:
                        raise ValueError("All 'to' potentials must be in the same container.")
                    for p in component.to_potentials:
                        if container != p.container:
                            raise ValueError("All 'from' and 'to' potentials must be in the same container.")
                component.set_container(container)
                this.diagram.add_element(component)    ## Add to container...
                flow.add_component(component)
            else:
                raise SyntaxError
        this.bond_graph.add_flow(flow)
    }

    parse_diagram(root) {
        this.last_element = root
        if root.tag != CellDL_namespace('cell-diagram'):
            raise SyntaxError("Root tag is not <cell-diagram>")

        # Parse top-level children, loading stylesheets and
        # finding any diagram and bond-graph elements
        diagram_element = None
        bond_graph_element = None
        for e in ElementChildren(root, this.stylesheets):
            this.last_element = e
            if   e.tag == CellDL_namespace('bond-graph'):
                if bond_graph_element is None:
                    bond_graph_element = e
                else:
                    raise SyntaxError("Can only declare a single <bond-graph>")
            elif e.tag == CellDL_namespace('diagram'):
                if diagram_element is None:
                    diagram_element = e
                else:
                    raise SyntaxError("Can only declare a single <diagram>")
            elif e.tag == CellDL_namespace('style'):
                pass
            else:
                raise SyntaxError("Unknown XML element: <{}>".format(e.tag))

        # Parse the diagram element
        if diagram_element is not None:
            this.diagram = dia.Diagram(style=diagram_element.style,
                                        **diagram_element.attributes)
            self.parse_container(diagram_element, this.diagram)
        else:
            this.diagram = dia.Diagram()

        # Parse the bond-graph element
        if bond_graph_element is not None:
            this.bond_graph = bg.BondGraph(this.diagram,
                                            style=bond_graph_element.style,
                                            **bond_graph_element.attributes)
            self.parse_bond_graph(bond_graph_element)
        else:
            this.bond_graph = bg.BondGraph(this.diagram)
        this.diagram.set_bond_graph(this.bond_graph)
    }

    parse(file, stylesheet=None) {
        logging.debug('PARSE: %s', file)

        # Parse the XML file and wrap the resulting root element so
        # we can easily iterate through its children
        error = None
        try:
            xml_root = etree.parse(file)
        except (etree.ParseError, etree.XMLSyntaxError) as err:
            lineno, column = err.position
            with open(file) as f:
                t = f.read()
                line = next(itertools.islice(io.StringIO(t), lineno-1, None))
            error = ("{}\n{}".format(err, line))
        if error:
            raise SyntaxError(error)

        try:
            # Load all style information before wrapping the root element
            if stylesheet is not None:
                this.stylesheets.append(StyleSheet(stylesheet))
            for e in xml_root.iterfind(CellDL_namespace('style')):
                if 'href' in e.attrib:
                    pass          ### TODO: Load external stylesheets...
                                  ### **ALL** external stylesheets should be loaded
                                  ### **before** any internal ones...
                else:
                    this.stylesheets.append(StyleSheet(e.text))
        except cssselect2.parser.SelectorError as err:
            error = "{} when parsing stylesheet.".format(err)
        if error:
            raise SyntaxError(error)

        root_element = ElementWrapper(
            cssselect2.ElementWrapper.from_xml_root(xml_root),
            this.stylesheets)

        try:
            self.parse_diagram(root_element)
        except Exception as err:
            e = this.last_element.element.etree_element
            s = this.last_element.style
            error = "{}\n<{} {}/>\n{}".format(err,
                    e.tag,
                    ' '.join(['{}="{}"'.format(a, v) for a, v in e.items()]),
                    '\n'.join(['{}: {};'.format(a, tinycss2.serialize(n)) for a, n in s.items()])
                    )
#        if error:
            raise SyntaxError(error)

        #try:
        this.diagram.layout()
        #except Exception as err:
        #    error = "{}".format(err)
#        if error:
         #   raise SyntaxError(error)

        logging.debug('')

        # For all flow components
        # parse 'line' attribute
        # assign line segments

        return this.diagram
    }
  }

*/

/*
We want our own CSSMatcher class that has all selectors and their rules,
kept in specificity order...

for all rules:
  rule.selector
  rule.selector.specificity
  rule.
match(element) to return the set of matching rules

*/


class StyleSheet {
    constructor(css) {
        this.stylesheet = [];
        const rules = CSSOM.parse(css).cssRules;
        let order = 0;
        for (let rule of rules) {
            const selectors = rule.selectorText.split(',');
            for (let selector of selectors) {
                this.stylesheet.push({selector: selector,
                                style: rule.style,
                                specificity: SPECIFICITY.calculate(selector)[0]['specificityArray'],
                                order: order});
                order += 1;
            }
        }
        this.stylesheet.sort(function(a, b) {
            const order = SPECIFICITY.compare(a.specificity, b.specificity);
            if (order != 0) {
                return order;
            } else {
                return (a.order > b.order) ?  1
                     : (a.order < b.order) ? -1
                     :  0;
            }
        });
    }

    style(element) {
        let style = {};
        for (let rule of this.stylesheet) {
            if (element.matches(rule.selector)) {
                for (let i = 0; i < rule.style.length; ++i) {
                    const key = rule.style[i];
                    style[key] = rule.style[key];
                }
            }
        }
        return style;
    }

}


export function createSVG(xmldoc) {
    const xmlroot = xmldoc.documentElement;

    const csstext = xmlroot.querySelector('style').textContent;
    const stylesheet = new StyleSheet(csstext);

    const element = xmlroot.querySelector('compartment');

    const elementStyle = stylesheet.style(element);

  // querySelector()
  // querySelectorAll()
  //  var match0 = elements[0];
    // Add attribute `cssname` with value `cssvalue`

    // What we really want is to get all CSS rules that
    // match a given element.

    console.log(xmlroot.nodeName);
}
