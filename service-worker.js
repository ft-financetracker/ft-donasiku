const CACHE='kia-v0.2.3';

const SHELL=[
  './',
  './index.html',
  './login.html',
  './register.html',
  './app.html',
  './offline.html',
  './manifest.json',
  './assets/css/tokens.css',
  './assets/css/components.css',
  './assets/css/public.css',
  './assets/css/auth.css',
  './assets/css/ui.css',
  './assets/js/config.js',
  './assets/js/api.js',
  './assets/js/app.js',
  './assets/js/auth.js',
  './assets/js/public-auth.js',
  './assets/js/auth-page.js',
  './assets/js/ui.js',
  './assets/js/login.js',
  './assets/js/register.js',
  './assets/js/dashboard.js',
  './assets/js/pwa.js',
  './icons/kia-symbol.png',
  './icons/favicon-32.png',
  './icons/favicon-48.png',
  './icons/favicon.ico',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE)
      .then(cache=>cache.addAll(SHELL))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(
        keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))
      ))
      .then(()=>self.clients.claim())
  );
});

async function networkFirst(request, fallback){
  try{
    const response=await fetch(request);
    if(response && response.ok){
      const copy=response.clone();
      caches.open(CACHE).then(cache=>cache.put(request,copy));
    }
    return response;
  }catch{
    return (await caches.match(request)) ||
      (fallback ? await caches.match(fallback) : undefined);
  }
}

async function cacheFirst(request){
  const cached=await caches.match(request);
  if(cached) return cached;
  const response=await fetch(request);
  if(response && response.ok){
    const copy=response.clone();
    caches.open(CACHE).then(cache=>cache.put(request,copy));
  }
  return response;
}

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;

  const url=new URL(event.request.url);

  // DOKU/Render/Apps Script/API tidak pernah dicache oleh PWA.
  if(url.origin!==self.location.origin) return;

  if(event.request.mode==='navigate'){
    event.respondWith(networkFirst(event.request,'./offline.html'));
    return;
  }

  if(/\.(?:js|css|json)$/.test(url.pathname)){
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(cacheFirst(event.request));
});
