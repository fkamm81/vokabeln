
const CACHE='vocab-pwa-release-v1';
const ASSETS=['./','./index.html','./styles.css?v=rel1','./app.js?v=rel1','./manifest.json','./assets/mascots.svg'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))); self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>k!==CACHE&&caches.delete(k))))); self.clients.claim();});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(resp=>{
    const url=new URL(e.request.url);
    if(url.origin===location.origin){ const clone=resp.clone(); caches.open(CACHE).then(c=>c.put(e.request,clone)); }
    return resp;
  }).catch(()=>caches.match('./index.html'))));
});
