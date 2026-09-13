const CACHE='kia-v0.4.0';
const SHELL=[
  './','./index.html','./login.html','./register.html','./app.html','./program.html','./programs.html','./help.html','./info.html','./offline.html',
  './manifest-v040.json','./manifest.json','./app-version.json','./changelog.json',
  './assets/css/tokens.css','./assets/css/components.css','./assets/css/auth.css','./assets/css/ui.css','./assets/css/public-v040.css','./assets/css/dashboard-v040.css','./assets/css/program-v040.css',
  './assets/js/config.js','./assets/js/auth.js','./assets/js/public-auth.js','./assets/js/auth-page.js','./assets/js/ui.js','./assets/js/login.js','./assets/js/register.js','./assets/js/dashboard-v040.js','./assets/js/public-v040.js','./assets/js/catalog-v040.js','./assets/js/program-v040.js','./assets/js/help-v040.js','./assets/js/info-v040.js','./assets/js/pwa-v040.js',
  './icons/kia-symbol-v030.png','./icons/favicon-white-v040-32.png','./icons/favicon-white-v040-48.png','./icons/favicon-white-v040.ico','./icons/kia-apple-v040-180.png','./icons/kia-app-v040-192.png','./icons/kia-app-v040-512.png','./icons/kia-app-v040-maskable-512.png',
  './assets/images/hero/hero-1.png','./assets/images/hero/hero-2.png','./assets/images/hero/hero-3.png'
];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)))});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
async function networkFirst(request,fallback){try{const r=await fetch(request);if(r&&r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(request,copy))}return r}catch{return(await caches.match(request))||(fallback?await caches.match(fallback):undefined)}}
async function cacheFirst(request){const c=await caches.match(request);if(c)return c;const r=await fetch(request);if(r&&r.ok){const copy=r.clone();caches.open(CACHE).then(x=>x.put(request,copy))}return r}
self.addEventListener('fetch',event=>{if(event.request.method!=='GET')return;const url=new URL(event.request.url);if(url.origin!==self.location.origin)return;if(event.request.mode==='navigate'){event.respondWith(networkFirst(event.request,'./offline.html'));return}if(/(?:app-version|changelog)\.json$/.test(url.pathname)){event.respondWith(networkFirst(event.request));return}if(/\.(?:js|css|json|html)$/.test(url.pathname)){event.respondWith(networkFirst(event.request));return}event.respondWith(cacheFirst(event.request))});
