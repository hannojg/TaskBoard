import { markdownLanguage } from '@codemirror/lang-markdown';

export function markdownCheckpoints(description) {
 const tree = markdownLanguage.parser.parse(description);
 const checkpoints = [];
 tree.iterate({enter(cursor) {
  if (cursor.name !== 'Task') return;
  const node = cursor.node;
  let depth = 0;
  for (let parent = node.parent.parent; parent; parent = parent.parent) {
   if (parent.name === 'ListItem' && parent.getChild('Task')) depth += 1;
  }
  if (depth > 1) return;
  const marker = node.getChild('TaskMarker');
  const newline = description.indexOf('\n',marker.to);
  const end = newline >= 0 ? Math.min(newline,node.to) : node.to;
  const line = description.slice(marker.to,end);
  const text = line.trim();
  const checked = description[marker.from+1] !== ' ';
  checkpoints.push({position:marker.from+1,text,checked,depth});
 }});
 return checkpoints;
}

export function setCheckpoint(description,position,checked) {
 const before = description.slice(0,position);
 const after = description.slice(position+1);
 const mark = checked ? 'x' : ' ';
 return before+mark+after;
}
