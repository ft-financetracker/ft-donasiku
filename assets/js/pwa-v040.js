window.KiaPWA=(()=>{
  const currentVersion='0.4.0'; let deferredInstall=null, registration=null;
  const isStandalone=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e});
  if('serviceWorker'in navigator){window.addEventListener('load',async()=>{try{registration=await navigator.serviceWorker.register('./service-worker.js');registration.update().catch(()=>{})}catch(e){console.warn('SW_REGISTER_FAILED',e)}})}
  async function install(){if(isStandalone())return{installed:true,already:true};if(!deferredInstall)return{installed:false,reason:'PROMPT_UNAVAILABLE'};deferredInstall.prompt();const choice=await deferredInstall.userChoice;deferredInstall=null;return{installed:choice.outcome==='accepted',choice:choice.outcome}}
  async function checkUpdate(){try{const r=await fetch('./app-version.json?ts='+Date.now(),{cache:'no-store'});const d=await r.json();const latest=String(d.version||currentVersion);return{latest,updateAvailable:latest!==currentVersion,required:!!d.required_update,release:d}}catch{return{latest:currentVersion,updateAvailable:false,error:true}}}
  async function applyUpdate(){if(!('serviceWorker'in navigator)){location.reload();return}const reg=registration||await navigator.serviceWorker.getRegistration();if(!reg){location.reload();return}await reg.update().catch(()=>{});const activate=worker=>{if(worker){navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});worker.postMessage({type:'SKIP_WAITING'});setTimeout(()=>location.reload(),2500)}};if(reg.waiting){activate(reg.waiting);return}if(reg.installing){reg.installing.addEventListener('statechange',()=>{if(reg.installing?.state==='installed')activate(reg.waiting||reg.installing)});return}setTimeout(()=>location.reload(),900)}
  return{currentVersion,isStandalone,install,checkUpdate,applyUpdate};
})();
