/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as assert from 'assert';
import {Range} from 'vs/editor/common/core/range';
import {Position} from 'vs/editor/common/core/position';
import {Selection} from 'vs/editor/common/core/selection';
import {CodeSnippet} from 'vs/editor/contrib/snippet/common/snippet';
import {SnippetController} from 'vs/editor/contrib/snippet/common/snippetController';
import {MockCodeEditor, withMockCodeEditor} from 'vs/editor/test/common/mocks/mockCodeEditor';
import {Cursor} from 'vs/editor/common/controller/cursor';

class TestSnippetController extends SnippetController {

	isInSnippetMode(): boolean {
		return !!this._currentController;
	}

}

suite('SnippetController', () => {

	function snippetTest(cb:(editor:MockCodeEditor, cursor:Cursor, codeSnippet: CodeSnippet, snippetController:TestSnippetController)=>void): void {
		withMockCodeEditor([
			'function test() {',
			'\tvar x = 3;',
			'\tvar arr = [];',
			'\t',
			'}'
		], {}, (editor, cursor) => {
			editor.getModel().updateOptions({
				insertSpaces: false
			});
			let snippetController = editor.registerAndInstantiateContribution<TestSnippetController>(TestSnippetController);
			let codeSnippet = CodeSnippet.fromInternal([
				'for (var {{index}}; {{index}} < {{array}}.length; {{index}}++) {',
				'\tvar element = {{array}}[{{index}}];',
				'\t{{}}',
				'}'
			].join('\n'));

			cb(editor, cursor, codeSnippet, snippetController);

			snippetController.dispose();
		});
	}

	test('Simple accepted', () => {
		snippetTest((editor, cursor, codeSnippet, snippetController) => {
			editor.setPosition({ lineNumber: 4, column: 2 });

			snippetController.run(codeSnippet, 0, 0, false);
			assert.equal(editor.getModel().getLineContent(4), '\tfor (var index; index < array.length; index++) {');
			assert.equal(editor.getModel().getLineContent(5), '\t\tvar element = array[index];');
			assert.equal(editor.getModel().getLineContent(6), '\t\t');
			assert.equal(editor.getModel().getLineContent(7), '\t}');

			editor.trigger('test', 'type', { text: 'i' });
			assert.equal(editor.getModel().getLineContent(4), '\tfor (var i; i < array.length; i++) {');
			assert.equal(editor.getModel().getLineContent(5), '\t\tvar element = array[i];');
			assert.equal(editor.getModel().getLineContent(6), '\t\t');
			assert.equal(editor.getModel().getLineContent(7), '\t}');

			snippetController.jumpToNextPlaceholder();
			editor.trigger('test', 'type', { text: 'arr' });
			assert.equal(editor.getModel().getLineContent(4), '\tfor (var i; i < arr.length; i++) {');
			assert.equal(editor.getModel().getLineContent(5), '\t\tvar element = arr[i];');
			assert.equal(editor.getModel().getLineContent(6), '\t\t');
			assert.equal(editor.getModel().getLineContent(7), '\t}');

			snippetController.jumpToPrevPlaceholder();
			editor.trigger('test', 'type', { text: 'j' });
			assert.equal(editor.getModel().getLineContent(4), '\tfor (var j; j < arr.length; j++) {');
			assert.equal(editor.getModel().getLineContent(5), '\t\tvar element = arr[j];');
			assert.equal(editor.getModel().getLineContent(6), '\t\t');
			assert.equal(editor.getModel().getLineContent(7), '\t}');

			snippetController.acceptSnippet();
			assert.deepEqual(editor.getPosition(), new Position(6, 3));
		});
	});

	test('Simple canceled', () => {
		snippetTest((editor, cursor, codeSnippet, snippetController) => {
			editor.setPosition({ lineNumber: 4, column: 2 });

			snippetController.run(codeSnippet, 0, 0, false);
			assert.equal(editor.getModel().getLineContent(4), '\tfor (var index; index < array.length; index++) {');
			assert.equal(editor.getModel().getLineContent(5), '\t\tvar element = array[index];');
			assert.equal(editor.getModel().getLineContent(6), '\t\t');
			assert.equal(editor.getModel().getLineContent(7), '\t}');

			snippetController.leaveSnippet();
			assert.deepEqual(editor.getPosition(), new Position(4, 16));
		});
	});

	test('Stops when deleting lines above', () => {
		snippetTest((editor, cursor, codeSnippet, snippetController) => {
			editor.setPosition({ lineNumber: 4, column: 2 });
			snippetController.run(codeSnippet, 0, 0, false);

			editor.getModel().applyEdits([{
				forceMoveMarkers: false,
				identifier: null,
				isAutoWhitespaceEdit: false,
				range: new Range(1, 1, 3, 1),
				text: null
			}]);

			assert.equal(snippetController.isInSnippetMode(), false);
		});
	});

	test('Stops when deleting lines below', () => {
		snippetTest((editor, cursor, codeSnippet, snippetController) => {
			editor.setPosition({ lineNumber: 4, column: 2 });
			snippetController.run(codeSnippet, 0, 0, false);

			editor.getModel().applyEdits([{
				forceMoveMarkers: false,
				identifier: null,
				isAutoWhitespaceEdit: false,
				range: new Range(7, 100, 8, 100),
				text: null
			}]);

			assert.equal(snippetController.isInSnippetMode(), false);
		});
	});

	test('Stops when inserting lines above', () => {
		snippetTest((editor, cursor, codeSnippet, snippetController) => {
			editor.setPosition({ lineNumber: 4, column: 2 });
			snippetController.run(codeSnippet, 0, 0, false);

			editor.getModel().applyEdits([{
				forceMoveMarkers: false,
				identifier: null,
				isAutoWhitespaceEdit: false,
				range: new Range(1, 100, 1, 100),
				text: '\nHello'
			}]);

			assert.equal(snippetController.isInSnippetMode(), false);
		});
	});

	test('Stops when inserting lines below', () => {
		snippetTest((editor, cursor, codeSnippet, snippetController) => {
			editor.setPosition({ lineNumber: 4, column: 2 });
			snippetController.run(codeSnippet, 0, 0, false);

			editor.getModel().applyEdits([{
				forceMoveMarkers: false,
				identifier: null,
				isAutoWhitespaceEdit: false,
				range: new Range(8, 100, 8, 100),
				text: '\nHello'
			}]);

			assert.equal(snippetController.isInSnippetMode(), false);
		});
	});

	test('Stops when calling model.setValue()', () => {
		snippetTest((editor, cursor, codeSnippet, snippetController) => {
			editor.setPosition({ lineNumber: 4, column: 2 });
			snippetController.run(codeSnippet, 0, 0, false);

			editor.getModel().setValue('goodbye');

			assert.equal(snippetController.isInSnippetMode(), false);
		});
	});

	test('Stops when undoing', () => {
		snippetTest((editor, cursor, codeSnippet, snippetController) => {
			editor.setPosition({ lineNumber: 4, column: 2 });
			snippetController.run(codeSnippet, 0, 0, false);

			editor.getModel().undo();

			assert.equal(snippetController.isInSnippetMode(), false);
		});
	});

	test('Stops when moving cursor outside', () => {
		snippetTest((editor, cursor, codeSnippet, snippetController) => {
			editor.setPosition({ lineNumber: 4, column: 2 });
			snippetController.run(codeSnippet, 0, 0, false);

			editor.setPosition({lineNumber:1, column: 1});

			assert.equal(snippetController.isInSnippetMode(), false);
		});
	});

	test('Stops when disconnecting editor model', () => {
		snippetTest((editor, cursor, codeSnippet, snippetController) => {
			editor.setPosition({ lineNumber: 4, column: 2 });
			snippetController.run(codeSnippet, 0, 0, false);

			editor.setModel(null);

			assert.equal(snippetController.isInSnippetMode(), false);
		});
	});

	test('Stops when disposing editor', () => {
		snippetTest((editor, cursor, codeSnippet, snippetController) => {
			editor.setPosition({ lineNumber: 4, column: 2 });
			snippetController.run(codeSnippet, 0, 0, false);

			snippetController.dispose();

			assert.equal(snippetController.isInSnippetMode(), false);
		});
	});

	test('Final tabstop with multiple selections', () => {
		// snippetTest((editor, cursor, codeSnippet, snippetController) => {
		// 	editor.setSelections([
		// 		new Selection(1, 1, 1, 1),
		// 		new Selection(2, 1, 2, 1),
		// 	]);

		// 	codeSnippet = CodeSnippet.fromInternal('foo{{}}');
		// 	snippetController.run(codeSnippet, 0, 0, false);

		// 	assert.equal(editor.getSelections().length, 2);
		// 	const [first, second] = editor.getSelections();
		// 	assert.ok(first.equalsRange({ startLineNumber: 1, startColumn: 4, endLineNumber: 1, endColumn: 4 }), first.toString());
		// 	assert.ok(second.equalsRange({ startLineNumber: 2, startColumn: 4, endLineNumber: 2, endColumn: 4 }), second.toString());
		// });

		// snippetTest((editor, cursor, codeSnippet, snippetController) => {
		// 	editor.setSelections([
		// 		new Selection(1, 1, 1, 1),
		// 		new Selection(2, 1, 2, 1),
		// 	]);

		// 	codeSnippet = CodeSnippet.fromInternal('foo{{}}bar');
		// 	snippetController.run(codeSnippet, 0, 0, false);

		// 	assert.equal(editor.getSelections().length, 2);
		// 	const [first, second] = editor.getSelections();
		// 	assert.ok(first.equalsRange({ startLineNumber: 1, startColumn: 4, endLineNumber: 1, endColumn: 4 }), first.toString());
		// 	assert.ok(second.equalsRange({ startLineNumber: 2, startColumn: 4, endLineNumber: 2, endColumn: 4 }), second.toString());
		// });

		// snippetTest((editor, cursor, codeSnippet, snippetController) => {
		// 	editor.setSelections([
		// 		new Selection(1, 1, 1, 1),
		// 		new Selection(1, 5, 1, 5),
		// 	]);

		// 	codeSnippet = CodeSnippet.fromInternal('foo{{}}bar');
		// 	snippetController.run(codeSnippet, 0, 0, false);

		// 	assert.equal(editor.getSelections().length, 2);
		// 	const [first, second] = editor.getSelections();
		// 	assert.ok(first.equalsRange({ startLineNumber: 1, startColumn: 4, endLineNumber: 1, endColumn: 4 }), first.toString());
		// 	assert.ok(second.equalsRange({ startLineNumber: 1, startColumn: 14, endLineNumber: 1, endColumn: 14 }), second.toString());
		// });

		// snippetTest((editor, cursor, codeSnippet, snippetController) => {
		// 	editor.setSelections([
		// 		new Selection(1, 1, 1, 1),
		// 		new Selection(1, 5, 1, 5),
		// 	]);

		// 	codeSnippet = CodeSnippet.fromInternal('foo\n{{}}\nbar');
		// 	snippetController.run(codeSnippet, 0, 0, false);

		// 	assert.equal(editor.getSelections().length, 2);
		// 	const [first, second] = editor.getSelections();
		// 	assert.ok(first.equalsRange({ startLineNumber: 2, startColumn: 1, endLineNumber: 2, endColumn: 1 }), first.toString());
		// 	assert.ok(second.equalsRange({ startLineNumber: 4, startColumn: 1, endLineNumber: 4, endColumn: 1 }), second.toString());
		// });
	});
});