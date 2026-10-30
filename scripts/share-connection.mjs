import { readFile,writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const home = homedir();
const directory = process.env.TASKBOARD_DATA_DIR || join(home,'Library','Application Support','TaskBoard');
const path = join(directory,'connection.json');
const source = await readFile(path,'utf8');
const connection = JSON.parse(source);
const shared = JSON.stringify({url:connection.url,token:connection.token},null,2);
const argument = process.argv[2];
let output = join(home,'Downloads','TaskBoard-connection.json');
if (argument) output = argument.startsWith('~/') ? join(home,argument.slice(2)) : argument;
try {
 await writeFile(output,shared+'\n',{mode:0o600,flag:'wx'});
} catch(error) {
 if (error.code !== 'EEXIST') throw error;
 const existingText = await readFile(output,'utf8');
 const existing = JSON.parse(existingText);
 if (existing.url !== connection.url || existing.token !== connection.token) throw new Error('A different connection file already exists at this path. Choose a new output path.');
}
console.log(output);
