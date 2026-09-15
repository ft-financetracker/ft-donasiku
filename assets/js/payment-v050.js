(()=>{
  const $=(s,r=document)=>r.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>'\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'\"':'&quot;'}[c]));
  const idr=v=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v)||0);
  const label=s=>({CREATED:'Menunggu aktivasi channel',PENDING:'Menunggu pembayaran',PAID:'Pembayaran berhasil',FAILED:'Pembayaran gagal',EXPIRED:'Pembayaran kedaluwarsa',CANCELLED:'Pembayaran dibatalkan'}[String(s||'').toUpperCase()]||s||'—');
  const method=s=>({QRIS:'QRIS',VIRTUAL_ACCOUNT:'Virtual Account'}[String(s||'').toUpperCase()]||s||'—');
  let token='',timer=null,current=null;

  function terminal(status){return ['PAID','FAILED','EXPIRED','CANCELLED','REFUNDED'].includes(String(status||'').toUpperCase())}
  function schedule(status){clearTimeout(timer);if(!terminal(status)&&!document.hidden)timer=setTimeout(load,7000)}

  function render(data){
    current=data;
    const root=$('[data-payment-root]'),d=data.donation||{},p=data.payment||{},program=data.program||{};
    const status=String(p.status||'').toUpperCase(),paid=status==='PAID',failed=['FAILED','EXPIRED','CANCELLED'].includes(status);
    root.classList.toggle('payment-success',paid);root.classList.toggle('payment-failed',failed);
    const icon=paid?'check_circle':failed?'error':'hourglass_top';
    const payAction=data.provider_ready&&p.payment_url&&!terminal(status)?`<a class="btn btn-primary" href="${esc(p.payment_url)}"><span class="material-symbols-outlined">open_in_new</span> Lanjut ke Pembayaran</a>`:'';
    const providerNote=!data.provider_ready?'<div class="payment-shell-note"><strong>Channel pembayaran belum aktif.</strong><br>Permintaan sudah dicatat. Anda dapat cek status atau mengganti metode pembayaran.</div>':(!terminal(status)?'<div class="payment-shell-note"><strong>Channel DOKU siap.</strong><br>Tekan “Lanjut ke Pembayaran”. Status KIA menjadi PAID hanya setelah notifikasi pembayaran tervalidasi.</div>':'');
    const changeAction=!paid?'<button class="btn btn-ghost" type="button" data-change-method><span class="material-symbols-outlined">swap_horiz</span> Ganti Metode</button>':'';
    root.innerHTML=`<div class="payment-state-icon"><span class="material-symbols-outlined">${icon}</span></div><h1>${esc(label(p.status))}</h1><div class="payment-code">${esc(d.donation_code||'')}</div><p class="muted">${esc(program.program_name||'Program KIA')}</p><div class="payment-details"><div><span>Nominal</span><strong>${idr(d.gross_amount)}</strong></div><div><span>Metode</span><strong>${esc(method(p.payment_method))}</strong></div><div><span>Status Donation</span><strong>${esc(d.status||'PENDING')}</strong></div><div><span>Status Payment</span><strong>${esc(p.status||'CREATED')}</strong></div></div>${providerNote}${p.va_number?`<div class="payment-shell-note"><strong>Virtual Account</strong><br>${esc(p.va_number)}</div>`:''}<div class="payment-actions">${payAction}<button class="btn ${payAction?'btn-ghost':'btn-primary'}" type="button" data-refresh-status><span class="material-symbols-outlined">refresh</span> Cek Status</button>${changeAction}<a class="btn btn-ghost" href="./program.html?id=${encodeURIComponent(d.program_id||'')}">Kembali ke Program</a></div><div class="payment-shell-note" data-method-picker hidden><strong>Pilih metode baru</strong><br><span class="muted mini">Donation tetap sama. KIA hanya membuat payment attempt baru.</span><div class="payment-actions" style="margin-top:10px"><button class="btn btn-primary" type="button" data-method="QRIS">QRIS</button><button class="btn btn-ghost" type="button" data-method="VIRTUAL_ACCOUNT">Virtual Account</button></div><div class="muted mini" data-method-status style="margin-top:8px"></div></div>`;
    $('[data-refresh-status]')?.addEventListener('click',()=>load(true));
    $('[data-change-method]')?.addEventListener('click',()=>{const box=$('[data-method-picker]');box.hidden=!box.hidden});
    root.querySelectorAll('[data-method]').forEach(btn=>btn.addEventListener('click',()=>changeMethod(btn.dataset.method)));
    schedule(p.status);
  }

  async function changeMethod(paymentMethod){
    const box=$('[data-method-picker]'),status=$('[data-method-status]');
    if(!box||!current)return;
    box.querySelectorAll('button').forEach(b=>b.disabled=true);status.textContent='Menyiapkan metode pembayaran baru…';
    const controller=new AbortController(),t=setTimeout(()=>controller.abort(),22000);
    try{
      const response=await fetch(`${KIA_CONFIG.BACKEND_URL}/api/payments/retry`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,payment_method:paymentMethod}),signal:controller.signal});
      const r=await response.json();if(!response.ok||!r.success)throw new Error(r.message||'Metode pembayaran belum dapat diganti.');
      location.replace('./payment.html?token='+encodeURIComponent(r.data.view_token));
    }catch(e){status.textContent=e.message||'Metode pembayaran belum dapat diganti.';box.querySelectorAll('button').forEach(b=>b.disabled=false)}finally{clearTimeout(t)}
  }

  async function load(manual=false){
    const root=$('[data-payment-root]'),btn=$('[data-refresh-status]');if(manual&&btn){btn.disabled=true;btn.textContent='Memeriksa…'}
    const controller=new AbortController(),t=setTimeout(()=>controller.abort(),10000);
    try{const response=await fetch(`${KIA_CONFIG.BACKEND_URL}/api/payments/status?token=${encodeURIComponent(token)}`,{cache:'no-store',signal:controller.signal});const r=await response.json();if(!response.ok||!r.success)throw new Error(r.message||'Status pembayaran gagal dimuat.');render(r.data)}
    catch(e){if(manual||!root.dataset.loaded)root.innerHTML=`<div class="empty-state">${esc(e.message||'Status pembayaran belum dapat dimuat.')} <button class="btn btn-ghost" type="button" data-retry-payment>Coba Lagi</button></div>`;$('[data-retry-payment]')?.addEventListener('click',()=>load(true));schedule('PENDING')}
    finally{clearTimeout(t);root.dataset.loaded='1'}
  }

  document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});
  document.addEventListener('DOMContentLoaded',()=>{token=new URLSearchParams(location.search).get('token')||'';if(!token){$('[data-payment-root]').innerHTML='<div class="empty-state">Tautan pembayaran tidak valid.</div>';return}load()});
})();
