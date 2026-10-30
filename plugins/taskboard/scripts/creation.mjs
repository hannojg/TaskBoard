import { readFile,writeFile,mkdir,rename,access,link,unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export async function readCreation(directory) {
 const path = join(directory,'creation.json');
 try {
  const text = await readFile(path,'utf8');
  return JSON.parse(text);
 } catch(error) {
  if (error.code === 'ENOENT') return null;
  throw error;
 }
}

export async function requireUnconnected(directory) {
 const path = join(directory,'connection.json');
 try { await access(path); }
 catch(error) {
  if (error.code === 'ENOENT') return;
  throw error;
 }
 throw new Error('This Mac is already connected to a board.');
}

async function writeCreation(directory,creation) {
 const now = new Date();
 const saved = {...creation,updatedAt:now.toISOString()};
 const path = join(directory,'creation.json');
 const temporary = path+'.'+randomUUID();
 const text = JSON.stringify(saved,null,2);
 await writeFile(temporary,text+'\n',{mode:0o600});
 await rename(temporary,path);
 return saved;
}

export async function beginCreation(directory) {
 await requireUnconnected(directory);
 const previous = await readCreation(directory);
 if (previous && previous.status !== 'complete') {
  if (previous.status === 'failed') {
   const creation = await writeCreation(directory,{...previous,status:'requested'});
   return {creation,shouldRequest:true};
  }
  return {creation:previous,shouldRequest:false};
 }
 await mkdir(directory,{recursive:true,mode:0o700});
 const requestId = randomUUID();
 const sourceDirectory = join(directory,'boards',requestId);
 const now = new Date();
 const creation = {requestId,status:'requested',projectId:null,sourceDirectory,updatedAt:now.toISOString()};
 const path = join(directory,'creation.json');
 const text = JSON.stringify(creation,null,2);
 if (previous) await writeCreation(directory,creation);
 else {
  const temporary = path+'.'+requestId;
  await writeFile(temporary,text+'\n',{mode:0o600});
  try { await link(temporary,path); }
  catch(error) {
   if (error.code !== 'EEXIST') throw error;
   const current = await readCreation(directory);
   return {creation:current,shouldRequest:false};
  } finally { await unlink(temporary); }
 }
 return {creation,shouldRequest:true};
}

export async function updateCreation(directory,requestId,status,projectId) {
 const current = await readCreation(directory);
 if (current === null || current.requestId !== requestId) throw new Error('This board setup request is no longer active.');
 if (current.status === 'complete' && status !== 'complete') throw new Error('This board setup is already complete.');
 if (projectId && current.projectId && projectId !== current.projectId) throw new Error('Resume the existing Site instead of replacing its project ID.');
 const creation = {...current,status,projectId:projectId || current.projectId};
 return writeCreation(directory,creation);
}

export function creationPrompt(requestId) {
 return 'Use the TaskBoard skill to create a new private shared board for setup request '+requestId+'. Read the saved provisioning state and resume it if setup already started. Use the bundled Site template and the Sites skill. Once the private Site is published, connect this Mac with the bundled complete-creation script through hidden stdin. Keep all credentials out of chat, source files and shell command arguments. Do not create another Site for the same request.';
}
