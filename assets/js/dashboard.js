document.addEventListener('DOMContentLoaded', async () => {
  const status=document.querySelector('[data-dashboard-status]');
  const home=document.querySelector('[data-dashboard-home]');
  const fundraise=document.querySelector('[data-dashboard-fundraise]');
  let currentUser=null;

  function renderRoute(){
    const isFundraise = location.hash === '#fundraise';
    if(home) home.hidden = isFundraise;
    if(fundraise) fundraise.hidden = !isFundraise;

    document.querySelectorAll('[data-dashboard-route]').forEach(link=>{
      const route=link.dataset.dashboardRoute;
      link.classList.toggle('btn-primary',
        (route==='home' && !isFundraise) ||
        (route==='fundraise' && isFundraise)
      );
      link.classList.toggle('btn-ghost',
        !((route==='home' && !isFundraise) ||
        (route==='fundraise' && isFundraise))
      );
    });
  }

  KiaUI.showLoading({
    title:'Menyiapkan dashboard',
    message:'Memeriksa sesi dan memuat profil Anda…'
  });

  try{
    const r=await KiaAuth.me();
    currentUser=r.data.user;
    localStorage.setItem('kia_user',JSON.stringify(currentUser));

    document.querySelectorAll('[data-user-name]').forEach(el=>{
      el.textContent=currentUser.full_name;
    });
    document.querySelectorAll('[data-account-type]').forEach(el=>{
      el.textContent=currentUser.account_type==='ORGANIZATION'
        ? 'Yayasan / Organisasi'
        : 'Perorangan';
    });

    const fundraiseCopy=document.querySelector('[data-fundraise-copy]');
    if(fundraiseCopy){
      fundraiseCopy.textContent=currentUser.account_type==='ORGANIZATION'
        ? 'Akun yayasan Anda sudah aktif. Anda tidak perlu daftar ulang. Tahap berikutnya adalah verifikasi organisasi dan pembuatan program donasi.'
        : 'Akun perorangan Anda sudah aktif. Anda tidak perlu daftar ulang. Tahap berikutnya adalah verifikasi identitas sebelum program dapat diajukan.';
    }

    if(status) status.textContent='Sesi aktif';
    renderRoute();
    KiaUI.hideLoading();
  }catch(err){
    KiaAuth.clear();
    KiaUI.hideLoading();
    location.replace('./login.html');
    return;
  }

  window.addEventListener('hashchange',renderRoute);

  document.querySelector('[data-logout]')?.addEventListener('click',async()=>{
    const approved=await KiaUI.confirm({
      title:'Keluar dari KIA?',
      message:'Sesi akun di perangkat ini akan diakhiri. Anda perlu masuk kembali untuk membuka dashboard.',
      confirmText:'Ya, Keluar',
      cancelText:'Batal'
    });

    if(!approved) return;

    KiaUI.showLoading({
      title:'Keluar dari akun',
      message:'Mengakhiri sesi dengan aman…'
    });

    await KiaAuth.logout();

    KiaUI.setLoading({
      title:'Berhasil keluar',
      message:'Kembali ke halaman utama…'
    });

    // localStorage sudah dibersihkan sebelum request logout,
    // sehingga landing page langsung tampil sebagai guest.
    setTimeout(()=>location.replace('./'),280);
  });
});
