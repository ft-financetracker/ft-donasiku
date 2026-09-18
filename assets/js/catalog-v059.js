(()=>{
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':'&quot;'}[c]));
  const idr=v=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v)||0);
  const VERSION='v059';
  let page=1,totalPages=1,timer,requestSeq=0;
  const key=(p,q,c)=>`kia_catalog_${VERSION}_${p}_${c}_${q.toLowerCase().slice(0,80)}`;
  const legacyKeys=(p,q,c)=>[`kia_catalog_v058_${p}_${c}_${q.toLowerCase().slice(0,80)}`,`kia_catalog_v056_${p}_${c}_${q.toLowerCase().slice(0,80)}`,`kia_catalog_v055_${p}_${c}_${q.toLowerCase().slice(0,80)}`,`kia_catalog_v054_${p}_${c}_${q.toLowerCase().slice(0,80)}`,`kia_catalog_v052_${p}_${c}_${q.toLowerCase().slice(0,80)}`,`kia_catalog_v051_${p}_${c}_${q.toLowerCase().slice(0,80)}`];
  function funding(p){const raw=Math.max(0,Number(p?.raised_amount)||0),target=Math.max(0,Number(p?.target_amount)||0),completed=target>0&&raw>=target,credited=target>0?Math.min(raw,target):raw,pct=target>0?Math.min(100,Math.round(credited/target*100)):0;return{raw,target,completed,credited,pct}}
  function stamp(done){return done?'<div class="program-complete-stamp-v059" aria-label="Target 100 persen selesai"><strong>100%</strong><span>SELESAI</span></div>':''}
  function parseCache(k,maxAge=6*3600000){try{const x=JSON.parse(localStorage.getItem(k)||'null');return x&&Date.now()-Number(x.t||0)<maxAge?x.d:null}catch{return null}}
  function read(p,q,c){return parseCache(key(p,q,c))||legacyKeys(p,q,c).map(k=>parseCache(k)).find(Boolean)||null}
  function write(k,d){try{localStorage.setItem(k,JSON.stringify({t:Date.now(),d}))}catch{}}
  function bootstrapSeed(){
    try{
      for(const k of ['kia_public_bootstrap_v059','kia_public_bootstrap_v058','kia_public_bootstrap_v056','kia_public_bootstrap_v055','kia_public_bootstrap_v054','kia_public_bootstrap_v052','kia_public_bootstrap_v051']){
        const x=JSON.parse(localStorage.getItem(k)||'null');
        if(!x||Date.now()-Number(x.saved_at||0)>6*3600000||!x.data?.programs?.length)continue;
        const total=Number(x.data.stats?.active_programs)||x.data.programs.length;
        return {page:1,limit:12,total,total_pages:Math.max(1,Math.ceil(total/12)),items:x.data.programs,partial:true};
      }
    }catch{}
    return null;
  }
  function card(p){
    const media=p.media||[],coverMedia=media.find(x=>x.is_cover)||media[0],cover=coverMedia?.public_url||p.cover_image_url||'',f=funding(p);
    const other=media.filter(x=>x!==coverMedia);
    const thumbs=other.slice(0,3).map(x=>`<img class="program-thumb" loading="lazy" decoding="async" src="${esc(x.thumbnail_url||x.public_url)}" alt="">`).join('');
    const extra=Math.max(0,other.length-3);
    return `<article class="card public-program"><div class="program-poster" style="background-image:url('${esc(cover)}')">${stamp(f.completed)}</div>${media.length>1?`<div class="program-thumbs">${thumbs}${extra?`<span class="program-more">+${extra}</span>`:''}</div>`:''}<div class="program-body"><span class="program-category">${esc(p.category)}</span><h3>${esc(p.program_name)}</h3><div class="progress"><span style="width:${f.pct}%"></span></div><div class="program-meta"><span>${idr(f.credited)} / ${idr(f.target)}</span><span>${f.pct}%</span></div><a class="btn btn-primary" style="width:100%" href="./program.html?id=${encodeURIComponent(p.program_id)}">Lihat Program</a></div></article>`;
  }
  function render(data,{refreshing=false}={}){const root=$('[data-catalog-grid]');totalPages=data.total_pages||1;page=data.page||1;root.innerHTML=(data.items||[]).map(card).join('')||'<div class="empty-state" style="grid-column:1/-1">Program tidak ditemukan.</div>';root.dataset.cached=data.partial?'partial':'full';$('[data-catalog-page]').textContent=`${page} / ${totalPages}${refreshing?' · memperbarui…':''}`;$('[data-catalog-prev]').disabled=page<=1;$('[data-catalog-next]').disabled=page>=totalPages}
  async function request(url,{timeout=30000,force=false}={}){const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{signal:c.signal,cache:force?'no-store':'default'});const raw=await r.text();let j;try{j=JSON.parse(raw)}catch{throw new Error(/^\s*</.test(raw||'')?'Server program sedang memulai layanan.':'Respons katalog sementara tidak valid.')}if(!r.ok||!j?.success)throw new Error(j?.message||'CATALOG_FAILED');return j.data}finally{clearTimeout(t)}}
  async function load(next=1){const seq=++requestSeq;page=next;const root=$('[data-catalog-grid]'),q=$('[data-catalog-search]').value.trim(),cat=$('[data-catalog-category]').value,k=key(page,q,cat);let cached=read(page,q,cat);if(!cached&&page===1&&!q&&cat==='ALL')cached=bootstrapSeed();if(cached)render(cached,{refreshing:true});else root.innerHTML='<div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div>';const slow=setTimeout(()=>{if(seq===requestSeq&&!cached)$('[data-catalog-page]').textContent='Server sedang menyiapkan program… tidak perlu F5'},9000);const url=`${KIA_CONFIG.BACKEND_URL}/api/public/programs?page=${page}&limit=12&search=${encodeURIComponent(q)}&category=${encodeURIComponent(cat)}`;try{const data=await request(url,{timeout:cached?26000:36000});if(seq!==requestSeq)return;clearTimeout(slow);write(k,data);render(data)}catch(e){clearTimeout(slow);if(seq!==requestSeq)return;if(cached){render(cached);$('[data-catalog-page]').textContent=`${page} / ${totalPages} · data tersimpan`;return}root.innerHTML='<div class="empty-state" style="grid-column:1/-1">Program belum dapat dimuat. <button class="btn btn-ghost" type="button" data-catalog-retry>Coba Lagi</button></div>';$('[data-catalog-retry]')?.addEventListener('click',()=>load(page))}}
  function refreshIfInvalidated(){const stamp=Number(localStorage.getItem('kia_public_invalidate_at')||0);const seen=Number(sessionStorage.getItem('kia_catalog_seen_invalidation')||0);if(stamp>seen){sessionStorage.setItem('kia_catalog_seen_invalidation',String(stamp));load(page)}}
  document.addEventListener('DOMContentLoaded',()=>{$('[data-catalog-prev]').onclick=()=>page>1&&load(page-1);$('[data-catalog-next]').onclick=()=>page<totalPages&&load(page+1);$('[data-catalog-category]').onchange=()=>load(1);$('[data-catalog-search]').oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>load(1),350)};load(1)});
  window.addEventListener('pageshow',refreshIfInvalidated);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshIfInvalidated()});
})();
