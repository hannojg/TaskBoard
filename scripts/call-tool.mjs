import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { resolve } from 'node:path';
let input = ''; for await (const chunk of process.stdin) input += chunk;
const params = JSON.parse(input);
const server = resolve('dist/server.mjs');
const transport = new StdioClientTransport({command:process.execPath,args:[server],stderr:'pipe'});
const client = new Client({name:'taskboard-local-client',version:'1.0.0'});
try { await client.connect(transport); const result = await client.callTool(params); console.log(JSON.stringify(result)); if (result.isError) process.exitCode = 1; } finally { await client.close(); }
