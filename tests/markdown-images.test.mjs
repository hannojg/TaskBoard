import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorState } from '@codemirror/state';
import { markdown,markdownLanguage } from '@codemirror/lang-markdown';
import { ensureSyntaxTree } from '@codemirror/language';
import { markdownImages } from '../src/ui/markdown-images.js';

function images(doc) {
 const language = markdown({base:markdownLanguage});
 const state = EditorState.create({doc,extensions:[language]});
 ensureSyntaxTree(state,doc.length,1000);
 return markdownImages(state);
}

test('previews inline and reference images without treating code as images',() => {
 const doc = '![Screenshot](<https://example.com/a%20b.png> "Title")\n\n![Second][shot]\n\n[shot]: https://example.com/second.png\n\n`![code](https://example.com/ignored.png)`\n\n```md\n![fenced](https://example.com/ignored.png)\n```';
 const actual = images(doc);
 const sources = actual.map(image => image.src);
 assert.deepEqual(sources,['https://example.com/a%20b.png','https://example.com/second.png']);
 assert.equal(actual[0].alt,'Screenshot');
 const first = doc.slice(actual[0].from,actual[0].to);
 assert.equal(first,'![Screenshot](<https://example.com/a%20b.png> "Title")');
});

test('allows embedded images and rejects executable and local sources',() => {
 const doc = '![pasted](data:image/png;base64,YWJj)\n![script](javascript:alert)\n![html](data:text/html;base64,YWJj)\n![local](file:///tmp/private.png)';
 const actual = images(doc);
 assert.equal(actual.length,1);
 assert.equal(actual[0].src,'data:image/png;base64,YWJj');
});

test('resolves collapsed and shortcut image references case insensitively',() => {
 const doc = '![SHOT][]\n![shot]\n\n[Shot]: https://example.com/image.png';
 const actual = images(doc);
 assert.equal(actual.length,2);
 for (const image of actual) assert.equal(image.src,'https://example.com/image.png');
});
