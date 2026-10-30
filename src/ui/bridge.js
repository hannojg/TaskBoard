import { App } from '@modelcontextprotocol/ext-apps';
import { OpenAIExtensions } from '@openai/mcp-extensions/app';
import { startBoard } from './board.js';
import './markdown.js';
import './style.css';
const app = new App({name:'taskboard',version:'0.7.2'});
new OpenAIExtensions(app);
let accept;
const workspace = document.getElementById('workspace');
const setup = document.getElementById('connection-setup');
const status = document.getElementById('connection-status');
const message = document.getElementById('connection-message');
const retry = document.getElementById('retry-connection');
const choose = document.getElementById('choose-connection-file');
const setupError = document.getElementById('setup-error');

function unpack(result) {
 if (result.isError) {
  const blocks = result.content.filter(block => block.type === 'text');
  const messages = blocks.map(block => block.text);
  throw new Error(messages.join('\n'));
 }
 const data = result.structuredContent;
 if (data === undefined || (data.state === undefined && typeof data.connectionRequired !== 'boolean')) throw new Error('TaskBoard returned no board data.');
 return data;
}
async function read() {
 const result = await app.callServerTool({name:'taskboard_read',arguments:{}});
 return unpack(result);
}
const api = {
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
};
function receive(data) {
 if (data.connectionRequired) {
  workspace.hidden = true;
  setup.hidden = false;
  status.hidden = true;
  return;
 }
 if (data.state === undefined) return;
 if (accept) accept(data);
 else accept = startBoard(data,api);
 setup.hidden = true;
 workspace.hidden = false;
 status.hidden = true;
 setupError.hidden = true;
}
function showError(error) {
 if (accept === undefined) setup.hidden = false;
 message.textContent = error.message;
 status.hidden = false;
 retry.hidden = false;
}
app.ontoolresult = result => {
 try {
  const data = unpack(result);
  receive(data);
 } catch(error) { showError(error); }
};
async function loadBoard() {
 try {
  const data = await read();
  receive(data);
 } catch(error) { showError(error); }
}
retry.onclick = loadBoard;
choose.onclick = async () => {
 choose.disabled = true;
 choose.textContent = 'Waiting for connection file…';
 setupError.hidden = true;
 try {
  const result = await app.callServerTool({name:'taskboard_connect',arguments:{}},{timeout:300000});
  const data = unpack(result);
  receive(data);
 } catch(error) {
  setupError.textContent = error.message;
  setupError.hidden = false;
 } finally {
  choose.disabled = false;
  choose.textContent = 'Choose connection file';
 }
};
async function connect() {
 try {
  await app.connect();
  await loadBoard();
 } catch(error) { showError(error); }
}
void connect();
