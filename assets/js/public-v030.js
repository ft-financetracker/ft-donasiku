(() => {
  const $=(s,r=document)=>r.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>'"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':'&quot;'}[ch]));
  const idr=v=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v)||0);

  async function publicCall(path,{timeout=18000}={}){
    const base=(window.KIA_CONFIG.BACKEND_URL||'').replace(/\/$/,'');
    if(!base) throw new Error('Backend belum dikonfigurasi');
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeout);
    try{
      const res=await fetch(base+path,{cache:'no-store',signal:controller.signal});
      const body=await res.json().catch(()=>null);
      if(!res.ok||!body?.success) throw new Error(body?.message||'Data publik gagal dimuat');
      return body;
    }finally{clearTimeout(timer)}
  }

  function safeHeroUrl(url){
    const v=String(url||'').trim();
    if(v.startsWith('https://')) return v.replaceAll('"','%22');
    return '';
  }

  function renderHero(hero){
    if(!hero) return;
    if(hero.title) $('[data-hero-title]').textContent=hero.title;
    if(hero.subtitle) $('[data-hero-subtitle]').textContent=hero.subtitle;
    const cta=$('[data-hero-cta]');
    if(hero.cta_label) cta.textContent=hero.cta_label;
    if(hero.cta_url && /^(#|\.\/|\/|https:\/\/)/.test(hero.cta_url)) cta.href=hero.cta_url;
    const card=$('[data-hero-card]');
    const img=safeHeroUrl(hero.image_url);
    if(img){
      card.style.backgroundImage=`linear-gradient(rgba(235,246,240,.42),rgba(255,255,255,.56)),url("${img}")`;
    }
  }

  function renderStats(stats){
    $('[data-stat-paid]').textContent=idr(stats?.total_paid_amount||0);
    $('[data-stat-programs]').textContent=String(stats?.active_programs||0);
    $('[data-stat-disbursed]').textContent=idr(stats?.total_withdrawn_net||0);
  }

  function programCard(p){
    const target=Number(p.target_amount)||0;
    const raised=Number(p.raised_amount)||0;
    const pct=target>0?Math.max(0,Math.min(100,(raised/target)*100)):0;
    const image=String(p.cover_image_url||'').startsWith('https://')?`style="background-image:url('${esc(p.cover_image_url)}')"`:'';
    return `<article class="card public-program">
      <div class="program-image" ${image}></div>
      <div class="program-body">
        <span class="status-pill" data-status="ACTIVE">${esc(p.category||'Program')}</span>
        <h3>${esc(p.program_name)}</h3>
        <p class="muted">${esc(p.short_description||'Program penggalangan dana KIA.')}</p>
        <div class="progress" aria-label="Progress dana"><span style="width:${pct.toFixed(2)}%"></span></div>
        <div class="program-meta"><span>${esc(idr(raised))} terkumpul</span><span>Target ${esc(idr(target))}</span></div>
        <a class="btn btn-primary" href="./program.html?id=${encodeURIComponent(p.program_id)}">Lihat Program</a>
      </div>
    </article>`;
  }

  function renderPrograms(programs){
    const list=$('[data-public-programs]');
    if(!programs?.length){
      list.innerHTML='<div class="empty-state" style="grid-column:1/-1">Belum ada program publik. Program yang sudah lolos review akan tampil otomatis di sini.</div>';
      return;
    }
    list.innerHTML=programs.map(programCard).join('');
  }

  async function load(){
    const status=$('[data-api-status]');
    try{
      const r=await publicCall('/api/public/bootstrap');
      renderHero(r.data.hero);
      renderStats(r.data.stats);
      renderPrograms(r.data.programs);
      if(status){status.textContent='Data publik terhubung';status.dataset.state='ok'}
    }catch(err){
      renderPrograms([]);
      if(status) status.textContent='Data terbaru belum dapat dimuat · tampilan dasar tetap aktif';
    }
  }

  document.addEventListener('DOMContentLoaded',load);
})();
