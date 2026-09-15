(()=>{
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':'&quot;'}[c]));
  const idr=v=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v)||0);
  const date=v=>{if(!v)return '—';try{return new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(v))}catch{return v}};

  let detail=null,program=null,media=[],active=0,touchStart=0;

  function imageUrl(m){return m?.public_url||m?.thumbnail_url||program?.cover_image_url||''}
  function daysLeft(end){if(!end)return '—';const diff=Math.ceil((new Date(end).setHours(23,59,59,999)-Date.now())/86400000);return diff<0?'Selesai':`${diff} hari`}
  function donorCount(){return Number(detail?.transparency?.paid_donations ?? program?.paid_donations)||0}

  function ownerHtml(){
    if(detail?._summary_only)return '<div class="empty-room">Memuat profil penggalang…</div>';
    const o=detail?.owner||{};
    const img=o.logo_url||o.avatar_url||'';
    const icon=o.owner_type==='ORGANIZATION'?'account_balance':'person';
    return `<div class="owner-card"><div class="owner-avatar">${img?`<img src="${esc(img)}" alt="">`:`<span class="material-symbols-outlined">${icon}</span>`}</div><div><h3>${esc(o.name||'Penggalang Dana')}</h3><div class="muted mini">${o.owner_type==='ORGANIZATION'?'Yayasan / Organisasi':'Perorangan'}${o.verified?' · Terverifikasi KIA':''}</div><div class="owner-meta"><span>${o.active_programs||0} program aktif</span>${o.joined_at?`<span>Bergabung ${esc(date(o.joined_at))}</span>`:''}</div></div></div>`;
  }

  function updatesHtml(){
    if(detail?._summary_only)return '<div class="empty-room">Memuat perkembangan program…</div>';
    const items=detail?.updates||[];
    if(!items.length)return '<div class="empty-room">Belum ada perkembangan yang dipublikasikan. Saat penggalang mengirim update, progres program akan muncul di sini.</div>';
    return `<div class="timeline">${items.map(x=>`<article class="timeline-item"><div class="timeline-line"><span class="timeline-dot"></span></div><div class="timeline-content"><div class="timeline-date">${esc(date(x.published_at))}</div><h3>${esc(x.title)}</h3><p>${esc(x.content)}</p>${x.image_url?`<img src="${esc(x.image_url)}" alt="Dokumentasi perkembangan">`:''}</div></article>`).join('')}</div>`;
  }

  function recentDonationsHtml(){
    if(detail?._summary_only)return '<div class="empty-room">Memuat donasi tervalidasi terbaru…</div>';
    const items=detail?.recent_donations||[];
    if(!items.length)return '<div class="empty-room">Live Donation akan muncul otomatis setelah pembayaran berhasil tervalidasi.</div>';
    return `<div class="recent-donations">${items.map(x=>`<div class="recent-donation"><strong>${esc(x.donor_label||'Hamba Allah')}</strong><span>${idr(x.amount)}</span></div>`).join('')}</div>`;
  }

  function transparencyHtml(){
    if(detail?._summary_only)return '<div class="empty-room">Memuat data transparansi tervalidasi…</div>';
    const t=detail?.transparency||{};
    return `<div class="transparency-grid"><div class="transparency-metric"><span>Donasi tervalidasi</span><strong>${idr(t.gross_amount)}</strong></div><div class="transparency-metric"><span>Biaya pembayaran tercatat</span><strong>${idr(t.payment_fee_amount)}</strong></div><div class="transparency-metric"><span>Dana bersih tercatat</span><strong>${idr(t.net_recorded_amount)}</strong></div></div><div class="transparency-note"><strong>Catatan transparansi</strong><br>KIA hanya menghitung pembayaran berstatus PAID. Pencairan per program belum ditampilkan sampai modul settlement dan alokasi pencairan program diaktifkan, sehingga angka yang belum dapat diverifikasi tidak ditampilkan.</div>`;
  }

  function render(){
    const root=$('[data-program-root]');
    if(!program)return;
    media=Array.isArray(program.media)?program.media:[];
    const coverIndex=media.findIndex(x=>x.is_cover);
    active=coverIndex>=0?coverIndex:0;
    const pct=Math.min(100,Math.round((Number(program.raised_amount)||0)/(Number(program.target_amount)||1)*100));
    const main=imageUrl(media[active]);
    const trust=detail?.trust||{};

    root.innerHTML=`
      <div class="program-breadcrumb"><a href="./programs.html">Semua Program</a><span>›</span><span>${esc(program.category)}</span></div>
      <div class="program-layout">
        <div>
          <div class="program-gallery">
            ${main?`<img class="program-main-image" data-main-image src="${esc(main)}" alt="${esc(program.program_name)}">`:'<div class="program-image-empty">Belum ada dokumentasi program.</div>'}
            ${media.length>1?`<div class="program-thumb-row">${media.map((m,i)=>`<button class="program-thumb-btn ${i===active?'is-active':''}" type="button" data-thumb-index="${i}"><img src="${esc(m.thumbnail_url||m.public_url)}" alt=""></button>`).join('')}</div>`:''}
          </div>

          <div class="program-heading">
            <span class="program-category">${esc(program.category)}</span>
            <h1>${esc(program.program_name)}</h1>
            <div class="trust-badges">
              ${trust.program_reviewed?'<span class="trust-badge"><span class="material-symbols-outlined">verified</span>Program ditinjau KIA</span>':''}
              ${trust.owner_verified?'<span class="trust-badge"><span class="material-symbols-outlined">shield_person</span>Penggalang terverifikasi</span>':'<span class="trust-badge is-neutral">Status penggalang tersedia di profil</span>'}
            </div>
          </div>

          <div class="program-room-nav" role="tablist">
            <button class="program-room-btn is-active" type="button" data-room="summary">Ringkasan</button>
            <button class="program-room-btn" type="button" data-room="story">Tentang</button>
            <button class="program-room-btn" type="button" data-room="owner">Penggalang</button>
            <button class="program-room-btn" type="button" data-room="updates">Perkembangan</button>
            <button class="program-room-btn" type="button" data-room="transparency">Transparansi</button>
          </div>

          <section class="program-room" data-room-panel="summary">
            <div class="card room-card"><h2>Ringkasan Program</h2><div class="summary-grid"><div class="summary-metric"><span>Terkumpul</span><strong>${idr(program.raised_amount)}</strong></div><div class="summary-metric"><span>Donatur tervalidasi</span><strong>${donorCount()}</strong></div><div class="summary-metric"><span>Sisa waktu</span><strong>${esc(daysLeft(program.end_date))}</strong></div></div><h3 style="margin:20px 0 0">Donasi Terbaru</h3>${recentDonationsHtml()}</div>
          </section>

          <section class="program-room" data-room-panel="story" hidden>
            <div class="card room-card"><h2>Tentang Program</h2><p class="program-description">${esc(program.description||program.short_description||'Penggalang belum menambahkan cerita lengkap untuk program ini.')}</p></div>
          </section>

          <section class="program-room" data-room-panel="owner" hidden>
            <div class="card room-card"><h2>Penggalang Dana</h2>${ownerHtml()}<div class="transparency-note">KIA menampilkan status verifikasi yang tercatat pada sistem. Informasi kontak pribadi tidak ditampilkan di halaman publik.</div></div>
          </section>

          <section class="program-room" data-room-panel="updates" hidden>
            <div class="card room-card"><h2>Perkembangan Program</h2>${updatesHtml()}</div>
          </section>

          <section class="program-room" data-room-panel="transparency" hidden>
            <div class="card room-card"><h2>Transparansi Dana</h2>${transparencyHtml()}</div>
          </section>
        </div>

        <aside class="card donation-card" id="donasi">
          <h3>Dukung Program Ini</h3>
          <p class="muted mini">Donasi berstatus PAID dihitung otomatis.</p>
          <div class="donation-amount">${idr(program.raised_amount)}</div>
          <div class="progress"><span style="width:${pct}%"></span></div>
          <div class="progress-meta"><span>${pct}% tercapai</span><span>Target ${idr(program.target_amount)}</span></div>
          <div class="donation-mini-stats"><div class="donation-mini-stat"><span>Donatur</span><strong>${donorCount()}</strong></div><div class="donation-mini-stat"><span>Sisa waktu</span><strong>${esc(daysLeft(program.end_date))}</strong></div></div>
          <div class="program-actions"><a class="btn btn-primary" href="./donate.html?program_id=${encodeURIComponent(program.program_id)}">Donasi Sekarang</a><button class="btn btn-ghost" type="button" data-share>Bagikan Program</button></div>
          <p class="program-note">Pembayaran akan dicatat sebagai Donation dan Payment terpisah agar status transaksi, fee, dan pencairan tetap dapat ditelusuri.</p>
        </aside>
      </div>`;

    $$('[data-thumb-index]').forEach(b=>b.onclick=()=>selectImage(Number(b.dataset.thumbIndex)));
    $('[data-main-image]')?.addEventListener('click',openLightbox);
    $('[data-share]')?.addEventListener('click',share);
    $$('[data-room]').forEach(b=>b.onclick=()=>openRoom(b.dataset.room));
  }

  function openRoom(name){
    $$('[data-room]').forEach(b=>b.classList.toggle('is-active',b.dataset.room===name));
    $$('[data-room-panel]').forEach(p=>p.hidden=p.dataset.roomPanel!==name);
  }

  function selectImage(i){
    if(!media.length)return;
    active=(i+media.length)%media.length;
    const main=$('[data-main-image]');
    if(main)main.src=imageUrl(media[active]);
    $$('[data-thumb-index]').forEach(b=>b.classList.toggle('is-active',Number(b.dataset.thumbIndex)===active));
    if(!$('[data-lightbox]')?.hidden)$('[data-lightbox-image]').src=imageUrl(media[active]);
  }

  function openLightbox(){
    if(!media.length)return;
    $('[data-lightbox-image]').src=imageUrl(media[active]);
    $('[data-lightbox]').hidden=false;
  }

  async function share(){
    const url=location.href;
    const text=(program.share_message||`Lihat program ${program.program_name} di KIA.`).trim();
    try{
      if(navigator.share)await navigator.share({title:program.program_name,text,url});
      else{
        await navigator.clipboard.writeText(`${text}\n\n${url}`);
        const b=$('[data-share]');b.textContent='Tersalin';setTimeout(()=>b.textContent='Bagikan Program',1500);
      }
    }catch(_){ }
  }

  function detailCacheKey(id){return 'kia_program_detail_v051_'+id}
  function readDetailCache(id){try{const x=JSON.parse(localStorage.getItem(detailCacheKey(id))||'null');return x&&Date.now()-x.saved_at<6*3600000?x.data:null}catch{return null}}
  function writeDetailCache(id,data){try{localStorage.setItem(detailCacheKey(id),JSON.stringify({saved_at:Date.now(),data}))}catch{}}
  function summaryFallback(id){
    try{
      const bootstrap=JSON.parse(localStorage.getItem('kia_public_bootstrap_v051')||'null')?.data;
      const fromBootstrap=(bootstrap?.programs||[]).find(x=>String(x.program_id)===String(id));
      if(fromBootstrap)return {program:fromBootstrap,transparency:{paid_donations:fromBootstrap.paid_donations||0},trust:{program_reviewed:true,owner_verified:false},_summary_only:true};
      for(let i=0;i<localStorage.length;i++){
        const key=localStorage.key(i)||'';if(!key.startsWith('kia_catalog_v051_'))continue;
        const data=JSON.parse(localStorage.getItem(key)||'null')?.d;
        const found=(data?.items||[]).find(x=>String(x.program_id)===String(id));
        if(found)return {program:found,transparency:{paid_donations:found.paid_donations||0},trust:{program_reviewed:true,owner_verified:false},_summary_only:true};
      }
    }catch(_){ }
    return null;
  }
  async function load(){
    const id=new URLSearchParams(location.search).get('id');
    if(!id){$('[data-program-root]').innerHTML='<div class="empty-state">Program tidak ditemukan.</div>';return}
    const cached=readDetailCache(id);
    const fast=cached||summaryFallback(id);
    if(fast){detail=fast;program=detail.program;render()}
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),fast?8000:12000);
    try{
      const response=await fetch(`${KIA_CONFIG.BACKEND_URL}/api/public/programs/${encodeURIComponent(id)}`,{signal:controller.signal});
      const r=await response.json();
      if(!response.ok||!r.success)throw new Error(r.message||'Program belum dapat dimuat.');
      detail=r.data||{};program=detail.program;writeDetailCache(id,detail);render();
    }catch(e){if(!fast)$('[data-program-root]').innerHTML=`<div class="empty-state">${esc(e.message||'Program belum dapat dimuat.')} <button class="btn btn-ghost" type="button" data-program-retry>Coba Lagi</button></div>`;$('[data-program-retry]')?.addEventListener('click',load)}finally{clearTimeout(timer)}
  }

  document.addEventListener('DOMContentLoaded',()=>{
    $('[data-lightbox-close]').onclick=()=>{$('[data-lightbox]').hidden=true};
    $('[data-lightbox-prev]').onclick=()=>selectImage(active-1);
    $('[data-lightbox-next]').onclick=()=>selectImage(active+1);
    $('[data-lightbox]').onclick=e=>{if(e.target.matches('[data-lightbox]'))e.currentTarget.hidden=true};
    $('[data-lightbox]')?.addEventListener('touchstart',e=>{touchStart=e.changedTouches?.[0]?.clientX||0},{passive:true});
    $('[data-lightbox]')?.addEventListener('touchend',e=>{const end=e.changedTouches?.[0]?.clientX||0;if(Math.abs(end-touchStart)>45)selectImage(active+(end<touchStart?1:-1))},{passive:true});
    load();
  });
})();
