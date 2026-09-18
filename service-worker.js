const APP_VERSION='0.5.10';
const APP_BUILD=512;
const CACHE='kia-v0.5.10-b512';
const SHELL=[
  './','./index.html','./login.html','./register.html','./app.html','./program.html','./program-donations.html','./donations.html','./programs.html','./donate.html','./payment.html','./help.html','./info.html','./offline.html',
  './manifest-v040.json','./manifest.json','./app-version.json','./changelog.json',
  './assets/css/tokens.css','./assets/css/components.css','./assets/css/auth.css','./assets/css/ui.css','./assets/css/public-v040.css','./assets/css/dashboard-v040.css','./assets/css/program-v040.css','./assets/css/checkout-v050.css','./assets/css/donation-feed-v058.css','./assets/css/payment-v058.css','./assets/css/v059-patch.css','./assets/css/v0510-patch.css','./assets/css/v0510b-patch.css',
  './assets/js/config.js','./assets/js/auth.js','./assets/js/public-auth.js','./assets/js/auth-page.js','./assets/js/ui.js','./assets/js/login.js','./assets/js/register.js','./assets/js/dashboard-v040.js','./assets/js/donor-impact-v051.js','./assets/js/public-v0510.js','./assets/js/catalog-v0510.js','./assets/js/program-v0510.js','./assets/js/program-donations-v058.js','./assets/js/donation-social-v059.js','./assets/js/donations-v0510.js','./assets/js/donate-v059.js','./assets/js/payment-v058.js','./assets/js/payment-phase-c-v0512.js','./assets/js/help-v040.js','./assets/js/info-v040.js','./assets/js/pwa-v040.js',
  './icons/kia-symbol-v030.png','./icons/favicon-white-v040-32.png','./icons/favicon-white-v040-48.png','./icons/favicon-white-v040.ico','./icons/kia-apple-v040-180.png','./icons/kia-app-v040-192.png','./icons/kia-app-v040-512.png','./icons/kia-app-v040-maskable-512.png',
  './assets/images/hero/hero-1.png','./assets/images/hero/hero-2.png','./assets/images/hero/hero-3.png'
];

self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)))});
self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING'){self.skipWaiting();return}
  if(event.data?.type==='KIA_GET_VERSION')event.ports?.[0]?.postMessage({version:APP_VERSION,build:APP_BUILD,cache:CACHE});
});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
async function networkFirst(request,fallback){try{const response=await fetch(request,{cache:'no-store'});if(response&&response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy))}return response}catch(_){return (await caches.match(request))||(fallback?await caches.match(fallback):undefined)}}
async function cacheFirst(request){const cached=await caches.match(request);if(cached)return cached;const response=await fetch(request);if(response&&response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy))}return response}
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  if(event.request.mode==='navigate'){event.respondWith(networkFirst(event.request,'./offline.html'));return}
  if(/(?:app-version|changelog)\.json$/.test(url.pathname)){event.respondWith(networkFirst(event.request));return}
  if(/\.(?:js|css|json|html)$/.test(url.pathname)){event.respondWith(networkFirst(event.request));return}
  event.respondWith(cacheFirst(event.request));
});
