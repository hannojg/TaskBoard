import { z } from 'zod';
import { asanaTaskAddress } from '../asana.js';

const gidSchema = z.string().regex(/^\d+$/,'An Asana task GID must contain only digits.');
const dateSchema = z.iso.datetime({offset:true});
const addressSchema = z.object({gid:gidSchema,url:z.string()});

function checkAddress(source,ctx) {
 try {
  const address = asanaTaskAddress(source.url);
  if (address.gid !== source.gid) ctx.addIssue({code:'custom',message:'The Asana task URL does not match its GID.'});
 } catch(error) { ctx.addIssue({code:'custom',message:error.message}); }
}

export const asanaSourceSchema = addressSchema.extend({modifiedAt:dateSchema,syncedAt:dateSchema,syncError:z.string().max(500).default('')}).superRefine(checkAddress);
export const asanaTaskSchema = addressSchema.extend({title:z.string().min(1),description:z.string(),modifiedAt:dateSchema}).superRefine(checkAddress);
export const asanaTasksSchema = z.array(asanaTaskSchema).max(100).superRefine((tasks,ctx) => {
 const seen = new Set();
 for (const task of tasks) {
  if (seen.has(task.gid)) ctx.addIssue({code:'custom',message:'Duplicate Asana task GID.'});
  seen.add(task.gid);
 }
});
export const asanaFailuresSchema = z.array(z.object({gid:gidSchema,message:z.string().trim().min(1).max(500)})).max(100);
export const asanaSyncSchema = z.object({tasks:asanaTasksSchema,failures:asanaFailuresSchema.default([])}).superRefine((input,ctx) => {
 const gids = new Set();
 for (const task of input.tasks) gids.add(task.gid);
 for (const failure of input.failures) {
  if (gids.has(failure.gid)) ctx.addIssue({code:'custom',message:'An Asana task can appear only once in a refresh.'});
  gids.add(failure.gid);
 }
});

export function applyAsanaSource(task,source,syncedAt) {
 const address = asanaTaskAddress(source.url);
 return {...task,title:source.title,description:source.description,asana:{...address,modifiedAt:source.modifiedAt,syncedAt,syncError:''}};
}
