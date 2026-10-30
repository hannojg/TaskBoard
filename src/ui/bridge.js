import { App } from '@modelcontextprotocol/ext-apps';
import { OpenAIExtensions } from '@openai/mcp-extensions/app';
import { startBoard } from './board.js';
import './markdown.js';
import './style.css';
const app = new App({name:'taskboard',version:'0.7.1'});
new OpenAIExtensions(app);
let accept;
function unpack(result) {
 if (result.isError) {
  const blocks = result.content.filter(block => block.type === 'text');
  const messages = blocks.map(block => block.text);
  throw new Error(messages.join('\n'));
 }
 const data = result.structuredContent;
 if (data === undefined || data.state === undefined) throw new Error('TaskBoard returned no board data.');
 return data;
}
async function read() { const result = await app.callServerTool({name:'taskboard_read',arguments:{}}); return unpack(result); }
app.ontoolresult = result => {
 try { const data = unpack(result); if (accept) accept(data); } catch(error) { document.getElementById('connection-status').textContent = error.message; }
};
async function connect() {
 try {
  await app.connect();
  const data = await read();
  accept = startBoard(data,{
   read,
   searchIssues:async (repository,query) => { const result = await app.callServerTool({name:'taskboard_github_search',arguments:{repository,query}}); return unpack(result); },
   importIssue:async (url,projectId,statusId,revision) => { const result = await app.callServerTool({name:'taskboard_import_issue',arguments:{url,projectId,statusId,revision}}); return unpack(result); },
   refreshIssue:async (taskId,revision) => { const result = await app.callServerTool({name:'taskboard_refresh_issue',arguments:{taskId,revision}}); return unpack(result); },
   resolveProject:async (projectId,hostId) => {
    const result = await app.callServerTool({name:'taskboard_project_details',arguments:{projectId,hostId}});
    const data = unpack(result);
    return data.projectDetails;
   },
   save:async (state,revision) => { const result = await app.callServerTool({name:'taskboard_save',arguments:{state,revision}}); return unpack(result); },
   openLink:async url => {
    const result = await app.openLink({url});
    if (result.isError) throw new Error('Codex could not open this link.');
   },
   message:async text => { await app.sendMessage({role:'user',content:[{type:'text',text}]}); }
  });
  document.getElementById('connection-status').hidden = true;
 } catch(error) { document.getElementById('connection-status').textContent = error.message; }
}
void connect();
