document.addEventListener('DOMContentLoaded',()=>{
  if('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js');
  const el=document.querySelector('[data-api-status]');
  if(el) KiaApi.health().then(()=>{el.textContent='API terhubung';el.dataset.state='ok'}).catch(()=>{el.textContent='Mode demo — API belum dikonfigurasi'});
});
