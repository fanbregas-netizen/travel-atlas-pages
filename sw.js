// Travel Atlas V4. Only cache our public application shell, never APIs, media or map tiles.
const CACHE='atlas-v4-shell-stage5-experience-20261029-v2';
const SHELL=['/travel-atlas-pages/','/travel-atlas-pages/manifest.webmanifest','/travel-atlas-pages/icon.svg','/travel-atlas-pages/atlas-orbit.css','/travel-atlas-pages/atlas-orbit.js','/travel-atlas-pages/atlas-stage5.js'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('atlas-v4-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const asset=new URL(request.url);
  if(asset.origin===self.location.origin&&['/travel-atlas-pages/manifest.webmanifest','/travel-atlas-pages/icon.svg','/travel-atlas-pages/atlas-orbit.css','/travel-atlas-pages/atlas-orbit.js','/travel-atlas-pages/atlas-stage5.js'].includes(asset.pathname)){
    event.respondWith(fetch(request).then(response=>{if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(request,copy)).catch(()=>{}));}return response}).catch(()=>caches.match(request)));
    return;
  }
  if(request.mode!=='navigate')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin||!['/travel-atlas-pages/','/travel-atlas-pages/v4','/travel-atlas-pages/v4/'].includes(url.pathname))return;
  event.respondWith(fetch(request).then(response=>{
    // Cache failures must never hide an otherwise successful online response.
    if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put('/travel-atlas-pages/',copy)).catch(()=>{}));}
    return response;
  }).catch(async()=>await caches.match('/travel-atlas-pages/')||new Response('Travel Atlas is temporarily offline.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}})));
});
