import { z } from 'zod';
import { boardSchema,catalogSchema } from '../server/schemas.mjs';
import { chatCatalogSchema,chatKey } from '../server/chats.mjs';
import { storeImages,loadImages } from './images.mjs';
import { asanaTaskSchema,asanaSyncSchema,applyAsanaSource } from '../server/asana-schema.mjs';

const revisionSchema = z.number().int().nonnegative();
const deviceSchema = z.string().uuid();
const conflict = 'The board changed on another machine or panel. Refresh board before editing again.';

function json(data,status = 200) {
 return Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
}

async function boardRow(db) {
 const select = db.prepare('SELECT revision,data FROM board WHERE id=1');
 let row = await select.first();
 if (row === null) {
  const empty = JSON.stringify({version:3,projects:[],tasks:[]});
  const insert = db.prepare('INSERT OR IGNORE INTO board (id,revision,data) VALUES (1,0,?)');
  await insert.bind(empty).run();
  row = await select.first();
 }
 return row;
}

function scopeBoard(state,deviceId) {
 const projects = state.projects.map(project => {
  const link = project.bindings.find(binding => binding.deviceId === deviceId);
  return {...project,path:link ? link.path : '',codexId:link ? link.codexId : '',hostId:link ? link.hostId : 'local'};
 });
 return {...state,projects};
}

function sharedBoard(state,current,deviceId,deviceName) {
 const projects = state.projects.map(project => {
  const previous = current.projects.find(item => item.id === project.id);
  const bindings = previous ? previous.bindings.filter(binding => binding.deviceId !== deviceId) : [];
  if (project.codexId || project.path) bindings.push({deviceId,codexId:project.codexId,path:project.path,hostId:project.hostId});
  return {...project,path:'',codexId:'',hostId:'local',bindings};
 });
 const tasks = state.tasks.map(task => {
  const chats = task.chats.map(chat => chat.deviceId ? chat : {...chat,deviceId,deviceName});
  const title = task.asana ? task.title : task.title.trim();
  return {...task,title,chats};
 });
 return {...state,projects,tasks};
}

async function read(db,deviceId,bucket) {
 const row = await boardRow(db);
 const decoded = JSON.parse(row.data);
 const stored = boardSchema.parse(decoded);
 const state = await loadImages(stored,bucket);
 const select = db.prepare('SELECT * FROM device_catalogs WHERE device_id=?');
 const device = await select.bind(deviceId).first();
 const projects = device ? JSON.parse(device.projects) : [];
 const chatMap = device ? JSON.parse(device.chats) : {};
 const chatValues = Object.values(chatMap);
 const chats = chatValues.map(value => JSON.parse(value));
 return {state:scopeBoard(state,deviceId),revision:row.revision,catalog:projects,chatCatalog:chats,catalogUpdatedAt:device ? device.projects_updated_at : null,chatsUpdatedAt:device ? device.chats_updated_at : null,deviceId,features:['references','asana']};
}

async function save(db,input,deviceId,deviceName,bucket,sourceWrite = false) {
 let state = boardSchema.parse(input.state);
 const revision = revisionSchema.parse(input.revision);
 const row = await boardRow(db);
 if (row.revision !== revision) return json({error:conflict},409);
 const decoded = JSON.parse(row.data);
 const current = boardSchema.parse(decoded);
 for (const task of current.tasks) {
  const incoming = input.state.tasks.find(item => item.id === task.id);
  if (task.references.length > 0 && incoming && incoming.references === undefined) return json({error:'Update the TaskBoard plugin before editing tasks with references.'},400);
 }
 if (sourceWrite === false) {
  const tasks = [];
  for (const task of state.tasks) {
   const previous = current.tasks.find(item => item.id === task.id);
   if (previous && previous.asana) {
    if (task.asana && task.asana.gid !== previous.asana.gid) return json({error:'An Asana ticket cannot change its source.'},400);
    tasks.push({...task,title:previous.title,description:previous.description,asana:previous.asana,issue:null});
   } else {
    if (task.asana) return json({error:'Link Asana tickets through taskboard_import_asana.'},400);
    tasks.push(task);
   }
  }
  state = {...state,tasks};
 }
 const shared = sharedBoard(state,current,deviceId,deviceName);
 const validated = boardSchema.parse(shared);
 const stored = await storeImages(validated,bucket);
 const data = JSON.stringify(stored);
 const update = db.prepare('UPDATE board SET data=?,revision=revision+1 WHERE id=1 AND revision=?');
 const result = await update.bind(data,revision).run();
 if (result.meta.changes !== 1) return json({error:conflict},409);
 const saved = await read(db,deviceId,bucket);
 return json(saved);
}

async function importAsana(db,input,deviceId,deviceName,bucket) {
 const source = asanaTaskSchema.parse(input.source);
 const current = await read(db,deviceId,bucket);
 const duplicate = current.state.tasks.find(task => task.asana && task.asana.gid === source.gid);
 if (duplicate) return json({...current,importedTaskId:duplicate.id,duplicate:true});
 const id = crypto.randomUUID();
 const now = new Date();
 const syncedAt = now.toISOString();
 const local = {id,projectId:input.projectId,statusId:input.statusId,priority:'None',due:'',chats:[],references:[],issue:null};
 const task = applyAsanaSource(local,source,syncedAt);
 current.state.tasks.push(task);
 const response = await save(db,{state:current.state,revision:input.revision},deviceId,deviceName,bucket,true);
 if (response.ok === false) return response;
 const saved = await response.json();
 return json({...saved,importedTaskId:id,duplicate:false});
}

async function syncAsana(db,input,deviceId,deviceName,bucket) {
 const updates = asanaSyncSchema.parse(input);
 const current = await read(db,deviceId,bucket);
 const revision = revisionSchema.parse(input.revision);
 if (current.revision !== revision) return json({error:conflict},409);
 const sources = new Map();
 for (const task of current.state.tasks) {
  if (task.asana) sources.set(task.asana.gid,task);
 }
 const now = new Date();
 const syncedAt = now.toISOString();
 for (const source of updates.tasks) {
  const task = sources.get(source.gid);
  if (task === undefined) return json({error:'The Asana task is no longer linked. Read the board again.'},400);
  const incomingTime = Date.parse(source.modifiedAt);
  const savedTime = Date.parse(task.asana.modifiedAt);
  if (incomingTime < savedTime) return json({error:'The Asana result is older than the saved source. Fetch the task again.'},409);
  const updated = applyAsanaSource(task,source,syncedAt);
  Object.assign(task,updated);
 }
 for (const failure of updates.failures) {
  const task = sources.get(failure.gid);
  if (task === undefined) return json({error:'The Asana task is no longer linked. Read the board again.'},400);
  task.asana.syncError = failure.message;
 }
 if (updates.tasks.length === 0 && updates.failures.length === 0) return json(current);
 return save(db,{state:current.state,revision},deviceId,deviceName,bucket,true);
}

async function syncProjects(db,projects,deviceId,deviceName) {
 const parsed = catalogSchema.parse(projects);
 const data = JSON.stringify(parsed);
 const now = new Date();
 const updatedAt = now.toISOString();
 const update = db.prepare('INSERT INTO device_catalogs (device_id,name,projects,projects_updated_at) VALUES (?,?,?,?) ON CONFLICT(device_id) DO UPDATE SET name=excluded.name,projects=excluded.projects,projects_updated_at=excluded.projects_updated_at');
 await update.bind(deviceId,deviceName,data,updatedAt).run();
}

async function syncChats(db,chats,deviceId,deviceName) {
 const parsed = chatCatalogSchema.parse(chats);
 const incoming = {};
 for (const chat of parsed) {
  const scoped = {...chat,deviceId,deviceName};
  const key = chatKey(scoped);
  // Replace complete records so merge-patch preserves nullable chat fields.
  incoming[key] = JSON.stringify(scoped);
 }
 const data = JSON.stringify(incoming);
 const now = new Date();
 const updatedAt = now.toISOString();
 const update = db.prepare('INSERT INTO device_catalogs (device_id,name,chats,chats_updated_at) VALUES (?,?,?,?) ON CONFLICT(device_id) DO UPDATE SET name=excluded.name,chats=json_patch(device_catalogs.chats,excluded.chats),chats_updated_at=excluded.chats_updated_at');
 await update.bind(deviceId,deviceName,data,updatedAt).run();
}

export async function handleBoardRequest(request,db,bucket) {
 try {
  const header = request.headers.get('X-TaskBoard-Device');
  const deviceId = deviceSchema.parse(header);
  const encodedName = request.headers.get('X-TaskBoard-Name') || '';
  const deviceName = decodeURIComponent(encodedName);
  if (request.method === 'GET') {
   const data = await read(db,deviceId,bucket);
   return json(data);
  }
  if (request.method !== 'POST') return json({error:'Method not allowed.'},405);
  const input = await request.json();
  if (input.operation === 'save') return await save(db,input,deviceId,deviceName,bucket);
  if (input.operation === 'asana_import') return await importAsana(db,input,deviceId,deviceName,bucket);
  if (input.operation === 'asana_sync') return await syncAsana(db,input,deviceId,deviceName,bucket);
  if (input.operation === 'projects') await syncProjects(db,input.projects,deviceId,deviceName);
  else if (input.operation === 'chats') await syncChats(db,input.chats,deviceId,deviceName);
  else if (input.operation === 'import') {
   const snapshot = input.snapshot;
   const row = await boardRow(db);
   if (row.revision !== 0) return json({error:'The shared board already contains saved changes. The local board was not imported.'},409);
   const imported = await save(db,{state:snapshot.state,revision:0},deviceId,deviceName,bucket);
   if (imported.ok === false) return imported;
   await syncProjects(db,snapshot.catalog,deviceId,deviceName);
   await syncChats(db,snapshot.chatCatalog,deviceId,deviceName);
  } else return json({error:'Unknown board operation.'},400);
  const data = await read(db,deviceId,bucket);
  return json(data);
 } catch(error) {
  if (error instanceof z.ZodError) {
   const messages = error.issues.map(issue => issue.message);
   const message = messages.join('; ');
   return json({error:message},400);
  }
  if (error instanceof SyntaxError || error instanceof URIError) return json({error:'Invalid board request.'},400);
  console.error('TaskBoard storage failed:',error);
  return json({error:'Could not access the shared board database.'},500);
 }
}
