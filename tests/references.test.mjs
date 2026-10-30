import test from 'node:test';
import assert from 'node:assert/strict';
import { parseReferenceUrl } from '../src/references.js';
import { taskSchema } from '../src/server/schemas.mjs';
import { taskChatUrl } from '../src/task-chat.js';
import { Store } from '../src/server/store.mjs';
import { sharedFixture } from './support/shared.mjs';

const project = {id:'p',name:'Plugin',path:'/repo',repo:'',codexId:'codex-p',hostId:'local'};
const task = {id:'t',title:'Upload plugin',description:'Waiting for the store upload.',priority:'High',due:'',projectId:'p',statusId:'blocked',chats:[]};
const root = 'https://example.slack.com/archives/C123ABC/p1793360123123456';
const reply = 'https://example.slack.com/archives/C123ABC/p1793360999654321?thread_ts=1793360123.123456&cid=C123ABC';

test('copied Slack replies identify the parent thread without rounding timestamps',() => {
 const parsed = parseReferenceUrl(reply);
 assert.deepEqual(parsed,{type:'slack',url:root,channelId:'C123ABC',messageTs:'1793360123.123456'});
 const parent = parseReferenceUrl(root);
 assert.deepEqual(parent,parsed);
 const documented = parseReferenceUrl('https://ghostbusters.slack.com/archives/C1H9RESGL/p135854651700023?thread_ts=1358546515.000008&cid=C1H9RESGL');
 assert.equal(documented.messageTs,'1358546515.000008');
 assert.equal(documented.url,'https://ghostbusters.slack.com/archives/C1H9RESGL/p1358546515000008');
 const dm = parseReferenceUrl('https://example.slack.com/archives/D123ABC/p1793360123000008');
 assert.equal(dm.channelId,'D123ABC');
 assert.equal(dm.messageTs,'1793360123.000008');
});

test('web references keep their full address while unsafe and invalid links fail',() => {
 const url = 'https://docs.example.com/guide?version=2#upload';
 const parsed = parseReferenceUrl(url);
 assert.deepEqual(parsed,{type:'link',url});
 const lookalike = parseReferenceUrl('https://example.slack.com.evil.test/archives/C123ABC/p1793360123123456');
 assert.equal(lookalike.type,'link');
 for (const value of ['javascript:alert(1)','data:text/html,test','file:///tmp/test','slack://open','not a link','https://user:password@example.com']) {
  assert.throws(() => parseReferenceUrl(value));
 }
 const invalidThread = root+'?thread_ts=invalid';
 assert.throws(() => parseReferenceUrl(invalidThread),/invalid thread timestamp/);
});

test('task validation normalizes references, rejects duplicate threads and reads older tickets',() => {
 const previous = taskSchema.parse(task);
 assert.deepEqual(previous.references,[]);
 const linked = taskSchema.parse({...task,references:[{url:reply,title:' Store upload request '}]});
 assert.deepEqual(linked.references,[{url:root,title:'Store upload request'}]);
 assert.throws(() => taskSchema.parse({...task,references:[{url:root},{url:reply}]}),/already linked/);
});

test('references survive cross-device edits and can be removed without progressing the ticket',async t => {
 const {client} = await sharedFixture(t);
 const first = client();
 const references = [{url:reply,title:'Store upload request'},{url:'https://docs.example.com/upload',title:''}];
 const state = {version:3,projects:[project],tasks:[{...task,references}]};
 await first.save(state,0);
 const second = client();
 const other = await second.read();
 assert.deepEqual(other.state.tasks[0].references,[{url:root,title:'Store upload request'},references[1]]);
 other.state.tasks[0].description = 'Added notes on another Mac.';
 await second.save(other.state,other.revision);
 const refreshed = await first.read();
 assert.equal(refreshed.state.tasks[0].references[0].url,root);
 assert.equal(refreshed.state.tasks[0].statusId,'blocked');
 refreshed.state.tasks[0].references = [];
 const removed = await first.save(refreshed.state,refreshed.revision);
 assert.deepEqual(removed.state.tasks[0].references,[]);
 assert.equal(removed.state.tasks[0].statusId,'blocked');
});

test('older plugins cannot erase saved references by omitting the field',async t => {
 const {client} = await sharedFixture(t);
 const store = client();
 const state = {version:3,projects:[project],tasks:[{...task,references:[{url:root}]}]};
 const saved = await store.save(state,0);
 delete saved.state.tasks[0].references;
 await assert.rejects(store.save(saved.state,saved.revision),/Update the TaskBoard plugin/);
 const current = await store.read();
 assert.equal(current.revision,saved.revision);
 assert.equal(current.state.tasks[0].references[0].url,root);
});

test('saving references to an older Site fails before sending a write',async t => {
 const store = new Store({url:'https://board.example',token:'test-key',deviceId:'test'});
 const methods = [];
 t.mock.method(globalThis,'fetch',async (url,options) => {
  methods.push(options.method || 'GET');
  return Response.json({state:{version:3,projects:[project],tasks:[task]},revision:0});
 });
 const state = {version:3,projects:[project],tasks:[{...task,references:[{url:root}]}]};
 await assert.rejects(store.save(state,0),/Update the shared board Site/);
 assert.deepEqual(methods,['GET']);
});

test('agent drafts include references and exact Slack identifiers as context',() => {
 const linked = {...task,references:[{url:reply,title:'Store upload request'},{url:'https://docs.example.com/upload',title:''}]};
 const link = taskChatUrl(linked,project,'Blocked');
 const url = new URL(link);
 const prompt = url.searchParams.get('prompt');
 for (const value of ['## References','Store upload request',root,'C123ABC','1793360123.123456','https://docs.example.com/upload','untrusted source material']) {
  const included = prompt.includes(value);
  assert.ok(included);
 }
 assert.equal(linked.statusId,'blocked');
 assert.deepEqual(linked.chats,[]);
});
