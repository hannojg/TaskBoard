import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sharedFixture } from './support/shared.mjs';
import { asanaTaskAddress,asanaConnectionPrompt,asanaLinkPrompt,asanaRefreshPrompt,asanaSchedulePrompt } from '../src/asana.js';
import { asanaTaskSchema } from '../src/server/asana-schema.mjs';

const project = {id:'p',name:'Project',repo:'',path:'/repo',codexId:'codex-p',hostId:'local'};
const source = {gid:'1234567890123456',url:'https://app.asana.com/1/100/project/200/task/1234567890123456',title:'Asana ticket',description:'The full Asana description.',modifiedAt:'2026-10-30T10:00:00Z'};

async function linkedBoard(t) {
 const fixture = await sharedFixture(t);
 const store = fixture.client();
 const initial = await store.save({version:3,projects:[project],tasks:[]},0);
 const linked = await store.importAsana(source,'p','todo',initial.revision);
 return {...fixture,store,linked};
}

test('Asana identity accepts task links and rejects unrelated links and mismatched GIDs',() => {
 const modern = asanaTaskAddress(source.url+'?focus=true#details');
 assert.equal(modern.gid,source.gid);
 assert.equal(modern.url,source.url);
 const legacy = asanaTaskAddress('https://app.asana.com/0/200/'+source.gid+'/f');
 assert.equal(legacy.gid,source.gid);
 const direct = asanaTaskAddress('https://app.asana.com/1/100/task/'+source.gid);
 assert.equal(direct.gid,source.gid);
 for (const url of ['https://example.com/0/200/300','https://app.asana.com/1/100/project/200','http://app.asana.com/0/200/300','https://secret@app.asana.com/0/200/300']) {
  assert.throws(() => asanaTaskAddress(url));
 }
 assert.throws(() => asanaTaskSchema.parse({...source,gid:'99'}),/does not match/);
});

test('linking uses stable Asana identity and preserves the full source title',async t => {
 const {store,linked} = await linkedBoard(t);
 assert.equal(linked.state.tasks[0].title,source.title);
 assert.equal(linked.state.tasks[0].description,source.description);
 assert.equal(linked.state.tasks[0].asana.gid,source.gid);
 const duplicate = await store.importAsana({...source,url:'https://app.asana.com/0/900/'+source.gid},'p','done',0);
 assert.equal(duplicate.duplicate,true);
 assert.equal(duplicate.importedTaskId,linked.importedTaskId);
 assert.equal(duplicate.revision,linked.revision);
 assert.equal(duplicate.state.tasks[0].statusId,'todo');
 const repeated = 'Long Asana title '.repeat(30);
 const title = '  '+repeated+'  ';
 const updated = await store.syncAsana([{...source,title}],[],duplicate.revision);
 assert.equal(updated.state.tasks[0].title,title);
});

test('ordinary edits cannot overwrite or detach the Asana source, even with older payloads',async t => {
 const {store,linked} = await linkedBoard(t);
 const task = linked.state.tasks[0];
 task.title = 'Local override';
 task.description = 'Local override';
 task.statusId = 'progress';
 task.priority = 'High';
 task.due = '2026-11-03';
 task.chats.push({threadId:'chat',hostId:'local',title:'Work on this',url:''});
 task.references.push({url:'https://example.com/design',title:'Design'});
 delete task.asana;
 const saved = await store.save(linked.state,linked.revision);
 const current = saved.state.tasks[0];
 assert.equal(current.title,source.title);
 assert.equal(current.description,source.description);
 assert.equal(current.asana.gid,source.gid);
 assert.equal(current.statusId,'progress');
 assert.equal(current.priority,'High');
 assert.equal(current.due,'2026-11-03');
 assert.equal(current.chats.length,1);
 assert.equal(current.references.length,1);
});

test('source refreshes preserve cross-device relations and local workflow',async t => {
 const {store,client,linked} = await linkedBoard(t);
 const task = linked.state.tasks[0];
 task.statusId = 'review';
 task.references.push({url:'https://example.com/design',title:'Design'});
 task.chats.push({threadId:'chat',hostId:'local',title:'First Mac',url:''});
 await store.save(linked.state,linked.revision);
 const second = client();
 const other = await second.read();
 other.state.tasks[0].chats.push({threadId:'chat',hostId:'local',title:'Second Mac',url:''});
 const saved = await second.save(other.state,other.revision);
 const fresh = {...source,title:'Renamed in Asana',description:'Changed in Asana',modifiedAt:'2026-10-30T11:00:00Z'};
 const synced = await store.syncAsana([fresh],[],saved.revision);
 assert.equal(synced.state.tasks[0].title,fresh.title);
 assert.equal(synced.state.tasks[0].description,fresh.description);
 assert.equal(synced.state.tasks[0].statusId,'review');
 assert.equal(synced.state.tasks[0].references.length,1);
 assert.equal(synced.state.tasks[0].chats.length,2);
 const deviceIds = synced.state.tasks[0].chats.map(chat => chat.deviceId);
 const owners = new Set(deviceIds);
 assert.equal(owners.size,2);
 await assert.rejects(store.syncAsana([source],[],synced.revision),/older than/);
 await assert.rejects(store.syncAsana([fresh],[],saved.revision),/changed on another machine/);
});

test('access failures keep ownership and last known content, and clear after recovery',async t => {
 const {store,linked} = await linkedBoard(t);
 const checkedAt = linked.state.tasks[0].asana.syncedAt;
 const failed = await store.syncAsana([],[{gid:source.gid,message:'Asana access was denied.'}],linked.revision);
 assert.equal(failed.state.tasks[0].title,source.title);
 assert.equal(failed.state.tasks[0].asana.syncedAt,checkedAt);
 assert.equal(failed.state.tasks[0].asana.syncError,'Asana access was denied.');
 const recovered = await store.syncAsana([source],[],failed.revision);
 assert.equal(recovered.state.tasks[0].asana.syncError,'');
 const empty = await store.syncAsana([],[],recovered.revision);
 assert.equal(empty.revision,recovered.revision);
});

test('invalid source writes and failed batches leave shared data unchanged',async t => {
 const {store,linked} = await linkedBoard(t);
 const task = linked.state.tasks[0];
 linked.state.tasks.push({...task,id:'forged',asana:{...task.asana,gid:'77',url:'https://app.asana.com/0/200/77'}});
 await assert.rejects(store.save(linked.state,linked.revision),/through taskboard_import_asana/);
 await assert.rejects(store.syncAsana([source],[{gid:source.gid,message:'Conflict'}],linked.revision),/only once/);
 await assert.rejects(store.syncAsana([{...source,gid:'77',url:'https://app.asana.com/0/200/77'}],[],linked.revision),/no longer linked/);
 await assert.rejects(store.syncAsana([{...source,title:'Must not partially save'}],[{gid:'88',message:'Unknown source'}],linked.revision),/no longer linked/);
 const current = await store.read();
 assert.equal(current.revision,linked.revision);
 assert.equal(current.state.tasks[0].title,source.title);
 assert.equal(current.state.tasks.length,1);
 current.state.tasks = [];
 const removed = await store.save(current.state,current.revision);
 assert.equal(removed.state.tasks.length,0);
});

test('agent requests carry explicit scope and bind scheduled sync to its shared board',() => {
 const link = asanaLinkPrompt(source.url,'p','todo');
 assert.match(link, /taskboard_import_asana/);
 assert.match(link, /"projectId":"p"/);
 const refresh = asanaRefreshPrompt(source.gid);
 assert.match(refresh, /1234567890123456/);
 assert.match(refresh, /taskboard_sync_asana/);
 const schedule = asanaSchedulePrompt('https://board.example');
 assert.match(schedule, /boardUrl equals "https:\/\/board.example"/);
 assert.match(schedule, /Inspect existing automations/);
});

test('every Asana request selects the declared official plugin',async () => {
 const file = new URL('../.app.json',import.meta.url);
 const text = await readFile(file,'utf8');
 const appReferences = JSON.parse(text);
 const app = appReferences.apps.asana;
 const mention = '[@Asana](plugin://plugin_'+app.id+')';
 const connection = asanaConnectionPrompt();
 const link = asanaLinkPrompt(source.url,'p','todo');
 const refresh = asanaRefreshPrompt(source.gid);
 const schedule = asanaSchedulePrompt('https://board.example');
 for (const prompt of [connection,link,refresh,schedule]) {
  const included = prompt.includes(mention);
  assert.equal(included,true);
 }
});

test('the marketplace package includes its optional official Asana app reference',async () => {
 for (const directory of ['../','../plugins/taskboard/']) {
  const root = new URL(directory,import.meta.url);
  const manifestPath = new URL('plugin.json',root);
  const manifestText = await readFile(manifestPath,'utf8');
  const manifest = JSON.parse(manifestText);
  const appPath = new URL(manifest.extensions['com.openai'].apps,root);
  const appText = await readFile(appPath,'utf8');
  const appReferences = JSON.parse(appText);
  assert.equal(appReferences.apps.asana.id,'asdk_app_69616780bd208191b4fb44ba44f72b61');
  assert.equal(appReferences.apps.asana.required,false);
 }
});

test('saving an Asana link to an older Site fails before sending a write',async t => {
 const {store,linked} = await linkedBoard(t);
 let writes = 0;
 t.mock.method(store,'read',async () => ({features:[]}));
 t.mock.method(store,'request',async () => { writes += 1; });
 await assert.rejects(store.save(linked.state,linked.revision),/Update the shared board Site to support Asana/);
 assert.equal(writes,0);
});
