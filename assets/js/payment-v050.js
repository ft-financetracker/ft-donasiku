(()=>{
  const $=(s,r=document)=>r.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':'&quot;'}[c]));
  const idr=v=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v)||0);
  const label=s=>({CREATED:'Menunggu aktivasi channel',PENDING:'Menunggu pembayaran',PAID:'Pembayaran berhasil',FAILED:'Pembayaran gagal',EXPIRED:'Pembayaran kedaluwarsa',CANCELLED:'Pembayaran dibatalkan'}[String(s||'').toUpperCase()]||s||'—');
  const method=s=>({QRIS:'QRIS',VIRTUAL_ACCOUNT:'Virtual Account'}[String(s||'').toUpperCase()]||s||'—');
  let token='';

  function render(data){
    const root=$('[data-payment-root]'),d=data.donation||{},p=data.payment||{},program=data.program||{};
    const paid=String(p.status).toUpperCase()==='PAID';
    const failed=['FAILED','EXPIRED','CANCELLED'].includes(String(p.status).toUpperCase());
    root.classList.toggle('payment-success',paid);root.classList.toggle('payment-failed',failed);
    const icon=paid?'check_circle':failed?'error':'hourglass_top';
    root.innerHTML=`<div class="payment-state-icon"><span class="material-symbols-outlined">${icon}</span></div><h1>${esc(label(p.status))}</h1><div class="payment-code">${esc(d.donation_code||'')}</div><p class="muted">${esc(program.program_name||'Program KIA')}</p><div class="payment-details"><div><span>Nominal</span><strong>${idr(d.gross_amount)}</strong></div><div><span>Metode</span><strong>${esc(method(p.payment_method))}</strong></div><div><span>Status Donation</span><strong>${esc(d.status||'PENDING')}</strong></div><div><span>Status Payment</span><strong>${esc(p.status||'CREATED')}</strong></div></div>${!data.provider_ready?'<div class="payment-shell-note"><strong>Channel pembayaran belum aktif.</strong><br>Permintaan pembayaran sudah dicatat, tetapi QRIS/Virtual Account belum diterbitkan. Donasi belum dianggap lunas sebelum status pembayaran tervalidasi.</div>':''}${p.va_number?`<div class="payment-shell-note"><strong>Virtual Account</strong><br>${esc(p.va_number)}</div>`:''}<div class="payment-actions"><button class="btn btn-primary" type="button" data-refresh-status><span class="material-symbols-outlined">refresh</span> Cek Status</button><a class="btn btn-ghost" href="./program.html?id=${encodeURIComponent(d.program_id||'')}">Kembali ke Program</a></div>`;
    $('[data-refresh-status]')?.addEventListener('click',load);
  }

  async function load(){
    const root=$('[data-payment-root]');
    const btn=$('[data-refresh-status]');if(btn){btn.disabled=true;btn.textContent='Memeriksa…'}
    try{const r=await fetch(`${KIA_CONFIG.BACKEND_URL}/api/payments/status?token=${encodeURIComponent(token)}`,{cache:'no-store'}).then(x=>x.json());if(!r.success)throw new Error(r.message||'Status pembayaran gagal dimuat.');render(r.data)}catch(e){root.innerHTML=`<div class="empty-state">${esc(e.message||'Status pembayaran belum dapat dimuat.')}</div>`}
  }

  document.addEventListener('DOMContentLoaded',()=>{token=new URLSearchParams(location.search).get('token')||'';if(!token){$('[data-payment-root]').innerHTML='<div class="empty-state">Tautan pembayaran tidak valid.</div>';return}load()});
})();
