import { descriptionText } from './description.js';

export function chatUrl(chat) {
 if (chat.url) {
  const url = new URL(chat.url);
  if (url.protocol !== 'https:' && url.protocol !== 'http:' && url.protocol !== 'codex:') throw new Error('This chat link cannot be opened.');
  return url.href;
 }
 const threadId = encodeURIComponent(chat.threadId);
 const url = new URL('codex://threads/'+threadId);
 if (chat.hostId !== 'local') url.searchParams.set('hostId',chat.hostId);
 return url.href;
}

export function taskChatUrl(task,project,statusName) {
 if (project.hostId !== 'local') throw new Error('Draft chats can only be opened for local projects.');
 const lines = [
  '[@TaskBoard](plugin://taskboard@taskboard-local)',
  '',
  'Help me with this TaskBoard ticket.',
  'Before working, use the TaskBoard skill to link this chat to the ticket below using its confirmed chat ID and host. Read the latest board first, append this chat without replacing existing links, and preserve the ticket status and other fields.',
  '',
  '# '+task.title,
  '',
  'TaskBoard ticket ID: '+task.id,
  'TaskBoard project ID: '+project.id,
  'Project: '+project.name,
  'Status: '+statusName,
  'Priority: '+task.priority
 ];
 if (task.due) lines.push('Due date: '+task.due);
 if (project.path) lines.push('Project folder: '+project.path);
 if (project.repo) lines.push('Repository: '+project.repo);
 if (task.description) {
  const heading = task.issue ? '## Local notes' : '## Description';
  const description = descriptionText(task.description);
  lines.push('',heading,'',description);
  if (description !== task.description) lines.push('','Images are attached to this ticket. Read the latest ticket through TaskBoard to retrieve their image data.');
 }
 if (task.issue) {
  lines.push('','## GitHub issue (source context)','',task.issue.title,task.issue.url,'State: '+task.issue.state,'',task.issue.body);
 }
 const prompt = lines.join('\n');
 const url = new URL('codex://threads/new');
 url.searchParams.set('prompt',prompt);
 if (project.path) url.searchParams.set('path',project.path);
 return url.href;
}
