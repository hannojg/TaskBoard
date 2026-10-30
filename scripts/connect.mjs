import { readFile,writeFile,mkdir,rename } from 'node:fs/promises';
import { homedir,hostname } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { execFileSync } from 'node:child_process';

const home = homedir();
const directory = process.env.TASKBOARD_DATA_DIR || join(home,'Library','Application Support','TaskBoard');
const path = join(directory,'connection.json');
let input;
const argument = process.argv[2];
if (argument === '--stdin') {
 if (process.stdin.isTTY) execFileSync('stty',['-echo'],{stdio:'inherit'});
 console.log('Site connection JSON on stdin (hidden).');
 try {
  const lines = createInterface({input:process.stdin});
  for await (const line of lines) { input = JSON.parse(line); break; }
  lines.close();
 } finally { if (process.stdin.isTTY) execFileSync('stty',['echo'],{stdio:'inherit'}); }
} else if (argument) {
 const file = argument.startsWith('~/') ? join(home,argument.slice(2)) : argument;
 const text = await readFile(file,'utf8');
 input = JSON.parse(text);
} else {
 const terminal = createInterface({input:process.stdin,output:process.stdout});
 const url = await terminal.question('Shared Site address: ');
 terminal.close();
 const hidden = new Writable({write(chunk,encoding,done) { done(); }});
 const secret = createInterface({input:process.stdin,output:hidden,terminal:true});
 process.stdout.write('Site access key: ');
 const token = await secret.question('');
 secret.close();
 process.stdout.write('\n');
 input = {url,token};
}
const url = new URL(input.url);
if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Use the HTTPS address of your private TaskBoard Site.');
if (typeof input.token !== 'string' || input.token.trim().length === 0) throw new Error('A Site access key is required.');
let deviceId;
try {
 const previousText = await readFile(path,'utf8');
 const previous = JSON.parse(previousText);
 deviceId = previous.deviceId;
} catch(error) { if (error.code !== 'ENOENT') throw error; }
if (deviceId === undefined) deviceId = randomUUID();
const connection = {url:url.origin,token:input.token.trim(),deviceId,deviceName:hostname()};
const text = JSON.stringify(connection,null,2);
await mkdir(directory,{recursive:true,mode:0o700});
const temporary = path+'.'+randomUUID();
await writeFile(temporary,text+'\n',{mode:0o600});
await rename(temporary,path);
console.log('Connected this machine to the shared TaskBoard. Reload the plugin to use it.');
