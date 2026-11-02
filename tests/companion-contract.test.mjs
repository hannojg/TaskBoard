import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { boardSchema } from '../src/server/schemas.mjs';
import { sharedFixture } from './support/shared.mjs';

test('the macOS companion fixture matches the shared board protocol',async t => {
 const path = new URL('../macos/Tests/Fixtures/board.json',import.meta.url);
 const text = await readFile(path,'utf8');
 const fixture = JSON.parse(text);
 const state = boardSchema.parse(fixture.state);
 const shared = await sharedFixture(t);
 const client = shared.client();
 await client.save(state,0);
 const current = await client.read();
 assert.deepEqual(current.state,state);
});
