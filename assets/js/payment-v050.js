(()=>{
  const $=(s,r=document)=>r.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>'\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'\"':'&quot;'}[c]));
  const idr=v=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v)||0);
  const label=s=>({CREATED:'Menunggu aktivasi channel',PENDING:'Menunggu pembayaran',PAID:'Pembayaran berhasil',FAILED:'Pembayaran gagal',EXPIRED:'Pembayaran kedaluwarsa',CANCELLED:'Pembayaran dibatalkan'}[String(s||'').toUpperCase()]||s||'—');
  const method=s=>({QRIS:'QRIS',VIRTUAL_ACCOUNT:'Virtual Account'}[String(s||'').toUpperCase()]||s||'—');

  let token='',timer=null,current=null,lastProviderCheck=0;

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
    current=data;
    const root=$('[data-payment-root]'),d=data.donation||{},p=data.payment||{},program=data.program||{};
    const status=String(p.status||'').toUpperCase(),paid=status==='PAID',failed=['FAILED','EXPIRED','CANCELLED'].includes(status);
    root.classList.toggle('payment-success',paid);
    root.classList.toggle('payment-failed',failed);

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
        ${payAction}
        <button class="btn ${payAction?'btn-ghost':'btn-primary'}" type="button" data-refresh-status>
          <span class="material-symbols-outlined">sync</span> Sinkronkan Status
        </button>
        ${changeAction}
        <a class="btn btn-ghost" href="./program.html?id=${encodeURIComponent(d.program_id||'')}">Kembali ke Program</a>
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

    const controller=new AbortController(),t=setTimeout(()=>controller.abort(),22000);
    try{
      const response=await fetch(`${KIA_CONFIG.BACKEND_URL}/api/payments/retry`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({token,payment_method:paymentMethod}),
        signal:controller.signal
      });
      const r=await response.json();
      if(!response.ok||!r.success)throw new Error(r.message||'Metode pembayaran belum dapat diganti.');

      token=r.data.view_token;
      const nextUrl='./payment.html?token='+encodeURIComponent(token)+'&v=053&t='+Date.now();
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
    if(refreshProvider){
      lastProviderCheck=Date.now();
      if(btn){
        btn.disabled=true;
        btn.innerHTML='<span class="material-symbols-outlined">sync</span> Menyinkronkan…';
      }
    }

    const controller=new AbortController(),t=setTimeout(()=>controller.abort(),18000);
    try{
      const suffix=refreshProvider?'&refresh=1':'';
      const response=await fetch(`${KIA_CONFIG.BACKEND_URL}/api/payments/status?token=${encodeURIComponent(token)}${suffix}`,{
        cache:'no-store',
        signal:controller.signal
      });
      const r=await response.json();
      if(!response.ok||!r.success)throw new Error(r.message||'Status pembayaran gagal dimuat.');
      render(r.data);
    }catch(e){
      if(refreshProvider||!root.dataset.loaded){
        root.innerHTML=`<div class="empty-state">${esc(e.message||'Status pembayaran belum dapat dimuat.')} <button class="btn btn-ghost" type="button" data-retry-payment>Coba Lagi</button></div>`;
        $('[data-retry-payment]')?.addEventListener('click',()=>load(true));
      }
      schedule('PENDING');
    }finally{
      clearTimeout(t);
      root.dataset.loaded='1';
    }
  }

  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden)load(Date.now()-lastProviderCheck>=65000);
  });

  document.addEventListener('DOMContentLoaded',()=>{
    token=new URLSearchParams(location.search).get('token')||'';
    if(!token){
      $('[data-payment-root]').innerHTML='<div class="empty-state">Tautan pembayaran tidak valid.</div>';
      return;
    }
    // Initial load sekaligus mencoba recovery transaksi lama yang tertahan PENDING.
    load(true);
  });
})();
