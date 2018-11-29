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

import ace from 'ace-builds/src-noconflict/ace';
import 'ace-builds/src-min-noconflict/theme-xcode';
import 'ace-builds/src-min-noconflict/mode-xml';

//==============================================================================

export class TextEditor
{
    constructor(textEditorId)
    {
        this._text = '';
        if (textEditorId) {
            this._editor = ace.edit(textEditorId);
            this._editor.setTheme("ace/theme/xcode");
            this._editor.setOptions({
                autoScrollEditorIntoView: true,
                hScrollBarAlwaysVisible: true
            });
            this._editor.session.setMode("ace/mode/xml");
        } else {
            this._editor = null;
        }
    }

    getValue()
    //========
    {
        if (this._editor !== null) {
            this._text = this._editor.getValue();
        }
        return this._text;
    }

    setValue(text)
    //============
    {
        this._text = text;
        if (this._editor !== null) {
            this._editor.setValue(text, 0);
            this._editor.clearSelection();
        }
    }
}

//==============================================================================
