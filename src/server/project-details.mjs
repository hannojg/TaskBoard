import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
export function repositoryUrl(origin) {
 let source = origin.trim();
 const scp = /^git@([^:]+):(.+)$/.exec(source);
 if (scp) source = 'https://'+scp[1]+'/'+scp[2];
 let parsed = new URL(source);
 if (parsed.protocol === 'ssh:' || parsed.protocol === 'git:') {
  const web = 'https://'+parsed.hostname+parsed.pathname;
  parsed = new URL(web);
 }
 if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('The Git origin is not a web repository URL.');
 parsed.username = ''; parsed.password = '';
 parsed.search = ''; parsed.hash = '';
 return parsed.toString();
}
export async function resolveProject(catalog,projectId,hostId) {
 const project = catalog.find(item => item.projectId === projectId && item.hostId === hostId);
 if (project === undefined) throw new Error('Refresh the Codex project catalog before selecting this project.');
 const details = {name:project.label,path:project.path,repo:'',repoStatus:'not-a-repository'};
 if (hostId !== 'local') return {...details,repoStatus:'remote-host'};
 if (project.isGitRepository === false) return details;
 try {
  const result = await run('git',['-C',project.path,'config','--get','remote.origin.url'],{timeout:5000,maxBuffer:16384,env:{...process.env,GIT_TERMINAL_PROMPT:'0'}});
  details.repo = repositoryUrl(result.stdout);
  details.repoStatus = 'found';
  return details;
 } catch(error) {
  if (error.code === 1) return {...details,repoStatus:'no-origin'};
  throw error;
 }
}
