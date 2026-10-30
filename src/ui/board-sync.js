function equal(left,right) {
 const leftJson = JSON.stringify(left);
 const rightJson = JSON.stringify(right);
 return leftJson === rightJson;
}

function listChanges(before,after) {
 const changes = [];
 for (const item of before) {
  const exists = after.some(next => next.id === item.id);
  if (exists === false) changes.push({id:item.id,remove:true});
 }
 for (const item of after) {
  const previous = before.find(value => value.id === item.id);
  if (previous === undefined) {
   changes.push({id:item.id,create:item});
   continue;
  }
  const fields = {};
  for (const key of Object.keys(item)) {
   if (equal(previous[key],item[key]) === false) fields[key] = item[key];
  }
  const keys = Object.keys(fields);
  if (keys.length > 0) changes.push({id:item.id,fields});
 }
 const beforeIds = before.map(item => item.id);
 const afterIds = after.map(item => item.id);
 return {changes,order:equal(beforeIds,afterIds) ? null : afterIds};
}

function boardChanges(before,after) {
 const projects = listChanges(before.projects,after.projects);
 const tasks = listChanges(before.tasks,after.tasks);
 const statusOrder = equal(before.statusOrder,after.statusOrder) ? null : after.statusOrder;
 return {projects,tasks,statusOrder};
}

function applyList(items,patch) {
 let result = [...items];
 for (const change of patch.changes) {
  const index = result.findIndex(item => item.id === change.id);
  if (change.remove) {
   if (index >= 0) result.splice(index,1);
  } else if (change.create) result.push(change.create);
  else if (index >= 0) result[index] = {...result[index],...change.fields};
 }
 if (patch.order) {
  const ordered = [];
  for (const id of patch.order) {
   const item = result.find(value => value.id === id);
   if (item) ordered.push(item);
  }
  const remaining = result.filter(item => patch.order.includes(item.id) === false);
  result = [...ordered,...remaining];
 }
 return result;
}

function applyChanges(state,patches) {
 for (const patch of patches) {
  const projects = applyList(state.projects,patch.projects);
  const tasks = applyList(state.tasks,patch.tasks);
  state = {...state,projects,tasks,statusOrder:patch.statusOrder || state.statusOrder};
 }
 return state;
}

export function createBoardSync(initialData,api,onChange) {
 let data = structuredClone(initialData);
 let optimistic = structuredClone(data.state);
 let running = false;
 let active = null;
 let error = null;
 let version = 0;
 const queue = [];

 function publish(changed) {
  // Preserve server-normalized fields while replaying edits made during a request.
  optimistic = data.state;
  for (const entry of queue) {
   if (entry.patches) optimistic = applyChanges(optimistic,entry.patches);
  }
  const state = structuredClone(optimistic);
  onChange({...data,state},{saving:running,dirty:queue.length > 0,error,changed});
 }

 async function drain() {
  if (running || error || queue.length === 0) return false;
  running = true;
  publish(false);
  try {
   while (queue.length > 0) {
    active = queue[0];
    try {
     if (active.operation) data = await active.operation(data.revision);
     else {
      const state = applyChanges(data.state,active.patches);
      data = await api.save(state,data.revision);
     }
    } catch (failure) {
     if (active.operation) {
      queue.shift();
      active.reject(failure);
      publish(true);
      continue;
     }
     error = failure;
     for (let index = queue.length-1; index >= 0; index -= 1) {
      const entry = queue[index];
      if (entry.operation) entry.reject(failure);
      else for (const resolve of entry.waiters) resolve(false);
      entry.waiters = [];
      if (entry.operation) queue.splice(index,1);
     }
     return false;
    }
    queue.shift();
    publish(true);
    for (const resolve of active.waiters) resolve(data);
   }
   return true;
  } finally {
   active = null;
   running = false;
   publish(false);
  }
 }

 function save(state) {
  const snapshot = structuredClone(state);
  const patch = boardChanges(optimistic,snapshot);
  const last = queue.at(-1);
  let entry;
  if (last && last.patches && last !== active) entry = last;
  else {
   entry = {patches:[],waiters:[]};
   queue.push(entry);
  }
  entry.patches.push(patch);
  version += 1;
  publish(true);
  if (error) return Promise.resolve(false);
  const completion = new Promise(resolve => { entry.waiters.push(resolve); });
  void drain();
  return completion;
 }

 function run(operation) {
  if (error) return Promise.reject(error);
  const entry = {operation,waiters:[]};
  queue.push(entry);
  const completion = new Promise((resolve,reject) => {
   entry.waiters.push(resolve);
   entry.reject = reject;
  });
  void drain();
  return completion;
 }

 return {
  save,run,
  get saving() { return running; },
  get dirty() { return queue.length > 0; },
  get error() { return error; },
  get version() { return version; },
  retry() { error = null; return drain(); },
  receive(next,discard = false) {
   if (running || (queue.length > 0 && discard === false)) return false;
   data = structuredClone(next);
   queue.length = 0;
   error = null;
   publish(true);
   return true;
  }
 };
}
