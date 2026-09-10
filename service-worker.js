const CACHE='kia-v0.1.0';
const SHELL=['./','./index.html','./login.html','./register.html','./offline.html','./assets/css/tokens.css','./assets/css/components.css','./assets/css/public.css','./assets/css/auth.css','./assets/js/config.js','./assets/js/api.js','./assets/js/app.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(!u.origin.includes(self.location.origin)){return}if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./offline.html'))));return}e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))});
