import test from 'node:test';
import assert from 'node:assert/strict';
import { markdownCheckpoints,setCheckpoint } from '../src/checkpoints.js';

test('extracts two checkbox levels without their supporting text or ordinary bullets',() => {
 const description = 'Overview\n\n- [ ] Ship the feature\n  Supporting text on the next line.\n\n  More details in another paragraph.\n  - Notes only\n  - [x] Add the UI\n    More child details.\n    - [ ] Too deeply nested\n  - [ ] Verify saving\n- [X] Write documentation\n\nClosing notes.';
 const checkpoints = markdownCheckpoints(description);
 const visible = checkpoints.map(({text,checked,depth}) => ({text,checked,depth}));
 assert.deepEqual(visible,[
  {text:'Ship the feature',checked:false,depth:0},
  {text:'Add the UI',checked:true,depth:1},
  {text:'Verify saving',checked:false,depth:1},
  {text:'Write documentation',checked:true,depth:0}
 ]);
});

test('uses Markdown list structure rather than matching checkbox-looking text',() => {
 const description = '[ ] Outside a list\n\n`- [ ] Inline code`\n\n```md\n- [ ] Fenced code\n```\n\n    - [ ] Indented code\n\n<!--\n- [ ] HTML comment\n-->\n\n- \\[ ] Escaped marker\n- [no] Not a checkbox\n\n1. [ ] Ordered checkpoint\n   - [x] Nested checkpoint\n\n* [ ] Asterisk checkpoint\n+ [ ] Plus checkpoint';
 const checkpoints = markdownCheckpoints(description);
 const labels = checkpoints.map(checkpoint => checkpoint.text);
 assert.deepEqual(labels,['Ordered checkpoint','Nested checkpoint','Asterisk checkpoint','Plus checkpoint']);
});

test('ignores ordinary list items when finding the checkbox hierarchy',() => {
 const description = '- Plain list\n  - [ ] Parent\n    - Plain note\n      - [ ] Child\n        - [ ] Third checkbox level';
 const checkpoints = markdownCheckpoints(description);
 const visible = checkpoints.map(({text,depth}) => ({text,depth}));
 assert.deepEqual(visible,[{text:'Parent',depth:0},{text:'Child',depth:1}]);
});

test('toggles the selected marker and preserves identical labels, attachments, and line endings',() => {
 const description = '✓ Overview\r\n\r\n- [ ] Same label\r\n  Details\r\n  - [X] Same label\r\n\r\n![Screenshot](data:image/png;base64,YWJj)';
 const checkpoints = markdownCheckpoints(description);
 const parent = setCheckpoint(description,checkpoints[0].position,true);
 const expectedParent = description.replace('- [ ] Same label','- [x] Same label');
 assert.equal(parent,expectedParent);
 const child = setCheckpoint(parent,checkpoints[1].position,false);
 const expectedChild = parent.replace('- [X] Same label','- [ ] Same label');
 assert.equal(child,expectedChild);
 const actual = markdownCheckpoints(child);
 const checked = actual.map(checkpoint => checkpoint.checked);
 assert.deepEqual(checked,[true,false]);
 assert.equal(actual[1].text,'Same label');
});
