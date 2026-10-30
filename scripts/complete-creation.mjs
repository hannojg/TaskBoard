import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { execFileSync } from 'node:child_process';
import { completeCreation } from '../src/server/creation.mjs';

const home = homedir();
const directory = process.env.TASKBOARD_DATA_DIR || join(home,'Library','Application Support','TaskBoard');
if (process.stdin.isTTY) execFileSync('stty',['-echo'],{stdio:'inherit'});
console.log('Board connection JSON on stdin (hidden).');
let input;
try {
 const lines = createInterface({input:process.stdin});
 for await (const line of lines) {
  try { input = JSON.parse(line); }
  catch { throw new Error('Send valid board connection JSON through stdin.'); }
  break;
 }
 lines.close();
} finally { if (process.stdin.isTTY) execFileSync('stty',['echo'],{stdio:'inherit'}); }
await completeCreation(directory,input);
console.log('Private board connected. TaskBoard will open automatically.');
