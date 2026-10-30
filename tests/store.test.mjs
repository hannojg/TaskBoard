import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedFixture } from './support/shared.mjs';
import { migrateBoard } from '../src/server/chats.mjs';
import { Store } from '../src/server/store.mjs';

const project = {id:'p',name:'Project',repo:'',path:'/repo',codexId:'codex-p',hostId:'local'};
const task = {id:'t',title:'Ticket',description:'**Markdown**',priority:'None',due:'',projectId:'p',statusId:'review',chats:[{threadId:'chat-1',hostId:'local',title:'Chat one',url:''}]};
const initial = {version:3,projects:[project],tasks:[task]};

test('pasted images survive cross-device saves without filling the board database row',async t => {
 const {client,db,images} = await sharedFixture(t);
 const first = client();
 const source = 'data:image/png;base64,'+'a'.repeat(2400000);
 const description = 'Screenshot\n\n![Screen]('+source+')';
 const withImage = {...initial,tasks:[{...task,description}]};
 const saved = await first.save(withImage,0);
 assert.equal(saved.state.tasks[0].description,description);
 assert.equal(images.size,1);
 const statement = db.prepare('SELECT data FROM board WHERE id=1');
 const row = await statement.first();
 assert.ok(row.data.length < 2000);
 assert.match(row.data,/taskboard-image:[a-f0-9]{64}/);
 assert.equal(row.data.includes(source),false);
 const second = client();
 const other = await second.read();
 assert.equal(other.state.tasks[0].description,description);
 other.state.tasks[0].title = 'Screenshot edited on second Mac';
 await second.save(other.state,other.revision);
 const reloaded = await first.read();
 assert.equal(reloaded.state.tasks[0].description,description);
 assert.equal(images.size,1);
 assert.equal(reloaded.state.tasks[0].title,'Screenshot edited on second Mac');
});

test('failed image uploads do not overwrite the saved board',async t => {
 const {client,bucket} = await sharedFixture(t);
 const store = client();
 const saved = await store.save(initial,0);
 bucket.put = async () => { throw new Error('Image storage unavailable'); };
 const withImage = {...saved.state,tasks:[{...task,description:'![Screen](data:image/png;base64,YWJj)'}]};
 t.mock.method(console,'error',() => {});
 await assert.rejects(store.save(withImage,saved.revision),/Could not access/);
 const current = await store.read();
 assert.equal(current.revision,saved.revision);
 assert.equal(current.state.tasks[0].description,task.description);
});

test('two machines share tasks while preserving their separate project bindings',async t => {
 const {client} = await sharedFixture(t);
 const first = client(); const second = client();
 await first.save(initial,0);
 const other = await second.read();
 assert.equal(other.state.tasks[0].description,'**Markdown**');
 assert.equal(other.state.projects[0].path,'');
 other.state.projects[0].path = '/second/repo'; other.state.projects[0].codexId = 'second-codex';
 other.state.tasks[0].title = 'Edited on second Mac';
 await second.save(other.state,other.revision);
 const original = await first.read();
 assert.equal(original.state.projects[0].path,'/repo');
 assert.equal(original.state.projects[0].codexId,'codex-p');
 assert.equal(original.state.tasks[0].title,'Edited on second Mac');
 assert.equal(original.state.projects[0].bindings.length,2);
 const freshPanel = client(first.connection.deviceId);
 const persisted = await freshPanel.read();
 assert.equal(persisted.state.projects[0].path,'/repo');
});

test('simultaneous writers accept one revision and reject the stale write',async t => {
 const {client} = await sharedFixture(t);
 const first = client(); const second = client();
 const writes = await Promise.allSettled([first.save(initial,0),second.save({...initial,projects:[{...project,name:'Other'}]},0)]);
 const successes = writes.filter(result => result.status === 'fulfilled');
 const failures = writes.filter(result => result.status === 'rejected');
 assert.equal(successes.length,1); assert.equal(failures.length,1);
 assert.match(failures[0].reason.message,/changed on another machine/);
 const saved = await first.read();
 assert.equal(saved.revision,1);
});

test('rejects invalid boards without changing shared data',async t => {
 const {client} = await sharedFixture(t); const store = client();
 await assert.rejects(store.save({version:3,projects:[],tasks:[task]},0),/does not exist/);
 await assert.rejects(store.save({version:3,projects:[project,project],tasks:[]},0),/Duplicate/);
 const duplicate = {...task,chats:[task.chats[0],task.chats[0]]};
 await assert.rejects(store.save({...initial,tasks:[duplicate]},0),/Duplicate chat relation/);
 const current = await store.read(); assert.equal(current.revision,0);
});

test('normalizing an unstamped chat cannot persist duplicate relations',async t => {
 const {client} = await sharedFixture(t); const store = client();
 const saved = await store.save(initial,0);
 saved.state.tasks[0].chats.push({...task.chats[0]});
 await assert.rejects(store.save(saved.state,saved.revision),/Duplicate chat relation/);
 const current = await store.read();
 assert.equal(current.revision,saved.revision);
 assert.equal(current.state.tasks[0].chats.length,1);
});

test('catalog refreshes are scoped to a machine and bounded chat reads merge',async t => {
 const {client} = await sharedFixture(t); const first = client(); const second = client();
 await first.save(initial,0);
 const catalog = [{projectId:'codex-p',label:'Project',path:'/repo',hostId:'local',isGitRepository:true}];
 await first.syncCatalog(catalog);
 await second.syncCatalog([{...catalog[0],projectId:'other'}]);
 const chat = {threadId:'chat-1',hostId:'local',title:'New title',projectId:'codex-p'};
 await first.syncChats([chat]);
 await first.syncChats([{...chat,threadId:'chat-2'}]);
 await second.syncChats([{...chat,title:'Other machine'}]);
 await first.syncChats([{...chat,title:'Updated again',projectId:null}]);
 const left = await first.read(); const right = await second.read();
 assert.equal(left.catalog[0].projectId,'codex-p'); assert.equal(right.catalog[0].projectId,'other');
 assert.equal(left.chatCatalog.length,2); assert.equal(right.chatCatalog.length,1);
 assert.equal(left.chatCatalog[0].title,'Updated again');
 assert.equal(left.chatCatalog[0].projectId,null);
 assert.equal(left.state.tasks[0].chats[0].title,'Chat one');
 assert.equal(left.revision,1);
});

test('identical local chat IDs on different machines remain separate relations',async t => {
 const {client} = await sharedFixture(t); const first = client(); const second = client();
 await first.save(initial,0);
 const other = await second.read();
 other.state.tasks[0].chats.push({...task.chats[0],title:'Second machine chat'});
 await second.save(other.state,other.revision);
 const saved = await first.read(); const chats = saved.state.tasks[0].chats;
 assert.equal(chats.length,2); assert.notEqual(chats[0].deviceId,chats[1].deviceId);
});

test('imports old data once and refuses to overwrite a populated shared board',async t => {
 const {client} = await sharedFixture(t); const store = client();
 const oldTask = {...task,threadId:'old-chat',threadTitle:'Old title',hostId:'local',chat:'https://example.com/chat'};
 delete oldTask.chats;
 const state = migrateBoard({version:2,projects:[project],tasks:[oldTask]});
 const snapshot = {state,catalog:[],chatCatalog:[]};
 const imported = await store.importLocal(snapshot);
 assert.equal(imported.state.tasks[0].chats[0].threadId,'old-chat');
 assert.equal(imported.state.tasks[0].chats[0].deviceId,store.connection.deviceId);
 await assert.rejects(store.importLocal(snapshot),/already contains saved changes/);
});

test('access failures and network failures never save a local board',async t => {
 const {client,url} = await sharedFixture(t); const valid = client();
 const denied = new Store({...valid.connection,token:'wrong'});
 await assert.rejects(denied.read(),/access was denied/);
 const unavailable = new Store({...valid.connection,url:'http://127.0.0.1:1'});
 await assert.rejects(unavailable.save(initial,0),/Could not reach/);
 const current = await valid.read(); assert.equal(current.revision,0);
 assert.ok(url);
});
