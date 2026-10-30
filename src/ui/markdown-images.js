import { Prec, StateEffect, StateField } from '@codemirror/state';
import { isolateHistory } from '@codemirror/commands';
import { Decoration, EditorView, WidgetType, keymap } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';

function imageUrl(value) {
 const bare = value.startsWith('<') ? value.slice(1,-1) : value;
 const unescaped = bare.replace(/\\([\\()[\]])/g,'$1');
 try {
  const url = new URL(unescaped);
  if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
  if (url.protocol === 'data:' && /^data:image\/[\w.+-]+;base64,/i.test(unescaped)) return unescaped;
 } catch {}
 return null;
}

function referenceName(value) {
 const trimmed = value.trim();
 const spaced = trimmed.replace(/\s+/g,' ');
 return spaced.toLowerCase();
}

export function markdownImages(state) {
 const references = new Map();
 const nodes = [];
 const tree = syntaxTree(state);
 tree.iterate({enter(cursor) {
  const node = cursor.node;
  if (node.name === 'Image') nodes.push(node);
  if (node.name !== 'LinkReference') return;
  const label = node.getChild('LinkLabel');
  const url = node.getChild('URL');
  if (label && url) {
   const name = state.sliceDoc(label.from+1,label.to-1);
   const normalized = referenceName(name);
   const value = state.sliceDoc(url.from,url.to);
   references.set(normalized,value);
  }
 }});
 const images = [];
 for (const node of nodes) {
  const marks = node.getChildren('LinkMark');
  const alt = state.sliceDoc(marks[0].to,marks[1].from);
  const url = node.getChild('URL');
  let value;
  if (url) value = state.sliceDoc(url.from,url.to);
  else {
   const label = node.getChild('LinkLabel');
   const name = label ? state.sliceDoc(label.from+1,label.to-1) || alt : alt;
   const normalized = referenceName(name);
   value = references.get(normalized);
  }
  if (value === undefined) continue;
  const src = imageUrl(value);
  if (src) images.push({from:node.from,to:node.to,src,alt});
 }
 return images;
}

class ImageWidget extends WidgetType {
 constructor(src,alt) { super(); this.src = src; this.alt = alt; }
 eq(other) { return this.src === other.src && this.alt === other.alt; }
 toDOM(view) {
  const wrapper = document.createElement('span');
  wrapper.className = 'md-image';
  const image = document.createElement('img');
  image.alt = this.alt;
  image.src = this.src;
  image.loading = 'lazy';
  image.referrerPolicy = 'no-referrer';
  image.draggable = false;
  image.onload = () => view.requestMeasure();
  image.onerror = () => {
   image.hidden = true;
   wrapper.textContent = this.alt ? 'Could not load image: '+this.alt : 'Could not load image';
   wrapper.classList.add('md-image-error');
   view.requestMeasure();
  };
  wrapper.append(image);
  return wrapper;
 }
}

function imageDecorations(state) {
 const images = markdownImages(state);
 const ranges = images.map(image => {
  const widget = new ImageWidget(image.src,image.alt);
  const decoration = Decoration.replace({widget});
  return decoration.range(image.from,image.to);
 });
 return Decoration.set(ranges);
}

export const imagePreviews = StateField.define({
 create: imageDecorations,
 update(value,transaction) {
  const previous = syntaxTree(transaction.startState);
  const current = syntaxTree(transaction.state);
  return transaction.docChanged || previous !== current ? imageDecorations(transaction.state) : value;
 },
 provide: field => [
  EditorView.decorations.from(field),
  EditorView.atomicRanges.of(view => { return view.state.field(field); })
 ]
});

export const imagePasteSession = StateField.define({
 create: () => ({pending:new Set()}),
 update: value => value
});

const startPaste = StateEffect.define();
const endPaste = StateEffect.define();
class PastingWidget extends WidgetType {
 toDOM() {
  const node = document.createElement('span');
  node.className = 'md-marker';
  node.textContent = 'Pasting image…';
  return node;
 }
}
const pendingImages = StateField.define({
 create: () => Decoration.none,
 update(value,transaction) {
  let ranges = value.map(transaction.changes);
  for (const effect of transaction.effects) {
   if (effect.is(startPaste)) {
    const {id,from,to} = effect.value;
    const widget = new PastingWidget();
    const decoration = from === to ? Decoration.widget({widget,id,side:1}) : Decoration.replace({widget,id});
    const range = decoration.range(from,to);
    ranges = ranges.update({add:[range],sort:true});
   }
   if (effect.is(endPaste)) ranges = ranges.update({filter:(_from,_to,value) => value.spec.id !== effect.value});
  }
  return ranges;
 },
 provide: field => EditorView.decorations.from(field)
});

export function cancelImagePaste(view) {
 const pending = view.state.field(pendingImages);
 let id;
 pending.between(0,view.state.doc.length,(_from,_to,value) => { id = value.spec.id; });
 if (id === undefined) return false;
 const effect = endPaste.of(id);
 view.dispatch({effects:effect});
 return true;
}

function readImage(file) {
 return new Promise((resolve,reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => {
   const error = new Error('Could not paste this image. Try copying and pasting it again.');
   reject(error);
  };
  reader.readAsDataURL(file);
 });
}

export function imagePaste(onError) {
 const keys = keymap.of([{key:'Mod-z',run:cancelImagePaste}]);
 const undoPending = Prec.high(keys);
 const handler = EditorView.domEventHandlers({paste(event,view) {
  if (view.state.readOnly) return false;
  const files = Array.from(event.clipboardData.files);
  const images = files.filter(file => file.type.startsWith('image/'));
  if (images.length === 0) return false;
  event.preventDefault();
  onError('');
  const session = view.state.field(imagePasteSession);
  const id = crypto.randomUUID();
  const {from,to} = view.state.selection.main;
  const pending = startPaste.of({id,from,to});
  view.dispatch({effects:pending});
  const reads = images.map(file => readImage(file));
  const reading = Promise.all(reads);
  const inserting = reading.then(sources => {
   if (view.state.field(imagePasteSession) !== session) return;
   const ranges = view.state.field(pendingImages);
   let target;
   ranges.between(0,view.state.doc.length,(from,to,value) => {
    if (value.spec.id === id) target = {from,to};
   });
   if (target === undefined) return;
   const markdown = sources.map((src,index) => {
    const name = images[index].name || 'Pasted image';
    const alt = name.replace(/[\\[\]\r\n]/g,' ');
    return '!['+alt+']('+src+')';
   });
   const insert = markdown.join('\n');
   const historyBoundary = isolateHistory.of('full');
   const done = endPaste.of(id);
   const current = view.state.selection.main;
   const selection = current.from === target.from && current.to === target.to ? {anchor:target.from+insert.length} : undefined;
   view.dispatch({changes:{...target,insert},selection,effects:done,annotations:historyBoundary,userEvent:'input.paste'});
  });
  const recovering = inserting.catch(error => {
   if (view.state.field(imagePasteSession) !== session) return;
   const done = endPaste.of(id);
   view.dispatch({effects:done});
   onError(error.message);
  });
  const job = recovering.finally(() => session.pending.delete(job));
  session.pending.add(job);
  return true;
 }});
 return [pendingImages,undoPending,handler];
}
