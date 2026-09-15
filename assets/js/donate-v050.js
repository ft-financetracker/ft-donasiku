(()=>{
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':'&quot;'}[c]));
  const idr=v=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v)||0);
  let program=null,step=1;

  function openStep(next){step=next;$$('[data-step-panel]').forEach(p=>p.hidden=Number(p.dataset.stepPanel)!==step);$$('[data-step-jump]').forEach(b=>b.classList.toggle('is-active',Number(b.dataset.stepJump)===step));window.scrollTo({top:0,behavior:'smooth'})}
  function amount(){return Math.floor(Number($('#donationForm').elements.gross_amount.value)||0)}
  function syncSummary(){$('[data-summary-amount]').textContent=idr(amount())}
  function validateStep(n){const f=$('#donationForm');if(n===1&&amount()<1000){showStatus('Nominal donasi minimal Rp1.000.');return false}if(n===2&&!String(f.elements.donor_name.value||'').trim()){showStatus('Nama donatur wajib diisi.');return false}hideStatus();return true}
  function showStatus(msg){const el=$('[data-checkout-status]');el.hidden=false;el.textContent=msg}
  function hideStatus(){const el=$('[data-checkout-status]');el.hidden=true;el.textContent=''}

  function fillProgram(){
    const cover=(program.media||[]).find(x=>x.is_cover)||(program.media||[])[0];
    const url=cover?.public_url||program.cover_image_url||'';
    $('[data-summary-poster]').style.backgroundImage=url?`url("${url}")`:'';
    $('[data-summary-category]').textContent=program.category||'Program KIA';
    $('[data-summary-title]').textContent=program.program_name||'Program KIA';
  }

  function prefillUser(){
    const user=window.KiaAuth?.getUser?.();
    if(!user)return;
    const f=$('#donationForm');
    if(!f.elements.donor_name.value)f.elements.donor_name.value=user.full_name||'';
    if(!f.elements.donor_email.value)f.elements.donor_email.value=user.email||'';
  }

  async function loadProgram(){
    const id=new URLSearchParams(location.search).get('program_id');
    if(!id){showStatus('Program tidak ditemukan.');return}
    let cached=null;try{const x=JSON.parse(localStorage.getItem('kia_program_detail_v051_'+id)||'null');if(x&&Date.now()-x.saved_at<6*3600000)cached=x.data}catch{}
    if(cached?.program){program=cached.program;fillProgram();prefillUser()}
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),cached?8000:12000);
    try{
      const response=await fetch(`${KIA_CONFIG.BACKEND_URL}/api/public/programs/${encodeURIComponent(id)}`,{signal:controller.signal});const r=await response.json();
      if(!response.ok||!r.success)throw new Error(r.message||'Program tidak ditemukan.');
      program=r.data.program;try{localStorage.setItem('kia_program_detail_v051_'+id,JSON.stringify({saved_at:Date.now(),data:r.data}))}catch{}fillProgram();prefillUser();
    }catch(e){if(!cached)showStatus(e.message||'Program belum dapat dimuat.')}finally{clearTimeout(timer)}
  }

  async function submit(e){
    e.preventDefault();
    if(!validateStep(1)||!validateStep(2)||!program)return;
    const f=e.currentTarget,btn=$('[data-submit-donation]');
    const payload={program_id:program.program_id,gross_amount:amount(),donor_name:f.elements.donor_name.value.trim(),donor_email:f.elements.donor_email.value.trim(),donor_phone:f.elements.donor_phone.value.trim(),is_anonymous:f.elements.is_anonymous.checked,message:f.elements.message.value.trim(),payment_method:f.elements.payment_method.value};
    btn.disabled=true;btn.textContent='Menyiapkan pembayaran…';hideStatus();
    try{
      const r=await KiaAuth.request('/api/donations/checkout',{method:'POST',body:JSON.stringify(payload),timeout:22000});
      location.href='./payment.html?token='+encodeURIComponent(r.data.view_token);
    }catch(err){showStatus(err.message||'Checkout belum dapat dibuat.');btn.disabled=false;btn.textContent='Siapkan Pembayaran'}
  }

  document.addEventListener('DOMContentLoaded',()=>{
    loadProgram();syncSummary();
    const f=$('#donationForm');
    f.addEventListener('submit',submit);
    f.elements.gross_amount.addEventListener('input',()=>{$$('[data-amount]').forEach(b=>b.classList.remove('is-active'));syncSummary()});
    $$('[data-amount]').forEach(b=>b.onclick=()=>{f.elements.gross_amount.value=b.dataset.amount;$$('[data-amount]').forEach(x=>x.classList.toggle('is-active',x===b));syncSummary()});
    $$('[data-next]').forEach(b=>b.onclick=()=>{const target=Number(b.dataset.next);if(validateStep(target-1))openStep(target)});
    $$('[data-back]').forEach(b=>b.onclick=()=>openStep(Number(b.dataset.back)));
    $$('[data-step-jump]').forEach(b=>b.onclick=()=>{const target=Number(b.dataset.stepJump);if(target<step){openStep(target);return}if(target===step+1&&validateStep(step))openStep(target)});
  });
})();
