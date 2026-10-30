import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm,readFile,mkdir,writeFile,access,stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { beginCreation,readCreation,updateCreation } from '../scripts/creation.mjs';
import { completeCreation } from '../src/server/creation.mjs';

async function fixture(t) {
 const temporary = tmpdir();
 const prefix = join(temporary,'taskboard-creation-');
 const directory = await mkdtemp(prefix);
 t.after(() => rm(directory,{recursive:true}));
 return directory;
}

test('concurrent create actions share one saved request and one agent prompt',async t => {
 const directory = await fixture(t);
 const results = await Promise.all([beginCreation(directory),beginCreation(directory)]);
 assert.equal(results[0].creation.requestId,results[1].creation.requestId);
 const requested = results.filter(result => result.shouldRequest);
 assert.equal(requested.length,1);
 const path = join(directory,'connection.json');
 const connection = access(path);
 await assert.rejects(connection);
});

test('failed setup resumes its original Site and refuses to replace that Site identity',async t => {
 const directory = await fixture(t);
 const started = await beginCreation(directory);
 const id = started.creation.requestId;
 await updateCreation(directory,id,'provisioning','test-site-id');
 await updateCreation(directory,id,'failed');
 const resumed = await beginCreation(directory);
 assert.equal(resumed.creation.requestId,id);
 assert.equal(resumed.creation.projectId,'test-site-id');
 assert.equal(resumed.shouldRequest,true);
 const replaced = updateCreation(directory,id,'publishing','different-site-id');
 await assert.rejects(replaced,/Resume the existing Site/);
});

test('bundled Site preparation preserves the new Site ID and excludes the maintainer identity',async t => {
 const directory = await fixture(t);
 const started = await beginCreation(directory);
 const creation = started.creation;
 await updateCreation(directory,creation.requestId,'provisioning','test-site-id');
 const metadataDirectory = join(creation.sourceDirectory,'.openai');
 await mkdir(metadataDirectory,{recursive:true});
 const manifestPath = join(metadataDirectory,'hosting.json');
 const manifest = JSON.stringify({project_id:'test-site-id',d1:null,r2:null});
 await writeFile(manifestPath,manifest);
 const script = resolve('plugins/taskboard/scripts/prepare-board.mjs');
 const result = spawnSync(process.execPath,[script,creation.requestId],{encoding:'utf8',env:{...process.env,TASKBOARD_DATA_DIR:directory}});
 assert.equal(result.status,0,result.stderr);
 const preparedText = await readFile(manifestPath,'utf8');
 const prepared = JSON.parse(preparedText);
 assert.deepEqual(prepared,{project_id:'test-site-id',d1:'DB',r2:'BUCKET'});
 const api = join(creation.sourceDirectory,'lib','board-api.mjs');
 await access(api);
 const templateManifest = resolve('plugins/taskboard/site/.openai/hosting.json');
 const privateManifest = access(templateManifest);
 await assert.rejects(privateManifest);
});

test('completion validates the saved Site, keeps credentials local and prevents a second connection',async t => {
 const directory = await fixture(t);
 const started = await beginCreation(directory);
 const requestId = started.creation.requestId;
 await updateCreation(directory,requestId,'publishing','test-site-id');
 const input = {requestId,projectId:'test-site-id',url:'https://board.example',token:'private-test-key'};
 const board = {state:{version:3,projects:[],tasks:[]},revision:0};
 t.mock.method(globalThis,'fetch',async () => Response.json(board));
 const mismatched = completeCreation(directory,{...input,projectId:'other-site'});
 await assert.rejects(mismatched,/Site project ID/);
 await completeCreation(directory,input);
 const creation = await readCreation(directory);
 assert.equal(creation.status,'complete');
 const journal = JSON.stringify(creation);
 const containsToken = journal.includes(input.token);
 assert.equal(containsToken,false);
 const path = join(directory,'connection.json');
 const text = await readFile(path,'utf8');
 const connection = JSON.parse(text);
 assert.equal(connection.token,input.token);
 assert.ok(connection.deviceId);
 const attributes = await stat(path);
 assert.equal(attributes.mode & 0o777,0o600);
 const repeated = completeCreation(directory,input);
 await assert.rejects(repeated,/already connected/);
 const another = beginCreation(directory);
 await assert.rejects(another,/already connected/);
});

test('a failed access check leaves creation resumable without saving credentials',async t => {
 const directory = await fixture(t);
 const started = await beginCreation(directory);
 const requestId = started.creation.requestId;
 await updateCreation(directory,requestId,'publishing','test-site-id');
 t.mock.method(globalThis,'fetch',async () => new Response('',{status:403}));
 const completion = completeCreation(directory,{requestId,projectId:'test-site-id',url:'https://board.example',token:'wrong-key'});
 await assert.rejects(completion,/access was denied/);
 const path = join(directory,'connection.json');
 const connection = access(path);
 await assert.rejects(connection);
 const current = await readCreation(directory);
 assert.equal(current.projectId,'test-site-id');
 assert.equal(current.status,'publishing');
});

test('the bundled completion command never echoes invalid private input',async t => {
 const directory = await fixture(t);
 const script = resolve('plugins/taskboard/scripts/complete-creation.mjs');
 const secret = 'private-input-that-must-not-appear-in-output';
 const result = spawnSync(process.execPath,[script],{encoding:'utf8',input:secret+'\n',env:{...process.env,TASKBOARD_DATA_DIR:directory}});
 assert.equal(result.status,1);
 const output = result.stdout+result.stderr;
 const echoedInput = output.includes(secret);
 assert.equal(echoedInput,false);
 assert.match(output,/Send valid board connection JSON through stdin/);
});
