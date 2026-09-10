KiaAuth.warmup();

const form=document.querySelector('#loginForm');
const statusEl=document.querySelector('[data-form-status]');

form.addEventListener('submit',async e=>{
  e.preventDefault();
  statusEl.textContent='';

  const intent = new URLSearchParams(location.search).get('intent');
  const target = intent === 'fundraise'
    ? './app.html#fundraise'
    : './app.html';

  KiaUI.showLoading({
    title:'Memeriksa akun',
    message:'Menghubungkan akun Anda dengan KIA…'
  });

  const payload=Object.fromEntries(new FormData(form).entries());

  try{
    const r=await KiaAuth.login(payload);
    KiaAuth.setSession(r.data);
    KiaUI.setLoading({
      title:'Login berhasil',
      message:'Menyiapkan dashboard Anda…'
    });
    location.replace(target);
  }catch(err){
    KiaUI.hideLoading();
    statusEl.textContent=err.message;
  }
});
