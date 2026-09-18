(()=>{
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const idr=v=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v)||0);
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':'&quot;'}[c]));
  const CACHE_KEY='kia_public_bootstrap_v059';
  const LEGACY_CACHE_KEYS=['kia_public_bootstrap_v058','kia_public_bootstrap_v057','kia_public_bootstrap_v056','kia_public_bootstrap_v055','kia_public_bootstrap_v054','kia_public_bootstrap_v052','kia_public_bootstrap_v051'];
  let lastAppliedInvalidation=Number(localStorage.getItem('kia_public_invalidate_at')||0);
  const CACHE_MAX_AGE=6*60*60*1000;

  const DEFAULT_HEROES=[
    {title:'Kecil di Tangan Kita, Besar untuk Mereka',subtitle:'Setiap kebaikan dapat menjadi harapan baru.',cta_label:'Mulai Berdonasi',cta_url:'#program',image_url:'./assets/images/hero/hero-1.png'},
    {title:'Bersama Membuka Jalan Pendidikan',subtitle:'Dukung langkah belajar dan masa depan yang lebih baik.',cta_label:'Lihat Program',cta_url:'#program',image_url:'./assets/images/hero/hero-2.png'},
    {title:'Kebaikan yang Menguatkan Umat',subtitle:'Bersama membantu program sosial, masjid, dan kebutuhan masyarakat.',cta_label:'Lihat Program',cta_url:'#program',image_url:'./assets/images/hero/hero-3.png'}
  ];
  let heroes=[],heroIndex=0,heroTimer=null;

  function funding(p){
    const raw=Math.max(0,Number(p?.raised_amount)||0),target=Math.max(0,Number(p?.target_amount)||0);
    const completed=target>0&&raw>=target;
    const credited=target>0?Math.min(raw,target):raw;
    const excess=target>0?Math.max(raw-target,0):0;
    const pct=target>0?Math.min(100,Math.round(credited/target*100)):0;
    return {raw,target,credited,excess,completed,pct};
  }
  function stamp(done){return done?'<div class="program-complete-stamp-v059" aria-label="Target 100 persen selesai"><strong>100%</strong><span>SELESAI</span></div>':''}
  function readCache(){try{for(const key of [CACHE_KEY,...LEGACY_CACHE_KEYS]){const x=JSON.parse(localStorage.getItem(key)||'null');if(x&&Date.now()-Number(x.saved_at||0)<CACHE_MAX_AGE)return x.data}return null}catch{return null}}
  function writeCache(data){try{localStorage.setItem(CACHE_KEY,JSON.stringify({saved_at:Date.now(),data}))}catch{}}
  async function fetchJson(url,timeout=30000,{force=false}={}){const c=new AbortController(),t=setTimeout(()=>c.abort(),timeout);try{const r=await fetch(url,{signal:c.signal,cache:force?'no-store':'default'});const raw=await r.text();let j;try{j=JSON.parse(raw)}catch{throw new Error(/^\s*</.test(raw||'')?'Server publik sedang memulai layanan.':'Respons data publik sementara tidak valid.')}if(!r.ok||!j?.success)throw new Error(j?.message||'PUBLIC_FETCH_FAILED');return j.data}finally{clearTimeout(t)}}
  function normalizeHeroAsset(hero,index){const item={...(hero||{})};const slot=Number(item.sort_order)||index+1;const image=String(item.image_url||'').trim();const legacy=image.match(/assets\/images\/hero\/hero-([123])\.(?:jpg|jpeg)(?:[?#].*)?$/i);if(legacy)item.image_url=`./assets/images/hero/hero-${legacy[1]}.png`;else if(!image)item.image_url=DEFAULT_HEROES[Math.max(0,Math.min(2,slot-1))].image_url;item.sort_order=slot;return item}
  function normalizedHeroes(remote){const active=Array.isArray(remote)?remote.filter(Boolean).slice(0,3).map(normalizeHeroAsset):[];const used=new Set(active.map(x=>Number(x.sort_order)||0).filter(Boolean));const result=[...active];DEFAULT_HEROES.forEach((fallback,index)=>{if(result.length>=3)return;const slot=index+1;if(!used.has(slot))result.push({...fallback,sort_order:slot})});while(result.length<3)result.push(DEFAULT_HEROES[result.length]);return result.slice(0,3)}
  function renderHero(){const h=heroes[heroIndex];if(!h)return;$('[data-hero-title]').textContent=h.title||'';$('[data-hero-subtitle]').textContent=h.subtitle||'';$('[data-hero-image]').style.backgroundImage=`url("${h.image_url||DEFAULT_HEROES[heroIndex]?.image_url||DEFAULT_HEROES[0].image_url}")`;const cta=$('[data-hero-cta]');cta.textContent=h.cta_label||'Mulai Berdonasi';cta.href=h.cta_url||'#program';$('[data-hero-dots]').innerHTML=heroes.map((_,i)=>`<button class="hero-dot ${i===heroIndex?'is-active':''}" data-dot="${i}" aria-label="Hero ${i+1}"></button>`).join('');$$('[data-dot]').forEach(button=>button.onclick=()=>{heroIndex=Number(button.dataset.dot);renderHero();restartHeroTimer()})}
  function restartHeroTimer(){clearInterval(heroTimer);if(heroes.length<=1)return;heroTimer=setInterval(()=>{heroIndex=(heroIndex+1)%heroes.length;renderHero()},7000)}
  function thumbs(p){const m=p.media||[],cover=m.find(x=>x.is_cover),rest=m.filter(x=>x!==cover).slice(0,3),extra=Math.max(0,m.length-(cover?1:0)-rest.length);return rest.map(x=>`<img class="program-thumb" loading="lazy" decoding="async" src="${esc(x.thumbnail_url||x.public_url)}" data-thumb="${esc(x.public_url)}" alt="">`).join('')+(extra?`<span class="program-more">+${extra}</span>`:'')}
  function renderPrograms(items){
    const root=$('[data-public-programs]');if(!root)return;
    if(!items?.length){root.innerHTML='<div class="empty-state" style="grid-column:1/-1">Belum ada program aktif.</div>';return}
    root.innerHTML=items.map(p=>{
      const media=p.media||[],cover=(media.find(x=>x.is_cover)||media[0])?.public_url||p.cover_image_url||'',f=funding(p);
      return `<article class="card public-program"><div class="program-poster" style="background-image:url('${esc(cover)}')" data-poster>${stamp(f.completed)}</div>${media.length>1?`<div class="program-thumbs">${thumbs(p)}</div>`:''}<div class="program-body"><span class="program-category">${esc(p.category)}</span><h3>${esc(p.program_name)}</h3><div class="progress"><span style="width:${f.pct}%"></span></div><div class="program-meta"><span>${idr(f.credited)} terkumpul</span><span>${f.pct}%</span></div><a class="btn btn-primary" style="width:100%" href="./program.html?id=${encodeURIComponent(p.program_id)}">Lihat Program</a></div></article>`;
    }).join('');
    $$('[data-thumb]',root).forEach(t=>t.onclick=()=>{const card=t.closest('.public-program');card.querySelector('[data-poster]').style.backgroundImage=`url('${t.dataset.thumb}')`});
  }
  function badgeClass(code){return String(code||'GUEST').toLowerCase()}
  function cleanMessage(value){return String(value||'').trim().replace(/\s+/g,' ')}
  function renderLiveDonations(items){
    const root=$('[data-live-donations]');if(!root)return;
    const rows=Array.isArray(items)?items:[];
    if(!rows.length){root.innerHTML='<div class="empty-state" style="grid-column:1/-1">Belum ada donasi tervalidasi. Live Donation akan terisi otomatis setelah pembayaran berstatus PAID.</div>';return}
    root.innerHTML=rows.map(x=>{const donor=x.donor_label||'Hamba Allah',message=cleanMessage(x.message);return `<article class="card live-donation-card-v058"><div class="live-donation-head-v058"><strong>${idr(x.amount)}</strong><span class="donor-badge donor-badge--${badgeClass(x.donor_badge_code)}">${esc(x.donor_badge||'Tamu')}</span></div><div class="live-donation-program-v058" title="${esc(x.program_name||'Program KIA')}">${esc(x.program_name||'Program KIA')}</div><div class="live-donation-person-v058"><strong>${esc(donor)}</strong>${message?`<span>·</span><em>“${esc(message)}”</em>`:'<span class="muted">· Tanpa pesan</span>'}</div></article>`}).join('');
    requestAnimationFrame(startLiveCarousel);
  }
  let liveTimer=null;
  function startLiveCarousel(){const root=$('[data-live-donations]');if(!root)return;clearInterval(liveTimer);const cards=[...root.querySelectorAll('.live-donation-card-v058')];if(cards.length<=3)return;let index=0;const advance=()=>{if(document.hidden||root.matches(':hover'))return;index=(index+1)%cards.length;cards[index]?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'start'})};liveTimer=setInterval(advance,4200);root.addEventListener('pointerdown',()=>clearInterval(liveTimer),{once:true})}
  function renderFaq(items){const root=$('[data-faq-preview]');if(root)root.innerHTML=(items||[]).slice(0,4).map(x=>`<details><summary>${esc(x.question)}</summary><p>${esc(x.answer)}</p></details>`).join('')}
  function applyData(data){if(!data)return;heroes=normalizedHeroes(data.heroes||[]);heroIndex=Math.min(heroIndex,heroes.length-1);renderHero();restartHeroTimer();renderPrograms(data.programs||[]);renderLiveDonations(data.live_donations||[]);renderFaq(data.faqs||[]);if($('[data-stat-paid]'))$('[data-stat-paid]').textContent=idr(data.stats?.total_paid_amount);if($('[data-stat-programs]'))$('[data-stat-programs]').textContent=String(data.stats?.active_programs||0);if($('[data-stat-disbursed]'))$('[data-stat-disbursed]').textContent=idr(data.stats?.total_withdrawn_net)}
  function publicError(){const root=$('[data-public-programs]');if(root)root.innerHTML='<div class="empty-state" style="grid-column:1/-1">Program belum dapat dimuat. <button class="btn btn-ghost" type="button" data-public-retry>Coba Lagi</button></div>';if($('[data-live-donations]'))$('[data-live-donations]').innerHTML='<div class="empty-state" style="grid-column:1/-1">Live Donation belum dapat dimuat.</div>';$('[data-public-retry]')?.addEventListener('click',load)}
  async function prefetchCatalog(seed){const key='kia_catalog_v059_1_ALL_';try{if(seed?.programs?.length){const total=Number(seed.stats?.active_programs)||seed.programs.length;localStorage.setItem(key,JSON.stringify({t:Date.now(),d:{page:1,limit:12,total,total_pages:Math.max(1,Math.ceil(total/12)),items:seed.programs},partial:true}))}const existing=JSON.parse(localStorage.getItem(key)||'null');if(existing&&!existing.partial&&Date.now()-Number(existing.t||0)<10*60*1000)return;const data=await fetchJson(`${KIA_CONFIG.BACKEND_URL}/api/public/programs?page=1&limit=12&search=&category=ALL`,28000);localStorage.setItem(key,JSON.stringify({t:Date.now(),d:data,partial:false}))}catch(_){}}
  async function load({force=false}={}){const cached=readCache();if(cached){applyData(cached);setTimeout(()=>prefetchCatalog(cached),20)}try{const data=await fetchJson(`${KIA_CONFIG.BACKEND_URL}/api/public/bootstrap${force?'?refresh='+Date.now():''}`,cached?26000:36000,{force});writeCache(data);applyData(data);lastAppliedInvalidation=Number(localStorage.getItem('kia_public_invalidate_at')||0);setTimeout(()=>prefetchCatalog(data),40)}catch(e){if(!cached)publicError()}}
  function refreshIfInvalidated(){const stamp=Number(localStorage.getItem('kia_public_invalidate_at')||0);if(stamp>lastAppliedInvalidation){lastAppliedInvalidation=stamp;load({force:true})}}
  document.addEventListener('DOMContentLoaded',()=>{heroes=DEFAULT_HEROES;renderHero();restartHeroTimer();$('[data-hero-prev]').onclick=()=>{heroIndex=(heroIndex-1+heroes.length)%heroes.length;renderHero();restartHeroTimer()};$('[data-hero-next]').onclick=()=>{heroIndex=(heroIndex+1)%heroes.length;renderHero();restartHeroTimer()};load()});
  window.addEventListener('pageshow',refreshIfInvalidated);
  window.addEventListener('storage',e=>{if(e.key==='kia_public_invalidate_at')refreshIfInvalidated()});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshIfInvalidated()});
})();
