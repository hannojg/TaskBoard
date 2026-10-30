const $ = id => document.getElementById(id);
const storageKey = 'margelo-taskboard-v1';
const stored = localStorage.getItem(storageKey);
const initial = {columns:[{id:'backlog',name:'Backlog'},{id:'todo',name:'To do'},{id:'progress',name:'In progress'},{id:'done',name:'Done'}],tasks:[]};
let state = stored ? JSON.parse(stored) : initial;
let editingTask = null;
let editingColumn = null;
let dragged = null;
let toastTimer;
function notify(message) { $('toast').textContent = message; $('toast').style.display = 'block'; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').style.display = 'none'; }, 2600); }
function persist() { try { const json = JSON.stringify(state); localStorage.setItem(storageKey,json); $('save-status').textContent = 'Saved in this browser'; } catch { $('save-status').textContent = 'Changes could not be saved'; notify('Browser storage is full or unavailable.'); } render(); }
function element(tag, className, text) { const node = document.createElement(tag); node.className = className; if (text) node.textContent = text; return node; }
function moveTask(id, columnId, beforeId) { const task = state.tasks.find(item => item.id === id); state.tasks = state.tasks.filter(item => item.id !== id); task.columnId = columnId; const position = state.tasks.findIndex(item => item.id === beforeId); if (position >= 0) state.tasks.splice(position,0,task); else state.tasks.push(task); persist(); }
function render() {
 const board = $('board'); board.replaceChildren(); $('total').textContent = state.tasks.length;
 const query = $('search').value.toLowerCase();
 for (const column of state.columns) {
  const section = element('section','column'); section.setAttribute('aria-label',column.name);
  const head = element('div','column-head'); const dot = element('span','dot'); const title = element('span','column-title',column.name);
  const all = state.tasks.filter(task => task.columnId === column.id);
  const countText = String(all.length); const count = element('span','count',countText);
  const menu = element('button','icon','⋯'); menu.setAttribute('aria-label','Edit '+column.name); menu.onclick = () => openColumn(column);
  head.append(dot,title,count,menu); const cards = element('div','cards');
  const tasks = all.filter(task => { const text = task.title+' '+task.description; const lower = text.toLowerCase(); return lower.includes(query); });
  for (const task of tasks) {
   const card = element('article','card'); card.draggable = true; card.tabIndex = 0; card.setAttribute('aria-label',task.title+'; open to edit or move');
   const heading = element('h2','',task.title); card.append(heading);
   if (task.description) { const description = element('p','',task.description); card.append(description); }
   const meta = element('div','meta');
   if (task.priority !== 'None') { const badge = element('span','priority '+task.priority,task.priority+' priority'); meta.append(badge); }
   if (task.due) { const date = new Date(task.due+'T12:00:00'); const formatted = date.toLocaleDateString(undefined,{month:'short',day:'numeric'}); const due = element('span','','◷ '+formatted); meta.append(due); }
   if (meta.childNodes.length) card.append(meta);
   card.onclick = () => openTask(task,column.id); card.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openTask(task,column.id); } };
   card.ondragstart = event => { dragged = task.id; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain',task.id); card.classList.add('dragging'); };
   card.ondragend = () => { dragged = null; render(); };
   card.ondrop = event => { event.preventDefault(); event.stopPropagation(); if (dragged && dragged !== task.id) moveTask(dragged,column.id,task.id); };
   cards.append(card);
  }
  if (tasks.length === 0) { const message = query ? 'No matching tasks' : 'A little room for what’s next.'; const empty = element('div','empty',message); cards.append(empty); }
  section.ondragover = event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; section.classList.add('drop-target'); };
  section.ondragleave = event => { if (section.contains(event.relatedTarget) === false) section.classList.remove('drop-target'); };
  section.ondrop = event => { event.preventDefault(); if (dragged) moveTask(dragged,column.id); };
  const add = element('button','add-task','＋  Add task'); add.onclick = () => openTask(null,column.id); section.append(head,cards,add); board.append(section);
 }
}
function openTask(task,columnId) {
 editingTask = task ? task.id : null; $('title').value = task ? task.title : ''; $('description').value = task ? task.description : ''; $('priority').value = task ? task.priority : 'None'; $('due').value = task ? task.due : '';
 $('column').replaceChildren();
 for (const column of state.columns) { const option = element('option','',column.name); option.value = column.id; $('column').append(option); }
 $('column').value = columnId; $('delete-task').hidden = task === null; $('editor').showModal(); $('title').focus();
}
$('task-form').onsubmit = event => { event.preventDefault(); const title = $('title').value.trim(); if (title.length === 0) { $('title').focus(); return; } const task = {id:editingTask || crypto.randomUUID(), title, description:$('description').value.trim(),priority:$('priority').value,due:$('due').value,columnId:$('column').value}; const index = state.tasks.findIndex(item => item.id === editingTask); if (index >= 0) state.tasks[index] = task; else state.tasks.push(task); persist(); $('editor').close(); };
$('delete-task').onclick = () => { state.tasks = state.tasks.filter(task => task.id !== editingTask); persist(); $('editor').close(); notify('Task deleted'); };
$('close').onclick = () => $('editor').close();
$('new-task').onclick = () => { if (state.columns.length === 0) openColumn(null); else openTask(null,state.columns[0].id); };
function openColumn(column) { editingColumn = column ? column.id : null; $('column-name').value = column ? column.name : ''; $('delete-column').hidden = column === null; const occupied = state.tasks.some(task => task.columnId === editingColumn); $('delete-column').disabled = occupied; $('delete-column').title = occupied ? 'Move tasks out of this column before deleting it.' : ''; $('column-editor').showModal(); $('column-name').focus(); }
$('add-column').onclick = () => openColumn(null);
$('close-column').onclick = () => $('column-editor').close();
$('column-form').onsubmit = event => { event.preventDefault(); const name = $('column-name').value.trim(); if (name.length === 0) return; if (editingColumn) { const column = state.columns.find(item => item.id === editingColumn); column.name = name; } else { const id = crypto.randomUUID(); state.columns.push({id,name}); } persist(); $('column-editor').close(); };
$('delete-column').onclick = () => { state.columns = state.columns.filter(column => column.id !== editingColumn); persist(); $('column-editor').close(); };
$('search').oninput = render;
window.addEventListener('storage',event => { if (event.key === storageKey && event.newValue) { state = JSON.parse(event.newValue); render(); } });
render();
