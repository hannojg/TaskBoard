import { z } from 'zod';
import { parseReferenceUrl } from '../references.js';

const urlTextSchema = z.string();
const trimmedUrlSchema = urlTextSchema.trim();
const referenceUrlSchema = trimmedUrlSchema.transform((value,ctx) => {
 try {
  const reference = parseReferenceUrl(value);
  return reference.url;
 } catch(error) {
  ctx.addIssue({code:'custom',message:error.message});
  return z.NEVER;
 }
});

const titleTextSchema = z.string();
const trimmedTitleSchema = titleTextSchema.trim();
const boundedTitleSchema = trimmedTitleSchema.max(200);
const titleSchema = boundedTitleSchema.default('');
const referenceSchema = z.object({url:referenceUrlSchema,title:titleSchema});
const referenceListSchema = z.array(referenceSchema);
export const referencesSchema = referenceListSchema.superRefine((references,ctx) => {
 const urls = new Set();
 for (const reference of references) {
  if (urls.has(reference.url)) ctx.addIssue({code:'custom',message:'This reference is already linked to the task.'});
  urls.add(reference.url);
 }
});
