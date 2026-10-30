import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
export { boardSchema,catalogSchema,projectSchema,taskSchema } from './schemas.mjs';

export class Store {
 constructor(connection) { this.connection = connection; }
 get configured() { return this.connection.url !== undefined && this.connection.token !== undefined; }
 async request(operation,args = {}) {
  const {url,token,deviceId,deviceName} = this.connection;
  if (url === undefined || token === undefined) throw new Error('Connect TaskBoard to the shared board first. Run the bundled scripts/connect.mjs setup.');
  const endpoint = new URL('/api/board',url);
  const encodedName = encodeURIComponent(deviceName);
  const headers = {'OAI-Sites-Authorization':'Bearer '+token,'X-TaskBoard-Device':deviceId,'X-TaskBoard-Name':encodedName};
  const options = {headers,redirect:'error',signal:AbortSignal.timeout(20000)};
  if (operation !== 'read') {
   headers['Content-Type'] = 'application/json';
   options.method = 'POST';
   options.body = JSON.stringify({operation,...args});
  }
  let response;
  try { response = await fetch(endpoint,options); }
  catch { throw new Error('Could not reach the shared board. Check your connection, then refresh the board.'); }
  if (response.status === 401 || response.status === 403) throw new Error('Shared board access was denied. Check the Site access key in TaskBoard connection settings.');
  const type = response.headers.get('content-type');
  if (type === null || type.includes('application/json') === false) throw new Error('The shared board did not return board data. Check the Site address and access key.');
  const data = await response.json();
  if (response.ok === false) throw new Error(data.error || 'Could not load the shared board.');
  return data;
 }
 read() { return this.request('read'); }
 save(state,revision) { return this.request('save',{state,revision}); }
 syncCatalog(projects) { return this.request('projects',{projects}); }
 syncChats(chats) { return this.request('chats',{chats}); }
 importLocal(snapshot) { return this.request('import',{snapshot}); }
}

export async function loadStore(directory) {
 const path = join(directory,'connection.json');
 let connection;
 try {
  const text = await readFile(path,'utf8');
  connection = JSON.parse(text);
 } catch(error) {
  if (error.code !== 'ENOENT') throw error;
  connection = {};
 }
 return new Store(connection);
}
