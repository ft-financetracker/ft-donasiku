(() => {
  const state={
    user:KiaAuth.getUser(),
    profile:null,
    organization:null,
    membership:null,
    verification:{status:'UNVERIFIED',type:'INDIVIDUAL'},
    programs:[],
    admin:null
  };

  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>'"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':'&quot;'}[ch]));
  const idr=v=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v)||0);
  const adminRole=u=>['PLATFORM_ADMIN','SUPER_ADMIN'].includes(u?.platform_role);

  function statusLabel(status){
    const map={
      UNVERIFIED:'Belum Verifikasi',
      PENDING_REVIEW:'Menunggu Review',
      APPROVED:'Terverifikasi',
      REJECTED:'Ditolak',
      DRAFT:'Draft',
      ACTIVE:'Aktif',
      PAUSED:'Dijeda',
      COMPLETED:'Selesai',
      ARCHIVED:'Diarsipkan'
    };
    return map[status]||status||'—';
  }

  function routeName(){
    const raw=(location.hash||'#home').slice(1);
    const allowed=['home','verification','programs','fundraise','admin','cms'];
    return allowed.includes(raw)?raw:'home';
  }

  function renderRoute(){
    let route=routeName();
    if((route==='admin'||route==='cms')&&!adminRole(state.user)) route='home';

    $$('[data-section]').forEach(sec=>{
      sec.hidden=sec.dataset.section!==route;
    });
    $$('[data-dashboard-route]').forEach(link=>{
      const active=link.dataset.dashboardRoute===route;
      link.classList.toggle('btn-primary',active);
      link.classList.toggle('btn-ghost',!active);
    });

    if(route==='admin'&&adminRole(state.user)) loadAdmin(false);
    if(route==='cms'&&adminRole(state.user)) loadAdmin(false);
  }

  function go(route){
    location.hash='#'+route;
    renderRoute();
  }

  function renderCachedUser(){
    if(!state.user) return;
    $$('[data-user-name]').forEach(el=>el.textContent=state.user.full_name||'Pengguna');
    const badge=$('[data-account-badge]');
    if(badge) badge.textContent=state.user.account_type==='ORGANIZATION'?'YAYASAN / ORGANISASI':'PERORANGAN';
  }

  function renderHome(){
    $('[data-home-verification]').textContent=statusLabel(state.verification?.status);
    $('[data-home-program-count]').textContent=String(state.programs.length);
    $('[data-home-active-count]').textContent=String(state.programs.filter(p=>p.status==='ACTIVE').length);
  }

  function renderVerification(){
    const status=state.verification?.status||'UNVERIFIED';
    const pill=$('[data-verification-status]');
    pill.textContent=statusLabel(status);
    pill.dataset.status=status;

    const note=$('[data-verification-note]');
    const submit=$('[data-verification-submit]');
    const fields=$('[data-verification-fields]');
    const isOrg=state.user?.account_type==='ORGANIZATION';

    if(status==='APPROVED'){
      note.textContent=isOrg
        ?'Yayasan/organisasi sudah terverifikasi. Program dapat diajukan untuk review KIA.'
        :'Identitas sudah terverifikasi. Program dapat diajukan untuk review KIA.';
      submit.hidden=true;
    }else if(status==='PENDING_REVIEW'){
      note.textContent='Data sudah dikirim dan sedang menunggu review KIA. Anda masih dapat menyiapkan Draft Program.';
      submit.hidden=true;
    }else if(status==='REJECTED'){
      note.textContent='Verifikasi sebelumnya ditolak. Periksa kembali data lalu ajukan ulang.';
      submit.hidden=false;
      submit.textContent='Ajukan Ulang';
    }else{
      note.textContent='Lengkapi data berikut. Data akan masuk antrean review KIA.';
      submit.hidden=false;
      submit.textContent='Ajukan Verifikasi';
    }

    if(isOrg){
      const o=state.organization||{};
      fields.innerHTML=`
        <div class="form-grid">
          <label class="field full">Nama Legal Yayasan / Organisasi<input name="legal_name" value="${esc(o.legal_name||o.name||'')}" required></label>
          <label class="field">Nomor Legalitas / Registrasi<input name="registration_number" value="${esc(o.registration_number||'')}" required></label>
          <label class="field">No. WhatsApp<input name="phone" value="${esc(o.phone||state.user?.phone||'')}" required></label>
          <label class="field full">Email<input name="email" type="email" value="${esc(o.email||state.user?.email||'')}" required></label>
          <label class="field full">Alamat<textarea name="address" required>${esc(o.address||'')}</textarea></label>
        </div>`;
    }else{
      const p=state.profile||{};
      fields.innerHTML=`
        <div class="form-grid">
          <label class="field">Jenis Identitas
            <select name="identity_type" required>
              <option value="">Pilih identitas</option>
              ${['KTP','PASSPORT','OTHER'].map(x=>`<option value="${x}" ${p.identity_type===x?'selected':''}>${x==='OTHER'?'Lainnya':x}</option>`).join('')}
            </select>
          </label>
          <label class="field">Nomor Identitas<input name="identity_number" value="${esc(p.identity_number||'')}" required></label>
          <label class="field full">Alamat<textarea name="address" required>${esc(p.address||'')}</textarea></label>
        </div>`;
    }
  }

  function programButtons(p){
    const out=[];
    if(['DRAFT','REJECTED'].includes(p.status)){
      out.push(`<button class="btn btn-ghost" type="button" data-program-action="edit" data-id="${esc(p.program_id)}">Edit</button>`);
      out.push(`<button class="btn btn-primary" type="button" data-program-action="submit" data-id="${esc(p.program_id)}">Kirim Review</button>`);
    }
    if(p.status==='APPROVED'){
      out.push(`<button class="btn btn-primary" type="button" data-program-action="PUBLISH" data-id="${esc(p.program_id)}">Publikasikan</button>`);
    }
    if(p.status==='ACTIVE'){
      out.push(`<a class="btn btn-soft" href="./program.html?id=${encodeURIComponent(p.program_id)}">Lihat Publik</a>`);
      out.push(`<button class="btn btn-ghost" type="button" data-program-action="PAUSE" data-id="${esc(p.program_id)}">Jeda</button>`);
    }
    if(p.status==='PAUSED'){
      out.push(`<button class="btn btn-primary" type="button" data-program-action="RESUME" data-id="${esc(p.program_id)}">Aktifkan Lagi</button>`);
    }
    if(!out.length) out.push(`<span class="muted mini">Tidak ada aksi yang diperlukan saat ini.</span>`);
    return out.join('');
  }

  function renderPrograms(){
    const list=$('[data-program-list]');
    if(!state.programs.length){
      list.innerHTML='<div class="empty-state">Belum ada program. Gunakan form di atas untuk membuat Draft pertama.</div>';
      return;
    }
    const sorted=[...state.programs].sort((a,b)=>String(b.updated_at||b.created_at).localeCompare(String(a.updated_at||a.created_at)));
    list.innerHTML=sorted.map(p=>`
      <article class="program-item">
        <div class="program-item__top">
          <div>
            <h3>${esc(p.program_name)}</h3>
            <p class="muted">${esc(p.program_code||'')} · ${esc(p.category||'Tanpa kategori')}</p>
          </div>
          <span class="status-pill" data-status="${esc(p.status)}">${esc(statusLabel(p.status))}</span>
        </div>
        <p>${esc(p.short_description||'Belum ada ringkasan.')}</p>
        <p class="mini muted">Target ${esc(idr(p.target_amount))}</p>
        <div class="program-actions">${programButtons(p)}</div>
      </article>`).join('');
  }

  function renderFundraise(){
    const el=$('[data-fundraise-state]');
    const status=state.verification?.status||'UNVERIFIED';
    if(status==='APPROVED'){
      el.innerHTML='<strong>Verifikasi sudah disetujui.</strong> Anda dapat membuat Draft dan mengirim program ke Review KIA.';
    }else if(status==='PENDING_REVIEW'){
      el.innerHTML='<strong>Verifikasi sedang direview.</strong> Sambil menunggu, Anda tetap dapat menyiapkan Draft Program.';
    }else if(status==='REJECTED'){
      el.innerHTML='<strong>Verifikasi perlu diperbaiki.</strong> Ajukan ulang data sebelum mengirim program ke review.';
    }else{
      el.innerHTML='<strong>Langkah pertama: verifikasi.</strong> Anda boleh membuat Draft sekarang, tetapi submit program baru terbuka setelah verifikasi disetujui.';
    }
  }

  function renderAll(){
    renderCachedUser();
    renderHome();
    renderVerification();
    renderPrograms();
    renderFundraise();

    const isAdmin=adminRole(state.user);
    $$('[data-admin-nav]').forEach(el=>el.hidden=!isAdmin);
    if(!isAdmin&&['admin','cms'].includes(routeName())) location.hash='#home';
    renderRoute();
  }

  async function loadBootstrap({quiet=false}={}){
    try{
      const r=await KiaAuth.request('/api/dashboard/bootstrap',{timeout:22000});
      state.user=r.data.user;
      state.profile=r.data.profile;
      state.organization=r.data.organization;
      state.membership=r.data.membership;
      state.verification=r.data.verification||{status:'UNVERIFIED'};
      state.programs=Array.isArray(r.data.programs)?r.data.programs:[];
      localStorage.setItem('kia_user',JSON.stringify({
        user_id:state.user.user_id,
        email:state.user.email,
        full_name:state.user.full_name,
        account_type:state.user.account_type
      }));
      $('[data-dashboard-status]').textContent='Sesi aktif';
      renderAll();
      return true;
    }catch(err){
      if(err.status===401){
        KiaAuth.clear();
        location.replace('./login.html?reason=session_expired');
        return false;
      }
      $('[data-dashboard-status]').textContent='Sesi tersimpan · data terbaru belum tersinkron';
      if(!quiet) KiaUI.toast(err.message||'Data terbaru belum dapat dimuat.',{type:'warning'});
      return false;
    }
  }

  function formPayload(form){
    return Object.fromEntries(new FormData(form).entries());
  }

  async function submitVerification(e){
    e.preventDefault();
    const form=e.currentTarget;
    KiaUI.showLoading({title:'Mengirim verifikasi',message:'Menyimpan data dan memasukkannya ke antrean review…'});
    try{
      await KiaAuth.request('/api/verification/submit',{
        method:'POST',
        body:JSON.stringify(formPayload(form)),
        timeout:30000
      });
      await loadBootstrap({quiet:true});
      KiaUI.hideLoading();
      KiaUI.toast('Verifikasi berhasil diajukan.',{type:'success'});
    }catch(err){
      KiaUI.hideLoading();
      KiaUI.toast(err.message||'Verifikasi gagal dikirim.',{type:'error',duration:5000});
    }
  }

  function resetProgramForm(){
    const f=$('#programForm');
    f.reset();
    f.elements.program_id.value='';
    $('[data-program-save]').textContent='Simpan Draft';
  }

  function editProgram(id){
    const p=state.programs.find(x=>x.program_id===id);
    if(!p) return KiaUI.toast('Program tidak ditemukan.',{type:'error'});
    const f=$('#programForm');
    for(const name of ['program_id','program_name','category','target_amount','start_date','end_date','short_description','description','cover_image_url']){
      if(f.elements[name]) f.elements[name].value=p[name]||'';
    }
    $('[data-program-save]').textContent='Simpan Perubahan';
    go('programs');
    f.elements.program_name.focus();
  }

  async function saveProgram(e){
    e.preventDefault();
    const f=e.currentTarget;
    const payload=formPayload(f);
    const programId=payload.program_id;
    delete payload.program_id;

    KiaUI.showLoading({title:programId?'Menyimpan perubahan':'Membuat Draft',message:'Menyimpan data program…'});
    try{
      await KiaAuth.request(programId?`/api/programs/${encodeURIComponent(programId)}/update`:'/api/programs',{
        method:'POST',
        body:JSON.stringify(payload),
        timeout:30000
      });
      await loadBootstrap({quiet:true});
      resetProgramForm();
      KiaUI.hideLoading();
      KiaUI.toast(programId?'Program berhasil diperbarui.':'Draft Program berhasil dibuat.',{type:'success'});
    }catch(err){
      KiaUI.hideLoading();
      KiaUI.toast(err.message||'Program gagal disimpan.',{type:'error',duration:5000});
    }
  }

  async function programAction(action,id){
    if(action==='edit') return editProgram(id);
    const p=state.programs.find(x=>x.program_id===id);
    if(!p) return KiaUI.toast('Program tidak ditemukan.',{type:'error'});

    if(action==='submit'){
      const ok=await KiaUI.confirm({
        title:'Kirim program ke Review KIA?',
        message:'Setelah dikirim, program tidak dapat diedit sampai review selesai.',
        confirmText:'Ya, Kirim Review'
      });
      if(!ok) return;
      KiaUI.showLoading({title:'Mengirim program',message:'Memasukkan program ke antrean Review KIA…'});
      try{
        await KiaAuth.request(`/api/programs/${encodeURIComponent(id)}/submit`,{method:'POST',body:'{}',timeout:30000});
        await loadBootstrap({quiet:true});
        KiaUI.hideLoading();
        KiaUI.toast('Program berhasil dikirim ke review.',{type:'success'});
      }catch(err){
        KiaUI.hideLoading();
        if(err.message?.toLowerCase().includes('verifikasi')) go('verification');
        KiaUI.toast(err.message||'Program gagal dikirim.',{type:'error',duration:5200});
      }
      return;
    }

    const labels={PUBLISH:['Publikasikan program?','Program akan tampil di landing page publik.'],PAUSE:['Jeda program?','Program akan sementara disembunyikan dari halaman publik.'],RESUME:['Aktifkan kembali program?','Program akan kembali tampil di halaman publik.']};
    const copy=labels[action];
    if(!copy) return;
    const ok=await KiaUI.confirm({title:copy[0],message:copy[1],confirmText:'Ya, Lanjutkan'});
    if(!ok) return;
    KiaUI.showLoading({title:'Memperbarui program',message:'Menyimpan status terbaru…'});
    try{
      await KiaAuth.request(`/api/programs/${encodeURIComponent(id)}/status`,{
        method:'POST',body:JSON.stringify({action}),timeout:30000
      });
      await loadBootstrap({quiet:true});
      KiaUI.hideLoading();
      KiaUI.toast('Status program berhasil diperbarui.',{type:'success'});
    }catch(err){
      KiaUI.hideLoading();
      KiaUI.toast(err.message||'Status program gagal diperbarui.',{type:'error',duration:5000});
    }
  }

  function fillHero(hero){
    const f=$('#heroForm');
    if(!f) return;
    const h=hero||{};
    f.elements.title.value=h.title||'Kebaikan yang terukur. Dampak yang terlihat.';
    f.elements.subtitle.value=h.subtitle||'Temukan program tepercaya dan lihat dampaknya secara transparan.';
    f.elements.cta_label.value=h.cta_label||'Mulai Berdonasi';
    f.elements.cta_url.value=h.cta_url||'#program';
    f.elements.image_url.value=h.image_url||'';
    $('[data-hero-preview-title]').textContent=f.elements.title.value;
    $('[data-hero-preview-subtitle]').textContent=f.elements.subtitle.value;
    const preview=$('[data-hero-preview]');
    preview.style.backgroundImage=h.image_url?`linear-gradient(rgba(255,255,255,.72),rgba(255,255,255,.72)),url("${h.image_url.replaceAll('"','%22')}")`:'';
  }

  function reviewButtons(kind,id){
    return `<div class="review-actions">
      <button class="btn btn-primary" type="button" data-review-kind="${kind}" data-review-id="${esc(id)}" data-review-decision="APPROVE">Setujui</button>
      <button class="btn btn-danger" type="button" data-review-kind="${kind}" data-review-id="${esc(id)}" data-review-decision="REJECT">Tolak</button>
    </div>`;
  }

  function renderAdmin(){
    if(!state.admin) return;
    const a=state.admin;
    const i=$('[data-review-individual]');
    i.innerHTML=a.profiles?.length?a.profiles.map(p=>`
      <article class="review-item">
        <h3>${esc(p.user?.full_name||p.user_id)}</h3>
        <p class="muted">${esc(p.identity_type)} · ${esc(p.identity_number)}</p>
        <p>${esc(p.address||'')}</p>
        ${reviewButtons('INDIVIDUAL',p.profile_id)}
      </article>`).join(''):'<div class="empty-state">Tidak ada verifikasi perorangan yang menunggu review.</div>';

    const o=$('[data-review-org]');
    o.innerHTML=a.organizations?.length?a.organizations.map(x=>`
      <article class="review-item">
        <h3>${esc(x.legal_name||x.name)}</h3>
        <p class="muted">Legalitas: ${esc(x.registration_number||'—')}</p>
        <p>${esc(x.address||'')}</p>
        ${reviewButtons('ORGANIZATION',x.organization_id)}
      </article>`).join(''):'<div class="empty-state">Tidak ada yayasan yang menunggu review.</div>';

    const p=$('[data-review-program]');
    p.innerHTML=a.programs?.length?a.programs.map(x=>`
      <article class="review-item">
        <h3>${esc(x.program_name)}</h3>
        <p class="muted">${esc(x.program_code)} · ${esc(x.owner_type)}</p>
        <p>${esc(x.short_description||'')}</p>
        <p class="mini">Target ${esc(idr(x.target_amount))}</p>
        ${reviewButtons('PROGRAM',x.program_id)}
      </article>`).join(''):'<div class="empty-state">Tidak ada program yang menunggu review.</div>';
    fillHero(a.hero);
  }

  async function loadAdmin(force=false){
    if(!adminRole(state.user)) return;
    if(state.admin&&!force){renderAdmin();return}
    try{
      const r=await KiaAuth.request('/api/admin/review',{timeout:25000});
      state.admin=r.data;
      renderAdmin();
    }catch(err){
      KiaUI.toast(err.message||'Data review admin gagal dimuat.',{type:'error'});
    }
  }

  async function adminDecision(kind,id,decision){
    const ok=await KiaUI.confirm({
      title:decision==='APPROVE'?'Setujui data ini?':'Tolak data ini?',
      message:kind==='PROGRAM'?'Status program akan diperbarui sesuai keputusan review.':'Status verifikasi akun akan diperbarui.',
      confirmText:decision==='APPROVE'?'Setujui':'Tolak'
    });
    if(!ok) return;
    KiaUI.showLoading({title:'Menyimpan keputusan',message:'Memperbarui status review…'});
    try{
      if(kind==='PROGRAM'){
        await KiaAuth.request(`/api/admin/programs/${encodeURIComponent(id)}/decision`,{
          method:'POST',body:JSON.stringify({decision}),timeout:30000
        });
      }else{
        await KiaAuth.request('/api/admin/verification/decision',{
          method:'POST',body:JSON.stringify({kind,id,decision}),timeout:30000
        });
      }
      state.admin=null;
      await Promise.all([loadAdmin(true),loadBootstrap({quiet:true})]);
      KiaUI.hideLoading();
      KiaUI.toast('Keputusan review berhasil disimpan.',{type:'success'});
    }catch(err){
      KiaUI.hideLoading();
      KiaUI.toast(err.message||'Keputusan gagal disimpan.',{type:'error',duration:5000});
    }
  }

  async function saveHero(e){
    e.preventDefault();
    const payload=formPayload(e.currentTarget);
    KiaUI.showLoading({title:'Menyimpan Hero',message:'Memperbarui konten landing page…'});
    try{
      const r=await KiaAuth.request('/api/admin/hero',{
        method:'POST',body:JSON.stringify(payload),timeout:30000
      });
      state.admin=state.admin||{};
      state.admin.hero=r.data.hero;
      fillHero(r.data.hero);
      KiaUI.hideLoading();
      KiaUI.toast('Hero landing page berhasil diperbarui.',{type:'success'});
    }catch(err){
      KiaUI.hideLoading();
      KiaUI.toast(err.message||'Hero gagal disimpan.',{type:'error',duration:5000});
    }
  }

  async function logout(){
    const approved=await KiaUI.confirm({
      title:'Keluar dari KIA?',
      message:'Sesi akun di perangkat ini akan diakhiri. Anda perlu masuk kembali untuk membuka dashboard.',
      confirmText:'Ya, Keluar',
      cancelText:'Batal'
    });
    if(!approved) return;
    KiaUI.showLoading({title:'Keluar dari akun',message:'Mengakhiri sesi dengan aman…'});
    await KiaAuth.logout();
    KiaUI.setLoading({title:'Berhasil keluar',message:'Kembali ke halaman utama…'});
    setTimeout(()=>location.replace('./'),220);
  }

  function bind(){
    window.addEventListener('hashchange',renderRoute);
    $$('[data-go]').forEach(btn=>btn.addEventListener('click',()=>{
      go(btn.dataset.go);
      if(btn.hasAttribute('data-focus-program')) setTimeout(()=>$('#programForm [name="program_name"]')?.focus(),80);
    }));
    $('#verificationForm')?.addEventListener('submit',submitVerification);
    $('#programForm')?.addEventListener('submit',saveProgram);
    $$('[data-program-reset]').forEach(btn=>btn.addEventListener('click',resetProgramForm));
    $('[data-program-list]')?.addEventListener('click',e=>{
      const btn=e.target.closest('[data-program-action]');
      if(btn) programAction(btn.dataset.programAction,btn.dataset.id);
    });
    $('[data-logout]')?.addEventListener('click',logout);
    $('[data-admin-refresh]')?.addEventListener('click',()=>loadAdmin(true));
    $('[data-section="admin"]')?.addEventListener('click',e=>{
      const btn=e.target.closest('[data-review-decision]');
      if(btn) adminDecision(btn.dataset.reviewKind,btn.dataset.reviewId,btn.dataset.reviewDecision);
    });
    $('#heroForm')?.addEventListener('submit',saveHero);
    $('#heroForm')?.addEventListener('input',e=>{
      if(e.target.name==='title') $('[data-hero-preview-title]').textContent=e.target.value||'Hero KIA';
      if(e.target.name==='subtitle') $('[data-hero-preview-subtitle]').textContent=e.target.value||'';
    });
  }

  document.addEventListener('DOMContentLoaded',async()=>{
    if(!KiaAuth.getToken()){
      location.replace('./login.html');
      return;
    }
    renderCachedUser();
    renderRoute();
    bind();
    await loadBootstrap();
  });
})();
