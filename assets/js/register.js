KiaAuth.warmup();

const form=document.querySelector('#registerForm');
const orgFields=document.querySelector('[data-org-fields]');
const statusEl=document.querySelector('[data-form-status]');

function type(){
  return form.querySelector('input[name="account_type"]:checked').value;
}
function sync(){
  orgFields.hidden=type()!=='ORGANIZATION';
}
form.querySelectorAll('input[name="account_type"]').forEach(x=>x.addEventListener('change',sync));
sync();

form.addEventListener('submit',async e=>{
  e.preventDefault();
  statusEl.textContent='';

  const intent = new URLSearchParams(location.search).get('intent');
  const target = intent === 'fundraise'
    ? './app.html#fundraise'
    : './app.html';

  KiaUI.showLoading({
    title:'Membuat akun',
    message:'Menyiapkan profil KIA Anda…'
  });

  const fd=new FormData(form);
  const payload=Object.fromEntries(fd.entries());
  payload.account_type=type();

  try{
    const r=await KiaAuth.register(payload);
    KiaAuth.setSession(r.data);
    KiaUI.setLoading({
      title:'Akun berhasil dibuat',
      message:intent === 'fundraise'
        ? 'Membuka area Galang Dana…'
        : 'Membuka dashboard Anda…'
    });
    location.replace(target);
  }catch(err){
    KiaUI.hideLoading();
    statusEl.textContent=err.message;
  }
});
