(() => {
  const $=s=>document.querySelector(s);
  const idr=v=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v)||0);
  async function load(){
    const id=new URLSearchParams(location.search).get('id');
    if(!id){$('[data-program-loading]').textContent='ID program tidak ditemukan.';return}
    const base=(window.KIA_CONFIG.BACKEND_URL||'').replace(/\/$/,'');
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),18000);
    try{
      const res=await fetch(base+'/api/public/programs/'+encodeURIComponent(id),{cache:'no-store',signal:controller.signal});
      const body=await res.json().catch(()=>null);
      if(!res.ok||!body?.success) throw new Error(body?.message||'Program gagal dimuat.');
      render(body.data.program);
    }catch(err){
      $('[data-program-loading]').textContent=err.name==='AbortError'?'Server terlalu lama merespons. Silakan muat ulang halaman.':err.message;
    }finally{clearTimeout(timer)}
  }
  function render(p){
    $('[data-program-name]').textContent=p.program_name||'Program KIA';
    $('[data-program-category]').textContent=p.category||'Program';
    $('[data-program-summary]').textContent=p.short_description||'';
    $('[data-program-description]').textContent=p.description||'Belum ada deskripsi.';
    const target=Number(p.target_amount)||0,raised=Number(p.raised_amount)||0;
    const pct=target>0?Math.max(0,Math.min(100,(raised/target)*100)):0;
    $('[data-program-progress]').style.width=pct.toFixed(2)+'%';
    $('[data-program-raised]').textContent=idr(raised)+' terkumpul';
    $('[data-program-target]').textContent='Target '+idr(target);
    if(String(p.cover_image_url||'').startsWith('https://')) $('[data-program-cover]').style.backgroundImage=`url("${String(p.cover_image_url).replaceAll('"','%22')}")`;
    $('[data-program-loading]').hidden=true;
    $('[data-program-content]').hidden=false;
    document.title=(p.program_name||'Program')+' | KIA';
  }
  async function share(){
    const data={title:document.title,text:'Lihat program penggalangan dana ini di KIA.',url:location.href};
    try{
      if(navigator.share){await navigator.share(data);return}
      await navigator.clipboard.writeText(location.href);
      KiaUI.toast('Link program disalin.',{type:'success'});
    }catch(err){
      if(err.name!=='AbortError') KiaUI.toast('Link belum dapat dibagikan.',{type:'error'});
    }
  }
  document.addEventListener('DOMContentLoaded',()=>{
    $('[data-share]')?.addEventListener('click',share);
    load();
  });
})();
