import { App } from '@modelcontextprotocol/ext-apps';
import { OpenAIExtensions } from '@openai/mcp-extensions/app';
import { startBoard } from './board.js';
import './markdown.js';
import './style.css';
const app = new App({name:'taskboard',version:'0.9.4'});
new OpenAIExtensions(app);
let accept;
const workspace = document.getElementById('workspace');
const setup = document.getElementById('connection-setup');
const status = document.getElementById('connection-status');
const message = document.getElementById('connection-message');
const retry = document.getElementById('retry-connection');
const choose = document.getElementById('choose-connection-file');
const setupError = document.getElementById('setup-error');
const create = document.getElementById('create-board');
const choices = document.getElementById('setup-choices');
const creationProgress = document.getElementById('creation-progress');
const creationMessage = document.getElementById('creation-message');
const continueCreation = document.getElementById('continue-creation');
let creationTimer;
let creating = false;

function showCreation(creation) {
 clearTimeout(creationTimer);
 const pending = creation && ['requested','provisioning','publishing'].includes(creation.status);
 choices.hidden = Boolean(pending);
 creationProgress.hidden = Boolean(pending) === false;
 create.textContent = creation && creation.status === 'failed' ? 'Retry creating board' : 'Create a new board';
 if (pending) {
  const labels = {requested:'Getting your board ready…',provisioning:'Setting up your private board…',publishing:'Finishing your board…'};
  creationMessage.textContent = labels[creation.status];
  creationTimer = setTimeout(loadBoard,2000);
 }
 if (creation && creation.status === 'failed') {
  setupError.textContent = 'Setup needs attention. Check the Codex chat, then retry to resume your board setup.';
  setupError.hidden = false;
 }
}

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
  showCreation(data.creation);
  return;
 }
 if (data.state === undefined) return;
 clearTimeout(creationTimer);
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
  choose.textContent = 'Connect to an existing board';
 }
};
async function requestCreation(resume = false) {
 if (creating) return;
 creating = true;
 create.disabled = true;
 continueCreation.disabled = true;
 setupError.hidden = true;
 let requestId;
 try {
  const result = await app.callServerTool({name:'taskboard_begin_creation',arguments:{}});
  const data = unpack(result);
  requestId = data.creation.requestId;
  receive(data);
  if (data.shouldRequest || resume) await api.message(data.prompt);
 } catch(error) {
  if (requestId) {
   const failed = await app.callServerTool({name:'taskboard_update_creation',arguments:{requestId,status:'failed'}});
   const data = unpack(failed);
   receive(data);
  }
  setupError.textContent = error.message;
  setupError.hidden = false;
 } finally {
  creating = false;
  create.disabled = false;
  continueCreation.disabled = false;
 }
}
create.onclick = () => requestCreation();
continueCreation.onclick = () => requestCreation(true);
async function connect() {
 try {
  await app.connect();
  await loadBoard();
 } catch(error) { showError(error); }
}
void connect();
