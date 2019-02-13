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


//==============================================================================

class Tool
{
	constructor(toolbar, tooltip, action) {
		this._toolbar = toolbar;
		this._action = action;
    	this._domElement = document.createElement('i');
		this._domElement.onclick = this.clicked.bind(this);
    	if (tooltip) {
    		this._domElement.setAttribute('title', tooltip);
    	}
	}

	get action()
	{
		return this._action;
	}

	get domElement()
	{
		return this._domElement;
	}

	clicked(toolElement)
	{
		this._toolbar.toolClicked(this);
	}

	highlight(selected)
	{
		if (selected) {
			this._domElement.classList.add('selected');
		} else {
			this._domElement.classList.remove('selected');
		}
	}
}

//==============================================================================

class StyledTool extends Tool
{
	constructor(toolbar, style, name, tooltip, action) {
		super(toolbar, tooltip, action);
    	this._domElement.classList.add(style);
    	this._domElement.classList.add(name);
	}
}

//==============================================================================

export class Toolbar
{
	constructor(containerId) {
		this._map = null;
        this._domElement = document.createElement('div');
        this._domElement.id = `${containerId}-toolbar`;
        this._domElement.classList.add('flatmap-toolbar');
        this._tools = [];
        this.addStyledTool('fas', 'fa-mouse-pointer', 'Select');
        this.addSpacer();
        this.addStyledTool('fas', 'fa-map-marker', 'Add point');
        this.addStyledTool('fas', 'fa-pencil-alt', 'Add line');
        this.addStyledTool('fas', 'fa-vector-square', 'Add rectangle');
        this.addStyledTool('fas', 'fa-draw-polygon', 'Add polygon');
        this.addSpacer();
        this.addStyledTool('far', 'fa-trash-alt', 'Delete');
        this.addSpacer();
        this.addStyledTool('fas', 'fa-undo', 'Undo');
        this.addStyledTool('fas', 'fa-redo', 'Redo');
        this.addSpacer();
        this.addStyledTool('fas', 'fa-save', 'Save changes');
	}

	get domElement()
	{
		return this._domElement;
	}

	addSpacer()
	{
    	const element = document.createElement('i');
    	element.classList.add('spacer');
    	this._domElement.appendChild(element);
	}

	addStyledTool(style, name, tooltip, action=null)
	{
		const tool = new StyledTool(this, style, name, tooltip, action);
		this._domElement.appendChild(tool.domElement);
		this._tools.push(tool);
	}

	setMap(map)
	{
		this._map = map;
	}

	toolClicked(tool)
	{
		for (let t of this._tools) {
			t.highlight(t === tool);
		}
		if (tool.action) {
			tool.action(this._map);
			tool.highlight(false);  // Or default back to selection ??
		}
	}
}

//==============================================================================
