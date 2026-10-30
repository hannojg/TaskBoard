import { DatabaseSync } from 'node:sqlite';
import { readFile,readdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { handleBoardRequest } from '../../src/cloud/board-api.mjs';
import { Store } from '../../src/server/store.mjs';

export async function sharedFixture(t) {
 const sqlite = new DatabaseSync(':memory:');
 const directory = new URL('../../site/drizzle/',import.meta.url);
 const files = await readdir(directory);
 const migrations = files.filter(file => file.endsWith('.sql'));
 migrations.sort();
 for (const name of migrations) {
  const path = new URL(name,directory);
  const sql = await readFile(path,'utf8');
  sqlite.exec(sql);
 }
 const db = {prepare(sql) {
  const statement = sqlite.prepare(sql);
  function bound(values = []) {
   return {
    bind(...args) { return bound(args); },
    async first() { return statement.get(...values) || null; },
    async run() {
     const result = statement.run(...values);
     return {meta:{changes:Number(result.changes)}};
    },
   };
  }
  return bound();
 }};
 const images = new Map();
 const bucket = {
  async put(key,value) { images.set(key,value); },
  async get(key) {
   const value = images.get(key);
   return value === undefined ? null : {async text() { return value; }};
  }
 };
 const server = createServer(async (incoming,outgoing) => {
  if (incoming.headers['oai-sites-authorization'] !== 'Bearer test-key') {
   outgoing.writeHead(403); outgoing.end(); return;
  }
  let body = '';
  for await (const chunk of incoming) body += chunk;
  const options = {method:incoming.method,headers:incoming.headers};
  if (incoming.method !== 'GET') options.body = body;
  const request = new Request('https://board.example/api/board',options);
  const response = await handleBoardRequest(request,db,bucket);
  const headers = Object.fromEntries(response.headers);
  outgoing.writeHead(response.status,headers);
  const text = await response.text();
  outgoing.end(text);
 });
 server.listen(0,'127.0.0.1');
 await once(server,'listening');
 const address = server.address();
 const url = 'http://127.0.0.1:'+address.port;
 function client(deviceId = randomUUID(),deviceName = 'Test Mac') {
  return new Store({url,token:'test-key',deviceId,deviceName});
 }
 t.after(async () => {
  server.closeAllConnections();
  server.close();
  await once(server,'close');
  sqlite.close();
 });
 return {client,db,url,images,bucket};
}
