(()=>{
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':'&quot;'}[c]));
  const idr=v=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v)||0);
  let impactLoaded=false,impactLoading=false,pendingLoaded=false,profileLoaded=false;

  const badgeInfo={
    LANGKAH_PERTAMA:'Donasi pertama tervalidasi.',
    SAHABAT_PROGRAM:'Mendukung sedikitnya 3 program.',
    KONSISTEN_3_BULAN:'Aktif berbagi pada 3 bulan berbeda.',
    KONSISTEN_6_BULAN:'Aktif berbagi pada 6 bulan berbeda.',
    LINTAS_PROGRAM:'Mendukung sedikitnya 5 program.',
    PROGRAM_TUNTAS:'Pernah mendukung program yang telah selesai.'
  };

  function injectStyle(){
    if(document.getElementById('kia-v0510b-dashboard-style'))return;
    const s=document.createElement('style');s.id='kia-v0510b-dashboard-style';
    s.textContent=`
      .admin-only[hidden],[data-admin-nav][hidden]{display:none!important}
      .impact-badge-guide-btn-v0510{display:inline-flex;align-items:center;gap:5px;min-height:34px;padding:0 10px;border:1px solid var(--border);border-radius:10px;background:#fff;color:var(--primary);font:inherit;font-size:10px;font-weight:800;cursor:pointer}
      .impact-badge-guide-btn-v0510 .material-symbols-outlined{font-size:15px}
      .impact-badge-guide-v0510{margin:0 0 12px;padding:13px;border:1px solid #dce8e3;border-radius:14px;background:#f8fbf9}
      .impact-badge-guide-v0510[hidden]{display:none!important}
      .impact-badge-guide-v0510 h4{margin:0 0 6px;font-size:12px}
      .impact-badge-guide-v0510 p{margin:0 0 10px;color:var(--muted);font-size:10px;line-height:1.5}
      .badge-rule-grid-v0510{display:grid;grid-template-columns:1fr 1fr;gap:7px}
      .badge-rule-v0510{padding:9px 10px;border:1px solid var(--border);border-radius:11px;background:#fff}
      .badge-rule-v0510 strong,.badge-rule-v0510 small{display:block}.badge-rule-v0510 strong{font-size:10px}.badge-rule-v0510 small{margin-top:2px;color:var(--muted);font-size:9px;line-height:1.4}
      .impact-level-note-v0510{margin-top:9px;padding:9px 10px;border-radius:11px;background:#edf6f2;color:#315b4d;font-size:9px;line-height:1.5}
      .pending-card-v0510{padding:18px}
      .pending-head-v0510{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:11px}
      .pending-head-v0510 h3{margin:0}.pending-head-v0510 p{margin:4px 0 0;font-size:10px}
      .pending-list-v0510{display:grid;gap:8px}
      .pending-item-v0510{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:11px 12px;border:1px solid var(--border);border-radius:13px;background:#fff}
      .pending-item-v0510 strong,.pending-item-v0510 span,.pending-item-v0510 small{display:block}
      .pending-item-v0510 .pending-title-v0510{font-size:11px}
      .pending-item-v0510 .pending-meta-v0510{margin-top:3px;color:var(--muted);font-size:9px}
      .pending-item-v0510 .pending-amount-v0510{text-align:right;color:var(--primary);font-family:var(--font-number);font-weight:850}
      .pending-item-v0510 .pending-actions-v0510{display:flex;gap:6px;justify-content:flex-end;margin-top:6px}
      .pending-empty-v0510{padding:16px;text-align:center;color:var(--muted);font-size:10px}
      .profile-editor-v0510{margin-top:14px;padding-top:17px;border-top:1px solid var(--border)}
      .profile-editor-v0510 h3{margin:0 0 5px}.profile-editor-v0510>p{margin:0 0 13px;font-size:10px}
      .profile-grid-v0510{display:grid;grid-template-columns:1fr 1fr;gap:11px}
      .profile-grid-v0510 .full{grid-column:1/-1}
      .profile-field-v0510{display:grid;gap:6px;font-size:11px;font-weight:750}
      .profile-field-v0510 input,.profile-field-v0510 textarea{width:100%;min-height:42px;padding:9px 11px;border:1px solid var(--border);border-radius:11px;background:#fff;font:inherit}
      .profile-field-v0510 textarea{min-height:82px;resize:vertical}
      .profile-field-v0510 input[readonly]{background:#f5f7f6;color:var(--muted)}
      .profile-actions-v0510{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-top:12px}
      .profile-status-v0510{font-size:10px;color:var(--muted)}
      @media(max-width:820px){
        .badge-rule-grid-v0510{grid-template-columns:1fr}
        .pending-item-v0510{grid-template-columns:1fr}
        .pending-item-v0510 .pending-amount-v0510{text-align:left}
        .pending-item-v0510 .pending-actions-v0510{justify-content:flex-start}
        .profile-grid-v0510{grid-template-columns:1fr}.profile-grid-v0510 .full{grid-column:auto}
      }`;
    document.head.appendChild(s);
  }

  function badgeGuide(){
    const impact=$('[data-impact-root]');if(!impact)return;
    const card=[...impact.querySelectorAll('.impact-columns .section-card')].find(x=>x.querySelector('h3')?.textContent.trim()==='Badge Saya');
    if(!card||card.querySelector('[data-badge-guide]'))return;
    const head=card.querySelector('.section-head');
    const btn=document.createElement('button');btn.type='button';btn.className='impact-badge-guide-btn-v0510';btn.dataset.badgeGuideToggle='1';
    btn.innerHTML='<span class="material-symbols-outlined">info</span> Tingkatan Badge';
    head?.appendChild(btn);
    const guide=document.createElement('div');guide.className='impact-badge-guide-v0510';guide.dataset.badgeGuide='1';guide.hidden=true;
    guide.innerHTML=`<h4>Cara Badge & Level bekerja</h4>
      <p>Badge menghargai jejak aktivitas yang tervalidasi, bukan besarnya nominal. Badge dapat terbuka ketika syarat aktivitasnya terpenuhi dan tidak harus dibaca sebagai ranking kekayaan.</p>
      <div class="badge-rule-grid-v0510">
        <div class="badge-rule-v0510"><strong>Langkah Pertama</strong><small>Donasi pertama berstatus PAID.</small></div>
        <div class="badge-rule-v0510"><strong>Sahabat Program</strong><small>Aktif mendukung lebih dari satu program.</small></div>
        <div class="badge-rule-v0510"><strong>Konsisten 3 Bulan</strong><small>Aktif berbagi pada 3 bulan berbeda.</small></div>
        <div class="badge-rule-v0510"><strong>Konsisten 6 Bulan</strong><small>Aktif berbagi pada 6 bulan berbeda.</small></div>
        <div class="badge-rule-v0510"><strong>Lintas Program</strong><small>Jejak dukungan tersebar pada beberapa program.</small></div>
        <div class="badge-rule-v0510"><strong>Program Tuntas</strong><small>Pernah mendukung program yang telah selesai.</small></div>
      </div>
      <div class="impact-level-note-v0510"><strong>Level Aktivitas</strong><br>Level dihitung engine KIA dari jejak aktivitas tervalidasi seperti donasi PAID, ragam program, periode aktif, dan program tuntas. KIA tidak menggunakan leaderboard nominal.</div>`;
    const badgeRoot=card.querySelector('[data-impact-badges]');card.insertBefore(guide,badgeRoot);
    btn.onclick=()=>{guide.hidden=!guide.hidden;btn.classList.toggle('is-active',!guide.hidden)};
  }

  function injectPending(){
    const impact=$('[data-impact-root]');if(!impact||impact.querySelector('[data-pending-donations]'))return;
    const metrics=impact.querySelector('.impact-metrics');
    if(!metrics)return;
    metrics.insertAdjacentHTML('afterend',`<section class="card pending-card-v0510" data-pending-donations>
      <div class="pending-head-v0510"><div><h3>Menunggu Pembayaran</h3><p class="muted">Donasi yang sudah dibuat tetapi belum PAID dapat dilanjutkan tanpa membuat Donation baru.</p></div><button class="btn btn-ghost" type="button" data-pending-refresh>Refresh</button></div>
      <div class="pending-list-v0510" data-pending-list><div class="pending-empty-v0510">Memuat transaksi yang masih dapat dilanjutkan…</div></div>
    </section>`);
    $('[data-pending-refresh]',impact)?.addEventListener('click',()=>loadPending(true));
  }

  function statusLabel(v){
    return ({PENDING:'Menunggu pembayaran',CREATED:'Menyiapkan channel',EXPIRED:'Kedaluwarsa',FAILED:'Percobaan gagal'}[String(v||'').toUpperCase()]||v||'Menunggu');
  }
  function pendingButton(x){
    const token=String(x.view_token||'');
    if(!token)return '';
    const href=`./payment.html?token=${encodeURIComponent(token)}&from=impact`;
    const terminal=['EXPIRED','FAILED'].includes(String(x.payment_status||'').toUpperCase());
    return `<a class="btn ${terminal?'btn-soft':'btn-primary'}" href="${href}">${terminal?'Buat Pembayaran Baru':'Lanjutkan Pembayaran'}</a>`;
  }
  async function loadPending(force=false){
    if(pendingLoaded&&!force)return;
    const root=$('[data-pending-list]');if(!root)return;
    root.innerHTML='<div class="pending-empty-v0510">Memuat transaksi…</div>';
    try{
      const r=await KiaAuth.request('/api/donor/pending-payments',{timeout:18000,attempts:1});
      const rows=r.data?.items||[];
      root.innerHTML=rows.length?rows.map(x=>`<article class="pending-item-v0510">
        <div><strong class="pending-title-v0510">${esc(x.program_name||'Program KIA')}</strong><span class="pending-meta-v0510">${esc(x.donation_code||'')} · ${esc(statusLabel(x.payment_status))}${x.expired_at?` · berlaku s.d. ${new Date(x.expired_at).toLocaleString('id-ID')}`:''}</span></div>
        <div><span class="pending-amount-v0510">${idr(x.gross_amount)}</span><div class="pending-actions-v0510">${pendingButton(x)}</div></div>
      </article>`).join(''):'<div class="pending-empty-v0510">Tidak ada donasi yang menunggu pembayaran.</div>';
      pendingLoaded=true;
    }catch(e){root.innerHTML=`<div class="pending-empty-v0510">${esc(e.message||'Riwayat pembayaran belum dapat dimuat.')}</div>`}
  }

  function injectProfileEditor(){
    const section=$('[data-section="account"]');if(!section||section.querySelector('[data-profile-editor]'))return;
    const card=section.querySelector('.section-card');if(!card)return;
    card.insertAdjacentHTML('beforeend',`<div class="profile-editor-v0510" data-profile-editor>
      <h3>Profil Akun</h3><p class="muted">Lengkapi data kontak dan alamat akun. Email dan jenis akun tidak diubah dari form ini.</p>
      <form data-profile-form>
        <div class="profile-grid-v0510">
          <label class="profile-field-v0510">Nama<input name="full_name" maxlength="140" required></label>
          <label class="profile-field-v0510">WhatsApp / Telepon<input name="phone" maxlength="60" inputmode="tel"></label>
          <label class="profile-field-v0510">Email<input name="email" readonly></label>
          <label class="profile-field-v0510">Jenis Akun<input name="account_type" readonly></label>
          <label class="profile-field-v0510 full">Alamat<textarea name="address" maxlength="600" placeholder="Alamat akun / alamat korespondensi"></textarea></label>
        </div>
        <div class="profile-actions-v0510"><button class="btn btn-primary" type="submit" data-profile-save>Simpan Profil</button><span class="profile-status-v0510" data-profile-status></span></div>
      </form>
    </div>`);
    $('[data-profile-form]',section)?.addEventListener('submit',saveProfile);
  }
  async function loadProfile(force=false){
    if(profileLoaded&&!force)return;
    injectProfileEditor();
    const form=$('[data-profile-form]');if(!form)return;
    const status=$('[data-profile-status]');status.textContent='Memuat profil…';
    try{
      const r=await KiaAuth.request('/api/account/profile',{timeout:14000});
      const u=r.data?.user||{},p=r.data?.profile||{};
      form.elements.full_name.value=u.full_name||'';
      form.elements.phone.value=u.phone||'';
      form.elements.email.value=u.email||'';
      form.elements.account_type.value=u.account_type==='ORGANIZATION'?'Yayasan / Organisasi':'Perorangan';
      form.elements.address.value=p.address||'';
      status.textContent='Profil tersinkron.';
      profileLoaded=true;
    }catch(e){status.textContent=e.message||'Profil belum dapat dimuat.'}
  }
  async function saveProfile(e){
    e.preventDefault();
    const form=e.currentTarget,btn=form.querySelector('[data-profile-save]'),status=form.querySelector('[data-profile-status]');
    const payload={full_name:form.elements.full_name.value.trim(),phone:form.elements.phone.value.trim(),address:form.elements.address.value.trim()};
    if(!payload.full_name){status.textContent='Nama wajib diisi.';return}
    btn.disabled=true;btn.textContent='Menyimpan…';status.textContent='';
    try{
      const r=await KiaAuth.request('/api/account/profile',{method:'POST',body:JSON.stringify(payload),timeout:18000,attempts:1});
      KiaAuth.setSession({user:r.data?.user||{}});
      $$('[data-user-name]').forEach(x=>x.textContent=r.data?.user?.full_name||payload.full_name);
      const name=$('[data-account-name]');if(name)name.textContent=r.data?.user?.full_name||payload.full_name;
      status.textContent='Profil berhasil diperbarui.';
    }catch(err){status.textContent=err.message||'Profil gagal disimpan.'}
    finally{btn.disabled=false;btn.textContent='Simpan Profil'}
  }

  function renderImpact(data){
    const level=data.level||{},m=data.metrics||{},badges=data.badges||[],recent=data.recent||[];
    $('[data-impact-level]').textContent=level.label||'Teman KIA';
    $('[data-impact-donations]').textContent=String(m.paid_donation_count||0);
    $('[data-impact-programs]').textContent=String(m.programs_supported||0);
    $('[data-impact-months]').textContent=String(m.active_months||0);
    $('[data-impact-completed]').textContent=String(m.completed_programs||0);

    const badgeRoot=$('[data-impact-badges]');
    badgeRoot.innerHTML=badges.length?badges.map(b=>`<article class="impact-badge"><span class="material-symbols-outlined">${esc(b.icon||'workspace_premium')}</span><div><strong>${esc(b.label)}</strong><small>${esc(badgeInfo[b.code]||'Badge aktivitas KIA')}</small></div></article>`).join(''):'<div class="empty-state">Badge akan muncul ketika syarat aktivitasnya terpenuhi.</div>';

    const recentRoot=$('[data-impact-recent]');
    recentRoot.innerHTML=recent.length?recent.map(x=>`<a class="impact-recent" href="./program.html?id=${encodeURIComponent(x.program_id||'')}"><div><strong>${esc(x.program_name)}</strong><small>${x.paid_at?new Date(x.paid_at).toLocaleDateString('id-ID'):'—'}</small></div><span>${idr(x.amount)}</span></a>`).join(''):'<div class="empty-state">Belum ada riwayat donasi PAID di akun ini.</div>';
    badgeGuide();injectPending();loadPending();impactLoaded=true;
  }

  async function loadImpact(force=false){
    if(impactLoading||impactLoaded&&!force)return;impactLoading=true;
    const root=$('[data-impact-root]');if(!impactLoaded)root?.classList.add('is-loading');
    try{const r=await KiaAuth.request('/api/donor/impact',{timeout:15000});renderImpact(r.data||{})}
    catch(e){if(root)root.innerHTML=`<div class="empty-state">${esc(e.message||'Dampak Saya belum dapat dimuat.')} <button class="btn btn-ghost" type="button" data-impact-retry>Coba Lagi</button></div>`;$('[data-impact-retry]')?.addEventListener('click',()=>{impactLoaded=false;loadImpact(true)})}
    finally{impactLoading=false;root?.classList.remove('is-loading')}
  }

  function observeRoutes(){
    const refresh=()=>{
      injectStyle();injectProfileEditor();
      const hash=(location.hash||'#home').slice(1);
      if(hash==='impact'){badgeGuide();injectPending();loadImpact();loadPending()}
      if(hash==='account')loadProfile();
    };
    window.addEventListener('hashchange',()=>setTimeout(refresh,40));
    setTimeout(refresh,60);
    setTimeout(refresh,700);
  }

  document.addEventListener('DOMContentLoaded',()=>{injectStyle();observeRoutes()});
  window.KiaDonorImpact={load:loadImpact,refresh:()=>{impactLoaded=false;pendingLoaded=false;return loadImpact(true)}};
})();