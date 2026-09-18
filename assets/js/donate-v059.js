(()=>{
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  const idr=v=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v)||0);
  let program=null,step=1,submitting=false,busyRestore=[];

  function openStep(next){step=next;$$('[data-step-panel]').forEach(p=>p.hidden=Number(p.dataset.stepPanel)!==step);$$('[data-step-jump]').forEach(b=>b.classList.toggle('is-active',Number(b.dataset.stepJump)===step));window.scrollTo({top:0,behavior:'smooth'})}
  function amount(){return Math.floor(Number($('#donationForm').elements.gross_amount.value)||0)}
  function funding(){
    const donation=Math.max(0,amount());
    const target=Math.max(0,Number(program?.target_amount)||0);
    const raised=Math.max(0,Number(program?.raised_amount)||0);
    if(!target)return {donation,target,raised,remaining:0,programAmount:donation,excessAmount:0,completed:false};
    const remaining=Math.max(target-raised,0);
    const programAmount=Math.min(donation,remaining);
    const excessAmount=Math.max(donation-programAmount,0);
    return {donation,target,raised,remaining,programAmount,excessAmount,completed:raised>=target};
  }
  function syncSummary(){
    const f=funding();
    $('[data-summary-amount]').textContent=idr(f.donation);
    const status=$('[data-summary-status]');
    if(status)status.textContent=f.completed?'100% Selesai':'Aktif';
    const box=$('[data-overflow-breakdown]');
    if(!box)return;
    if(!program||f.excessAmount<=0){box.hidden=true;return}
    box.hidden=false;
    $('[data-target-remaining]').textContent=idr(f.remaining);
    $('[data-program-allocation]').textContent=idr(f.programAmount);
    $('[data-excess-allocation]').textContent=idr(f.excessAmount);
    const notice=$('[data-overflow-notice]');
    if(notice)notice.textContent=f.completed
      ?'Target program sudah tercapai. Donasi Anda akan dihimpun pada Dana Lebih.'
      :'Kelebihan donasi akan dihimpun pada Dana Lebih.';
  }
  function validateStep(n){
    const f=$('#donationForm');
    if(n===1&&amount()<1000){showStatus('Nominal donasi minimal Rp1.000.');return false}
    if(n===2&&!String(f.elements.donor_name.value||'').trim()){showStatus('Nama donatur wajib diisi.');return false}
    hideStatus();return true
  }
  function showStatus(msg,kind='error'){const el=$('[data-checkout-status]');el.hidden=false;el.classList.toggle('is-info',kind==='info');el.textContent=msg}
  function hideStatus(){const el=$('[data-checkout-status]');el.hidden=true;el.classList.remove('is-info');el.textContent=''}
  function paymentShellKey(token){return 'kia_payment_shell_v056_'+String(token||'').slice(-48)}
  function setCheckoutBusy(busy){
    const card=$('.checkout-card');if(!card)return;card.classList.toggle('is-busy',busy);card.setAttribute('aria-busy',busy?'true':'false');
    if(busy){busyRestore=$$('.checkout-card input,.checkout-card textarea,.checkout-card select,.checkout-card button').map(el=>[el,el.disabled]);busyRestore.forEach(([el])=>el.disabled=true)}
    else{busyRestore.forEach(([el,was])=>el.disabled=was);busyRestore=[]}
  }
  function fillProgram(){
    const cover=(program.media||[]).find(x=>x.is_cover)||(program.media||[])[0];
    const url=cover?.public_url||program.cover_image_url||'';
    $('[data-summary-poster]').style.backgroundImage=url?`url("${url}")`:'';
    $('[data-summary-category]').textContent=program.category||'Program KIA';
    $('[data-summary-title]').textContent=program.program_name||'Program KIA';
    syncSummary();
  }
  function prefillUser(){
    const user=window.KiaAuth?.getUser?.();if(!user)return;
    const f=$('#donationForm');
    if(!f.elements.donor_name.value)f.elements.donor_name.value=user.full_name||'';
    if(!f.elements.donor_email.value)f.elements.donor_email.value=user.email||'';
  }
  async function loadProgram(){
    const id=new URLSearchParams(location.search).get('program_id');
    if(!id){showStatus('Program tidak ditemukan.');return}
    let cached=null;
    try{
      for(const key of ['kia_program_detail_v059_'+id,'kia_program_detail_v058_'+id,'kia_program_detail_v056_'+id,'kia_program_detail_v055_'+id,'kia_program_detail_v054_'+id,'kia_program_detail_v052_'+id,'kia_program_detail_v051_'+id]){
        const x=JSON.parse(localStorage.getItem(key)||'null');
        if(x&&Date.now()-x.saved_at<6*3600000){cached=x.data;break}
      }
    }catch{}
    if(cached?.program){program=cached.program;fillProgram();prefillUser()}
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),cached?22000:32000);
    try{
      const response=await fetch(`${KIA_CONFIG.BACKEND_URL}/api/public/programs/${encodeURIComponent(id)}`,{signal:controller.signal});
      const raw=await response.text();let r;try{r=JSON.parse(raw)}catch{throw new Error('Server program sementara belum siap. Silakan tunggu sebentar.')}
      if(!response.ok||!r.success)throw new Error(r.message||'Program tidak ditemukan.');
      program=r.data.program;
      try{localStorage.setItem('kia_program_detail_v059_'+id,JSON.stringify({saved_at:Date.now(),data:r.data}))}catch{}
      fillProgram();prefillUser();
    }catch(e){if(!cached)showStatus(e.message||'Program belum dapat dimuat.')}finally{clearTimeout(timer)}
  }
  async function submit(e){
    e.preventDefault();
    if(submitting||!validateStep(1)||!validateStep(2)||!program)return;
    const f=e.currentTarget,btn=$('[data-submit-donation]');
    const allocation=funding();
    const payload={program_id:program.program_id,gross_amount:amount(),donor_name:f.elements.donor_name.value.trim(),donor_email:f.elements.donor_email.value.trim(),donor_phone:f.elements.donor_phone.value.trim(),is_anonymous:f.elements.is_anonymous.checked,message:f.elements.message.value.trim(),payment_method:f.elements.payment_method.value};
    submitting=true;setCheckoutBusy(true);btn.textContent='Menyiapkan pembayaran…';hideStatus();
    const slow1=setTimeout(()=>showStatus('KIA masih menyiapkan payment channel. Data donasi tetap diproses, mohon jangan muat ulang halaman.','info'),8000);
    const slow2=setTimeout(()=>showStatus('Proses sedikit lebih lama dari biasanya. KIA masih menunggu gateway pembayaran dan belum menganggap proses gagal.','info'),20000);
    try{
      const r=await KiaAuth.request('/api/donations/checkout',{method:'POST',body:JSON.stringify(payload),timeout:65000,attempts:1});
      const token=String(r.data?.view_token||'');
      if(!token)throw new Error('Tautan pembayaran belum tersedia.');
      r.data.allocation_preview={
        gross_amount:allocation.donation,
        target_amount:allocation.target,
        raised_amount:allocation.raised,
        remaining_target:allocation.remaining,
        program_amount:allocation.programAmount,
        excess_amount:allocation.excessAmount,
        completed_before_payment:allocation.completed
      };
      try{sessionStorage.setItem(paymentShellKey(token),JSON.stringify({saved_at:Date.now(),data:r.data}))}catch(_){}
      location.replace('./payment.html?token='+encodeURIComponent(token)+'&v=059');
    }catch(err){
      showStatus(err.message||'Checkout belum dapat dibuat.');setCheckoutBusy(false);btn.textContent='Siapkan Pembayaran';submitting=false;
    }finally{clearTimeout(slow1);clearTimeout(slow2)}
  }
  document.addEventListener('DOMContentLoaded',()=>{
    loadProgram();syncSummary();
    const f=$('#donationForm');
    f.addEventListener('submit',submit);
    f.elements.gross_amount.addEventListener('input',()=>{$$('[data-amount]').forEach(b=>b.classList.remove('is-active'));syncSummary()});
    $$('[data-amount]').forEach(b=>b.onclick=()=>{f.elements.gross_amount.value=b.dataset.amount;$$('[data-amount]').forEach(x=>x.classList.toggle('is-active',x===b));syncSummary()});
    $$('[data-next]').forEach(b=>b.onclick=()=>{const target=Number(b.dataset.next);if(validateStep(target-1)){syncSummary();openStep(target)}});
    $$('[data-back]').forEach(b=>b.onclick=()=>openStep(Number(b.dataset.back)));
    $$('[data-step-jump]').forEach(b=>b.onclick=()=>{const target=Number(b.dataset.stepJump);if(target<step){openStep(target);return}if(target===step+1&&validateStep(step)){syncSummary();openStep(target)}});
  });
})();
