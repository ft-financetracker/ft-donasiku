(()=>{
  const $=(s,r=document)=>r.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>'\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'\"':'&quot;'}[c]));
  const idr=v=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v)||0);
  const label=s=>({CREATED:'Menunggu aktivasi channel',PENDING:'Menunggu pembayaran',PAID:'Pembayaran berhasil',FAILED:'Pembayaran gagal',EXPIRED:'Pembayaran kedaluwarsa',CANCELLED:'Pembayaran dibatalkan'}[String(s||'').toUpperCase()]||s||'—');
  const method=s=>({QRIS:'QRIS',VIRTUAL_ACCOUNT:'Virtual Account'}[String(s||'').toUpperCase()]||s||'—');

  let token='',timer=null,current=null,lastProviderCheck=0,paidWarmStarted=false;
  const paymentShellKey=t=>'kia_payment_shell_v055_'+String(t||'').slice(-48);
  function cacheShell(data){try{sessionStorage.setItem(paymentShellKey(token),JSON.stringify({saved_at:Date.now(),data}))}catch(_){}}
  function readShell(){try{const x=JSON.parse(sessionStorage.getItem(paymentShellKey(token))||'null');return x&&Date.now()-Number(x.saved_at||0)<2*3600000?x.data:null}catch{return null}}
  function markPublicDirty(){const stamp=Date.now();try{localStorage.setItem('kia_public_invalidate_at',String(stamp));for(let i=localStorage.length-1;i>=0;i--){const k=localStorage.key(i)||'';if(/^kia_(?:public_bootstrap|catalog|program_detail)_v0?5(?:1|2|4|5)_/.test(k)||/^kia_(?:public_bootstrap|catalog|program_detail)_v05(?:1|2|4|5)/.test(k))localStorage.removeItem(k)}}catch(_){ }return stamp}
  async function safeJson(response){const raw=await response.text();try{return raw?JSON.parse(raw):null}catch{throw new Error(/^\s*</.test(raw||'')?'Server sedang memulai layanan. Status lokal tetap aman.':'Respons server status sementara tidak valid.')}}
  async function warmPublicAfterPaid(data){if(paidWarmStarted)return;paidWarmStarted=true;markPublicDirty();const programId=data?.donation?.program_id||data?.program?.program_id||'';try{const r=await fetch(`${KIA_CONFIG.BACKEND_URL}/api/public/bootstrap?paid_refresh=${Date.now()}`,{cache:'no-store'});const j=await safeJson(r);if(r.ok&&j?.success)localStorage.setItem('kia_public_bootstrap_v055',JSON.stringify({saved_at:Date.now(),data:j.data}))}catch(_){ }if(programId){try{const r=await fetch(`${KIA_CONFIG.BACKEND_URL}/api/public/programs/${encodeURIComponent(programId)}?paid_refresh=${Date.now()}`,{cache:'no-store'});const j=await safeJson(r);if(r.ok&&j?.success)localStorage.setItem('kia_program_detail_v055_'+programId,JSON.stringify({saved_at:Date.now(),data:j.data}))}catch(_){ }}}

  function terminal(status){return ['PAID','FAILED','EXPIRED','CANCELLED','REFUNDED'].includes(String(status||'').toUpperCase())}

  function schedule(status){
    clearTimeout(timer);
    if(terminal(status)||document.hidden)return;
    timer=setTimeout(()=>{
      const refreshProvider=Date.now()-lastProviderCheck>=65000;
      load(refreshProvider);
    },12000);
  }

  function reconciliationNote(data){
    const r=data?.reconciliation||{};
    if(r.failed){
      return '<div class="payment-shell-note"><strong>Status DOKU belum dapat disinkronkan.</strong><br>KIA tetap mempertahankan status lokal dan akan mencoba lagi otomatis.</div>';
    }
    if(r.checked&&r.provider_status==='SUCCESS'){
      return '<div class="payment-shell-note"><strong>Pembayaran terverifikasi ke DOKU.</strong><br>Status KIA telah direkonsiliasi dari Check Status API.</div>';
    }
    if(r.checked&&['FAILED','EXPIRED'].includes(String(r.provider_status||'').toUpperCase())){
      return `<div class="payment-shell-note"><strong>Status DOKU: ${esc(r.provider_status)}</strong><br>Silakan gunakan Ganti Metode untuk membuat payment attempt baru.</div>`;
    }
    return '';
  }

  function methodButtons(data,payment){
    const currentMethod=String(payment?.payment_method||'').toUpperCase();
    const sandbox=String(data?.doku_env||'').toLowerCase()==='sandbox';
    const currentTerminal=terminal(payment?.status);
    const buttons=[];
    if(currentMethod!=='VIRTUAL_ACCOUNT'||currentTerminal){
      buttons.push('<button class="btn btn-primary" type="button" data-method="VIRTUAL_ACCOUNT">Virtual Account</button>');
    }
    if(!sandbox&&(currentMethod!=='QRIS'||currentTerminal)){
      buttons.push('<button class="btn btn-ghost" type="button" data-method="QRIS">QRIS</button>');
    }
    if(!buttons.length){
      return '<span class="muted mini">Tidak ada metode alternatif yang tersedia pada environment ini.</span>';
    }
    return buttons.join('');
  }

  function render(data){
    current=data;cacheShell(data);
    const root=$('[data-payment-root]'),d=data.donation||{},p=data.payment||{},program=data.program||{};
    const status=String(p.status||'').toUpperCase(),paid=status==='PAID',failed=['FAILED','EXPIRED','CANCELLED'].includes(status);
    root.classList.toggle('payment-success',paid);
    root.classList.toggle('payment-failed',failed);
    if(paid)warmPublicAfterPaid(data);

    const icon=paid?'check_circle':failed?'error':'hourglass_top';
    const payAction=data.provider_ready&&p.payment_url&&!terminal(status)
      ? `<a class="btn btn-primary" href="${esc(p.payment_url)}"><span class="material-symbols-outlined">open_in_new</span> Lanjut ke Pembayaran</a>`
      : '';

    const providerNote=!data.provider_ready&&!paid
      ? '<div class="payment-shell-note"><strong>Channel pembayaran belum siap.</strong><br>Permintaan sudah dicatat. KIA akan tetap mengecek status lokal dan DOKU.</div>'
      : (!terminal(status)
        ? '<div class="payment-shell-note"><strong>Channel DOKU siap.</strong><br>Status PAID hanya ditetapkan setelah webhook atau Check Status DOKU tervalidasi.</div>'
        : '');

    const changeAction=!paid
      ? '<button class="btn btn-ghost" type="button" data-change-method><span class="material-symbols-outlined">swap_horiz</span> Ganti Metode</button>'
      : '';
    const successActions=paid
      ? `<a class="btn btn-primary" href="./program.html?id=${encodeURIComponent(d.program_id||'')}">Lihat Program</a><a class="btn btn-ghost" href="./">Kembali ke Beranda</a>`
      : '';
    const syncAction=!paid
      ? `<button class="btn ${payAction?'btn-ghost':'btn-primary'}" type="button" data-refresh-status><span class="material-symbols-outlined">sync</span> Sinkronkan Status</button>`
      : '';

    const attempt=Number(p.attempt_no)||1;
    root.innerHTML=`
      <div class="payment-state-icon"><span class="material-symbols-outlined">${icon}</span></div>
      <h1>${esc(label(p.status))}</h1>
      <div class="payment-code">${esc(d.donation_code||'')}</div>
      <p class="muted">${esc(program.program_name||'Program KIA')}</p>

      <div class="payment-details">
        <div><span>Nominal</span><strong>${idr(d.gross_amount)}</strong></div>
        <div><span>Metode Aktif</span><strong>${esc(method(p.payment_method))}</strong></div>
        <div><span>Payment Attempt</span><strong>#${attempt}</strong></div>
        <div><span>Status Donation</span><strong>${esc(d.status||'PENDING')}</strong></div>
        <div><span>Status Payment</span><strong>${esc(p.status||'CREATED')}</strong></div>
      </div>

      ${providerNote}
      ${reconciliationNote(data)}
      ${p.va_number?`<div class="payment-shell-note"><strong>Virtual Account</strong><br>${esc(p.va_number)}</div>`:''}

      <div class="payment-actions">
        ${successActions||payAction}
        ${syncAction}
        ${changeAction}
        ${paid?'':`<a class="btn btn-ghost" href="./program.html?id=${encodeURIComponent(d.program_id||'')}">Kembali ke Program</a>`}
      </div>

      <div class="payment-shell-note" data-method-picker hidden>
        <strong>Pilih metode baru</strong><br>
        <span class="muted mini">Donation tetap sama. KIA membuat Payment Attempt baru dan mempertahankan histori attempt sebelumnya.</span>
        <div class="payment-actions" style="margin-top:10px">${methodButtons(data,p)}</div>
        <div class="muted mini" data-method-status style="margin-top:8px"></div>
      </div>`;

    $('[data-refresh-status]')?.addEventListener('click',()=>load(true));
    $('[data-change-method]')?.addEventListener('click',()=>{
      const box=$('[data-method-picker]');
      box.hidden=!box.hidden;
    });
    root.querySelectorAll('[data-method]').forEach(btn=>btn.addEventListener('click',()=>changeMethod(btn.dataset.method)));
    schedule(p.status);
  }

  async function changeMethod(paymentMethod){
    const box=$('[data-method-picker]'),status=$('[data-method-status]');
    if(!box||!current)return;

    box.querySelectorAll('button').forEach(b=>b.disabled=true);
    status.textContent='Menyiapkan Payment Attempt baru…';

    const controller=new AbortController(),t=setTimeout(()=>controller.abort(),65000);
    try{
      const response=await fetch(`${KIA_CONFIG.BACKEND_URL}/api/payments/retry`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({token,payment_method:paymentMethod}),
        signal:controller.signal
      });
      const r=await safeJson(response);
      if(!response.ok||!r.success)throw new Error(r.message||'Metode pembayaran belum dapat diganti.');

      token=r.data.view_token;
      const nextUrl='./payment.html?token='+encodeURIComponent(token)+'&v=054&t='+Date.now();
      history.replaceState(null,'',nextUrl);

      // Render attempt baru langsung; tidak menunggu reload/cache browser.
      render({
        ...r.data,
        program:current.program||{},
        doku_env:current.doku_env||'',
        reconciliation:{checked:false,reason:'NEW_PAYMENT_ATTEMPT'}
      });
      status.textContent='';
      setTimeout(()=>load(false),700);
    }catch(e){
      status.textContent=e.message||'Metode pembayaran belum dapat diganti.';
      box.querySelectorAll('button').forEach(b=>b.disabled=false);
    }finally{
      clearTimeout(t);
    }
  }

  async function load(refreshProvider=false){
    const root=$('[data-payment-root]'),btn=$('[data-refresh-status]');
    const hadView=!!current;
    if(refreshProvider){
      lastProviderCheck=Date.now();
      if(btn){btn.disabled=true;btn.innerHTML='<span class="material-symbols-outlined">sync</span> Menyinkronkan…'}
    }

    let slowTimer=null;
    if(!hadView){
      slowTimer=setTimeout(()=>{
        if(!current)root.innerHTML='<div class="empty-state"><strong>Masih menyiapkan status pembayaran…</strong><br><span class="muted mini">Tidak perlu F5. KIA tetap menunggu server dan akan menampilkan data saat tersedia.</span></div>';
      },9000);
    }

    const controller=new AbortController(),t=setTimeout(()=>controller.abort(),refreshProvider?75000:38000);
    try{
      const suffix=refreshProvider?'&refresh=1':'';
      const response=await fetch(`${KIA_CONFIG.BACKEND_URL}/api/payments/status?token=${encodeURIComponent(token)}${suffix}`,{
        cache:'no-store',signal:controller.signal
      });
      const r=await safeJson(response);
      if(!response.ok||!r?.success)throw new Error(r?.message||'Status pembayaran gagal dimuat.');
      render(r.data);
      return true;
    }catch(e){
      // Jika shell/status sebelumnya sudah ada, jangan rusak card menjadi error/skeleton.
      if(!current){
        root.innerHTML=`<div class="empty-state">${esc(e.message||'Status pembayaran belum dapat dimuat.')} <button class="btn btn-ghost" type="button" data-retry-payment>Coba Lagi</button></div>`;
        $('[data-retry-payment]')?.addEventListener('click',()=>load(true));
      }else if(btn){
        btn.disabled=false;
        btn.innerHTML='<span class="material-symbols-outlined">sync</span> Sinkronkan Status';
      }
      schedule(current?.payment?.status||'PENDING');
      return false;
    }finally{
      clearTimeout(t);if(slowTimer)clearTimeout(slowTimer);root.dataset.loaded='1';
    }
  }

  document.addEventListener('visibilitychange' ,async()=>{
    if(document.hidden)return;
    await load(false);
    if(current&&!terminal(current.payment?.status))setTimeout(()=>load(true),350);
  });

  document.addEventListener('DOMContentLoaded',async()=>{
    token=new URLSearchParams(location.search).get('token')||'';
    if(!token){
      $('[data-payment-root]').innerHTML='<div class="empty-state">Tautan pembayaran tidak valid.</div>';
      return;
    }
    const cached=readShell();
    if(cached)render(cached);
    await load(false);
    if(current&&!terminal(current.payment?.status))setTimeout(()=>load(true),700);
  });
})();
