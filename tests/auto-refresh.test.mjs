import test from 'node:test';
import assert from 'node:assert/strict';
import { startAutoRefresh } from '../src/ui/auto-refresh.js';

function fixture(t,refresh) {
 const previousDocument = globalThis.document;
 const previousWindow = globalThis.window;
 const document = new EventTarget();
 document.visibilityState = 'visible';
 const window = new EventTarget();
 globalThis.document = document;
 globalThis.window = window;
 t.mock.timers.enable({apis:['setTimeout']});
 const updates = startAutoRefresh(refresh);
 t.after(() => {
  updates.stop();
  globalThis.document = previousDocument;
  globalThis.window = previousWindow;
 });
 async function advance(milliseconds = 0) {
  t.mock.timers.tick(milliseconds);
  await Promise.resolve();
  await Promise.resolve();
 }
 return {document,window,updates,advance};
}

test('visible boards refresh every five seconds and hidden boards resume immediately',async t => {
 let reads = 0;
 const {document,advance} = fixture(t,() => { reads += 1; });
 await advance(4999);
 assert.equal(reads,0);
 await advance(1);
 assert.equal(reads,1);
 await advance(5000);
 assert.equal(reads,2);
 document.visibilityState = 'hidden';
 const hidden = new Event('visibilitychange');
 document.dispatchEvent(hidden);
 await advance(20000);
 assert.equal(reads,2);
 document.visibilityState = 'visible';
 const visible = new Event('visibilitychange');
 document.dispatchEvent(visible);
 await advance();
 assert.equal(reads,3);
});

test('focus and reconnection refresh immediately without overlapping a pending read',async t => {
 let reads = 0;
 let finish;
 const pending = new Promise(resolve => { finish = resolve; });
 const {window,advance} = fixture(t,() => {
  reads += 1;
  if (reads === 1) return pending;
 });
 const focus = new Event('focus');
 window.dispatchEvent(focus);
 assert.equal(reads,1);
 const online = new Event('online');
 window.dispatchEvent(online);
 await advance(20000);
 assert.equal(reads,1);
 finish();
 await advance();
 const reconnected = new Event('online');
 window.dispatchEvent(reconnected);
 await advance();
 assert.equal(reads,2);
});

test('a manual refresh requested during a background read runs after it finishes',async t => {
 const requests = [];
 let finish;
 const pending = new Promise(resolve => { finish = resolve; });
 const {updates,advance} = fixture(t,manual => {
  requests.push(manual);
  if (requests.length === 1) return pending;
 });
 const first = updates.refresh();
 await updates.refresh(true);
 await updates.refresh(true);
 assert.deepEqual(requests,[false]);
 finish();
 await first;
 await advance();
 assert.deepEqual(requests,[false,true]);
});

test('cached pages resume on return and closed pages stop all refreshes',async t => {
 let reads = 0;
 const {window,advance} = fixture(t,() => { reads += 1; });
 const cached = new Event('pagehide');
 cached.persisted = true;
 window.dispatchEvent(cached);
 await advance(20000);
 assert.equal(reads,0);
 const restored = new Event('pageshow');
 window.dispatchEvent(restored);
 await advance();
 assert.equal(reads,1);
 const closed = new Event('pagehide');
 window.dispatchEvent(closed);
 const focus = new Event('focus');
 window.dispatchEvent(focus);
 await advance(20000);
 assert.equal(reads,1);
});
