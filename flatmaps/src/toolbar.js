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


function awesomeFont(style, name, tooltip)
{
    const element = document.createElement('i');
    element.classList.add(style);
    element.classList.add(name);
    element.setAttribute('title', tooltip);

	element.onclick = function(e) {
	    e.target.classList.add('selected');
	};

    return element;
}


function spacer()
{
    const element = document.createElement('i');
    element.classList.add('spacer');
    return element;
}


export class Toolbar
{
	constructor(containerId) {
        const toolbarElement = document.createElement('div');
        toolbarElement.id = `${containerId}-toolbar`;
        toolbarElement.classList.add('flatmap-toolbar');
        toolbarElement.appendChild(awesomeFont('fas', 'fa-mouse-pointer', 'Select'));
        toolbarElement.appendChild(spacer());
        toolbarElement.appendChild(awesomeFont('fas', 'fa-map-marker', 'Add point'));
        toolbarElement.appendChild(awesomeFont('fas', 'fa-pencil-alt', 'Add line'));
        toolbarElement.appendChild(awesomeFont('fas', 'fa-vector-square', 'Add rectangle'));
        toolbarElement.appendChild(awesomeFont('fas', 'fa-draw-polygon', 'Add polygon'));
        toolbarElement.appendChild(spacer());
        toolbarElement.appendChild(awesomeFont('far', 'fa-trash-alt', 'Delete'));
        toolbarElement.appendChild(spacer());
        toolbarElement.appendChild(awesomeFont('fas', 'fa-undo', 'Undo'));
        toolbarElement.appendChild(awesomeFont('fas', 'fa-redo', 'Redo'));
        this._domElement = toolbarElement;
	}

	get domElement() {
		return this._domElement;
	}
}

//==============================================================================
