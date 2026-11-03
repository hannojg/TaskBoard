import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync,existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readPreferences,savePreferences } from '../src/server/preferences.mjs';

function fixture(t) {
 const temporary = tmpdir();
 const prefix = join(temporary,'taskboard-preferences-');
 const directory = mkdtempSync(prefix);
 t.after(() => rmSync(directory,{recursive:true,force:true}));
 return directory;
}

test('a new Mac hides done tasks until a filter is selected',t => {
 const directory = fixture(t);
 const preferences = readPreferences(directory);
 assert.deepEqual(preferences,{statusFilter:'active'});
 const file = join(directory,'preferences.json');
 const exists = existsSync(file);
 assert.equal(exists,false);
});

test('filter changes persist outside the plugin cache and stay independent between Macs',t => {
 const directory = fixture(t);
 const first = join(directory,'first-mac');
 const second = join(directory,'second-mac');
 savePreferences(first,{statusFilter:'all'});
 savePreferences(second,{statusFilter:'progress'});
 savePreferences(first,{statusFilter:'review'});
 const firstPreferences = readPreferences(first);
 const secondPreferences = readPreferences(second);
 assert.deepEqual(firstPreferences,{statusFilter:'review'});
 assert.deepEqual(secondPreferences,{statusFilter:'progress'});
 assert.throws(() => savePreferences(first,{statusFilter:'invalid'}));
 const preserved = readPreferences(first);
 assert.deepEqual(preserved,{statusFilter:'review'});
});
