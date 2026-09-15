(()=>{
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const idr=v=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v)||0);
  const esc=v=>String(v??'').replace(/[&<>'\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':'&quot;'}[c]));

  const DEFAULT_HEROES=[
    {
      title:'Kecil di Tangan Kita, Besar untuk Mereka',
      subtitle:'Setiap kebaikan dapat menjadi harapan baru.',
      cta_label:'Mulai Berdonasi',
      cta_url:'#program',
      image_url:'./assets/images/hero/hero-1.png'
    },
    {
      title:'Bersama Membuka Jalan Pendidikan',
      subtitle:'Dukung langkah belajar dan masa depan yang lebih baik.',
      cta_label:'Lihat Program',
      cta_url:'#program',
      image_url:'./assets/images/hero/hero-2.png'
    },
    {
      title:'Kebaikan yang Menguatkan Umat',
      subtitle:'Bersama membantu program sosial, masjid, dan kebutuhan masyarakat.',
      cta_label:'Lihat Program',
      cta_url:'#program',
      image_url:'./assets/images/hero/hero-3.png'
    }
  ];

  let heroes=[];
  let heroIndex=0;
  let heroTimer=null;

  function normalizeHeroAsset(hero,index){
    const item={...(hero||{})};
    const slot=Number(item.sort_order)||index+1;
    const image=String(item.image_url||'').trim();
    const legacy=image.match(/assets\/images\/hero\/hero-([123])\.(?:jpg|jpeg)(?:[?#].*)?$/i);

    // Upgrade otomatis path hero lokal lama (.jpg) ke aset HD 2:1 (.png).
    // Custom image dari Media Library/Drive tidak disentuh.
    if(legacy){
      item.image_url=`./assets/images/hero/hero-${legacy[1]}.png`;
    }else if(!image){
      item.image_url=DEFAULT_HEROES[Math.max(0,Math.min(2,slot-1))].image_url;
    }

    item.sort_order=slot;
    return item;
  }

  function normalizedHeroes(remote){
    const active=Array.isArray(remote)
      ? remote.filter(Boolean).slice(0,3).map(normalizeHeroAsset)
      : [];
    const usedSlots=new Set(active.map(x=>Number(x.sort_order)||0).filter(Boolean));
    const result=[...active];

    DEFAULT_HEROES.forEach((fallback,index)=>{
      if(result.length>=3) return;
      const slot=index+1;
      if(!usedSlots.has(slot)) result.push({...fallback,sort_order:slot});
    });

    while(result.length<3){
      result.push(DEFAULT_HEROES[result.length]);
    }

    return result.slice(0,3);
  }

  function renderHero(){
    const h=heroes[heroIndex];
    if(!h) return;

    $('[data-hero-title]').textContent=h.title||'';
    $('[data-hero-subtitle]').textContent=h.subtitle||'';

    const img=$('[data-hero-image]');
    img.style.backgroundImage=`url("${h.image_url||DEFAULT_HEROES[heroIndex]?.image_url||DEFAULT_HEROES[0].image_url}")`;

    const cta=$('[data-hero-cta]');
    cta.textContent=h.cta_label||'Mulai Berdonasi';
    cta.href=h.cta_url||'#program';

    $('[data-hero-dots]').innerHTML=heroes.map((_,i)=>
      `<button class="hero-dot ${i===heroIndex?'is-active':''}" data-dot="${i}" aria-label="Hero ${i+1}"></button>`
    ).join('');

    $$('[data-dot]').forEach(button=>{
      button.onclick=()=>{
        heroIndex=Number(button.dataset.dot);
        renderHero();
        restartHeroTimer();
      };
    });
  }

  function restartHeroTimer(){
    clearInterval(heroTimer);
    if(heroes.length<=1) return;
    heroTimer=setInterval(()=>{
      heroIndex=(heroIndex+1)%heroes.length;
      renderHero();
    },7000);
  }

  function thumbs(p){
    const m=p.media||[];
    const cover=m.find(x=>x.is_cover);
    const rest=m.filter(x=>x!==cover).slice(0,3);
    const extra=Math.max(0,m.length-(cover?1:0)-rest.length);

    return rest.map(x=>
      `<img class="program-thumb" src="${esc(x.thumbnail_url||x.public_url)}" data-thumb="${esc(x.public_url)}" alt="">`
    ).join('')+(extra?`<span class="program-more">+${extra}</span>`:'');
  }

  function renderPrograms(items){
    const root=$('[data-public-programs]');

    if(!items.length){
      root.innerHTML='<div class="empty-state" style="grid-column:1/-1">Belum ada program aktif.</div>';
      return;
    }

    root.innerHTML=items.map(p=>{
      const media=p.media||[];
      const cover=(media.find(x=>x.is_cover)||media[0])?.public_url||p.cover_image_url||'';
      const pct=Math.min(100,Math.round((Number(p.raised_amount)||0)/(Number(p.target_amount)||1)*100));

      return `<article class="card public-program"><div class="program-poster" style="background-image:url('${esc(cover)}')" data-poster></div>${media.length>1?`<div class="program-thumbs">${thumbs(p)}</div>`:''}<div class="program-body"><span class="program-category">${esc(p.category)}</span><h3>${esc(p.program_name)}</h3><div class="progress"><span style="width:${pct}%"></span></div><div class="program-meta"><span>${idr(p.raised_amount)} terkumpul</span><span>${pct}%</span></div><a class="btn btn-primary" style="width:100%" href="./program.html?id=${encodeURIComponent(p.program_id)}">Lihat Program</a></div></article>`;
    }).join('');

    $$('[data-thumb]',root).forEach(t=>{
      t.onclick=()=>{
        const card=t.closest('.public-program');
        card.querySelector('[data-poster]').style.backgroundImage=`url('${t.dataset.thumb}')`;
      };
    });
  }

  function renderLiveDonations(items){
    const root=$('[data-live-donations]');
    if(!root)return;
    const rows=Array.isArray(items)?items:[];
    if(!rows.length){root.innerHTML='<div class="empty-state" style="grid-column:1/-1">Belum ada donasi tervalidasi. Live Donation akan terisi otomatis setelah pembayaran berstatus PAID.</div>';return}
    root.innerHTML=rows.map(x=>`<article class="card live-donation-card"><div class="live-donation-icon"><span class="material-symbols-outlined">volunteer_activism</span></div><div><strong>${esc(x.donor_label||'Hamba Allah')}</strong><p>${idr(x.amount)} · ${esc(x.program_name||'Program KIA')}</p></div></article>`).join('');
  }

  function renderFaq(items){
    const root=$('[data-faq-preview]');
    root.innerHTML=(items||[]).slice(0,4).map(x=>
      `<details><summary>${esc(x.question)}</summary><p>${esc(x.answer)}</p></details>`
    ).join('');
  }

  async function load(){
    try{
      const response=await fetch(`${KIA_CONFIG.BACKEND_URL}/api/public/bootstrap`,{cache:'no-store'});
      const r=await response.json();
      if(!r.success) throw new Error(r.message||'PUBLIC_BOOTSTRAP_FAILED');

      heroes=normalizedHeroes(r.data.heroes||[]);
      heroIndex=0;
      renderHero();
      restartHeroTimer();

      renderPrograms(r.data.programs||[]);
      renderLiveDonations(r.data.live_donations||[]);
      renderFaq(r.data.faqs||[]);
      $('[data-stat-paid]').textContent=idr(r.data.stats?.total_paid_amount);
      $('[data-stat-programs]').textContent=String(r.data.stats?.active_programs||0);
      $('[data-stat-disbursed]').textContent=idr(r.data.stats?.total_withdrawn_net);
    }catch(e){
      heroes=DEFAULT_HEROES;
      heroIndex=0;
      renderHero();
      restartHeroTimer();
      $('[data-public-programs]').innerHTML='<div class="empty-state" style="grid-column:1/-1">Program belum dapat dimuat. Silakan coba lagi.</div>';
      if($('[data-live-donations]'))$('[data-live-donations]').innerHTML='<div class="empty-state" style="grid-column:1/-1">Live Donation belum dapat dimuat.</div>';
    }
  }

  document.addEventListener('DOMContentLoaded',()=>{
    $('[data-hero-prev]').onclick=()=>{
      heroIndex=(heroIndex-1+heroes.length)%heroes.length;
      renderHero();
      restartHeroTimer();
    };

    $('[data-hero-next]').onclick=()=>{
      heroIndex=(heroIndex+1)%heroes.length;
      renderHero();
      restartHeroTimer();
    };

    load();
  });
})();
