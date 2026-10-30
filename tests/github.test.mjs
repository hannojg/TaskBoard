import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedFixture } from './support/shared.mjs';
import { issueAddress,repositoryName,addImportedIssue,updateImportedIssue } from '../src/server/github.mjs';
const source = {url:'https://github.com/example/repo/issues/12',repository:'example/repo',number:12,title:'Issue title',body:'## Source body',state:'open',labels:['bug'],updatedAt:'2026-10-30T08:00:00Z',fetchedAt:'2026-10-30T08:01:00Z'};
test('accepts GitHub issue addresses and rejects other resources',() => {
 assert.equal(issueAddress(source.url+'?x=1#comment').url,source.url);
 assert.equal(repositoryName('https://github.com/example/repo.git'),'example/repo');
 for (const url of ['https://evil.example/example/repo/issues/12','https://github.com/example/repo/pull/12','https://token@github.com/example/repo/issues/12','http://github.com/example/repo/issues/12']) assert.throws(() => issueAddress(url));
 assert.throws(() => repositoryName('owner/repo/issues/12'));
});
test('import is idempotent and refresh preserves local work and chat relations',async t => {
 const {client} = await sharedFixture(t); const store = client();
 const project = {id:'p',name:'Project',repo:'',path:'',codexId:'',hostId:'local'};
  await store.save({version:3,projects:[project],tasks:[]},0);
  const first = await addImportedIssue(store,source,'p','todo',1); assert.equal(first.duplicate,false);
  const task = first.state.tasks[0]; assert.equal(task.issue.body,'## Source body'); assert.equal(task.description,'');
  task.description = 'My notes'; task.title = 'My title'; task.statusId = 'progress'; task.chats = [{threadId:'chat',hostId:'local',title:'Implementation',url:''}];
  const edited = await store.save(first.state,first.revision);
  const duplicate = await addImportedIssue(store,source,'p','done',0); assert.equal(duplicate.duplicate,true); assert.equal(duplicate.importedTaskId,task.id); assert.equal(duplicate.revision,edited.revision); assert.equal(duplicate.state.tasks.length,1);
  const updatedSource = {...source,title:'Renamed on GitHub',body:'Updated Markdown',state:'closed'};
  const refreshed = await updateImportedIssue(store,task.id,updatedSource,edited.revision); const saved = refreshed.state.tasks[0];
  assert.equal(saved.issue.state,'closed'); assert.equal(saved.issue.body,'Updated Markdown'); assert.equal(saved.description,'My notes'); assert.equal(saved.title,'My title'); assert.equal(saved.statusId,'progress'); assert.equal(saved.chats[0].threadId,'chat');
  await assert.rejects(updateImportedIssue(store,task.id,source,edited.revision),/changed on another machine/);
});
