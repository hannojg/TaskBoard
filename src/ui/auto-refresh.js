export function startAutoRefresh(refresh) {
 let timer;
 let running = false;
 let stopped = false;
 let manualPending = false;
 function schedule() {
  clearTimeout(timer);
  if (stopped || document.visibilityState !== 'visible') return;
  timer = setTimeout(automatic,5000);
 }
 async function run(manual = false) {
  if (stopped || (manual === false && document.visibilityState !== 'visible')) return false;
  if (running) { if (manual) manualPending = true; return false; }
  clearTimeout(timer);
  running = true;
  try { return await refresh(manual); }
  finally {
   running = false;
   if (manualPending && stopped === false) { manualPending = false; void run(true); }
   else schedule();
  }
 }
 function automatic() { void run(); }
 function visibilityChanged() {
  if (document.visibilityState === 'visible') automatic();
  else clearTimeout(timer);
 }
 function pageHidden(event) {
  if (event.persisted) clearTimeout(timer);
  else stop();
 }
 function stop() {
  stopped = true;
  clearTimeout(timer);
  document.removeEventListener('visibilitychange',visibilityChanged);
  window.removeEventListener('focus',automatic);
  window.removeEventListener('online',automatic);
  window.removeEventListener('pageshow',automatic);
  window.removeEventListener('pagehide',pageHidden);
 }
 document.addEventListener('visibilitychange',visibilityChanged);
 window.addEventListener('focus',automatic);
 window.addEventListener('online',automatic);
 window.addEventListener('pageshow',automatic);
 window.addEventListener('pagehide',pageHidden);
 schedule();
 return {refresh:run,stop};
}
