(()=>{
  const $=(s,r=document)=>r.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>'\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'\"':'&quot;'}[c]));
  const idr=v=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v)||0);
  let programId='',page=1,totalPages=1,total=0,loading=false,requestSeq=0;
  const CACHE_TTL=5*60*1000;
  const key=p=>`kia_program_donations_v0520_${programId}_${p}`;
  function readCache(p){try{for(const k of [key(p),`kia_program_donations_v058_${programId}_${p}`,`kia_program_donations_v056_${programId}_${p}`]){const x=JSON.parse(sessionStorage.getItem(k)||'null');if(x&&Date.now()-x.saved_at<CACHE_TTL)return x.data}return null}catch{return null}}
  function writeCache(p,data){try{sessionStorage.setItem(key(p),JSON.stringify({saved_at:Date.now(),data}))}catch{}}
  function initials(name){const p=String(name||'Hamba Allah').trim().split(/\s+/).filter(Boolean);return((p[0]?.[0]||'H')+(p[1]?.[0]||'')).toUpperCase()}
  function badgeClass(code){return String(code||'GUEST').toLowerCase()}
  function frameCode(profile){return String(profile?.frame_code||'DEFAULT').toLowerCase()}
  function dateTime(v){if(!v)return'—';try{return new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(v))}catch{return v}}
  function materialAvatar(v){const s=String(v||'').trim();return s.startsWith('material:')?s.slice(9):''}
  function avatar(x){const donor=x.donor_label||'Hamba Allah',p=x.donor_profile||null,url=String(p?.avatar_url||'').trim(),mi=materialAvatar(url);return `<div class="donor-avatar-frame-v058 frame-${esc(frameCode(p))}" aria-hidden="true">${mi?`<span class="material-symbols-outlined">${esc(mi)}</span>`:url?`<img src="${esc(url)}" alt="">`:`<span>${esc(initials(donor))}</span>`}</div>`}
  function row(x,index){
    const donor=x.donor_label||'Hamba Allah',message=String(x.message||'').trim(),social=!!x.social_enabled;
    const attrs=social?`data-donation-ref="${esc(x.donation_ref||'')}" data-social-enabled="1" tabindex="0" role="button" aria-label="Buka timeline donasi ${esc(donor)}"`:`data-social-enabled="0" role="group" aria-label="Donasi ${esc(donor)}"`;
    return `<article class="donation-row-v058 ${social?'is-social':'is-static'}" ${attrs}>
      <div class="donation-cell-no-v058">#${index}</div>
      <div class="donation-cell-profile-v058">${avatar(x)}</div>
      <div class="donation-cell-person-v058"><strong>${esc(donor)}</strong>${message?`<span>·</span><em>“${esc(message)}”</em>`:'<span class="muted">· Tanpa pesan</span>'}</div>
      <div class="donation-cell-program-v058">${esc(x.program_name||'Program KIA')}</div>
      <div class="donation-cell-badge-v058"><span class="donor-badge donor-badge--${badgeClass(x.donor_badge_code)}">${esc(x.donor_badge||'Tamu')}</span></div>
      <div class="donation-cell-amount-v058"><strong>${idr(x.amount)}</strong><time>${esc(dateTime(x.paid_at))}</time></div>
    </article>`
  }
  function prefetchSocial(items){const refs=(items||[]).filter(x=>x.social_enabled&&x.donation_ref);refs.forEach(x=>window.KiaDonationSocial?.seed?.(x));setTimeout(()=>refs.slice(0,6).forEach((x,i)=>setTimeout(()=>window.KiaDonationSocial?.prefetch?.(x.donation_ref),i*160)),60)}
  function render(data,{refreshing=false}={}){
    const root=$('[data-donation-list]');page=Number(data.page)||1;totalPages=Number(data.total_pages)||1;total=Number(data.total)||0;const program=data.program||{},items=data.items||[];
    $('[data-program-name]').textContent=program.program_name||'Program KIA';$('[data-donation-total]').textContent=`${total.toLocaleString('id-ID')} donasi tervalidasi`;
    root.innerHTML=items.map((x,i)=>row(x,(page-1)*(Number(data.limit)||10)+i+1)).join('')||'<div class="empty-state">Belum ada donasi tervalidasi.</div>';
    $('[data-page-info]').textContent=`Halaman ${page} dari ${totalPages}${refreshing?' · memperbarui…':''}`;$('[data-prev]').disabled=page<=1||loading;$('[data-next]').disabled=page>=totalPages||loading;prefetchSocial(items)
  }
  async function request(p){const c=new AbortController(),t=setTimeout(()=>c.abort(),22000);try{const r=await fetch(`${KIA_CONFIG.BACKEND_URL}/api/public/programs/${encodeURIComponent(programId)}/donations?page=${p}&limit=10&avatar_v=520`,{cache:'no-store',signal:c.signal});const raw=await r.text();let j;try{j=JSON.parse(raw)}catch{throw new Error(/^\s*</.test(raw||'')?'Server donor sedang memulai layanan.':'Respons server belum siap.')}if(!r.ok||!j.success)throw new Error(j.message||'Donasi belum dapat dimuat.');return j.data}finally{clearTimeout(t)}}
  async function load(p=1){if(loading)return;loading=true;const seq=++requestSeq;const root=$('[data-donation-list]'),cached=readCache(p);if(cached)render(cached,{refreshing:true});else root.innerHTML='<div class="donation-feed-loading-v058"><span class="donation-feed-spinner-v058"></span><strong>Memuat donasi tervalidasi…</strong></div>';try{const data=await request(p);if(seq!==requestSeq)return;writeCache(p,data);render(data)}catch(e){if(seq!==requestSeq)return;if(cached)render(cached);else root.innerHTML=`<div class="empty-state">${esc(e.message||'Donasi belum dapat dimuat.')} <button class="btn btn-ghost" type="button" data-retry>Coba Lagi</button></div>`;$('[data-retry]')?.addEventListener('click',()=>load(p))}finally{loading=false;$('[data-prev]').disabled=page<=1;$('[data-next]').disabled=page>=totalPages}}
  document.addEventListener('DOMContentLoaded',()=>{programId=new URLSearchParams(location.search).get('id')||'';if(!programId){$('[data-donation-list]').innerHTML='<div class="empty-state">Program tidak ditemukan.</div>';return}document.querySelectorAll('[data-back-program]').forEach(a=>a.href=`./program.html?id=${encodeURIComponent(programId)}`);$('[data-prev]').onclick=()=>page>1&&load(page-1);$('[data-next]').onclick=()=>page<totalPages&&load(page+1);load(1)});
})();