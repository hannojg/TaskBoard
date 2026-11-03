import { readFileSync,writeFileSync,mkdirSync,renameSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { statusIds } from '../column-order.js';

export const statusFilterSchema = z.enum(['active','all',...statusIds]);
const preferencesSchema = z.object({statusFilter:statusFilterSchema});

export function readPreferences(directory) {
 const path = join(directory,'preferences.json');
 let text;
 try { text = readFileSync(path,'utf8'); }
 catch(error) {
  if (error.code === 'ENOENT') return {statusFilter:'active'};
  throw error;
 }
 const data = JSON.parse(text);
 return preferencesSchema.parse(data);
}

export function savePreferences(directory,preferences) {
 const saved = preferencesSchema.parse(preferences);
 const path = join(directory,'preferences.json');
 const temporary = path+'.'+randomUUID();
 const text = JSON.stringify(saved,null,2);
 mkdirSync(directory,{recursive:true,mode:0o700});
 writeFileSync(temporary,text+'\n',{mode:0o600});
 renameSync(temporary,path);
 return saved;
}
