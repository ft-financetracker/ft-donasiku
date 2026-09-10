document.addEventListener('DOMContentLoaded', async () => {
  const status=document.querySelector('[data-dashboard-status]');
  const home=document.querySelector('[data-dashboard-home]');
  const fundraise=document.querySelector('[data-dashboard-fundraise]');
  let currentUser=KiaAuth.getUser();

  function renderRoute(){
    const isFundraise = location.hash === '#fundraise';
    if(home) home.hidden = isFundraise;
    if(fundraise) fundraise.hidden = !isFundraise;

    document.querySelectorAll('[data-dashboard-route]').forEach(link=>{
      const route=link.dataset.dashboardRoute;
      const active =
        (route==='home' && !isFundraise) ||
        (route==='fundraise' && isFundraise);

      link.classList.toggle('btn-primary',active);
      link.classList.toggle('btn-ghost',!active);
    });
  }

  function renderUser(user){
    if(!user) return;

    document.querySelectorAll('[data-user-name]').forEach(el=>{
      el.textContent=user.full_name || 'Pengguna';
    });

    document.querySelectorAll('[data-account-type]').forEach(el=>{
      el.textContent=user.account_type==='ORGANIZATION'
        ? 'Yayasan / Organisasi'
        : 'Perorangan';
    });

    const fundraiseCopy=document.querySelector('[data-fundraise-copy]');
    if(fundraiseCopy){
      fundraiseCopy.textContent=user.account_type==='ORGANIZATION'
        ? 'Akun yayasan Anda sudah aktif. Anda tidak perlu daftar ulang. Tahap berikutnya adalah verifikasi organisasi dan pembuatan program donasi.'
        : 'Akun perorangan Anda sudah aktif. Anda tidak perlu daftar ulang. Tahap berikutnya adalah verifikasi identitas sebelum program dapat diajukan.';
    }
  }

  // Tidak ada token = memang belum login.
  if(!KiaAuth.getToken()){
    location.replace('./login.html');
    return;
  }

  // FAST FIRST PAINT:
  // gunakan user cache untuk menampilkan dashboard seketika.
  renderRoute();
  if(currentUser){
    renderUser(currentUser);
    if(status) status.textContent='Sesi aktif';
  }else{
    if(status) status.textContent='Memeriksa sesi…';
  }

  // VALIDASI DI BELAKANG.
  // Hanya 401 yang boleh dianggap session habis.
  try{
    const r=await KiaAuth.me();
    currentUser=r.data.user;
    localStorage.setItem('kia_user',JSON.stringify(currentUser));
    renderUser(currentUser);
    if(status) status.textContent='Sesi aktif';
  }catch(err){
    if(err.status===401){
      KiaAuth.clear();
      location.replace('./login.html?reason=session_expired');
      return;
    }

    // Render/Apps Script lambat, timeout, offline, atau 5xx:
    // JANGAN logout user. Cache tetap dipakai.
    if(status){
      status.textContent=currentUser
        ? 'Sesi tersimpan · koneksi sedang diperbarui'
        : 'Koneksi sedang tertunda';
    }
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

    setTimeout(()=>location.replace('./'),220);
  });
});
