document.addEventListener('DOMContentLoaded', async () => {
  if(!window.KiaAuth || !KiaAuth.getToken()) return;

  const intent = new URLSearchParams(location.search).get('intent');
  const target = intent === 'fundraise'
    ? './app.html#fundraise'
    : './app.html';

  KiaUI?.showLoading({
    title:'Sesi masih aktif',
    message:'Memeriksa akun dan membuka dashboard…'
  });

  try{
    await KiaAuth.me();
    location.replace(target);
  }catch(err){
    if(err.status === 401) KiaAuth.clear();
    KiaUI?.hideLoading();
  }
});
