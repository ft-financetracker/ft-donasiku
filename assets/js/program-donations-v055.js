(()=>{
  const $=(s,r=document)=>r.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>'\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'\"':'&quot;'}[c]));
  const idr=v=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v)||0);
  let programId='',page=1,totalPages=1,total=0,loading=false,requestSeq=0;
  const CACHE_TTL=5*60*1000;
  const key=p=>`kia_program_donations_v055_${programId}_${p}`;
  function readCache(p){try{const x=JSON.parse(sessionStorage.getItem(key(p))||'null');return x&&Date.now()-x.saved_at<CACHE_TTL?x.data:null}catch{return null}}
  function writeCache(p,data){try{sessionStorage.setItem(key(p),JSON.stringify({saved_at:Date.now(),data}))}catch{}}
  function initials(name){const p=String(name||'Hamba Allah').trim().split(/\s+/).filter(Boolean);return((p[0]?.[0]||'H')+(p[1]?.[0]||'')).toUpperCase()}
  function badgeClass(code){return String(code||'GENERAL').toLowerCase()}
  function row(x,index){const donor=x.donor_label||'Hamba Allah',message=String(x.message||'').trim();return `<article class="donation-list-row-v055">
    <div class="donation-list-no-v055">#${index}</div>
    <div class="donor-avatar-frame donor-avatar-frame--compact" aria-hidden="true"><span>${esc(initials(donor))}</span></div>
    <div class="donation-list-person-v055"><div><strong>${esc(donor)}</strong><span class="donor-badge donor-badge--${badgeClass(x.donor_badge_code)}">${esc(x.donor_badge||'Umum')}</span></div><p>${message?`“${esc(message)}”`:'<span class="muted">Tanpa pesan</span>'}</p></div>
    <strong class="donation-list-amount-v055">${idr(x.amount)}</strong>
  </article>`}
  function render(data,{refreshing=false}={}){
    const root=$('[data-donation-list]');
    page=Number(data.page)||1;totalPages=Number(data.total_pages)||1;total=Number(data.total)||0;
    const program=data.program||{};
    $('[data-program-name]').textContent=program.program_name||'Program KIA';
    $('[data-donation-total]').textContent=`${total.toLocaleString('id-ID')} donasi tervalidasi`;
    root.innerHTML=(data.items||[]).map((x,i)=>row(x,(page-1)*(Number(data.limit)||10)+i+1)).join('')||'<div class="empty-state">Belum ada donasi tervalidasi.</div>';
    $('[data-page-info]').textContent=`Halaman ${page} dari ${totalPages}${refreshing?' · memperbarui…':''}`;
    $('[data-prev]').disabled=page<=1||loading;$('[data-next]').disabled=page>=totalPages||loading;
  }
  async function request(p){
    const c=new AbortController(),t=setTimeout(()=>c.abort(),22000);
    try{
      const r=await fetch(`${KIA_CONFIG.BACKEND_URL}/api/public/programs/${encodeURIComponent(programId)}/donations?page=${p}&limit=10`,{cache:'no-store',signal:c.signal});
      const text=await r.text();let j=null;try{j=JSON.parse(text)}catch{throw new Error('Respons server belum siap. Coba lagi sebentar.')}
      if(!r.ok||!j.success)throw new Error(j.message||'Donasi belum dapat dimuat.');return j.data;
    }finally{clearTimeout(t)}
  }
  async function load(p=1){
    if(loading)return;loading=true;const seq=++requestSeq;const root=$('[data-donation-list]');
    const cached=readCache(p);if(cached)render(cached,{refreshing:true});else root.innerHTML='<div class="donation-feed-loading-v055"><span class="donation-feed-spinner-v055"></span><strong>Memuat donasi tervalidasi…</strong></div>';
    try{const data=await request(p);if(seq!==requestSeq)return;writeCache(p,data);render(data)}catch(e){if(seq!==requestSeq)return;if(cached)render(cached);else root.innerHTML=`<div class="empty-state">${esc(e.message||'Donasi belum dapat dimuat.')} <button class="btn btn-ghost" type="button" data-retry>Coba Lagi</button></div>`;$('[data-retry]')?.addEventListener('click',()=>load(p))}finally{loading=false;$('[data-prev]').disabled=page<=1;$('[data-next]').disabled=page>=totalPages}
  }
  document.addEventListener('DOMContentLoaded',()=>{
    programId=new URLSearchParams(location.search).get('id')||'';
    if(!programId){$('[data-donation-list]').innerHTML='<div class="empty-state">Program tidak ditemukan.</div>';return}
    document.querySelectorAll('[data-back-program]').forEach(a=>a.href=`./program.html?id=${encodeURIComponent(programId)}`);
    $('[data-prev]').onclick=()=>page>1&&load(page-1);$('[data-next]').onclick=()=>page<totalPages&&load(page+1);
    load(1);
  });
})();
