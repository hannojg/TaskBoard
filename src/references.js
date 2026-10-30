export function parseReferenceUrl(value) {
 let url;
 try { url = new URL(value); }
 catch { throw new Error('Enter a complete web link, such as https://example.com.'); }
 if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('References must use an https:// or http:// link.');
 if (url.username || url.password) throw new Error('Reference links cannot contain sign-in credentials.');
 const slack = url.hostname.endsWith('.slack.com');
 const message = slack ? url.pathname.match(/^\/archives\/([CGD][A-Z0-9]+)\/p(\d{7,})\/?$/) : null;
 if (message === null) return {type:'link',url:url.href};
 const channelId = message[1];
 const digits = message[2];
 const timestamp = digits.slice(0,-6)+'.'+digits.slice(-6);
 const parent = url.searchParams.get('thread_ts');
 const messageTs = parent === null ? timestamp : parent;
 if (/^\d+\.\d{6}$/.test(messageTs) === false) throw new Error('The Slack link has an invalid thread timestamp.');
 const permalink = messageTs.replace('.','');
 url.protocol = 'https:';
 url.pathname = '/archives/'+channelId+'/p'+permalink;
 url.search = '';
 url.hash = '';
 return {type:'slack',url:url.href,channelId,messageTs};
}
