(()=>{
  const $=(s,r=document)=>r.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>'\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'\"':'&quot;'}[c]));
  const idr=v=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v)||0);
  const dt=v=>{if(!v)return'—';try{return new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(v))}catch{return String(v)}};
  const label=s=>({CREATED:'Menunggu aktivasi channel',PENDING:'Menunggu pembayaran',PAID:'Pembayaran berhasil',FAILED:'Pembayaran gagal',EXPIRED:'Pembayaran kedaluwarsa',CANCELLED:'Pembayaran dibatalkan',REFUNDED:'Pembayaran direfund'}[String(s||'').toUpperCase()]||s||'—');
  const method=s=>({QRIS:'QRIS',VIRTUAL_ACCOUNT:'Virtual Account'}[String(s||'').toUpperCase()]||s||'—');

  let token='',timer=null,current=null,lastProviderCheck=0,paidWarmStarted=false,hero=null,quietSyncBusy=false,manualSyncBusy=false;
  const shellKey=t=>'kia_payment_shell_v058_'+String(t||'').slice(-48);
  const legacyKeys=t=>['kia_payment_shell_v057_','kia_payment_shell_v056_','kia_payment_shell_v055_'].map(x=>x+String(t||'').slice(-48));
  function cacheShell(data){try{sessionStorage.setItem(shellKey(token),JSON.stringify({saved_at:Date.now(),data}))}catch(_){}}
  function readShell(){try{for(const k of [shellKey(token),...legacyKeys(token)]){const x=JSON.parse(sessionStorage.getItem(k)||'null');if(x&&Date.now()-Number(x.saved_at||0)<2*3600000)return x.data}return null}catch{return null}}
  function terminal(s){return ['PAID','FAILED','EXPIRED','CANCELLED','REFUNDED'].includes(String(s||'').toUpperCase())}
  function safeJsonResponse(r){return r.text().then(raw=>{try{return raw?JSON.parse(raw):null}catch{throw new Error(/^\s*</.test(raw||'')?'Server sedang memulai layanan. Status pembayaran tetap aman.':'Respons server status sementara tidak valid.')}})}
  function markPublicDirty(){const stamp=Date.now();try{localStorage.setItem('kia_public_invalidate_at',String(stamp));for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i)||'';if(/^kia_(?:public_bootstrap|catalog|program_detail)_v0?5/.test(k))localStorage.removeItem(k)}}catch(_){ }return stamp}
  async function warmPublicAfterPaid(data){if(paidWarmStarted)return;paidWarmStarted=true;markPublicDirty();const programId=data?.donation?.program_id||'';try{const r=await fetch(`${KIA_CONFIG.BACKEND_URL}/api/public/bootstrap?paid_refresh=${Date.now()}`,{cache:'no-store'});const j=await safeJsonResponse(r);if(r.ok&&j?.success)localStorage.setItem('kia_public_bootstrap_v058',JSON.stringify({saved_at:Date.now(),data:j.data}))}catch(_){ }if(programId){try{const r=await fetch(`${KIA_CONFIG.BACKEND_URL}/api/public/programs/${encodeURIComponent(programId)}?paid_refresh=${Date.now()}`,{cache:'no-store'});const j=await safeJsonResponse(r);if(r.ok&&j?.success)localStorage.setItem('kia_program_detail_v058_'+programId,JSON.stringify({saved_at:Date.now(),data:j.data}))}catch(_){ }}}

  async function loadHero(){
    try{
      const cached=JSON.parse(localStorage.getItem('kia_public_bootstrap_v058')||'null')?.data||JSON.parse(localStorage.getItem('kia_public_bootstrap_v057')||'null')?.data;
      if(cached)applyHero(cached);
      const r=await fetch(`${KIA_CONFIG.BACKEND_URL}/api/public/bootstrap`,{cache:'default'});const j=await safeJsonResponse(r);if(r.ok&&j?.success)applyHero(j.data);
    }catch(_){applyHero(null)}
  }
  function applyHero(data){
    const settings=data?.settings||{},h=(data?.heroes||[])[2]||(data?.heroes||[])[0]||{};
    hero={
      image:settings.payment_hero_image_url||h.image_url||'./assets/images/hero/hero-3.png',
      title:settings.payment_hero_title||h.title||'Kebaikan Anda sedang diproses',
      subtitle:settings.payment_hero_subtitle||h.subtitle||'Status pembayaran diperbarui otomatis setelah transaksi tervalidasi.'
    };
    const box=$('[data-payment-hero]');if(!box)return;box.style.backgroundImage=`linear-gradient(90deg,rgba(7,41,31,.88),rgba(7,41,31,.40),rgba(7,41,31,.08)),url("${hero.image}")`;
    $('[data-payment-hero-title]').textContent=hero.title;$('[data-payment-hero-subtitle]').textContent=hero.subtitle;
  }

  function schedule(status){
    clearTimeout(timer);if(terminal(status)||document.hidden)return;
    timer=setTimeout(async()=>{
      await load(false,{quiet:true});
      if(!current||terminal(current.payment?.status))return;
      // provider inquiry hanya fallback, bukan tombol autoplay. Tombol manual tidak disentuh.
      if(Date.now()-lastProviderCheck>45000)await load(true,{quiet:true});
      schedule(current?.payment?.status||'PENDING');
    },5000);
  }

  function receiptHtml(data){const d=data?.donation||{},p=data?.payment||{},program=data?.program||{};return `<div class="receipt-v058"><div class="receipt-brand-v058"><strong>KIA — Donasi Online</strong><span>Founded by Finance Tracker</span></div><h2>Struk Pembayaran Donasi</h2><div class="receipt-grid-v058"><span>Kode Donasi</span><b>${esc(d.donation_code||'—')}</b><span>Program</span><b>${esc(program.program_name||'Program KIA')}</b><span>Nominal</span><b>${idr(d.gross_amount)}</b><span>Metode</span><b>${esc(method(p.payment_method))}</b><span>Status</span><b>${esc(label(p.status))}</b><span>Waktu</span><b>${esc(dt(p.paid_at||d.updated_at||''))}</b></div><small>Struk ini merupakan bukti status yang tercatat di KIA. Validasi pembayaran tetap berasal dari DOKU/server.</small></div>`}
  function printReceipt(){if(!current)return;const w=window.open('','_blank','width=760,height=900');if(!w)return;w.document.write(`<!doctype html><html><head><title>Struk KIA</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#17201d}.receipt-v058{max-width:640px;margin:auto;border:1px solid #dfe7e3;border-radius:18px;padding:24px}.receipt-brand-v058{display:grid;gap:3px;color:#176b52}.receipt-brand-v058 span{font-size:11px;color:#69736f}.receipt-grid-v058{display:grid;grid-template-columns:150px 1fr;gap:10px 16px;padding:18px 0;border-top:1px solid #e5ebe8;border-bottom:1px solid #e5ebe8;margin:16px 0}.receipt-grid-v058 span{color:#6b7771;font-size:12px}.receipt-grid-v058 b{text-align:right}small{color:#7b8580}@media print{body{padding:0}.receipt-v058{border:0}}</style></head><body>${receiptHtml(current)}<script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close()}

  function reconciliationNote(data){const r=data?.reconciliation||{};if(r.failed)return '<div class="payment-shell-note is-warning-v058"><strong>Status provider belum tersinkron.</strong><br>KIA akan mencoba lagi otomatis; transaksi lokal tidak berubah sembarangan.</div>';if(r.checked&&r.provider_status==='SUCCESS')return '<div class="payment-shell-note is-success-v058"><strong>Pembayaran terverifikasi.</strong><br>Status berhasil direkonsiliasi dari DOKU.</div>';return ''}

  function methodOptions(data,p){const cur=String(p?.payment_method||'').toUpperCase(),sandbox=String(data?.doku_env||'').toLowerCase()==='sandbox';let html='';if(cur!=='VIRTUAL_ACCOUNT'||terminal(p?.status))html+='<button class="payment-method-choice-v058" data-method="VIRTUAL_ACCOUNT"><span class="material-symbols-outlined">account_balance</span><b>Virtual Account</b><small>Gunakan pilihan bank di DOKU Checkout.</small></button>';if(!sandbox&&(cur!=='QRIS'||terminal(p?.status)))html+='<button class="payment-method-choice-v058" data-method="QRIS"><span class="material-symbols-outlined">qr_code_2</span><b>QRIS</b><small>Scan dengan aplikasi bank/e-wallet.</small></button>';return html||'<p class="muted mini">Tidak ada metode alternatif pada environment ini.</p>'}

  function render(data){
    const prevStatus=String(current?.payment?.status||'').toUpperCase();current=data;cacheShell(data);
    const root=$('[data-payment-root]'),d=data.donation||{},p=data.payment||{},program=data.program||{},status=String(p.status||'').toUpperCase();
    const paid=status==='PAID',failed=['FAILED','EXPIRED','CANCELLED'].includes(status),attempt=Number(p.attempt_no)||1;
    root.classList.toggle('payment-success',paid);root.classList.toggle('payment-failed',failed);if(paid)warmPublicAfterPaid(data);
    const icon=paid?'check_circle':failed?'error':'hourglass_top';
    const payAction=data.provider_ready&&p.payment_url&&!terminal(status)?`<a class="btn btn-primary action-main-v058" href="${esc(p.payment_url)}"><span class="material-symbols-outlined">open_in_new</span><span>Lanjut ke Pembayaran</span></a>`:'';
    const providerNote=!data.provider_ready&&!paid?'<div class="payment-shell-note"><strong>Channel pembayaran belum siap.</strong><br>KIA tetap menyimpan transaksi dan memeriksa status secara aman.</div>':'';
    root.innerHTML=`<div class="payment-card-head-v058"><div class="payment-state-icon"><span class="material-symbols-outlined">${icon}</span></div><div><span class="payment-eyebrow-v058">PAYMENT ATTEMPT #${attempt}</span><h1>${esc(label(p.status))}</h1><div class="payment-code">${esc(d.donation_code||'')}</div></div></div><p class="payment-program-v058">${esc(program.program_name||'Program KIA')}</p>
    <div class="payment-details"><div><span>Nominal</span><strong>${idr(d.gross_amount)}</strong></div><div><span>Metode Aktif</span><strong>${esc(method(p.payment_method))}</strong></div><div><span>Status Donation</span><strong>${esc(d.status||'PENDING')}</strong></div><div><span>Status Payment</span><strong>${esc(p.status||'CREATED')}</strong></div>${p.va_number?`<div><span>Virtual Account</span><strong class="payment-va-v058">${esc(p.va_number)}</strong></div>`:''}</div>
    ${providerNote}${reconciliationNote(data)}
    ${!paid?'<div class="auto-status-v058"><span class="auto-dot-v058"></span><span>Status diperiksa otomatis. Tombol Sinkronkan hanya untuk pengecekan manual.</span></div>':''}
    <div class="payment-actions-v058">${paid?`<a class="btn btn-primary action-main-v058" href="./program.html?id=${encodeURIComponent(d.program_id||'')}"><span class="material-symbols-outlined">volunteer_activism</span><span>Lihat Program</span></a><button class="btn btn-soft" type="button" data-print-receipt><span class="material-symbols-outlined">receipt_long</span><span>Cetak Struk</span></button><a class="btn btn-ghost" href="./"><span class="material-symbols-outlined">home</span><span>Beranda</span></a>`:`${payAction}<button class="btn btn-ghost" type="button" data-refresh-status><span class="material-symbols-outlined">sync</span><span>Sinkronkan Status</span></button><button class="btn btn-ghost" type="button" data-change-method><span class="material-symbols-outlined">swap_horiz</span><span>Ganti Metode</span></button><a class="btn btn-ghost" href="./program.html?id=${encodeURIComponent(d.program_id||'')}"><span class="material-symbols-outlined">arrow_back</span><span>Kembali</span></a>`}</div>
    <div class="method-panel-v058" data-method-picker hidden><div class="method-panel-head-v058"><div><strong>Ganti metode pembayaran</strong><p>Donation tetap sama. KIA membuat Payment Attempt baru.</p></div><button type="button" class="method-close-v058" data-method-close>×</button></div><div class="method-choice-grid-v058">${methodOptions(data,p)}</div><div class="method-progress-v058" data-method-status></div></div>`;
    $('[data-refresh-status]')?.addEventListener('click',()=>load(true,{quiet:false}));
    $('[data-change-method]')?.addEventListener('click',()=>{$('[data-method-picker]').hidden=false});
    $('[data-method-close]')?.addEventListener('click',()=>{$('[data-method-picker]').hidden=true});
    root.querySelectorAll('[data-method]').forEach(b=>b.addEventListener('click',()=>changeMethod(b.dataset.method,b)));
    $('[data-print-receipt]')?.addEventListener('click',printReceipt);
    if(prevStatus&&prevStatus!=='PAID'&&paid)root.animate?.([{transform:'scale(.99)',opacity:.8},{transform:'scale(1)',opacity:1}],{duration:280,easing:'ease-out'});
    schedule(status);
  }

  async function changeMethod(paymentMethod,button){
    if(!current)return;const panel=$('[data-method-picker]'),status=$('[data-method-status]');panel?.querySelectorAll('button').forEach(b=>b.disabled=true);button?.classList.add('is-loading');status.textContent='Menyiapkan Payment Attempt baru…';
    const c=new AbortController(),t=setTimeout(()=>c.abort(),45000);
    try{const r=await fetch(`${KIA_CONFIG.BACKEND_URL}/api/payments/retry`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,payment_method:paymentMethod}),signal:c.signal});const j=await safeJsonResponse(r);if(!r.ok||!j.success)throw new Error(j.message||'Metode pembayaran belum dapat diganti.');const previous=current;token=j.data.view_token;history.replaceState(null,'','./payment.html?token='+encodeURIComponent(token)+'&v=058&t='+Date.now());render({...j.data,program:previous?.program||j.data?.program||{},doku_env:previous?.doku_env||j.data?.doku_env||'',reconciliation:{checked:false,reason:'NEW_PAYMENT_ATTEMPT'}});setTimeout(()=>load(false,{quiet:true}),300)}catch(e){status.textContent=e.message||'Metode pembayaran belum dapat diganti.';panel?.querySelectorAll('button').forEach(b=>b.disabled=false);button?.classList.remove('is-loading')}finally{clearTimeout(t)}}

  async function load(refreshProvider=false,{quiet=false}={}){
    if((quiet&&quietSyncBusy)||(!quiet&&manualSyncBusy))return false;if(quiet)quietSyncBusy=true;else manualSyncBusy=true;
    const root=$('[data-payment-root]'),btn=$('[data-refresh-status]');if(refreshProvider)lastProviderCheck=Date.now();if(!quiet&&btn){btn.disabled=true;btn.querySelector('span:last-child')&&(btn.querySelector('span:last-child').textContent='Menyinkronkan…')}
    const c=new AbortController(),t=setTimeout(()=>c.abort(),refreshProvider?35000:18000);
    try{const suffix=refreshProvider?'&refresh=1':'';const r=await fetch(`${KIA_CONFIG.BACKEND_URL}/api/payments/status?token=${encodeURIComponent(token)}${suffix}`,{cache:'no-store',signal:c.signal});const j=await safeJsonResponse(r);if(!r.ok||!j?.success)throw new Error(j?.message||'Status pembayaran gagal dimuat.');render(j.data);return true}catch(e){if(!current)root.innerHTML=`<div class="payment-soft-error-v058"><strong>Status masih disiapkan</strong><span>${esc(e.message||'Server merespons lebih lambat. KIA akan mencoba lagi otomatis.')}</span><button class="btn btn-ghost" type="button" data-retry-payment>Coba Sekarang</button></div>`,$('[data-retry-payment]')?.addEventListener('click',()=>load(true,{quiet:false}));schedule(current?.payment?.status||'PENDING');return false}finally{clearTimeout(t);if(quiet)quietSyncBusy=false;else manualSyncBusy=false;if(!quiet&&btn){btn.disabled=false;const t=btn.querySelector('span:last-child');if(t)t.textContent='Sinkronkan Status'}}
  }

  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&current&&!terminal(current.payment?.status)){load(false,{quiet:true});setTimeout(()=>load(true,{quiet:true}),900)}});
  document.addEventListener('DOMContentLoaded',async()=>{token=new URLSearchParams(location.search).get('token')||'';loadHero();if(!token){$('[data-payment-root]').innerHTML='<div class="empty-state">Tautan pembayaran tidak valid.</div>';return}const cached=readShell();if(cached)render(cached);else $('[data-payment-root]').innerHTML='<div class="payment-first-load-v058"><div class="payment-state-icon"><span class="material-symbols-outlined">hourglass_top</span></div><strong>Menyiapkan status pembayaran</strong><span>KIA sedang membaca status transaksi terbaru.</span></div>';await load(false,{quiet:true});if(current&&!terminal(current.payment?.status))setTimeout(()=>load(true,{quiet:true}),7000)});
})();
