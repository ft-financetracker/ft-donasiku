document.addEventListener('DOMContentLoaded', async () => {
  if(!window.KiaAuth || !KiaAuth.getToken()) return;

  const intent = new URLSearchParams(location.search).get('intent');
  const target = intent === 'fundraise'
    ? './app.html#fundraise'
    : './app.html';

  // Bila token + cached user tersedia, jangan tahan user di login/register.
  if(KiaAuth.getUser()){
    location.replace(target);
    return;
  }

  // Kasus langka: token ada tetapi user cache tidak ada.
  // Baru lakukan validasi server.
  KiaUI?.showLoading({
    title:'Memeriksa sesi',
    message:'Menghubungkan akun Anda…'
  });

  try{
    const r=await KiaAuth.me();
    if(r?.data?.user){
      localStorage.setItem('kia_user',JSON.stringify(r.data.user));
    }
    location.replace(target);
  }catch(err){
    if(err.status===401){
      KiaAuth.clear();
    }
    KiaUI?.hideLoading();
  }
});
