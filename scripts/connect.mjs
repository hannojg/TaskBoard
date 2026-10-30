import { readConnectionFile,prepareConnection,saveConnection } from './connection.mjs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { execFileSync } from 'node:child_process';

const home = homedir();
const directory = process.env.TASKBOARD_DATA_DIR || join(home,'Library','Application Support','TaskBoard');
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
 input = await readConnectionFile(argument);
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
const connection = await prepareConnection(input,directory);
await saveConnection(connection,directory);
console.log('Connected this machine to the shared TaskBoard. Reload the plugin to use it.');
