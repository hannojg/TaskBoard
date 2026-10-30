import { z } from 'zod';
export const chatSchema = z.object({threadId:z.string(),hostId:z.string(),title:z.string(),url:z.string().default(''),deviceId:z.string().default(''),deviceName:z.string().default('')}).refine(chat => chat.threadId.length > 0 || chat.url.length > 0,{message:'A linked chat needs an ID or an imported URL.'});
export const chatCatalogSchema = z.array(z.object({threadId:z.string().min(1),hostId:z.string().min(1),title:z.string().min(1),projectId:z.string().nullable(),url:z.string().default(''),deviceId:z.string().default(''),deviceName:z.string().default('')}));
export { chatKey } from '../chat-key.js';
export function migrateBoard(board) {
 if (board.version === 3) return board;
 if (board.version !== 2) throw new Error('Unsupported TaskBoard data version.');
 const tasks = board.tasks.map(task => {
  const {chat,threadId,threadTitle,hostId,...fields} = task;
  const chats = [];
  if (threadId) chats.push({threadId,hostId:hostId || 'local',title:threadTitle || threadId,url:chat || ''});
  else if (chat) chats.push({threadId:'',hostId:hostId || 'local',title:'Imported chat link',url:chat});
  return {...fields,chats};
 });
 return {...board,version:3,tasks};
}
