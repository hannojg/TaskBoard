const embeddedImage = /data:image\/[\w.+-]+;base64,[A-Za-z0-9+/]+={0,2}/g;
const storedImage = /taskboard-image:([a-f0-9]{64})/g;

export async function storeImages(state,bucket) {
 const sources = new Set();
 for (const task of state.tasks) {
  const matches = task.description.match(embeddedImage) || [];
  for (const source of matches) sources.add(source);
 }
 const replacements = new Map();
 const encoder = new TextEncoder();
 for (const source of sources) {
  const bytes = encoder.encode(source);
  const digest = await crypto.subtle.digest('SHA-256',bytes);
  const hashBytes = new Uint8Array(digest);
  const hex = Array.from(hashBytes,byte => {
   const value = byte.toString(16);
   return value.padStart(2,'0');
  });
  const id = hex.join('');
  await bucket.put('images/'+id,source);
  replacements.set(source,'taskboard-image:'+id);
 }
 const tasks = state.tasks.map(task => {
  const description = task.description.replace(embeddedImage,source => replacements.get(source));
  return {...task,description};
 });
 return {...state,tasks};
}

export async function loadImages(state,bucket) {
 const ids = new Set();
 for (const task of state.tasks) {
  const matches = task.description.matchAll(storedImage);
  for (const match of matches) ids.add(match[1]);
 }
 const sources = new Map();
 for (const id of ids) {
  const object = await bucket.get('images/'+id);
  if (object === null) throw new Error('A saved task image is missing from shared storage.');
  const source = await object.text();
  sources.set(id,source);
 }
 const tasks = state.tasks.map(task => {
  const description = task.description.replace(storedImage,(_match,id) => sources.get(id));
  return {...task,description};
 });
 return {...state,tasks};
}
