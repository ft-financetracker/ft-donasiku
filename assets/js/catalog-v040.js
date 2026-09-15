(()=>{
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>'\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'\"':'&quot;'}[c]));
  const idr=v=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v)||0);
  const VERSION='v052';
  let page=1,totalPages=1,timer,requestSeq=0;

  const key=(p,q,c)=>`kia_catalog_${VERSION}_${p}_${c}_${q.toLowerCase().slice(0,80)}`;
  const legacyKey=(p,q,c)=>`kia_catalog_v051_${p}_${c}_${q.toLowerCase().slice(0,80)}`;

  function parseCache(k,maxAge=6*3600000){
    try{const x=JSON.parse(localStorage.getItem(k)||'null');return x&&Date.now()-Number(x.t||0)<maxAge?x.d:null}catch{return null}
  }
  function read(p,q,c){return parseCache(key(p,q,c))||parseCache(legacyKey(p,q,c))}
  function write(k,d){try{localStorage.setItem(k,JSON.stringify({t:Date.now(),d}))}catch{}}

  function bootstrapSeed(){
    try{
      for(const k of ['kia_public_bootstrap_v052','kia_public_bootstrap_v051']){
        const x=JSON.parse(localStorage.getItem(k)||'null');
        if(!x||Date.now()-Number(x.saved_at||0)>6*3600000||!x.data?.programs?.length)continue;
        const total=Number(x.data.stats?.active_programs)||x.data.programs.length;
        return {page:1,limit:12,total,total_pages:Math.max(1,Math.ceil(total/12)),items:x.data.programs,partial:true};
      }
    }catch{}
    return null;
  }

  function card(p){
    const media=p.media||[],coverMedia=media.find(x=>x.is_cover)||media[0],cover=coverMedia?.public_url||p.cover_image_url||'';
    const pct=Math.min(100,Math.round((Number(p.raised_amount)||0)/(Number(p.target_amount)||1)*100));
    const other=media.filter(x=>x!==coverMedia);
    const thumbs=other.slice(0,3).map(x=>`<img class="program-thumb" loading="lazy" decoding="async" src="${esc(x.thumbnail_url||x.public_url)}" alt="">`).join('');
    const extra=Math.max(0,other.length-3);
    return `<article class="card public-program"><div class="program-poster" style="background-image:url('${esc(cover)}')"></div>${media.length>1?`<div class="program-thumbs">${thumbs}${extra?`<span class="program-more">+${extra}</span>`:''}</div>`:''}<div class="program-body"><span class="program-category">${esc(p.category)}</span><h3>${esc(p.program_name)}</h3><div class="progress"><span style="width:${pct}%"></span></div><div class="program-meta"><span>${idr(p.raised_amount)} / ${idr(p.target_amount)}</span><span>${pct}%</span></div><a class="btn btn-primary" style="width:100%" href="./program.html?id=${encodeURIComponent(p.program_id)}">Lihat Program</a></div></article>`;
  }

  function render(data,{refreshing=false}={}){
    const root=$('[data-catalog-grid]');
    totalPages=data.total_pages||1;page=data.page||1;
    root.innerHTML=(data.items||[]).map(card).join('')||'<div class="empty-state" style="grid-column:1/-1">Program tidak ditemukan.</div>';
    root.dataset.cached=data.partial?'partial':'full';
    $('[data-catalog-page]').textContent=`${page} / ${totalPages}${refreshing?' · memperbarui…':''}`;
    $('[data-catalog-prev]').disabled=page<=1;
    $('[data-catalog-next]').disabled=page>=totalPages;
  }

  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  async function request(url,{attempts=2,timeout=9000}={}){
    let last;
    for(let attempt=1;attempt<=attempts;attempt++){
      const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout+(attempt-1)*3500);
      try{
        const r=await fetch(url,{signal:c.signal,cache:'no-store'});
        const j=await r.json();
        if(!r.ok||!j.success)throw new Error(j.message||'CATALOG_FAILED');
        return j.data;
      }catch(e){last=e;if(attempt<attempts)await sleep(450*attempt)}finally{clearTimeout(t)}
    }
    throw last||new Error('CATALOG_FAILED');
  }

  async function load(next=1){
    const seq=++requestSeq;page=next;
    const root=$('[data-catalog-grid]'),q=$('[data-catalog-search]').value.trim(),cat=$('[data-catalog-category]').value,k=key(page,q,cat);
    let cached=read(page,q,cat);
    if(!cached&&page===1&&!q&&cat==='ALL')cached=bootstrapSeed();
    if(cached)render(cached,{refreshing:true});
    else root.innerHTML='<div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div>';

    const url=`${KIA_CONFIG.BACKEND_URL}/api/public/programs?page=${page}&limit=12&search=${encodeURIComponent(q)}&category=${encodeURIComponent(cat)}`;
    try{
      const data=await request(url,{attempts:2,timeout:cached?7000:9500});
      if(seq!==requestSeq)return;
      write(k,data);render(data);
    }catch(e){
      if(seq!==requestSeq)return;
      if(cached){render(cached);$('[data-catalog-page]').textContent=`${page} / ${totalPages} · data tersimpan`;return;}
      root.innerHTML='<div class="empty-state" style="grid-column:1/-1">Program belum dapat dimuat. <button class="btn btn-ghost" type="button" data-catalog-retry>Coba Lagi</button></div>';
      $('[data-catalog-retry]')?.addEventListener('click',()=>load(page));
    }
  }

  document.addEventListener('DOMContentLoaded',()=>{
    $('[data-catalog-prev]').onclick=()=>page>1&&load(page-1);
    $('[data-catalog-next]').onclick=()=>page<totalPages&&load(page+1);
    $('[data-catalog-category]').onchange=()=>load(1);
    $('[data-catalog-search]').oninput=()=>{clearTimeout(timer);timer=setTimeout(()=>load(1),350)};
    load(1);
  });
})();
