(()=>{
  const $=(s,r=document)=>r.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':'&quot;'}[c]));
  const idr=v=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v)||0);
  const dt=v=>{if(!v)return'—';try{return new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(v))}catch{return String(v)}};
  let token='',timer=null,busy=false,lastStatus='',startedAt=Date.now();

  function terminal(s){return ['PAID','FAILED','EXPIRED','CANCELLED','REFUNDED'].includes(String(s||'').toUpperCase())}
  function shellAllocation(){
    try{
      const suffix=String(token||'').slice(-48);
      for(let i=0;i<sessionStorage.length;i++){
        const k=sessionStorage.key(i)||'';
        if(!k.startsWith('kia_payment_shell_')||!k.endsWith(suffix))continue;
        const x=JSON.parse(sessionStorage.getItem(k)||'null');
        const a=x?.data?.allocation_preview;
        if(a)return a;
      }
    }catch(_){}
    return null;
  }
  async function quick(){
    if(busy||!token||document.hidden)return null;busy=true;
    try{
      const r=await fetch(`${KIA_CONFIG.BACKEND_URL}/api/payments/quick-status?token=${encodeURIComponent(token)}`,{cache:'no-store'});
      const j=await r.json();if(!r.ok||!j.success)return null;
      const status=String(j.data?.payment?.status||'').toUpperCase();
      if(lastStatus&&status!==lastStatus&&terminal(status)){
        const u=new URL(location.href);u.searchParams.set('auto_status',status.toLowerCase());
        location.replace(u.toString());return j.data;
      }
      lastStatus=status;
      if(status==='PAID'&&!$('[data-payment-root]')?.classList.contains('payment-success')){
        const u=new URL(location.href);u.searchParams.set('auto_status','paid');
        location.replace(u.toString());return j.data;
      }
      return j.data;
    }catch(_){return null}
    finally{busy=false}
  }
  function schedule(){
    clearTimeout(timer);
    const elapsed=Date.now()-startedAt;
    const delay=elapsed<45000?3500:7000;
    timer=setTimeout(async()=>{const data=await quick();if(!terminal(data?.payment?.status))schedule()},delay);
  }

  function receipt(data){
    const d=data?.donation||{},p=data?.payment||{},program=data?.program||{},a=shellAllocation();
    const donor=(String(d.is_anonymous||'').toUpperCase()==='TRUE'||d.is_anonymous===true)?'Hamba Allah (Anonim)':(d.donor_name||'Donatur KIA');
    const split=a&&Number(a.excess_amount)>0?`
      <div class="split"><div><span>Masuk ke Program</span><b>${idr(a.program_amount)}</b></div><div><span>Dana Lebih</span><b>${idr(a.excess_amount)}</b></div></div>`:'';
    const html=`<!doctype html><html><head><meta charset="utf-8"><title>Bukti Donasi KIA</title><style>
      *{box-sizing:border-box}body{margin:0;padding:28px;background:#f5f7f5;color:#17201d;font-family:Arial,sans-serif}
      .sheet{max-width:720px;margin:auto;background:#fff;border:1px solid #dfe7e3;border-radius:20px;overflow:hidden}
      .head{padding:24px 26px;background:linear-gradient(135deg,#0f513d,#176b52);color:#fff}
      .brand{font-size:20px;font-weight:900}.brand small{display:block;margin-top:3px;font-size:10px;font-weight:400;color:#dcece6}
      .head h1{margin:20px 0 3px;font-size:24px}.status{font-size:11px;color:#dff4eb}
      .body{padding:24px 26px}.grid{display:grid;grid-template-columns:170px 1fr;gap:10px 16px;padding:17px 0;border-top:1px solid #e5ebe8;border-bottom:1px solid #e5ebe8}
      .grid span{color:#6b7771;font-size:11px}.grid b{text-align:right;font-size:12px}.split{margin-top:14px;padding:13px;border-radius:13px;background:#f2f8f5}
      .split>div{display:flex;justify-content:space-between;gap:15px;padding:5px 0}.split span{color:#5f6f68;font-size:11px}.split b{color:#176b52}
      .thanks{margin:20px 0 8px;font-size:16px;font-weight:800;color:#176b52}.note{font-size:10px;line-height:1.55;color:#69766f}
      .foot{padding:16px 26px;border-top:1px solid #e5ebe8;background:#fafcfb;font-size:9px;line-height:1.55;color:#6f7c76}
      @media print{body{padding:0;background:#fff}.sheet{border:0;border-radius:0}}
    </style></head><body><div class="sheet">
      <div class="head"><div class="brand">KIA — Donasi Online<small>Founded by Finance Tracker</small></div><h1>Bukti Donasi</h1><div class="status">✓ ${esc(String(p.status||'PAID').toUpperCase()==='PAID'?'Pembayaran berhasil':'Status '+String(p.status||''))}</div></div>
      <div class="body">
        <div class="grid">
          <span>Kode Donasi</span><b>${esc(d.donation_code||'—')}</b>
          <span>Tanggal</span><b>${esc(dt(p.paid_at||d.updated_at||''))}</b>
          <span>Donatur</span><b>${esc(donor)}</b>
          <span>Program</span><b>${esc(program.program_name||'Program KIA')}</b>
          <span>Nominal Donasi</span><b>${idr(d.gross_amount)}</b>
          <span>Metode Pembayaran</span><b>${esc(String(p.payment_method||'—').replaceAll('_',' '))}</b>
          <span>Status</span><b>${esc(String(p.status||'—'))}</b>
        </div>${split}
        <div class="thanks">Terima kasih telah menitipkan kebaikan melalui KIA.</div>
        <div class="note">Semoga setiap kebaikan yang dititipkan memberi manfaat bagi program yang Anda dukung.</div>
      </div>
      <div class="foot"><strong>Catatan atribusi donasi:</strong> Donasi ini tetap merupakan donasi dari donatur yang tercantum pada transaksi kepada program terkait. KIA berperan sebagai platform yang memfasilitasi proses pembayaran, pencatatan, transparansi, dan penyaluran. KIA tidak mengklaim donasi ini sebagai donasi yang berasal dari platform KIA.</div>
    </div><script>window.onload=()=>window.print()<\/script></body></html>`;
    const w=window.open('','_blank','width=780,height=980');if(!w)return;w.document.write(html);w.document.close();
  }
  async function freshStatus(){
    try{
      const r=await fetch(`${KIA_CONFIG.BACKEND_URL}/api/payments/quick-status?token=${encodeURIComponent(token)}`,{cache:'no-store'});
      const j=await r.json();return r.ok&&j.success?j.data:null;
    }catch{return null}
  }
  function bindPrint(){
    document.addEventListener('click',async e=>{
      const btn=e.target.closest?.('[data-print-receipt]');if(!btn)return;
      e.preventDefault();e.stopImmediatePropagation();
      btn.disabled=true;
      try{const data=await freshStatus();if(data)receipt(data)}
      finally{btn.disabled=false}
    },true);
  }
  function addAutoNote(){
    const root=$('[data-payment-root]');if(!root||root.querySelector('.payment-auto-note-v0510'))return;
    const obs=new MutationObserver(()=>{
      if(root.querySelector('.payment-auto-note-v0510'))return;
      const actions=root.querySelector('.payment-actions-v058');
      if(actions&&!root.classList.contains('payment-success')){
        actions.insertAdjacentHTML('beforebegin','<div class="payment-auto-note-v0510"><span class="material-symbols-outlined">sync</span><span>Status diperiksa otomatis. Tombol Sinkronkan Status hanya diperlukan sebagai fallback manual.</span></div>');
      }
    });obs.observe(root,{childList:true,subtree:true});setTimeout(()=>obs.takeRecords(),0);
  }

  document.addEventListener('DOMContentLoaded',()=>{
    token=new URLSearchParams(location.search).get('token')||'';if(!token)return;
    bindPrint();addAutoNote();setTimeout(async()=>{const d=await quick();if(!terminal(d?.payment?.status))schedule()},1600);
  });
  window.addEventListener('pageshow',()=>{if(token)setTimeout(quick,500)});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&token)setTimeout(quick,350)});
})();