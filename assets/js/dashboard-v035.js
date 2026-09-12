(() => {
  const state={
    user:KiaAuth.getUser(),
    profile:null,
    organization:null,
    membership:null,
    verification:{status:'UNVERIFIED',type:'INDIVIDUAL'},
    programs:[],
    admin:null,
    settings:null,
    heroSlot:1,
    lastSyncAt:0,
    media:[]
  };

  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>'"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':'&quot;'}[ch]));
  const idr=v=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v)||0);
  const adminRole=u=>['PLATFORM_ADMIN','SUPER_ADMIN'].includes(u?.platform_role);
  const superAdminRole=u=>u?.platform_role==='SUPER_ADMIN';
  const HERO_DEFAULTS=[
    {hero_id:'hero_1',title:'Kecil di Tangan Kita, Besar untuk Mereka',subtitle:'Setiap kebaikan yang Anda berikan dapat menjadi harapan baru bagi banyak kehidupan.',cta_label:'Mulai Berdonasi',cta_url:'#program',image_url:'./assets/images/hero/hero-1.png',sort_order:1,status:'ACTIVE'},
    {hero_id:'hero_2',title:'Investasi Terbaik adalah Generasi yang Tumbuh',subtitle:'Dukung pendidikan dan kesempatan belajar yang membuka masa depan lebih luas.',cta_label:'Lihat Program Pendidikan',cta_url:'#program',image_url:'./assets/images/hero/hero-2.png',sort_order:2,status:'ACTIVE'},
    {hero_id:'hero_3',title:'Bersama Membangun Masa Depan yang Lebih Baik',subtitle:'Kepedulian hari ini dapat menghadirkan sarana yang bermanfaat untuk banyak orang.',cta_label:'Jelajahi Program',cta_url:'#program',image_url:'./assets/images/hero/hero-3.png',sort_order:3,status:'ACTIVE'}
  ];

  const SNAPSHOT_KEY='kia_dashboard_snapshot_v035';
  const SNAPSHOT_MAX_AGE=7*24*60*60*1000;

  function saveSnapshot(){
    try{
      if(!state.user?.user_id) return;
      localStorage.setItem(SNAPSHOT_KEY,JSON.stringify({
        user_id:state.user.user_id,
        saved_at:Date.now(),
        user:state.user,
        profile:state.profile,
        organization:state.organization,
        membership:state.membership,
        verification:state.verification,
        programs:state.programs
      }));
    }catch(_){}
  }

  function hydrateSnapshot(){
    try{
      const raw=JSON.parse(localStorage.getItem(SNAPSHOT_KEY)||'null');
      const cachedUser=KiaAuth.getUser();
      if(!raw||!cachedUser?.user_id||raw.user_id!==cachedUser.user_id) return false;
      if(Date.now()-Number(raw.saved_at||0)>SNAPSHOT_MAX_AGE) return false;
      state.user={...(cachedUser||{}),...(raw.user||{})};
      state.profile=raw.profile||null;
      state.organization=raw.organization||null;
      state.membership=raw.membership||null;
      state.verification=raw.verification||{status:'UNVERIFIED',type:'INDIVIDUAL'};
      state.programs=Array.isArray(raw.programs)?raw.programs:[];
      return true;
    }catch(_){return false}
  }

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
    const allowed=['home','verification','programs','fundraise','account','admin','cms','settings'];
    return allowed.includes(raw)?raw:'home';
  }

  function renderRoute(){
    let route=routeName();
    if(['admin','cms','settings'].includes(route)&&!adminRole(state.user)) route='home';

    $$('[data-section]').forEach(sec=>{
      sec.hidden=sec.dataset.section!==route;
    });
    $$('[data-dashboard-route]').forEach(link=>{
      const active=link.dataset.dashboardRoute===route;
      link.classList.toggle('btn-primary',active);
      link.classList.toggle('btn-ghost',!active);
    });
    $$('[data-mobile-route]').forEach(link=>link.classList.toggle('is-active',link.dataset.mobileRoute===route));

    if(route==='admin'&&adminRole(state.user)) loadAdmin(false);
    if(route==='cms'&&adminRole(state.user)){ loadAdmin(false); loadMedia(); }
    if(route==='settings'&&adminRole(state.user)) loadSettings(false);
    if(['settings','admin','cms'].includes(route) && Date.now()-state.lastSyncAt>90000){ loadBootstrap({quiet:true}).catch(()=>{}); }
  }

  function go(route){
    location.hash='#'+route;
    renderRoute();
  }

  function renderCachedUser(){
    if(!state.user) return;
    const name=state.user.full_name||'Pengguna';
    const accountType=state.user.account_type==='ORGANIZATION'?'Yayasan / Organisasi':'Perorangan';
    const role=state.user.platform_role||'USER';
    const isPlatformAdmin=adminRole(state.user);
    $$('[data-user-name]').forEach(el=>el.textContent=name);
    const badge=$('[data-account-badge]');
    if(badge){
      badge.hidden=isPlatformAdmin;
      if(!isPlatformAdmin) badge.textContent=accountType.toUpperCase();
    }
    const roleBadge=$('[data-role-badge]');
    if(roleBadge){roleBadge.textContent=role;roleBadge.dataset.role=role;}
    $('[data-account-name]')&&($('[data-account-name]').textContent=name);
    $('[data-account-email]')&&($('[data-account-email]').textContent=state.user.email||'—');
    $('[data-account-initial]')&&($('[data-account-initial]').textContent=name.trim().charAt(0).toUpperCase()||'K');
    $('[data-account-type-text]')&&($('[data-account-type-text]').textContent=accountType);
    $('[data-account-role-text]')&&($('[data-account-role-text]').textContent=role);
    $('[data-org-role-text]')&&($('[data-org-role-text]').textContent=state.membership?.role||'—');
    $$('[data-user-account-type-row]').forEach(el=>el.hidden=isPlatformAdmin);
    $$('[data-user-org-role-row]').forEach(el=>el.hidden=isPlatformAdmin);
    $$('[data-admin-identity-note]').forEach(el=>el.hidden=!isPlatformAdmin);
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
    $$('[data-admin-account-tools]').forEach(el=>el.hidden=!isAdmin);
    if(!isAdmin&&['admin','cms','settings'].includes(routeName())) location.hash='#home';
    renderRoute();
  }

  async function loadBootstrap({quiet=false}={}){
    try{
      const r=await KiaAuth.request('/api/dashboard/bootstrap',{timeout:22000,cache:'no-store'});
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
        account_type:state.user.account_type,
        platform_role:state.user.platform_role||'USER'
      }));
      state.lastSyncAt=Date.now();
      saveSnapshot();
      $('[data-dashboard-status]').textContent='Sesi aktif · data tersinkron';
      renderAll();
      return true;
    }catch(err){
      if(err.status===401){
        KiaAuth.clear();
        location.replace('./login.html?reason=session_expired');
        return false;
      }
      $('[data-dashboard-status]').textContent='Fast Session aktif · memakai data tersimpan';
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


  const SYSTEM_MEDIA=[
    {media_id:'system_hero_1',file_name:'Hero Bawaan 1',public_url:'./assets/images/hero/hero-1.png',thumbnail_url:'./assets/images/hero/hero-1.png',system:true},
    {media_id:'system_hero_2',file_name:'Hero Bawaan 2',public_url:'./assets/images/hero/hero-2.png',thumbnail_url:'./assets/images/hero/hero-2.png',system:true},
    {media_id:'system_hero_3',file_name:'Hero Bawaan 3',public_url:'./assets/images/hero/hero-3.png',thumbnail_url:'./assets/images/hero/hero-3.png',system:true}
  ];

  function renderMediaLibrary(){
    const host=$('[data-media-library]');
    if(!host) return;
    const items=[...SYSTEM_MEDIA,...state.media];
    const selected=$('#heroForm')?.elements.image_url?.value||'';
    host.innerHTML=items.map(m=>`<article class="media-card ${selected===m.public_url?'is-selected':''}" data-media-card="${esc(m.media_id)}">
      <div class="media-card__img" style="background-image:url('${esc(m.thumbnail_url||m.public_url)}')"></div>
      <div class="media-card__body"><span class="media-card__name">${esc(m.file_name||m.media_id)}</span>
        <div class="media-card__actions"><button class="btn btn-soft" type="button" data-use-media="${esc(m.media_id)}">Gunakan</button>${m.system?'':`<button class="btn btn-ghost" type="button" data-archive-media="${esc(m.media_id)}">Arsipkan</button>`}</div>
      </div></article>`).join('');
  }

  async function loadMedia(){
    if(!adminRole(state.user)) return;
    try{
      const r=await KiaAuth.request('/api/admin/media',{timeout:25000,cache:'no-store'});
      state.media=Array.isArray(r.data.items)?r.data.items:[];
      renderMediaLibrary();
    }catch(err){
      state.media=[];
      renderMediaLibrary();
      KiaUI.toast(err.message||'Media Library belum dapat dimuat.',{type:'warning'});
    }
  }

  function selectMedia(mediaId){
    const media=[...SYSTEM_MEDIA,...state.media].find(x=>x.media_id===mediaId);
    if(!media) return;
    const input=$('#heroForm')?.elements.image_url;
    if(input) input.value=media.public_url;
    const preview=$('[data-hero-preview]');
    if(preview) preview.style.backgroundImage=`linear-gradient(0deg,rgba(8,45,35,.72),rgba(8,45,35,.16)),url("${String(media.public_url).replaceAll('"','%22')}")`;
    renderMediaLibrary();
    KiaUI.toast('Gambar dipilih. Klik Simpan Hero Aktif untuk menerapkan.',{type:'success'});
  }

  async function compressImage(file){
    const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});
    const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=data});
    const maxW=1800,maxH=900;
    const scale=Math.min(1,maxW/img.width,maxH/img.height);
    const w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale));
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    canvas.getContext('2d').drawImage(img,0,0,w,h);
    return canvas.toDataURL('image/jpeg',0.88);
  }

  async function uploadHeroMedia(){
    const input=$('[data-hero-file]');
    const file=input?.files?.[0];
    if(!file) return KiaUI.toast('Pilih file gambar terlebih dahulu.',{type:'warning'});
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)) return KiaUI.toast('Format harus JPG, PNG, atau WEBP.',{type:'error'});
    KiaUI.showLoading({title:'Mengimpor gambar',message:'Mengoptimalkan lalu menyimpan gambar ke Media Library…'});
    try{
      const dataUrl=await compressImage(file);
      const r=await KiaAuth.request('/api/admin/media/upload',{method:'POST',body:JSON.stringify({file_name:file.name.replace(/\.[^.]+$/,'.jpg'),mime_type:'image/jpeg',base64:dataUrl}),timeout:60000});
      state.media=[r.data.media,...state.media.filter(x=>x.media_id!==r.data.media.media_id)];
      renderMediaLibrary();
      input.value='';
      KiaUI.hideLoading();
      KiaUI.toast('Gambar berhasil diimpor dan tersimpan.',{type:'success'});
    }catch(err){KiaUI.hideLoading();KiaUI.toast(err.message||'Upload gambar gagal.',{type:'error',duration:6000});}
  }

  async function archiveMedia(mediaId){
    const ok=await KiaUI.confirm({title:'Arsipkan gambar?',message:'Gambar akan disembunyikan dari Media Library, tetapi hero yang sudah memakai URL ini tidak langsung diubah.',confirmText:'Ya, Arsipkan'});
    if(!ok) return;
    try{
      await KiaAuth.request(`/api/admin/media/${encodeURIComponent(mediaId)}/archive`,{method:'POST',body:'{}',timeout:30000});
      state.media=state.media.filter(x=>x.media_id!==mediaId);
      renderMediaLibrary();
      KiaUI.toast('Gambar diarsipkan.',{type:'success'});
    }catch(err){KiaUI.toast(err.message||'Gagal mengarsipkan gambar.',{type:'error'});}
  }

  function currentHero(){
    const slot=state.heroSlot||1;
    const id=`hero_${slot}`;
    const remote=state.admin?.heroes?.find(h=>h.hero_id===id) || (slot===1?state.admin?.hero:null);
    return {...HERO_DEFAULTS[slot-1],...(remote||{}),hero_id:id,sort_order:slot};
  }

  function fillHero(hero=currentHero()){
    const f=$('#heroForm');
    if(!f) return;
    const h=hero||currentHero();
    f.elements.slot.value=String(state.heroSlot||1);
    f.elements.title.value=h.title||'';
    f.elements.subtitle.value=h.subtitle||'';
    f.elements.cta_label.value=h.cta_label||'Mulai Berdonasi';
    f.elements.cta_url.value=h.cta_url||'#program';
    f.elements.image_url.value=h.image_url||'';
    $('[data-hero-preview-title]').textContent=f.elements.title.value;
    $('[data-hero-preview-subtitle]').textContent=f.elements.subtitle.value;
    const preview=$('[data-hero-preview]');
    const img=String(h.image_url||'').replaceAll('"','%22');
    preview.style.backgroundImage=img?`linear-gradient(0deg,rgba(8,45,35,.72),rgba(8,45,35,.16)),url("${img}")`:'';
    preview.style.color='#fff';
    $$('[data-hero-slot]').forEach(btn=>btn.classList.toggle('is-active',Number(btn.dataset.heroSlot)===state.heroSlot));
    renderMediaLibrary();
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
    fillHero(currentHero());
  }

  async function loadAdmin(force=false){
    if(!adminRole(state.user)) return;
    if(state.admin&&!force){renderAdmin();return}
    try{
      const r=await KiaAuth.request('/api/admin/review',{timeout:25000,cache:'no-store'});
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
    const slot=Number(payload.slot)||state.heroSlot||1;
    delete payload.slot;
    KiaUI.showLoading({title:`Menyimpan Hero ${slot}`,message:'Memperbarui konten landing page…'});
    try{
      const r=await KiaAuth.request(`/api/admin/heroes/${slot}`,{
        method:'POST',body:JSON.stringify(payload),timeout:30000
      });
      state.admin=state.admin||{heroes:[]};
      state.admin.heroes=Array.isArray(state.admin.heroes)?state.admin.heroes:[];
      state.admin.heroes=state.admin.heroes.filter(h=>h.hero_id!==r.data.hero.hero_id).concat(r.data.hero);
      fillHero(r.data.hero);
      KiaUI.hideLoading();
      KiaUI.toast(`Hero ${slot} berhasil diperbarui.`,{type:'success'});
    }catch(err){
      KiaUI.hideLoading();
      KiaUI.toast(err.message||'Hero gagal disimpan.',{type:'error',duration:5000});
    }
  }

  function selectHeroSlot(slot){
    const n=Number(slot);
    if(![1,2,3].includes(n)) return;
    state.heroSlot=n;
    fillHero(currentHero());
  }

  function renderSettings(){
    const data=state.settings;
    if(!data) return;
    $('[data-settings-current-role]').textContent=data.current_user?.platform_role||state.user?.platform_role||'USER';
    $('[data-settings-version]').textContent=data.platform?.version||'0.3.1';
    const note=$('[data-role-management-note]');
    const host=$('[data-user-role-list]');
    if(!data.can_manage_roles){
      note.innerHTML='<strong>Role Management terkunci.</strong> PLATFORM_ADMIN dapat review dan mengelola CMS Hero, tetapi hanya SUPER_ADMIN yang boleh mengubah role platform.';
      host.innerHTML='<div class="empty-state">Tidak ada perubahan role yang dapat dilakukan dari akun ini.</div>';
      return;
    }
    note.innerHTML='<strong>SUPER_ADMIN aktif.</strong> Semua pendaftaran publik tetap dibuat sebagai USER. Promosi admin dilakukan dari sini agar role tercatat dan diaudit.';
    const users=Array.isArray(data.users)?data.users:[];
    host.innerHTML=users.length?users.map(u=>`
      <article class="user-role-item">
        <div class="user-role-main"><strong>${esc(u.full_name||u.email)}</strong><span class="muted mini">${esc(u.email)} · ${esc(u.account_type||'INDIVIDUAL')}</span></div>
        <div class="user-role-control">
          <select data-role-user="${esc(u.user_id)}" ${u.user_id===state.user?.user_id?'disabled':''}>
            ${['USER','PLATFORM_ADMIN','SUPER_ADMIN'].map(role=>`<option value="${role}" ${u.platform_role===role?'selected':''}>${role}</option>`).join('')}
          </select>
          <button class="btn btn-soft" type="button" data-save-role="${esc(u.user_id)}" ${u.user_id===state.user?.user_id?'disabled':''}>Simpan Role</button>
        </div>
      </article>`).join(''):'<div class="empty-state">Belum ada akun aktif.</div>';
  }

  async function loadSettings(force=false){
    if(!adminRole(state.user)) return;
    if(state.settings&&!force){renderSettings();return;}
    try{
      const r=await KiaAuth.request('/api/admin/settings',{timeout:25000,cache:'no-store'});
      state.settings=r.data;
      renderSettings();
    }catch(err){
      KiaUI.toast(err.message||'Setting admin gagal dimuat.',{type:'error'});
    }
  }

  async function saveUserRole(userId){
    if(!superAdminRole(state.user)) return KiaUI.toast('Hanya SUPER_ADMIN yang dapat mengubah role.',{type:'error'});
    const select=$$('[data-role-user]').find(el=>el.dataset.roleUser===userId);
    if(!select) return;
    const nextRole=select.value;
    const ok=await KiaUI.confirm({title:'Ubah role platform?',message:`Akun ini akan menggunakan role ${nextRole}.`,confirmText:'Ya, Simpan Role'});
    if(!ok) return;
    KiaUI.showLoading({title:'Menyimpan role',message:'Memperbarui hak akses dan Audit Log…'});
    try{
      await KiaAuth.request(`/api/admin/users/${encodeURIComponent(userId)}/role`,{method:'POST',body:JSON.stringify({platform_role:nextRole}),timeout:30000});
      state.settings=null;
      await loadSettings(true);
      KiaUI.hideLoading();
      KiaUI.toast('Role platform berhasil diperbarui.',{type:'success'});
    }catch(err){
      KiaUI.hideLoading();
      state.settings=null;
      await loadSettings(true).catch(()=>{});
      KiaUI.toast(err.message||'Role gagal diperbarui.',{type:'error',duration:5200});
    }
  }

  async function syncAccount(showToast=true){
    const buttons=$$('[data-sync-account]');
    buttons.forEach(btn=>{btn.disabled=true;btn.dataset.oldText=btn.textContent;btn.textContent='Menyinkronkan…';});
    try{
      const ok=await loadBootstrap({quiet:true});
      if(!ok) throw new Error('Server belum merespons. Fast Session tetap aktif.');
      state.settings=null;
      state.admin=null;
      if(showToast) KiaUI.toast('Akses dan role berhasil disinkronkan.',{type:'success'});
    }catch(err){
      if(showToast) KiaUI.toast(err.message||'Sinkronisasi gagal. Data tersimpan tetap digunakan.',{type:'warning',duration:4800});
    }finally{
      buttons.forEach(btn=>{btn.disabled=false;btn.textContent=btn.dataset.oldText||'Sinkronkan Akses';});
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
    $$('[data-logout]').forEach(btn=>btn.addEventListener('click',logout));
    $$('[data-sync-account]').forEach(btn=>btn.addEventListener('click',()=>syncAccount(true)));
    $('[data-admin-refresh]')?.addEventListener('click',()=>loadAdmin(true));
    $('[data-settings-refresh]')?.addEventListener('click',()=>loadSettings(true));
    $('[data-upload-hero-media]')?.addEventListener('click',uploadHeroMedia);
    $('[data-refresh-media]')?.addEventListener('click',loadMedia);
    $('[data-media-library]')?.addEventListener('click',e=>{const use=e.target.closest('[data-use-media]');if(use) return selectMedia(use.dataset.useMedia);const arch=e.target.closest('[data-archive-media]');if(arch) archiveMedia(arch.dataset.archiveMedia);});
    $('[data-hero-slot-tabs]')?.addEventListener('click',e=>{const btn=e.target.closest('[data-hero-slot]');if(btn) selectHeroSlot(btn.dataset.heroSlot);});
    $('[data-user-role-list]')?.addEventListener('click',e=>{const btn=e.target.closest('[data-save-role]');if(btn) saveUserRole(btn.dataset.saveRole);});
    $('[data-section="admin"]')?.addEventListener('click',e=>{
      const btn=e.target.closest('[data-review-decision]');
      if(btn) adminDecision(btn.dataset.reviewKind,btn.dataset.reviewId,btn.dataset.reviewDecision);
    });
    $('#heroForm')?.addEventListener('submit',saveHero);
    $('#heroForm')?.addEventListener('input',e=>{
      if(e.target.name==='title') $('[data-hero-preview-title]').textContent=e.target.value||'Hero KIA';
      if(e.target.name==='subtitle') $('[data-hero-preview-subtitle]').textContent=e.target.value||'';
      if(e.target.name==='image_url'){const v=e.target.value||'';const preview=$('[data-hero-preview]');preview.style.backgroundImage=v?`linear-gradient(0deg,rgba(8,45,35,.72),rgba(8,45,35,.16)),url("${v.replaceAll('\"','%22')}")`:'';}
    });
  }

  document.addEventListener('DOMContentLoaded',()=>{
    if(!KiaAuth.getToken()){
      location.replace('./login.html');
      return;
    }

    const hasSnapshot=hydrateSnapshot();
    if(!state.user) state.user=KiaAuth.getUser();

    renderAll();
    bind();
    $('[data-dashboard-status]').textContent=hasSnapshot
      ?'Fast Session aktif · memperbarui data di latar belakang…'
      :'Fast Session aktif · menghubungkan data…';

    // Jangan blok UI. Seluruh dashboard langsung memakai cache/session lokal,
    // lalu backend disinkronkan diam-diam di latar belakang.
    loadBootstrap({quiet:true}).then(ok=>{
      if(!ok){
        setTimeout(()=>loadBootstrap({quiet:true}).catch(()=>{}),5000);
      }
    }).catch(()=>{});
  });
})();
