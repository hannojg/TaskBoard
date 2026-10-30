import { readFile,writeFile,mkdir,rename } from 'node:fs/promises';
import { homedir,hostname } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export async function readConnectionFile(path) {
 const home = homedir();
 const file = path.startsWith('~/') ? join(home,path.slice(2)) : path;
 let text;
 try { text = await readFile(file,'utf8'); }
 catch { throw new Error('Could not read that connection file. Choose TaskBoard-connection.json from the connected Mac.'); }
 try { return JSON.parse(text); }
 catch { throw new Error('Choose a valid TaskBoard-connection.json exported from a connected Mac.'); }
}

export async function prepareConnection(input,directory) {
 if (input === null || typeof input !== 'object' || typeof input.url !== 'string' || typeof input.token !== 'string') throw new Error('Choose a valid TaskBoard-connection.json exported from a connected Mac.');
 let url;
 try { url = new URL(input.url); }
 catch { throw new Error('The connection file must contain a valid HTTPS Site address.'); }
 if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Use the HTTPS address of your private TaskBoard Site.');
 const token = input.token.trim();
 if (token.length === 0) throw new Error('A Site access key is required.');
 const path = join(directory,'connection.json');
 let deviceId;
 try {
  const previousText = await readFile(path,'utf8');
  const previous = JSON.parse(previousText);
  deviceId = previous.deviceId;
 } catch(error) { if (error.code !== 'ENOENT') throw error; }
 if (deviceId === undefined) deviceId = randomUUID();
 const deviceName = hostname();
 return {url:url.origin,token,deviceId,deviceName};
}

export async function saveConnection(connection,directory) {
 const path = join(directory,'connection.json');
 const text = JSON.stringify(connection,null,2);
 await mkdir(directory,{recursive:true,mode:0o700});
 const temporary = path+'.'+randomUUID();
 await writeFile(temporary,text+'\n',{mode:0o600});
 await rename(temporary,path);
}
