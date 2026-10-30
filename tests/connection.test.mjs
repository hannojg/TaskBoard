import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,readFileSync,writeFileSync,statSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

function fixture(t) {
 const temporary = tmpdir();
 const root = mkdtempSync(join(temporary,'taskboard-connect-'));
 t.after(() => rmSync(root,{recursive:true}));
 function run(script,directory,args) {
  const path = resolve('scripts',script);
  return spawnSync(process.execPath,[path,...args],{encoding:'utf8',env:{...process.env,TASKBOARD_DATA_DIR:directory}});
 }
 function settings(directory) {
  const path = join(directory,'connection.json');
  const text = readFileSync(path,'utf8');
  return JSON.parse(text);
 }
 return {root,run,settings};
}

test('importing one private file on two Macs assigns separate identities and preserves reconnections',t => {
 const {root,run,settings} = fixture(t);
 const transfer = join(root,'TaskBoard-connection.json');
 const shared = {url:'https://board.example',token:'private-test-key',deviceId:'do-not-copy-this-id'};
 const sharedText = JSON.stringify(shared);
 writeFileSync(transfer,sharedText);
 const firstDirectory = join(root,'first');
 const secondDirectory = join(root,'second');
 const firstResult = run('connect.mjs',firstDirectory,[transfer]);
 const secondResult = run('connect.mjs',secondDirectory,[transfer]);
 assert.equal(firstResult.status,0);
 assert.equal(secondResult.status,0);
 assert.equal(firstResult.stdout.includes(shared.token),false);
 const first = settings(firstDirectory);
 const second = settings(secondDirectory);
 assert.notEqual(first.deviceId,second.deviceId);
 assert.notEqual(first.deviceId,shared.deviceId);
 assert.equal(first.token,shared.token);
 assert.equal(second.url,shared.url);
 const reconnected = run('connect.mjs',firstDirectory,[transfer]);
 assert.equal(reconnected.status,0);
 const sameMac = settings(firstDirectory);
 assert.equal(sameMac.deviceId,first.deviceId);
 const path = join(firstDirectory,'connection.json');
 const permissions = statSync(path);
 assert.equal(permissions.mode & 0o777,0o600);
});

test('exports only board access, reuses its own export and preserves a different private file',t => {
 const {root,run} = fixture(t);
 const transfer = join(root,'received.json');
 const shared = {url:'https://board.example',token:'private-test-key'};
 const sharedText = JSON.stringify(shared);
 writeFileSync(transfer,sharedText);
 const directory = join(root,'mac');
 const imported = run('connect.mjs',directory,[transfer]);
 assert.equal(imported.status,0);
 const output = join(root,'shared.json');
 const exported = run('share-connection.mjs',directory,[output]);
 assert.equal(exported.status,0);
 assert.equal(exported.stdout.includes(shared.token),false);
 const text = readFileSync(output,'utf8');
 const data = JSON.parse(text);
 assert.deepEqual(data,shared);
 const repeated = run('share-connection.mjs',directory,[output]);
 assert.equal(repeated.status,0);
 const different = JSON.stringify({url:'https://other.example',token:'other-test-key'});
 writeFileSync(output,different);
 const refused = run('share-connection.mjs',directory,[output]);
 assert.notEqual(refused.status,0);
 const preserved = readFileSync(output,'utf8');
 assert.equal(preserved,different);
});
