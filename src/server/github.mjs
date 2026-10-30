import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
const run = promisify(execFile);
export { issueSchema } from './issue-schema.mjs';
import { issueSchema } from './issue-schema.mjs';
export function issueAddress(value) {
 const url = new URL(value);
 const match = /^\/([^/]+)\/([^/]+)\/issues\/(\d+)\/?$/.exec(url.pathname);
 if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.port || url.username || url.password || match === null) throw new Error('Paste a github.com issue URL, such as https://github.com/owner/repo/issues/123.');
 const repository = match[1]+'/'+match[2];
 const number = Number(match[3]);
 if (Number.isSafeInteger(number) === false || number < 1) throw new Error('Invalid issue number.');
 return {repository,number,url:'https://github.com/'+repository+'/issues/'+number};
}
export function repositoryName(value) {
 let name = value.trim();
 if (name.startsWith('https://github.com/')) { const url = new URL(name); name = url.pathname.slice(1); }
 name = name.replace(/\.git\/?$/,'').replace(/\/$/,'');
 if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(name) === false) throw new Error('Enter a GitHub repository as owner/repo or its HTTPS URL.');
 return name;
}
async function github(endpoint,fields = []) {
 try {
  const args = ['api','--hostname','github.com','--method','GET',endpoint,...fields];
  const response = await run('gh',args,{timeout:20000,maxBuffer:2*1024*1024,env:{...process.env,GH_PROMPT_DISABLED:'1'}});
  return JSON.parse(response.stdout);
 } catch(error) {
  if (error.code === 'ENOENT') throw new Error('Install GitHub CLI and sign in with gh auth login to use issue import.');
  if (error.killed) throw new Error('GitHub took too long to respond. Try again.');
  throw new Error('Could not read GitHub. Check the issue URL, repository access, and GitHub CLI sign-in.');
 }
}
function normalize(raw) {
 if (raw.pull_request) throw new Error('This link is a pull request. Choose a GitHub issue.');
 const address = issueAddress(raw.html_url);
 const now = new Date();
 return issueSchema.parse({...address,title:raw.title,body:raw.body || '',state:raw.state,labels:raw.labels.map(label => typeof label === 'string' ? label : label.name),updatedAt:raw.updated_at,fetchedAt:now.toISOString()});
}
export async function fetchIssue(url) {
 const address = issueAddress(url);
 const raw = await github('repos/'+address.repository+'/issues/'+address.number);
 return normalize(raw);
}
export async function searchIssues(repository,query) {
 const repo = repositoryName(repository);
 const phrase = query.trim();
 const text = phrase ? JSON.stringify(phrase) : '';
 const q = 'repo:'+repo+' is:issue '+text;
 const raw = await github('search/issues',['-f','q='+q,'-f','per_page=20','-f','sort=updated']);
 return raw.items.map(normalize);
}
export async function addImportedIssue(store,issue,projectId,statusId,revision) {
 const current = await store.read();
 const key = issue.url.toLowerCase();
 const duplicate = current.state.tasks.find(task => task.issue && task.issue.url.toLowerCase() === key);
 if (duplicate) return {...current,importedTaskId:duplicate.id,duplicate:true};
 const id = randomUUID();
 const title = issue.title.slice(0,200);
 current.state.tasks.push({id,title,description:'',priority:'None',due:'',projectId,statusId,chats:[],issue});
 const saved = await store.save(current.state,revision);
 return {...saved,importedTaskId:id,duplicate:false};
}
export async function updateImportedIssue(store,taskId,issue,revision) {
 const current = await store.read();
 const task = current.state.tasks.find(item => item.id === taskId);
 if (task === undefined || task.issue === null) throw new Error('The imported task no longer exists.');
 if (task.issue.url.toLowerCase() !== issue.url.toLowerCase()) throw new Error('The issue relation changed. Reload the task.');
 task.issue = issue;
 return store.save(current.state,revision);
}
