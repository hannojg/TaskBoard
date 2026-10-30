import { z } from 'zod';
import { issueSchema } from './issue-schema.mjs';
import { statusIds } from '../column-order.js';
import { chatSchema,chatKey } from './chats.mjs';
const bindingSchema = z.object({deviceId:z.string(),path:z.string(),codexId:z.string(),hostId:z.string()});
export const projectSchema = z.object({id:z.string().min(1),name:z.string().trim().min(1).max(80),repo:z.string(),path:z.string(),codexId:z.string(),hostId:z.string().default('local'),bindings:z.array(bindingSchema).default([])});
export const taskSchema = z.object({id:z.string().min(1),title:z.string().trim().min(1).max(200),description:z.string(),priority:z.enum(['None','Low','Medium','High']),due:z.string(),projectId:z.string(),statusId:z.enum(['backlog','todo','progress','review','blocked','done']),chats:z.array(chatSchema),issue:issueSchema.nullable().default(null)});
export const boardSchema = z.object({version:z.literal(3),projects:z.array(projectSchema),tasks:z.array(taskSchema),statusOrder:z.array(z.enum(statusIds)).length(6).refine(order => new Set(order).size === 6,{message:'Status order must include each status once'}).default(() => [...statusIds])}).superRefine((board,ctx) => {
 const projects = new Set();
 for (const project of board.projects) { if (projects.has(project.id)) ctx.addIssue({code:'custom',message:'Duplicate project ID'}); projects.add(project.id); }
 const tasks = new Set();
 const issues = new Set();
 for (const task of board.tasks) {
  if (tasks.has(task.id)) ctx.addIssue({code:'custom',message:'Duplicate task ID'});
  tasks.add(task.id);
  if (task.issue) {
   const key = task.issue.url.toLowerCase();
   if (issues.has(key)) ctx.addIssue({code:'custom',message:'This GitHub issue is already imported'});
   issues.add(key);
  }
  const linked = new Set();
  for (const chat of task.chats) {
   const key = chatKey(chat);
   if (linked.has(key)) ctx.addIssue({code:'custom',message:'Duplicate chat relation'});
   linked.add(key);
  }
  if (projects.has(task.projectId) === false) ctx.addIssue({code:'custom',message:'Task project does not exist'});
 }
});
export const catalogSchema = z.array(z.object({projectId:z.string(),label:z.string(),path:z.string(),hostId:z.string(),isGitRepository:z.boolean()}));
