import test from 'node:test';
import assert from 'node:assert/strict';
import { chatUrl,taskChatUrl } from '../src/task-chat.js';
import { asanaPluginMention } from '../src/asana.js';

const project = {id:'project-1',name:'Example project',path:'/Users/example/Project & tools',repo:'https://github.com/example/repo',hostId:'local'};
const task = {id:'ticket-1',title:'Keep #tags & Unicode ✓',description:'First line\n\n**Markdown** & details',priority:'High',due:'2026-11-03',statusId:'review',chats:[]};

test('Asana task drafts explicitly select the official plugin without adding it to local tasks',() => {
 const asana = {gid:'1234567890123456',url:'https://app.asana.com/1/100/task/1234567890123456'};
 const linkedTask = {...task,asana};
 const linkedUrl = taskChatUrl(linkedTask,project,'Waiting for review');
 const parsedLinked = new URL(linkedUrl);
 const linkedPrompt = parsedLinked.searchParams.get('prompt');
 const selectsAsana = linkedPrompt.includes(asanaPluginMention);
 assert.equal(selectsAsana,true);
 const localUrl = taskChatUrl(task,project,'Waiting for review');
 const parsedLocal = new URL(localUrl);
 const localPrompt = parsedLocal.searchParams.get('prompt');
 const selectsLocalAsana = localPrompt.includes(asanaPluginMention);
 assert.equal(selectsLocalAsana,false);
});

test('image attachments keep draft links small and point the agent to the saved ticket',() => {
 const source = 'data:image/png;base64,'+'a'.repeat(2400000);
 const description = 'Before\n\n![Screenshot]('+source+')\n\nAfter';
 const link = taskChatUrl({...task,description},project,'Backlog');
 assert.ok(link.length < 3000);
 const url = new URL(link);
 const prompt = url.searchParams.get('prompt');
 assert.ok(prompt.includes('Before\n\n[Image: Screenshot]\n\nAfter'));
 assert.ok(prompt.includes('Read the latest ticket through TaskBoard'));
 assert.equal(prompt.includes(source),false);
});

test('opens confirmed chats on their owning host and preserves imported links',() => {
 const local = chatUrl({threadId:'chat-1',hostId:'local',url:''});
 assert.equal(local,'codex://threads/chat-1');
 const remote = chatUrl({threadId:'chat-1',hostId:'remote / host',url:''});
 const url = new URL(remote);
 assert.equal(url.pathname,'/chat-1');
 assert.equal(url.searchParams.get('hostId'),'remote / host');
 const imported = chatUrl({threadId:'',hostId:'local',url:'https://example.com/chat?id=1#message'});
 assert.equal(imported,'https://example.com/chat?id=1#message');
 assert.throws(() => chatUrl({url:'javascript:alert(1)'}),/cannot be opened/);
});

test('opens an unsent draft with the full ticket context and exact workspace',() => {
 const link = taskChatUrl(task,project,'Waiting for review');
 const url = new URL(link);
 assert.equal(url.protocol,'codex:');
 assert.equal(url.hostname,'threads');
 assert.equal(url.pathname,'/new');
 assert.equal(url.searchParams.get('path'),project.path);
 const prompt = url.searchParams.get('prompt');
 for (const value of [task.id,task.title,task.description,task.priority,task.due,project.id,project.name,project.repo,'Waiting for review','preserve the ticket status']) assert.ok(prompt.includes(value));
 const parameters = Array.from(url.searchParams.keys());
 assert.deepEqual(parameters,['prompt','path']);
 assert.deepEqual(task.chats,[]);
 assert.equal(task.statusId,'review');
});

test('includes imported source alongside local notes and allows projectless drafts',() => {
 const issue = {title:'Original issue',url:'https://github.com/example/repo/issues/12',state:'OPEN',body:'Source Markdown\n\n- Full issue context'};
 const imported = {...task,issue};
 const link = taskChatUrl(imported,{...project,path:''},'Backlog');
 const url = new URL(link);
 const prompt = url.searchParams.get('prompt');
 assert.equal(url.searchParams.has('path'),false);
 assert.ok(prompt.includes('## Local notes'));
 for (const value of [issue.title,issue.url,issue.state,issue.body,task.description]) assert.ok(prompt.includes(value));
 assert.throws(() => taskChatUrl(task,{...project,hostId:'remote'},'Backlog'),/local projects/);
});
