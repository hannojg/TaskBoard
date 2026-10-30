import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoardSync } from '../src/ui/board-sync.js';
import { sharedFixture } from './support/shared.mjs';

function deferred() {
 let resolve;
 let reject;
 const promise = new Promise((success,failure) => { resolve = success; reject = failure; });
 return {promise,resolve,reject};
}

async function fixture(t) {
 const shared = await sharedFixture(t);
 const client = shared.client();
 const project = {id:'p',name:'Project',repo:'',path:'',codexId:'',hostId:'local'};
 const task = {id:'t',title:'Ticket',description:'- [ ] First\n- [ ] Second',priority:'None',due:'',projectId:'p',statusId:'backlog',chats:[]};
 const initial = await client.save({version:3,projects:[project],tasks:[task]},0);
 let local = structuredClone(initial);
 let status;
 const calls = [];
 const gates = [];
 const api = {async save(state,revision) {
  const snapshot = structuredClone(state);
  calls.push({state:snapshot,revision});
  const gate = gates.shift();
  if (gate) await gate.promise;
  return client.save(state,revision);
 }};
 const sync = createBoardSync(initial,api,(data,next) => { local = data; status = next; });
 return {sync,client,shared,calls,gates,get local() { return local; },get status() { return status; }};
}

test('rapid edits stay optimistic, coalesce behind an in-flight save and use successive revisions',async t => {
 const f = await fixture(t);
 const gate = deferred();
 f.gates.push(gate);
 f.local.state.tasks[0].title = 'First edit';
 const first = f.sync.save(f.local.state);
 assert.equal(f.status.saving,true);
 assert.equal(f.local.state.tasks[0].title,'First edit');
 f.local.state.tasks[0].title = 'Latest edit';
 const second = f.sync.save(f.local.state);
 f.local.state.tasks[0].priority = 'High';
 const third = f.sync.save(f.local.state);
 assert.equal(f.calls.length,1);
 assert.equal(f.calls[0].state.tasks[0].title,'First edit');
 assert.equal(f.local.state.tasks[0].title,'Latest edit');
 gate.resolve();
 await Promise.all([first,second,third]);
 assert.equal(f.calls.length,2);
 assert.equal(f.calls[1].revision,f.calls[0].revision+1);
 assert.equal(f.calls[1].state.tasks[0].title,'Latest edit');
 assert.equal(f.local.state.tasks[0].priority,'High');
 assert.equal(f.status.dirty,false);
 const stored = await f.client.read();
 assert.equal(stored.state.tasks[0].title,'Latest edit');
 assert.equal(stored.state.tasks[0].priority,'High');
});

test('server-normalized chat identity survives edits queued before its response',async t => {
 const f = await fixture(t);
 const gate = deferred();
 f.gates.push(gate);
 f.local.state.tasks[0].chats.push({threadId:'chat',hostId:'local',title:'Chat',url:''});
 const first = f.sync.save(f.local.state);
 f.local.state.tasks[0].statusId = 'todo';
 const second = f.sync.save(f.local.state);
 gate.resolve();
 await Promise.all([first,second]);
 assert.equal(f.calls[1].state.tasks[0].chats[0].deviceId,f.client.connection.deviceId);
 assert.equal(f.local.state.tasks[0].statusId,'todo');
});

test('failed saves keep edits and allow further edits until an explicit retry',async t => {
 const f = await fixture(t);
 const gate = deferred();
 f.gates.push(gate);
 f.local.state.tasks[0].title = 'Kept after failure';
 const first = f.sync.save(f.local.state);
 f.local.state.tasks[0].priority = 'High';
 const second = f.sync.save(f.local.state);
 gate.reject(new Error('Network unavailable'));
 const results = await Promise.all([first,second]);
 assert.deepEqual(results,[false,false]);
 assert.equal(f.local.state.tasks[0].title,'Kept after failure');
 assert.equal(f.status.saving,false);
 assert.equal(f.status.dirty,true);
 assert.match(f.status.error.message,/Network unavailable/);
 f.local.state.tasks[0].due = '2026-11-01';
 await f.sync.save(f.local.state);
 assert.equal(f.calls.length,1);
 await f.sync.retry();
 assert.equal(f.status.error,null);
 assert.equal(f.status.dirty,false);
 const stored = await f.client.read();
 assert.equal(stored.state.tasks[0].title,'Kept after failure');
 assert.equal(stored.state.tasks[0].priority,'High');
 assert.equal(stored.state.tasks[0].due,'2026-11-01');
});

test('retry respects cross-device revision conflicts and retains the local work',async t => {
 const f = await fixture(t);
 const other = f.shared.client();
 const remote = await other.read();
 remote.state.tasks[0].title = 'Changed on another Mac';
 await other.save(remote.state,remote.revision);
 f.local.state.tasks[0].title = 'Local edit';
 await f.sync.save(f.local.state);
 assert.equal(f.status.dirty,true);
 await f.sync.retry();
 assert.equal(f.local.state.tasks[0].title,'Local edit');
 assert.match(f.status.error.message,/changed on another/);
 const stored = await other.read();
 assert.equal(stored.state.tasks[0].title,'Changed on another Mac');
 const accepted = f.sync.receive(stored);
 assert.equal(accepted,false);
 assert.equal(f.local.state.tasks[0].title,'Local edit');
 f.sync.receive(stored,true);
 assert.equal(f.status.dirty,false);
 assert.equal(f.local.state.tasks[0].title,'Changed on another Mac');
});

test('imports serialize with saves and do not disappear when later edits finish',async t => {
 const f = await fixture(t);
 const gate = deferred();
 let started;
 const entered = new Promise(resolve => { started = resolve; });
 const imported = f.sync.run(async revision => {
  started();
  await gate.promise;
  const remote = await f.client.read();
  const task = {...remote.state.tasks[0],id:'imported',title:'Imported ticket'};
  remote.state.tasks.push(task);
  const saved = await f.client.save(remote.state,revision);
  return {...saved,importedTaskId:task.id};
 });
 await entered;
 f.local.state.tasks[0].title = 'Edited while importing';
 const edited = f.sync.save(f.local.state);
 gate.resolve();
 await Promise.all([imported,edited]);
 const stored = await f.client.read();
 assert.equal(stored.state.tasks.length,2);
 assert.equal(stored.state.tasks[0].title,'Edited while importing');
 assert.equal(stored.state.tasks[1].title,'Imported ticket');
});

test('source refreshes preserve later local notes and source failures do not pause ordinary saves',async t => {
 const f = await fixture(t);
 const gate = deferred();
 const source = f.sync.run(async revision => {
  await gate.promise;
  const remote = await f.client.read();
  remote.state.tasks[0].due = '2026-11-02';
  return f.client.save(remote.state,revision);
 });
 f.local.state.tasks[0].description = 'New local notes';
 const edited = f.sync.save(f.local.state);
 gate.resolve();
 await Promise.all([source,edited]);
 assert.equal(f.local.state.tasks[0].due,'2026-11-02');
 assert.equal(f.local.state.tasks[0].description,'New local notes');
 const failed = f.sync.run(async () => { throw new Error('GitHub unavailable'); });
 await assert.rejects(failed,/GitHub unavailable/);
 f.local.state.tasks[0].title = 'Still editable';
 await f.sync.save(f.local.state);
 assert.equal(f.status.error,null);
 assert.equal(f.local.state.tasks[0].title,'Still editable');
});

test('a failed save cancels queued source writes and retains edits queued after them',async t => {
 const f = await fixture(t);
 const gate = deferred();
 f.gates.push(gate);
 f.local.state.tasks[0].title = 'Pending title';
 const saved = f.sync.save(f.local.state);
 let sourceCalls = 0;
 const source = f.sync.run(async () => {
  sourceCalls += 1;
  return f.client.read();
 });
 const rejected = assert.rejects(source,/Network unavailable/);
 f.local.state.tasks[0].description = 'Notes after the source request';
 const notes = f.sync.save(f.local.state);
 gate.reject(new Error('Network unavailable'));
 await Promise.all([saved,notes,rejected]);
 assert.equal(sourceCalls,0);
 await f.sync.retry();
 assert.equal(sourceCalls,0);
 const stored = await f.client.read();
 assert.equal(stored.state.tasks[0].title,'Pending title');
 assert.equal(stored.state.tasks[0].description,'Notes after the source request');
});

test('creates, deletes and both column orders survive a delayed acknowledgement',async t => {
 const f = await fixture(t);
 const gate = deferred();
 f.gates.push(gate);
 f.local.state.tasks[0].title = 'Initial edit';
 const first = f.sync.save(f.local.state);
 const original = f.local.state.tasks[0];
 f.local.state.tasks.push({...original,id:'second',title:'Second'});
 const second = f.sync.save(f.local.state);
 f.local.state.tasks = f.local.state.tasks.filter(task => task.id !== 't');
 f.local.state.projects.push({...f.local.state.projects[0],id:'q',name:'Other project'});
 f.local.state.projects.reverse();
 f.local.state.statusOrder.reverse();
 const third = f.sync.save(f.local.state);
 gate.resolve();
 await Promise.all([first,second,third]);
 const stored = await f.client.read();
 const ids = stored.state.tasks.map(task => task.id);
 const projects = stored.state.projects.map(project => project.id);
 assert.deepEqual(ids,['second']);
 assert.deepEqual(projects,['q','p']);
 assert.equal(stored.state.statusOrder[0],'done');
});
