import { reorderColumns } from '../column-order.js';
import { chatKey } from '../chat-key.js';
import { chatUrl,taskChatUrl } from '../task-chat.js';
import { descriptionImagesReady } from './markdown.js';
import { descriptionText } from '../description.js';
import { startAutoRefresh } from './auto-refresh.js';
import { markdownCheckpoints,setCheckpoint } from '../checkpoints.js';
import { parseReferenceUrl } from '../references.js';
import { asanaLinkPrompt,asanaRefreshPrompt,asanaSchedulePrompt } from '../asana.js';
export function startBoard(initialData,api) {
const $ = id => document.getElementById(id);

const statuses = [{id:'backlog',name:'Backlog'},{id:'todo',name:'To do'},{id:'progress',name:'In progress'},{id:'review',name:'Waiting for review'},{id:'blocked',name:'Blocked'},{id:'done',name:'Done'}];
let state = initialData.state;
let revision = initialData.revision;
let catalog = initialData.catalog;
let chatCatalog = initialData.chatCatalog;
let chatsUpdatedAt = initialData.chatsUpdatedAt;
const deviceId = initialData.deviceId;
const boardUrl = initialData.boardUrl;
let asanaSupported = initialData.features?.includes('asana') === true;
let selectedChats = [];
let selectedReferences = [];
let referenceType = null;
let saving = false;
let failed = false;
let selectedProject = null;
let view = 'projects';
let editingTask = null;
let editingProject = null;
let projectLookup = 0;
let dragged = null;
let draggedColumn = null;
let draggedProject = null;
let toastTimer;
let issueResults = [];
let selectedIssue = null;
let issueStatus = 'backlog';
let issueRequest = 0;
let issueBusy = false;
let openingChat = false;
let savingTask = false;
function element(tag,className,text) { const node = document.createElement(tag); node.className = className; if (text) node.textContent = text; return node; }
function notify(message) { $('toast').textContent = message; $('toast').style.display = 'block'; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').style.display = 'none'; },2600); }
async function persist() {
 if (saving || failed) return false;
 saving = true;
 document.body.classList.add('saving');
 $('save-status').textContent = 'Saving…';
 try {
  const result = await api.save(state,revision);
  state = result.state; revision = result.revision; catalog = result.catalog;
  $('save-status').textContent = 'All changes saved';
  render();
  return true;
 } catch (error) {
  failed = true;
  document.body.classList.add('save-error');
  $('sync-status').hidden = true;
  $('save-status').textContent = error.message+' Use Refresh board to load the latest saved version.';
  notify(error.message);
  return false;
 } finally { saving = false; document.body.classList.remove('saving'); }
}
function projectFor(id) { return state.projects.find(project => project.id === id); }
function statusFor(id) { return statuses.find(status => status.id === id); }
function selectProject(id) { selectedProject = id; render(); }
function clearProjectDrag() {
 draggedProject = null;
 for (const node of $('projects').children) node.classList.remove('project-dragging','project-drop-before','project-drop-after');
}
function projectDropAfter(event,button) {
 const bounds = button.getBoundingClientRect();
 const narrow = window.matchMedia('(max-width:600px)');
 return narrow.matches ? event.clientX > bounds.left+bounds.width/2 : event.clientY > bounds.top+bounds.height/2;
}
function projectButton(item) {
 const button = element('button','nav-item');
 button.type = 'button';
 button.draggable = true;
 button.dataset.projectId = item.id;
 button.classList.toggle('active',item.id === selectedProject);
 button.title = 'Drag to reorder. Alt + Up or Down also moves this project.';
 const label = element('span','project-nav-label',item.name);
 const grip = element('span','project-nav-grip','⠿');
 grip.setAttribute('aria-hidden','true');
 button.append(label,grip);
 button.onclick = () => selectProject(item.id);
 button.ondragstart = event => {
  if (saving || failed) { event.preventDefault(); return; }
  draggedProject = item.id;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain',item.id);
  button.classList.add('project-dragging');
 };
 button.ondragend = clearProjectDrag;
 button.ondragover = event => {
  if (draggedProject === null || draggedProject === item.id) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  const after = projectDropAfter(event,button);
  button.classList.toggle('project-drop-before',after === false);
  button.classList.toggle('project-drop-after',after);
 };
 button.ondragleave = event => {
  if (button.contains(event.relatedTarget) === false) button.classList.remove('project-drop-before','project-drop-after');
 };
 button.ondrop = event => {
  if (draggedProject === null) return;
  event.preventDefault();
  const after = projectDropAfter(event,button);
  const id = draggedProject;
  clearProjectDrag();
  reorderColumn(id,item.id,true,after);
 };
 button.onkeydown = async event => {
  if (event.altKey === false || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
  event.preventDefault();
  const index = state.projects.findIndex(project => project.id === item.id);
  const down = event.key === 'ArrowDown';
  const next = down ? index+1 : index-1;
  if (next < 0 || next >= state.projects.length) return;
  const saved = await reorderColumn(item.id,state.projects[next].id,true,down);
  if (saved) {
   for (const node of $('projects').children) {
    if (node.dataset.projectId === item.id) { node.focus(); break; }
   }
  }
 };
 return button;
}
function linkNode(url,label) {
 const node = element('a','project-link',label);
 const parsed = new URL(url);
 if (parsed.protocol === 'https:' || parsed.protocol === 'http:' || parsed.protocol === 'codex:') { node.href = url; node.target = '_blank'; node.rel = 'noopener noreferrer'; }
 return node;
}
function render() {
 const project = projectFor(selectedProject);
 $('view-title').textContent = project ? project.name : 'All projects';
 $('edit-project').hidden = project === undefined;
 $('overview').classList.toggle('active',selectedProject === null);
 $('by-project').hidden = Boolean(project);
 $('by-status').textContent = project ? 'Board' : 'Status';
 $('by-project').classList.toggle('active',view === 'projects');
 $('by-status').classList.toggle('active',Boolean(project) || view === 'status');
 $('project-links').replaceChildren();
 if (project) {
  if (project.repo) { const link = linkNode(project.repo,'Repository ↗'); $('project-links').append(link); }
  if (project.path) { const path = element('span','local-path',project.path); $('project-links').append(path); }
 }
 $('projects').replaceChildren();
 for (const item of state.projects) {
  const button = projectButton(item);
  $('projects').append(button);
 }
 const board = $('board'); board.replaceChildren();
 const query = $('search').value.toLowerCase();
 const visible = state.tasks.filter(task => { const text = task.title+' '+task.description; const lower = text.toLowerCase(); return (selectedProject === null || task.projectId === selectedProject) && lower.includes(query); });
 const taskLabel = visible.length === 1 ? ' task' : ' tasks';
 $('total').textContent = visible.length+taskLabel;
 if (state.projects.length === 0) {
  const empty = element('div','board-empty','Create a project to start adding tasks.'); board.append(empty); return;
 }
 const groupByProject = selectedProject === null && view === 'projects';
 const orderedStatuses = state.statusOrder.map(id => statusFor(id));
 const groups = groupByProject ? state.projects : orderedStatuses;
 for (const group of groups) {
  const section = element('section','column'); section.setAttribute('aria-label',group.name);
  const head = element('div','column-head');
  const title = element('button','column-open',group.name); title.onclick = () => { if (groupByProject) selectProject(group.id); }; title.title = groupByProject ? 'Open project board' : group.name;
  const tasks = visible.filter(task => groupByProject ? task.projectId === group.id : task.statusId === group.id);
  const countText = String(tasks.length); const count = element('span','count',countText);
  const grip = element('button','column-grip','⠿');
  grip.type = 'button'; grip.draggable = true;
  grip.setAttribute('aria-label','Reorder '+group.name);
  grip.title = 'Drag to reorder. Alt + Left or Right also moves this column.';
  grip.ondragstart = event => {
   event.stopPropagation(); draggedColumn = {id:group.id,groupByProject};
   event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain',group.id);
   section.classList.add('column-dragging');
  };
  grip.ondragend = () => {
   draggedColumn = null;
   for (const node of board.children) node.classList.remove('column-dragging','column-drop-before','column-drop-after');
  };
  grip.onkeydown = event => {
   if (event.altKey === false || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
   event.preventDefault();
   const index = groups.findIndex(item => item.id === group.id);
   const next = event.key === 'ArrowRight' ? index+1 : index-1;
   if (next < 0 || next >= groups.length) return;
   reorderColumn(group.id,groups[next].id,groupByProject,event.key === 'ArrowRight');
  };
  head.append(grip,title,count);
  if (groupByProject) {
   const edit = element('button','icon','⋯'); edit.setAttribute('aria-label','Edit '+group.name); edit.onclick = () => openProject(group); head.append(edit);
   section.ondblclick = event => { if (event.target.closest('.card, .add-task, .icon, .column-grip')) return; selectProject(group.id); };
  }
  const cards = element('div','cards');
  for (const task of tasks) { const card = taskCard(task,group,groupByProject); cards.append(card); }
  if (tasks.length === 0) { const empty = element('div','empty',query ? 'No matching tasks' : 'No tasks'); cards.append(empty); }
  section.ondragover = event => {
   if (draggedColumn === null && dragged === null) return;
   event.preventDefault(); event.dataTransfer.dropEffect = 'move';
   if (draggedColumn) {
    const bounds = section.getBoundingClientRect();
    const after = event.clientX > bounds.left+bounds.width/2;
    section.classList.toggle('column-drop-before',after === false);
    section.classList.toggle('column-drop-after',after);
   } else section.classList.add('drop-target');
  };
  section.ondragleave = event => {
   if (section.contains(event.relatedTarget) === false) section.classList.remove('drop-target','column-drop-before','column-drop-after');
  };
  section.ondrop = event => {
   event.preventDefault();
   if (draggedColumn) {
    const bounds = section.getBoundingClientRect();
    const after = event.clientX > bounds.left+bounds.width/2;
    const moved = draggedColumn; draggedColumn = null;
    reorderColumn(moved.id,group.id,groupByProject,after);
   } else if (dragged) moveTask(dragged,group,groupByProject,null);
  };
  const add = element('button','add-task','＋ Add task'); add.onclick = () => openTask(null,groupByProject ? group.id : selectedProject,groupByProject ? 'backlog' : group.id);
  section.append(head,add,cards); board.append(section);
 }
}
function reorderColumn(id,targetId,groupByProject,after) {
 if (saving || failed || id === targetId) return false;
 if (groupByProject) state.projects = reorderColumns(state.projects,id,targetId,after);
 else {
  const ordered = state.statusOrder.map(statusId => statusFor(statusId));
  const moved = reorderColumns(ordered,id,targetId,after);
  state.statusOrder = moved.map(status => status.id);
 }
 return persist();
}
function moveTask(id,group,groupByProject,beforeId) {
 const task = state.tasks.find(item => item.id === id);
 if (groupByProject) task.projectId = group.id; else task.statusId = group.id;
 state.tasks = state.tasks.filter(item => item.id !== id);
 const position = state.tasks.findIndex(item => item.id === beforeId);
 if (position >= 0) state.tasks.splice(position,0,task); else state.tasks.push(task);
 persist();
}
function taskCard(task,group,groupByProject) {
 const card = element('article','card'); card.draggable = true; card.tabIndex = 0; card.setAttribute('aria-label',task.title+'; edit task');
 const header = element('div','card-header');
 const heading = element('h2','',task.title);
 if (task.asana) {
  const source = linkNode(task.asana.url,task.title);
  source.className = 'asana-title';
  source.title = 'Open in Asana';
  source.draggable = false;
  source.onclick = async event => {
   event.preventDefault();
   event.stopPropagation();
   try { await api.openLink(task.asana.url); }
   catch(error) { notify(error.message); }
  };
  source.ondragstart = event => { event.preventDefault(); event.stopPropagation(); };
  heading.replaceChildren(source);
 }
 const actions = element('div','card-chat-actions');
 if (task.chats.length > 0) {
  const open = chatAction('','Open linked chat',() => openTaskChats(task));
  const icon = chatIcon();
  open.append(icon);
  actions.append(open);
 }
 const create = chatAction('＋','Create agent chat',() => createTaskChat(task));
 const project = projectFor(task.projectId);
 configureCreateChat(create,project);
 header.append(heading,actions);
 actions.append(create);
 card.append(header);
 if (task.asana) {
  const label = task.asana.syncError ? 'Asana · refresh needs attention' : 'Asana ↗';
  const badge = element('span','issue-badge asana-badge',label);
  card.append(badge);
 }
 if (task.issue) {
  const link = linkNode(task.issue.url,'GitHub #'+task.issue.number);
  link.className = 'issue-badge';
  link.title = 'Open '+task.issue.repository+' #'+task.issue.number+' on GitHub';
  link.setAttribute('aria-label',link.title);
  link.draggable = false;
  const icon = githubIcon();
  link.prepend(icon);
  link.onclick = async event => {
   event.preventDefault(); event.stopPropagation();
   try { await api.openLink(task.issue.url); } catch(error) { notify(error.message); }
  };
  link.ondragstart = event => { event.preventDefault(); event.stopPropagation(); };
  card.append(link);
 }
 const checkpoints = markdownCheckpoints(task.description);
 if (checkpoints.length > 0) {
  const checklist = taskCheckpoints(task,checkpoints);
  card.append(checklist);
 } else if (task.description) { const text = descriptionText(task.description); const description = element('p','',text); card.append(description); }
 const meta = element('div','meta');
 const context = groupByProject ? statusFor(task.statusId) : projectFor(task.projectId);
 const contextName = context ? context.name : '';
 if (contextName) { const badge = element('span','priority',contextName); meta.append(badge); }
 if (task.priority !== 'None') { const badge = element('span','priority '+task.priority,task.priority); meta.append(badge); }
 if (checkpoints.length > 0) {
  const completed = checkpoints.filter(checkpoint => checkpoint.checked);
  const progress = element('span','checkpoint-progress',completed.length+'/'+checkpoints.length);
  progress.setAttribute('aria-label',completed.length+' of '+checkpoints.length+' checkpoints completed');
  meta.append(progress);
 }
 if (task.chats.length > 0) {
  const label = task.chats.length === 1 ? '1 chat' : task.chats.length+' chats';
  const chats = chatAction(label,'Open linked chat',() => openTaskChats(task));
  const icon = chatIcon();
  chats.prepend(icon);
  chats.className = 'priority chat-badge';
  meta.append(chats);
 }
 if (task.references && task.references.length > 0) {
  const label = task.references.length === 1 ? '1 reference' : task.references.length+' references';
  const badge = element('span','priority',label);
  meta.append(badge);
 }
 if (task.due) { const date = new Date(task.due+'T12:00:00'); const formatted = date.toLocaleDateString(undefined,{month:'short',day:'numeric'}); const due = element('span','',formatted); meta.append(due); }
 card.append(meta);
 card.onclick = () => openTask(task,task.projectId,task.statusId);
 card.onkeydown = event => { if (event.target === card && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openTask(task,task.projectId,task.statusId); } };
 card.ondblclick = event => event.stopPropagation();
 card.ondragstart = event => { dragged = task.id; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain',task.id); card.classList.add('dragging'); };
 card.ondragend = () => { dragged = null; render(); };
 card.ondrop = event => { if (draggedColumn) return; event.preventDefault(); event.stopPropagation(); if (dragged && dragged !== task.id) moveTask(dragged,group,groupByProject,task.id); };
 return card;
}
function taskCheckpoints(task,checkpoints) {
 const list = element('ul','card-checkpoints');
 list.setAttribute('aria-label','Checkpoints');
 for (const checkpoint of checkpoints) {
  const item = element('li','card-checkpoint');
  item.classList.toggle('checkpoint-nested',checkpoint.depth === 1);
  const label = element('label','');
  const checkbox = element('input','');
  checkbox.type = 'checkbox';
  checkbox.checked = checkpoint.checked;
  checkbox.disabled = Boolean(task.asana);
  const text = element('span','',checkpoint.text);
  checkbox.onchange = async () => {
   if (saving || failed || task.asana) {
    checkbox.checked = checkpoint.checked;
    return;
   }
   task.description = setCheckpoint(task.description,checkpoint.position,checkbox.checked);
   await persist();
  };
  label.append(checkbox,text);
  item.append(label);
  list.append(item);
 }
 list.onclick = event => event.stopPropagation();
 list.ondragstart = event => { event.preventDefault(); event.stopPropagation(); };
 return list;
}
function githubIcon() {
 const namespace = 'http://www.w3.org/2000/svg';
 const icon = document.createElementNS(namespace,'svg');
 icon.setAttribute('class','github-icon');
 icon.setAttribute('viewBox','0 0 16 16');
 icon.setAttribute('fill','currentColor');
 icon.setAttribute('aria-hidden','true');
 const mark = document.createElementNS(namespace,'path');
 mark.setAttribute('d','M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.65 7.65 0 0 1 8 3.86c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z');
 icon.append(mark);
 return icon;
}
function chatIcon() {
 const namespace = 'http://www.w3.org/2000/svg';
 const icon = document.createElementNS(namespace,'svg');
 icon.setAttribute('class','chat-icon');
 icon.setAttribute('viewBox','0 0 24 24');
 icon.setAttribute('fill','none');
 icon.setAttribute('stroke','currentColor');
 icon.setAttribute('stroke-width','1.75');
 icon.setAttribute('stroke-linecap','round');
 icon.setAttribute('stroke-linejoin','round');
 icon.setAttribute('aria-hidden','true');
 const outline = document.createElementNS(namespace,'path');
 outline.setAttribute('d','M21 15a4 4 0 0 1-4 4H7l-4 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z');
 icon.append(outline);
 return icon;
}
function chatAction(label,title,action) {
 const button = element('button','card-chat-action',label);
 button.type = 'button';
 button.title = title;
 button.setAttribute('aria-label',title);
 button.onclick = event => { event.stopPropagation(); action(); };
 button.ondragstart = event => { event.preventDefault(); event.stopPropagation(); };
 return button;
}
function configureCreateChat(button,project) {
 const local = project.hostId === 'local' && project.path.length > 0;
 button.disabled = local === false;
 button.title = local ? 'Open a new draft with this ticket’s context' : 'Draft chats can only be opened for local projects.';
}
async function openChat(chat) {
 if (chat.threadId && chat.deviceId && chat.deviceId !== deviceId) { notify('Open this chat on '+chat.deviceName+'.'); return; }
 try {
  const url = chatUrl(chat);
  await api.openLink(url);
 } catch(error) { notify(error.message); }
}
function openTaskChats(task) {
 if (task.chats.length === 1) { openChat(task.chats[0]); return; }
 $('task-chats-title').textContent = task.title;
 $('task-chat-links').replaceChildren();
 for (const chat of task.chats) {
  const button = element('button','task-chat-link',chat.title);
  const icon = chatIcon();
  button.prepend(icon);
  button.type = 'button';
  button.onclick = () => openChat(chat);
  $('task-chat-links').append(button);
 }
 $('task-chats').showModal();
}
async function createTaskChat(task) {
 if (openingChat) return;
 openingChat = true;
 try {
  const project = projectFor(task.projectId);
  const status = statusFor(task.statusId);
  const url = taskChatUrl(task,project,status.name);
  await api.openLink(url);
 } catch(error) { notify(error.message); }
 finally { openingChat = false; }
}
$('close-task-chats').onclick = () => $('task-chats').close();
function fillOptions(id,items,value) { $(id).replaceChildren(); for (const item of items) { const option = element('option','',item.name); option.value = item.id; $(id).append(option); } $(id).value = value; }
function openTask(task,projectId,statusId) {
 if (state.projects.length === 0) { openProject(null); return; }
 editingTask = task ? task.id : null;
 $('task-create-chat').hidden = task === null;
 $('task-save-error').hidden = true;
 $('task-source-actions').hidden = task !== null;
 const sourceOwned = Boolean(task && task.asana);
 $('title').readOnly = sourceOwned;
 $('description').readOnly = sourceOwned;
 if (sourceOwned) $('title').removeAttribute('maxlength');
 else $('title').maxLength = 200;
 renderTaskAsana(task);
 $('description-label').textContent = task && task.issue ? 'Local notes' : 'Description';
 renderTaskIssue(task);
 $('title').value = task ? task.title : ''; $('description').value = task ? task.description : ''; $('priority').value = task ? task.priority : 'None'; $('due').value = task ? task.due : '';
 selectedChats = task ? [...task.chats] : [];
 selectedReferences = task && task.references ? [...task.references] : [];
 closeReferenceComposer();
 renderReferences();
 $('chat-search').value = '';
 $('all-chats').checked = false;
 const targetProject = projectId || state.projects[0].id;
 fillOptions('task-project',state.projects,targetProject); fillOptions('task-status',statuses,statusId || 'backlog');
 renderChatPicker();
 $('delete-task').textContent = sourceOwned ? 'Remove from board' : 'Delete task';
 $('delete-task').hidden = task === null; $('editor').showModal(); $('title').focus();
}
async function saveTask(createChat) {
 if (savingTask) return;
 savingTask = true;
 try {
  const ready = await descriptionImagesReady();
  if (ready === false || $('editor').open === false) return;
  const existing = state.tasks.find(item => item.id === editingTask);
  const sourceOwned = Boolean(existing && existing.asana);
  const title = sourceOwned ? existing.title : $('title').value.trim();
  if (title.length === 0) return;
  const pendingUrl = $('reference-url').value;
  const pendingTitle = $('reference-title').value;
  if (pendingUrl || pendingTitle) {
   const added = addReference();
   if (added === false) return;
  }
  const description = sourceOwned ? existing.description : $('description').value.trim();
  const task = {...existing,id:editingTask || crypto.randomUUID(),title,description,priority:$('priority').value,due:$('due').value,projectId:$('task-project').value,statusId:$('task-status').value,chats:selectedChats,references:selectedReferences};
  const index = state.tasks.findIndex(item => item.id === editingTask); if (index >= 0) state.tasks[index] = task; else state.tasks.push(task);
  const saved = await persist();
  if (saved === false) {
   $('task-save-error').textContent = $('save-status').textContent;
   $('task-save-error').hidden = false;
   return;
  }
  $('editor').close();
  if (createChat) await createTaskChat(task);
  return task;
 } finally {
  savingTask = false;
 }
}
$('task-form').onsubmit = event => {
 event.preventDefault();
 saveTask(false);
};
$('create-agent-chat').onclick = () => {
 const valid = $('task-form').reportValidity();
 if (valid) saveTask(true);
};
function renderReferences() {
 $('task-references').replaceChildren();
 for (const reference of selectedReferences) {
  const details = parseReferenceUrl(reference.url);
  const type = details.type === 'slack' ? 'Slack thread' : 'Web link';
  const label = reference.title || type;
  const row = element('div','task-reference');
  const icon = referenceIcon(details.type);
  const content = element('div','reference-content');
  const link = linkNode(reference.url,label+' ↗');
  link.className = 'reference-link';
  link.title = reference.url;
  link.onclick = async event => {
   event.preventDefault();
   try { await api.openLink(reference.url); }
   catch(error) { notify(error.message); }
  };
  const url = new URL(reference.url);
  const source = element('span','reference-source',type+' · '+url.hostname);
  const remove = element('button','icon','×');
  remove.type = 'button';
  remove.setAttribute('aria-label','Remove reference '+label);
  remove.onclick = () => {
   selectedReferences = selectedReferences.filter(item => item.url !== reference.url);
   $('reference-error').hidden = true;
   renderReferences();
  };
  content.append(link,source);
  row.append(icon,content,remove);
  $('task-references').append(row);
 }
}
function referenceIcon(type) {
 const namespace = 'http://www.w3.org/2000/svg';
 const icon = document.createElementNS(namespace,'svg');
 icon.setAttribute('class','reference-icon');
 icon.setAttribute('viewBox','0 0 24 24');
 icon.setAttribute('aria-hidden','true');
 if (type === 'slack') {
  const marks = [
   {fill:'#36c5f0',d:'M8 1a2 2 0 0 1 2 2v2H8a2 2 0 0 1 0-4ZM3 6h7v4H3a2 2 0 0 1 0-4Z'},
   {fill:'#2eb67d',d:'M23 8a2 2 0 0 1-2 2h-2V8a2 2 0 0 1 4 0ZM18 3v7h-4V3a2 2 0 0 1 4 0Z'},
   {fill:'#ecb22e',d:'M16 23a2 2 0 0 1-2-2v-2h2a2 2 0 0 1 0 4ZM21 18h-7v-4h7a2 2 0 0 1 0 4Z'},
   {fill:'#e01e5a',d:'M1 16a2 2 0 0 1 2-2h2v2a2 2 0 0 1-4 0ZM6 21v-7h4v7a2 2 0 0 1-4 0Z'}
  ];
  for (const mark of marks) {
   const path = document.createElementNS(namespace,'path');
   path.setAttribute('fill',mark.fill);
   path.setAttribute('d',mark.d);
   icon.append(path);
  }
 } else {
  icon.setAttribute('fill','none');
  icon.setAttribute('stroke','currentColor');
  icon.setAttribute('stroke-width','1.8');
  icon.setAttribute('stroke-linecap','round');
  icon.setAttribute('stroke-linejoin','round');
  const path = document.createElementNS(namespace,'path');
  path.setAttribute('d','M10 13a5 5 0 0 0 7.1 0l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7M14 11a5 5 0 0 0-7.1 0l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7');
  icon.append(path);
 }
 return icon;
}
function closeReferenceComposer() {
 referenceType = null;
 $('reference-composer').hidden = true;
 $('reference-url').value = '';
 $('reference-title').value = '';
 $('reference-error').hidden = true;
 $('reference-slack').setAttribute('aria-expanded','false');
 $('reference-link').setAttribute('aria-expanded','false');
}
function toggleReferenceComposer(type) {
 if (referenceType === type) {
  closeReferenceComposer();
  return;
 }
 referenceType = type;
 const slack = type === 'slack';
 $('reference-composer').hidden = false;
 $('reference-composer-title').textContent = slack ? 'Add Slack thread' : 'Add web link';
 $('reference-url').placeholder = slack ? 'Paste a Slack thread link' : 'https://example.com';
 $('reference-title').placeholder = slack ? 'e.g. Store upload request' : 'e.g. Upload instructions';
 $('reference-error').hidden = true;
 const slackExpanded = String(slack);
 const linkExpanded = String(slack === false);
 $('reference-slack').setAttribute('aria-expanded',slackExpanded);
 $('reference-link').setAttribute('aria-expanded',linkExpanded);
 $('reference-url').focus();
}
for (const type of ['slack','link']) {
 const button = $('reference-'+type);
 const icon = referenceIcon(type);
 const plus = element('span','reference-add-plus','+');
 plus.setAttribute('aria-hidden','true');
 button.append(icon,plus);
 button.onclick = () => toggleReferenceComposer(type);
}
$('cancel-reference').onclick = () => {
 const button = $('reference-'+referenceType);
 closeReferenceComposer();
 button.focus();
};
function addReference() {
 try {
  const value = $('reference-url').value;
  const details = parseReferenceUrl(value);
  if (referenceType === 'slack' && details.type !== 'slack') throw new Error('Paste a Slack message or thread link.');
  const duplicate = selectedReferences.some(reference => reference.url === details.url);
  if (duplicate) throw new Error('This reference is already linked to the task.');
  const label = $('reference-title').value;
  const title = label.trim();
  selectedReferences.push({url:details.url,title});
  const button = $('reference-'+referenceType);
  closeReferenceComposer();
  renderReferences();
  button.focus();
  return true;
 } catch(error) {
  $('reference-error').textContent = error.message;
  $('reference-error').hidden = false;
  return false;
 }
}
$('add-reference').onclick = addReference;
function referenceKeydown(event) {
 if (event.key === 'Escape') {
  event.preventDefault();
  event.stopPropagation();
  const button = $('reference-'+referenceType);
  closeReferenceComposer();
  button.focus();
  return;
 }
 if (event.key !== 'Enter') return;
 event.preventDefault();
 addReference();
}
$('reference-url').onkeydown = referenceKeydown;
$('reference-title').onkeydown = referenceKeydown;
function issueSource(issue) {
 const section = element('div','issue-source');
 const heading = element('h3','',issue.title); const link = linkNode(issue.url,issue.repository+' #'+issue.number+' ↗');
 const meta = element('p','form-note',issue.state+' · '+issue.labels.join(', '));
 const body = element('pre','issue-body',issue.body || 'No description.');
 section.append(heading,link,meta,body); return section;
}
function renderTaskAsana(task) {
 const container = $('task-asana');
 container.replaceChildren();
 container.hidden = Boolean(task && task.asana) === false;
 if (container.hidden) return;
 const link = linkNode(task.asana.url,'Open in Asana ↗');
 link.onclick = async event => {
  event.preventDefault();
  try { await api.openLink(task.asana.url); }
  catch(error) { notify(error.message); }
 };
 const ownership = element('p','form-note','Owned by Asana. Edit the title and description in Asana.');
 const date = new Date(task.asana.syncedAt);
 const checkedAt = date.toLocaleString();
 const checked = element('p','form-note','Last synced '+checkedAt);
 const refresh = element('button','','Save and refresh from Asana');
 refresh.type = 'button';
 refresh.onclick = async () => {
  const valid = $('task-form').reportValidity();
  if (valid === false) return;
  const saved = await saveTask(false);
  if (saved) {
   const prompt = asanaRefreshPrompt(task.asana.gid);
   await requestAgent(prompt);
  }
 };
 container.append(link,ownership,checked,refresh);
 if (task.asana.syncError) {
  const error = element('p','asana-sync-error','Refresh needs attention: '+task.asana.syncError);
  error.setAttribute('role','status');
  container.append(error);
 }
}

let asanaStatus = 'backlog';
function openAsana(projectId,statusId) {
 const firstProject = state.projects[0];
 const target = projectId || (firstProject ? firstProject.id : '');
 fillOptions('asana-project',state.projects,target);
 asanaStatus = statusId || 'backlog';
 $('asana-url').value = '';
 $('asana-error').hidden = true;
 const linked = state.tasks.some(task => task.asana);
 $('link-asana').disabled = asanaSupported === false || state.projects.length === 0;
 $('refresh-asana').disabled = asanaSupported === false || linked === false;
 $('schedule-asana').disabled = asanaSupported === false || linked === false || Boolean(boardUrl) === false;
 $('asana-support').textContent = asanaSupported ? '' : 'Update the shared board Site to the latest TaskBoard API to enable Asana links.';
 $('asana-manager').showModal();
}
$('open-asana').onclick = () => openAsana(selectedProject,'backlog');
$('open-asana-import').onclick = () => openAsana($('task-project').value,$('task-status').value);
$('close-asana').onclick = () => $('asana-manager').close();
$('connect-asana').onclick = async () => {
 $('asana-manager').close();
 await requestAgent('Check whether the Asana plugin is installed and connected. Use plugin discovery to help me install/connect it if needed. If connected, verify it with a read-only account or task read. Do not modify Asana or import tickets yet.');
};
$('asana-link-form').onsubmit = async event => {
 event.preventDefault();
 try {
  const prompt = asanaLinkPrompt($('asana-url').value,$('asana-project').value,asanaStatus);
  await api.message(prompt);
  $('asana-manager').close();
  if ($('editor').open && editingTask === null) $('editor').close();
  notify('Requested Asana link in chat.');
 } catch(error) {
  $('asana-error').textContent = error.message;
  $('asana-error').hidden = false;
 }
};
$('refresh-asana').onclick = async () => {
 const prompt = asanaRefreshPrompt();
 $('asana-manager').close();
 await requestAgent(prompt);
};
$('schedule-asana').onclick = async () => {
 const prompt = asanaSchedulePrompt(boardUrl);
 $('asana-manager').close();
 await requestAgent(prompt);
};
function renderTaskIssue(task) {
 const container = $('task-issue'); container.replaceChildren(); container.hidden = task === null || task.issue === null;
 if (container.hidden) return;
 const source = element('details',''); const summary = element('summary','','GitHub #'+task.issue.number+' · '+task.issue.state);
 const details = issueSource(task.issue); source.append(summary,details);
 const refresh = element('button','','Refresh from GitHub'); refresh.type = 'button';
 refresh.onclick = async () => {
  refresh.disabled = true;
  const taskId = task.id;
  try {
   const data = await api.refreshIssue(taskId,revision);
   state = data.state; revision = data.revision; render();
   if ($('editor').open && editingTask === taskId) { const updated = state.tasks.find(item => item.id === taskId); renderTaskIssue(updated); }
   notify('GitHub details refreshed. Local edits preserved.');
  } catch(error) { notify(error.message); } finally {refresh.disabled = false;}
 };
 container.append(source,refresh);
}
function clearIssuePreview() {
 issueRequest += 1; selectedIssue = null; issueResults = [];
 $('issue-preview').hidden = true; $('issue-preview').replaceChildren(); $('issue-results').replaceChildren(); $('confirm-issue-import').disabled = true;
}
const githubImportIcon = githubIcon();
$('open-issue-import').append(githubImportIcon);
$('open-issue-import').onclick = () => {
 clearIssuePreview(); issueBusy = false; $('search-issues').disabled = false;
 fillOptions('issue-project',state.projects,$('task-project').value);
 const project = projectFor($('issue-project').value);
 $('issue-repository').value = project.repo;
 $('issue-query').value = ''; $('issue-message').textContent = '';
 issueStatus = $('task-status').value;
 $('issue-import').showModal();
};
$('close-issue-import').onclick = () => { issueRequest += 1; $('issue-import').close(); };
$('issue-project').onchange = () => { const project = projectFor($('issue-project').value); $('issue-repository').value = project.repo; clearIssuePreview(); };
$('issue-query').oninput = clearIssuePreview;
$('issue-repository').oninput = clearIssuePreview;
$('issue-import-form').onsubmit = async event => {
 event.preventDefault(); if (issueBusy) return;
 clearIssuePreview(); const request = issueRequest; issueBusy = true; $('search-issues').disabled = true;
 $('issue-message').textContent = 'Reading GitHub…';
 try {
  const data = await api.searchIssues($('issue-repository').value,$('issue-query').value);
  if (request !== issueRequest || $('issue-import').open === false) return;
  issueResults = data.issueResults;
  $('issue-message').textContent = issueResults.length ? 'Choose an issue to preview.' : 'No matching issues.';
  issueResults.forEach((issue,index) => {
   const choice = element('button','issue-result','#'+issue.number+' '+issue.title); choice.type = 'button';
   choice.onclick = () => selectIssue(index);
   $('issue-results').append(choice);
  });
  if (issueResults.length === 1) selectIssue(0);
 } catch(error) { if (request === issueRequest) $('issue-message').textContent = error.message; }
 finally { issueBusy = false; $('search-issues').disabled = false; }
};
function selectIssue(index) {
 selectedIssue = issueResults[index]; const preview = issueSource(selectedIssue); $('issue-preview').replaceChildren(preview); $('issue-preview').hidden = false;
 const existing = state.tasks.find(task => task.issue && task.issue.url.toLowerCase() === selectedIssue.url.toLowerCase());
 $('confirm-issue-import').textContent = existing ? 'Open existing task' : 'Import task';
 $('confirm-issue-import').disabled = false;
}
$('confirm-issue-import').onclick = async () => {
 if (selectedIssue === null || issueBusy) return;
 issueBusy = true; $('confirm-issue-import').disabled = true; $('search-issues').disabled = true;
 try {
  const data = await api.importIssue(selectedIssue.url,$('issue-project').value,issueStatus,revision);
  state = data.state; revision = data.revision; render();
  $('issue-import').close(); $('editor').close();
  const task = state.tasks.find(item => item.id === data.importedTaskId);
  openTask(task,task.projectId,task.statusId);
  notify(data.duplicate ? 'Opened the existing imported task.' : 'Issue imported. GitHub is unchanged.');
 } catch(error) { $('issue-message').textContent = error.message; }
 finally { issueBusy = false; $('confirm-issue-import').disabled = false; $('search-issues').disabled = false; }
};
$('delete-task').onclick = () => { state.tasks = state.tasks.filter(task => task.id !== editingTask); persist(); $('editor').close(); };
$('close').onclick = () => $('editor').close();
$('new-task').onclick = () => openTask(null,selectedProject,'backlog');
function openProject(project) {
 projectLookup += 1;
 $('save-project').disabled = false;
 $('project-repo-status').textContent = '';
 editingProject = project ? project.id : null;
 for (const [id,key] of [['project-name','name'],['project-repo','repo'],['project-path','path'],['project-codex','codexId']]) $(id).value = project ? project[key] : '';
 $('delete-project').hidden = project === null;
 const occupied = state.tasks.some(task => task.projectId === editingProject); $('delete-project').disabled = occupied; $('delete-project').title = occupied ? 'Move tasks to another project first.' : '';
 fillCatalog(project);
 $('project-editor').showModal(); $('project-name').focus();
}
$('project-form').onsubmit = event => {
 event.preventDefault(); const name = $('project-name').value.trim(); if (name.length === 0) return;
 const project = {id:editingProject || crypto.randomUUID(),name,repo:$('project-repo').value.trim(),path:$('project-path').value.trim(),codexId:$('project-codex').value.trim(),hostId:$('project-host').value};
 const index = state.projects.findIndex(item => item.id === editingProject); if (index >= 0) state.projects[index] = project; else state.projects.push(project);
 persist(); $('project-editor').close();
};
$('delete-project').onclick = () => { state.projects = state.projects.filter(project => project.id !== editingProject); if (selectedProject === editingProject) selectedProject = null; persist(); $('project-editor').close(); };
$('close-project').onclick = () => $('project-editor').close();
$('add-project').onclick = () => openProject(null); $('sidebar-add').onclick = () => openProject(null);
$('edit-project').onclick = () => { const project = projectFor(selectedProject); openProject(project); };
$('overview').onclick = () => selectProject(null);
$('by-project').onclick = () => { view = 'projects'; render(); };
$('by-status').onclick = () => { view = 'status'; render(); };
$('search').oninput = render;

function fillCatalog(project) {
 const selectedId = project ? project.codexId : '';
 const selectedHost = project ? project.hostId || 'local' : 'local';
 $('project-host').value = selectedHost;
 $('codex-project').replaceChildren();
 const none = element('option','','No Codex project'); none.value = ''; $('codex-project').append(none);
 catalog.forEach((item,index) => {
  const label = item.label+' — '+item.path;
  const option = element('option','',label); option.value = String(index);
  option.selected = item.projectId === selectedId && item.hostId === selectedHost;
  $('codex-project').append(option);
 });
 if (selectedId && catalog.some(item => item.projectId === selectedId && item.hostId === selectedHost) === false) {
  const retained = element('option','','Linked project (refresh catalog to update)'); retained.value = 'retained'; retained.selected = true; $('codex-project').append(retained);
 }
}
$('codex-project').onchange = async () => {
 projectLookup += 1;
 const request = projectLookup;
 const value = $('codex-project').value;
 if (value === 'retained') return;
 const project = value === '' ? null : catalog[Number(value)];
 $('project-codex').value = project ? project.projectId : '';
 $('project-host').value = project ? project.hostId : 'local';
 $('save-project').disabled = false;
 $('project-repo-status').textContent = '';
 if (project === null) return;
 $('project-name').value = project.label;
 $('project-path').value = project.path;
 $('project-repo').value = '';
 $('save-project').disabled = true;
 $('project-repo-status').textContent = 'Reading Git repository…';
 try {
  const details = await api.resolveProject(project.projectId,project.hostId);
  if (request !== projectLookup) return;
  $('project-repo').value = details.repo;
  const messages = {'found':'','no-origin':'This project has no Git origin configured.','not-a-repository':'This project is not a Git repository.','remote-host':'The Git URL must be entered manually for a project on another host.'};
  $('project-repo-status').textContent = messages[details.repoStatus];
 } catch(error) {
  if (request !== projectLookup) return;
  $('project-repo-status').textContent = error.message;
 } finally { if (request === projectLookup) $('save-project').disabled = false; }
};
async function requestAgent(text) {
 try { await api.message(text); notify('Requested in chat.'); } catch (error) { notify(error.message); }
}
$('sync-projects').onclick = () => requestAgent('Use the taskboard skill to refresh the Codex project catalog with list_projects and taskboard_sync_projects. Do not create board projects or change existing tasks.');
function renderChatPicker() {
 $('selected-chats').replaceChildren();
 for (const chat of selectedChats) {
  const row = element('div','selected-chat');
  const elsewhere = chat.threadId && chat.deviceId && chat.deviceId !== deviceId;
  const label = elsewhere ? chat.title+' · '+chat.deviceName : chat.title;
  const title = element('button','selected-chat-open',label);
  const icon = chatIcon();
  title.prepend(icon);
  title.disabled = Boolean(elsewhere);
  title.type = 'button';
  title.title = 'Open '+chat.title;
  title.onclick = () => openChat(chat);
  const remove = element('button','icon','×'); remove.type = 'button'; remove.setAttribute('aria-label','Unlink '+chat.title);
  remove.onclick = () => { const key = chatKey(chat); selectedChats = selectedChats.filter(item => chatKey(item) !== key); renderChatPicker(); };
  row.append(title,remove); $('selected-chats').append(row);
 }
 const project = projectFor($('task-project').value);
 configureCreateChat($('create-agent-chat'),project);
 const scoped = project && project.codexId && $('all-chats').checked === false;
 const query = $('chat-search').value.toLowerCase();
 const choices = chatCatalog.filter(chat => {
  const title = chat.title.toLowerCase();
  const matchesProject = scoped ? chat.projectId === project.codexId && chat.hostId === project.hostId : true;
  return matchesProject && title.includes(query);
 });
 $('chat-options').replaceChildren();
 for (const chat of choices) {
  const label = element('label','chat-choice'); const checkbox = element('input',''); checkbox.type = 'checkbox';
  const key = chatKey(chat); checkbox.checked = selectedChats.some(item => chatKey(item) === key);
  checkbox.onchange = () => {
   if (checkbox.checked) selectedChats.push({...chat});
   else selectedChats = selectedChats.filter(item => chatKey(item) !== key);
   renderChatPicker();
  };
  const title = element('span','',chat.title); label.append(checkbox,title); $('chat-options').append(label);
 }
 if (choices.length === 0) { const empty = element('p','form-note',query ? 'No matching chats.' : 'No synced chats in this view.'); $('chat-options').append(empty); }
 const scope = scoped ? 'This project' : 'All projects';
 const date = chatsUpdatedAt ? new Date(chatsUpdatedAt) : null;
 const refreshed = date ? ' · Synced '+date.toLocaleString() : ' · Not synced yet';
 $('chat-status').textContent = scope+refreshed+'. Sync chats asks Codex to refresh recent chat titles; Reload list loads the results.';
}
$('chat-search').oninput = renderChatPicker;
$('all-chats').onchange = renderChatPicker;
$('task-project').onchange = renderChatPicker;
$('sync-chats').onclick = () => requestAgent('Use the taskboard skill to refresh the recent Codex chat catalog with list_threads and taskboard_sync_chats. Include confirmed chat ID, host, exact title and project ID. Do not modify ticket links or send messages to any chat.');
$('reload-chats').onclick = async () => {
 try { const data = await api.read(); chatCatalog = data.chatCatalog; chatsUpdatedAt = data.chatsUpdatedAt; renderChatPicker(); } catch(error) { $('chat-status').textContent = error.message; }
};
function boardBusy() {
 return saving || dragged !== null || draggedColumn !== null || draggedProject !== null || document.querySelector('dialog[open]') !== null;
}
function receive(data,manual = false) {
 asanaSupported = data.features?.includes('asana') === true;
 chatCatalog = data.chatCatalog; chatsUpdatedAt = data.chatsUpdatedAt;
 if ($('editor').open) renderChatPicker();
 if (boardBusy() || (failed && manual === false)) return false;
 if (manual === false && data.revision < revision) return false;
 catalog = data.catalog;
 $('sync-status').hidden = true;
 if (manual) {
  failed = false;
  document.body.classList.remove('save-error');
  $('save-status').textContent = 'All changes saved';
 } else if (data.revision === revision && data.importedTaskId === undefined) return true;
 state = data.state; revision = data.revision;
 if (projectFor(selectedProject) === undefined) selectedProject = null;
 render();
 if (data.importedTaskId) {
  const imported = state.tasks.find(task => task.id === data.importedTaskId);
  if (imported && imported.asana) openTask(imported,imported.projectId,imported.statusId);
 }
 return true;
}
async function refreshBoard(manual) {
 if (boardBusy() || (failed && manual === false)) return false;
 try {
  const result = await api.read();
  if (boardBusy()) return false;
  return receive(result,manual);
 } catch(error) {
  const status = $('sync-status');
  status.textContent = failed ? 'Updates paused. Use Refresh board to retry.' : 'Updates unavailable. Retrying…';
  status.title = error.message;
  status.hidden = false;
  if (manual) notify(error.message);
  return false;
 }
}
const updates = startAutoRefresh(refreshBoard);
$('refresh-board').onclick = () => updates.refresh(true);
document.addEventListener('close',() => { void updates.refresh(); },true);
render();
return receive;

}
