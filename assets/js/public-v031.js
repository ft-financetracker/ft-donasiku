(() => {
  const $=(s,r=document)=>r.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>'"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':'&quot;'}[ch]));
  const idr=v=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v)||0);

  const DEFAULT_HEROES=[
    {
      hero_id:'hero_1',
      title:'Kecil di Tangan Kita, Besar untuk Mereka',
      subtitle:'Setiap kebaikan yang Anda berikan dapat menjadi harapan baru bagi banyak kehidupan.',
      cta_label:'Mulai Berdonasi',
      cta_url:'#program',
      image_url:'./assets/images/hero/hero-1.jpg',
      sort_order:1,
      status:'ACTIVE'
    },
    {
      hero_id:'hero_2',
      title:'Investasi Terbaik adalah Generasi yang Tumbuh',
      subtitle:'Dukung pendidikan dan kesempatan belajar yang membuka masa depan lebih luas.',
      cta_label:'Lihat Program Pendidikan',
      cta_url:'#program',
      image_url:'./assets/images/hero/hero-2.jpg',
      sort_order:2,
      status:'ACTIVE'
    },
    {
      hero_id:'hero_3',
      title:'Bersama Membangun Masa Depan yang Lebih Baik',
      subtitle:'Kepedulian hari ini dapat menghadirkan sarana yang bermanfaat untuk banyak orang.',
      cta_label:'Jelajahi Program',
      cta_url:'#program',
      image_url:'./assets/images/hero/hero-3.jpg',
      sort_order:3,
      status:'ACTIVE'
    }
  ];

  let slides=[...DEFAULT_HEROES];
  let current=0;
  let timer=null;

  async function publicCall(path,{timeout=18000}={}){
    const base=(window.KIA_CONFIG.BACKEND_URL||'').replace(/\/$/,'');
    if(!base) throw new Error('Backend belum dikonfigurasi');
    const controller=new AbortController();
    const timeoutId=setTimeout(()=>controller.abort(),timeout);
    try{
      const res=await fetch(base+path,{cache:'no-store',signal:controller.signal});
      const body=await res.json().catch(()=>null);
      if(!res.ok||!body?.success) throw new Error(body?.message||'Data publik gagal dimuat');
      return body;
    }finally{clearTimeout(timeoutId)}
  }

  function safeHeroUrl(url){
    const v=String(url||'').trim();
    if(v.startsWith('https://')||v.startsWith('./assets/')) return v.replaceAll('"','%22');
    return '';
  }

  function normalizeHeroes(remote){
    const byId=new Map(DEFAULT_HEROES.map(x=>[x.hero_id,{...x}]));
    const list=Array.isArray(remote)?remote:[];
    list.filter(x=>x&&x.status==='ACTIVE').forEach((x,i)=>{
      const key=/^hero_[123]$/.test(x.hero_id)?x.hero_id:(i===0?'hero_1':null);
      if(!key) return;
      byId.set(key,{...byId.get(key),...x,hero_id:key});
    });
    return [...byId.values()].sort((a,b)=>(Number(a.sort_order)||999)-(Number(b.sort_order)||999)).slice(0,3);
  }

  function renderDots(){
    const host=$('[data-hero-dots]');
    if(!host) return;
    host.innerHTML=slides.map((_,i)=>`<button type="button" class="hero-dot${i===current?' is-active':''}" data-hero-dot="${i}" aria-label="Tampilkan hero ${i+1}" aria-current="${i===current?'true':'false'}"></button>`).join('');
  }

  function renderHero(index){
    if(!slides.length) return;
    current=(index+slides.length)%slides.length;
    const hero=slides[current];
    const media=$('[data-hero-image]');
    const img=safeHeroUrl(hero.image_url)||DEFAULT_HEROES[current]?.image_url||DEFAULT_HEROES[0].image_url;
    if(media) media.style.backgroundImage=`url("${img}")`;
    $('[data-hero-title]').textContent=hero.title||'Kebaikan yang terukur. Dampak yang terlihat.';
    $('[data-hero-subtitle]').textContent=hero.subtitle||'Temukan program kebaikan melalui KIA.';
    const cta=$('[data-hero-cta]');
    cta.textContent=hero.cta_label||'Mulai Berdonasi';
    cta.href=/^(#|\.\/|\/|https:\/\/)/.test(hero.cta_url||'')?hero.cta_url:'#program';
    renderDots();
  }

  function restartAutoplay(){
    clearInterval(timer);
    if(slides.length>1) timer=setInterval(()=>renderHero(current+1),6500);
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
    const image=(String(p.cover_image_url||'').startsWith('https://')||String(p.cover_image_url||'').startsWith('./assets/'))?`style="background-image:url('${esc(p.cover_image_url)}')"`:'';
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

  function bindHero(){
    $('[data-hero-prev]')?.addEventListener('click',()=>{renderHero(current-1);restartAutoplay()});
    $('[data-hero-next]')?.addEventListener('click',()=>{renderHero(current+1);restartAutoplay()});
    $('[data-hero-dots]')?.addEventListener('click',e=>{
      const btn=e.target.closest('[data-hero-dot]');
      if(!btn) return;
      renderHero(Number(btn.dataset.heroDot)||0);
      restartAutoplay();
    });
    const carousel=$('[data-hero-carousel]');
    carousel?.addEventListener('mouseenter',()=>clearInterval(timer));
    carousel?.addEventListener('mouseleave',restartAutoplay);
  }

  async function load(){
    const status=$('[data-api-status]');
    slides=[...DEFAULT_HEROES];
    renderHero(0);
    restartAutoplay();
    try{
      const r=await publicCall('/api/public/bootstrap');
      slides=normalizeHeroes(r.data.heroes||[r.data.hero].filter(Boolean));
      renderHero(0);
      restartAutoplay();
      renderStats(r.data.stats);
      renderPrograms(r.data.programs);
      if(status){status.textContent='Data publik terhubung';status.dataset.state='ok'}
    }catch(err){
      renderPrograms([]);
      if(status) status.textContent='Data terbaru belum dapat dimuat · hero dummy tetap aktif';
    }
  }

  document.addEventListener('DOMContentLoaded',()=>{
    bindHero();
    load();
  });
})();
