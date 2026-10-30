import { fetchIssue,searchIssues,addImportedIssue,updateImportedIssue } from './github.mjs';
import { chatCatalogSchema } from './chats.mjs';
import { resolveProject } from './project-details.mjs';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { OpenAIExtensions } from '@openai/mcp-extensions/server';
import { z } from 'zod';
import { loadStore,boardSchema,catalogSchema,projectSchema,taskSchema } from './store.mjs';
const home = homedir();
const dataDirectory = process.env.TASKBOARD_DATA_DIR || join(home,'Library','Application Support','TaskBoard');
const store = await loadStore(dataDirectory);
const iconFile = new URL('../assets/icon.svg',import.meta.url);
const icon = await readFile(iconFile);
const encodedIcon = icon.toString('base64');
const icons = [{src:'data:image/svg+xml;base64,'+encodedIcon,mimeType:'image/svg+xml',sizes:['any']}];
const server = new McpServer({name:'taskboard',version:'0.7.1',icons});
// The SDK omits tool icons from tools/list; expose them at the protocol boundary.
const registerHandler = server.server.setRequestHandler.bind(server.server);
server.server.setRequestHandler = (schema,handler) => {
 if (schema !== ListToolsRequestSchema) return registerHandler(schema,handler);
 return registerHandler(schema,async (request,extra) => {
  const listed = await handler(request,extra);
  const tools = listed.tools.map(tool => ({...tool,icons}));
  return {...listed,tools};
 });
};
new OpenAIExtensions(server);
const uri = 'ui://taskboard/0.7.1/board.html';
const panelUri = 'ui://taskboard/0.7.1/panel.html';
function registerBoardResource(name,resourceUri,preferredDisplayMode) {
 registerAppResource(server,name,resourceUri,{},async () => {
  const file = new URL('./app.html',import.meta.url);
  const html = await readFile(file,'utf8');
  return {contents:[{uri:resourceUri,mimeType:RESOURCE_MIME_TYPE,text:html,_meta:{ui:{csp:{connectDomains:[],resourceDomains:[]}},'openai/ui':{preferredDisplayMode,availableDisplayModes:['inline','fullscreen']}}}]};
 });
}
registerBoardResource('taskboard',uri,'fullscreen');
registerBoardResource('taskboard-panel',panelUri,'inline');
const readOnly = {readOnlyHint:true,destructiveHint:false,openWorldHint:false};
const write = {readOnlyHint:false,destructiveHint:false,openWorldHint:false};
function result(data) { return {content:[{type:'text',text:'TaskBoard loaded.'}],structuredContent:data}; }
function handle(callback) { return async args => { try { const data = await callback(args); return result(data); } catch(error) { return {isError:true,content:[{type:'text',text:error.message}]}; } }; }
function register(name,description,inputSchema,annotations,callback,extra = {},title) {
 registerAppTool(server,name,{title,icons,description,inputSchema,annotations,_meta:{ui:{resourceUri:uri,visibility:['app','model']},...extra}},handle(callback));
}
register('taskboard_open','Open TaskBoard fullscreen from the Codex sidebar.',{},readOnly,() => store.read(),{'openai/ui':{entrypoints:[{type:'global'}]}},'TaskBoard');
register('taskboard_open_panel','Open TaskBoard alongside a Codex chat.',{},readOnly,() => store.read(),{ui:{resourceUri:panelUri,visibility:['app','model']},'openai/ui':{entrypoints:[{type:'thread'}]}},'TaskBoard');
register('taskboard_read','Read current tasks, project links, revision, and the last agent-refreshed Codex project catalog.',{},readOnly,() => store.read());
register('taskboard_save','Save board edits from the interactive panel with revision conflict detection.',{state:boardSchema,revision:z.number().int().nonnegative()},write,args => store.save(args.state,args.revision));
register('taskboard_github_search','Read GitHub issues using the local signed-in GitHub CLI. Search one repository or fetch an issue URL; never writes to GitHub.',{repository:z.string(),query:z.string().max(500)},readOnly,async args => {
 const issueResults = args.query.trim().startsWith('https://') ? [await fetchIssue(args.query.trim())] : await searchIssues(args.repository,args.query);
 const current = await store.read();
 return {...current,issueResults};
});
register('taskboard_import_issue','Import a GitHub issue as a local task. Fetches the source again, prevents duplicate imports, and never changes GitHub.',{url:z.string(),projectId:z.string(),statusId:z.enum(['backlog','todo','progress','review','blocked','done']),revision:z.number().int().nonnegative()},write,async args => {
 const issue = await fetchIssue(args.url);
 return addImportedIssue(store,issue,args.projectId,args.statusId,args.revision);
});
register('taskboard_refresh_issue','Refresh only an imported issue snapshot. Preserves local title, notes, status, and chats; never changes GitHub.',{taskId:z.string(),revision:z.number().int().nonnegative()},write,async args => {
 const current = await store.read(); const task = current.state.tasks.find(item => item.id === args.taskId);
 if (task === undefined || task.issue === null) throw new Error('This task has no linked GitHub issue.');
 const issue = await fetchIssue(task.issue.url);
 return updateImportedIssue(store,args.taskId,issue,args.revision);
});
register('taskboard_project_details','Read the selected catalog project name, folder and local Git origin without changing the repository.',{projectId:z.string(),hostId:z.string()},readOnly,async args => {
 const current = await store.read();
 const projectDetails = await resolveProject(current.catalog,args.projectId,args.hostId);
 return {...current,projectDetails};
});
register('taskboard_sync_chats','Merge confirmed Codex chat metadata into the picker catalog. Bounded reads do not remove previously seen chats or change task relations.',{chats:chatCatalogSchema},write,args => store.syncChats(args.chats));
register('taskboard_sync_projects','Replace the project catalog with confirmed results from Codex list_projects. This stores a catalog; it does not create board projects or read chat contents.',{projects:catalogSchema},write,args => store.syncCatalog(args.projects));
register('taskboard_upsert_project','Create or update a board project. Use confirmed Codex project ID and host when linking.',{project:projectSchema,revision:z.number().int().nonnegative()},write,async args => {
 const current = await store.read(); const index = current.state.projects.findIndex(item => item.id === args.project.id);
 if (index >= 0) current.state.projects[index] = args.project; else current.state.projects.push(args.project);
 return store.save(current.state,args.revision);
});
register('taskboard_upsert_task','Create or update a task, including its explicit status and confirmed linked Codex chat.',{task:taskSchema,revision:z.number().int().nonnegative()},write,async args => {
 const current = await store.read(); const index = current.state.tasks.findIndex(item => item.id === args.task.id);
 if (index >= 0) current.state.tasks[index] = args.task; else current.state.tasks.push(args.task);
 return store.save(current.state,args.revision);
});
const transport = new StdioServerTransport();
await server.connect(transport);
