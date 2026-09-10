const CACHE='kia-v0.3.0';
const SHELL=[
  './',
  './index.html',
  './login.html',
  './register.html',
  './app.html',
  './program.html',
  './offline.html',
  './manifest-v030.json',
  './manifest.json',
  './assets/css/tokens.css',
  './assets/css/components.css',
  './assets/css/auth.css',
  './assets/css/ui.css',
  './assets/css/public-v030.css',
  './assets/css/dashboard.css',
  './assets/css/program.css',
  './assets/js/config.js',
  './assets/js/auth.js',
  './assets/js/public-auth.js',
  './assets/js/auth-page.js',
  './assets/js/ui.js',
  './assets/js/login.js',
  './assets/js/register.js',
  './assets/js/dashboard-v030.js',
  './assets/js/public-v030.js',
  './assets/js/program-v030.js',
  './assets/js/pwa.js',
  './icons/kia-symbol-v030.png',
  './icons/favicon-white-v030-32.png',
  './icons/favicon-white-v030-48.png',
  './icons/favicon-white-v030.ico',
  './icons/kia-apple-v030-180.png',
  './icons/kia-app-v030-192.png',
  './icons/kia-app-v030-512.png',
  './icons/kia-app-v030-maskable-512.png'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
async function networkFirst(request,fallback){
  try{
    const response=await fetch(request);
    if(response&&response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(request,copy));}
    return response;
  }catch{
    return (await caches.match(request))||(fallback?await caches.match(fallback):undefined);
  }
}
async function cacheFirst(request){
  const cached=await caches.match(request);if(cached)return cached;
  const response=await fetch(request);
  if(response&&response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(request,copy));}
  return response;
}
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  if(event.request.mode==='navigate'){event.respondWith(networkFirst(event.request,'./offline.html'));return;}
  if(/\.(?:js|css|json|html)$/.test(url.pathname)){event.respondWith(networkFirst(event.request));return;}
  event.respondWith(cacheFirst(event.request));
});
