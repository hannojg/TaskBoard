import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,rm,writeFile,access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { z } from 'zod';

async function fixture(t,configured = false) {
 const temporary = tmpdir();
 const directory = await mkdtemp(join(temporary,'taskboard-first-launch-'));
 if (configured) {
  const path = join(directory,'connection.json');
  const text = JSON.stringify({url:'https://unreachable.example',token:'test-key'});
  await writeFile(path,text);
 }
 const server = resolve('plugins/taskboard/dist/server.mjs');
 const transport = new StdioClientTransport({command:process.execPath,args:[server],env:{...process.env,TASKBOARD_DATA_DIR:directory},stderr:'pipe'});
 const client = new Client({name:'first-launch-check',version:'1.0.0'},{capabilities:{extensions:{'openai/elicitation':{form:{}}}}});
 t.after(async () => { await client.close(); await rm(directory,{recursive:true}); });
 return {client,transport,directory};
}

test('a fresh installation opens both views and returns setup without a connection or board request',async t => {
 const {client,transport,directory} = await fixture(t);
 await client.connect(transport);
 for (const name of ['taskboard_open','taskboard_open_panel','taskboard_read']) {
  const result = await client.callTool({name,arguments:{}});
  assert.notEqual(result.isError,true);
  assert.deepEqual(result.structuredContent,{connectionRequired:true});
  assert.equal(result.structuredContent.state,undefined);
 }
 const listed = await client.listTools();
 const opener = listed.tools.find(tool => tool.name === 'taskboard_open');
 const resource = await client.readResource({uri:opener._meta.ui.resourceUri});
 assert.match(resource.contents[0].text,/Choose connection file/);
 const path = join(directory,'connection.json');
 await assert.rejects(access(path));
});

test('cancelling the native connection picker leaves the first-launch view usable',async t => {
 const {client,transport,directory} = await fixture(t);
 const requestSchema = z.object({method:z.literal('openai/elicitation/create'),params:z.any()});
 let requestedForm;
 client.setRequestHandler(requestSchema,async request => {
  requestedForm = request.params;
  return {action:'cancel'};
 });
 await client.connect(transport);
 const result = await client.callTool({name:'taskboard_connect',arguments:{}});
 assert.notEqual(result.isError,true);
 assert.deepEqual(result.structuredContent,{connectionRequired:true,connectionCancelled:true});
 const field = requestedForm.requestedSchema.properties.connectionFile;
 assert.equal(field.format,'uri');
 assert.deepEqual(field['x-openai-input'].userOptions,{kind:'file',accept:['.json']});
 const listed = await client.listTools();
 const connector = listed.tools.find(tool => tool.name === 'taskboard_connect');
 assert.deepEqual(connector._meta.ui.visibility,['app']);
 const path = join(directory,'connection.json');
 await assert.rejects(access(path));
});

test('opening a configured board does not depend on a reachable Site',async t => {
 const {client,transport} = await fixture(t,true);
 await client.connect(transport);
 const result = await client.callTool({name:'taskboard_open',arguments:{}});
 assert.notEqual(result.isError,true);
 assert.deepEqual(result.structuredContent,{connectionRequired:false});
});
