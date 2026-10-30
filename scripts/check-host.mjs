import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const discovered = spawnSync('codex',['mcp','get','taskboard','--json'],{encoding:'utf8'});
assert.equal(discovered.status,0,'Codex does not discover the installed TaskBoard MCP server: '+discovered.stderr);
const config = JSON.parse(discovered.stdout);
assert.equal(config.enabled,true);
const runtime = config.transport;
const transport = new StdioClientTransport({command:runtime.command,args:runtime.args,cwd:runtime.cwd,env:{...process.env,...runtime.env},stderr:'pipe'});
const client = new Client({name:'taskboard-host-check',version:'1.0.0'});
try {
 await client.connect(transport);
 const tools = await client.listTools();
 const sidebar = tools.tools.find(tool => tool.name === 'taskboard_open');
 assert.ok(sidebar,'Installed server is missing its sidebar tool.');
 assert.equal(sidebar.title,'TaskBoard');
 const identity = client.getServerVersion();
 assert.equal(identity.icons[0].mimeType,'image/svg+xml');
 assert.match(identity.icons[0].src,/^data:image\/svg\+xml;base64,/);
 assert.deepEqual(sidebar.icons,identity.icons);
 assert.deepEqual(sidebar._meta['openai/ui'].entrypoints,[{type:'global'}]);
 const result = await client.callTool({name:sidebar.name,arguments:{}});
 assert.notEqual(result.isError,true);
 const resource = await client.readResource({uri:sidebar._meta.ui.resourceUri});
 assert.equal(resource.contents[0]._meta['openai/ui'].preferredDisplayMode,'fullscreen');
 assert.match(resource.contents[0].text,/description-editor/);
 console.log('Codex discovers TaskBoard. Its installed launch configuration starts successfully and exposes a working fullscreen sidebar entrypoint with the TaskBoard icon.');
} finally {await client.close();}
