KiaAuth.warmup();

const form=document.querySelector('#loginForm');
const statusEl=document.querySelector('[data-form-status]');
let submitting=false;

function setLoginBusy(busy){
  form.setAttribute('aria-busy',busy?'true':'false');
  [...form.querySelectorAll('input,button')].forEach(el=>{el.disabled=busy});
}

form.addEventListener('submit',async e=>{
  e.preventDefault();
  if(submitting)return;
  submitting=true;
  statusEl.textContent='';
  const payload=Object.fromEntries(new FormData(form).entries());
  setLoginBusy(true);

  const intent = new URLSearchParams(location.search).get('intent');
  const target = intent === 'fundraise'
    ? './app.html#fundraise'
    : './app.html';

  KiaUI.showLoading({
    title:'Memeriksa akun',
    message:'Menghubungkan akun Anda dengan KIA…'
  });

  const slow1=setTimeout(()=>KiaUI.setLoading({
    title:'Server sedang menyiapkan data',
    message:'Login tetap diproses. Tidak perlu menekan tombol kembali atau memuat ulang.'
  }),8000);
  const slow2=setTimeout(()=>KiaUI.setLoading({
    title:'Proses sedikit lebih lama',
    message:'KIA sedang menunggu gateway data. Permintaan login tidak dikirim berulang secara sembarangan.'
  }),20000);

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
    statusEl.textContent=err.message||'Login belum berhasil. Silakan coba lagi.';
    setLoginBusy(false);
    submitting=false;
  }finally{
    clearTimeout(slow1);clearTimeout(slow2);
  }
});
