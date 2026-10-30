export function chatKey(chat) {
 if (chat.threadId) return (chat.deviceId || '')+':'+chat.hostId+':'+chat.threadId;
 return 'url:'+chat.url;
}
