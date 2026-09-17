(()=>{
  const $=(s,r=document)=>r.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>'\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'\"':'&quot;'}[c]));
  const idr=v=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v)||0);
  const dt=v=>{if(!v)return'—';try{return new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(v))}catch{return String(v)}};
  const CACHE_TTL=3*60*1000;
  let overlay=null,currentRef='',currentData=null,busy=false;
  const key=ref=>`kia_social_v058_${String(ref||'')}`;

  function readCache(ref){try{const x=JSON.parse(sessionStorage.getItem(key(ref))||'null');return x&&Date.now()-Number(x.saved_at||0)<CACHE_TTL?x.data:null}catch{return null}}
  function writeCache(ref,data){try{sessionStorage.setItem(key(ref),JSON.stringify({saved_at:Date.now(),data}))}catch{}}
  function dropCache(ref){try{sessionStorage.removeItem(key(ref))}catch{}}
  function initials(name){const p=String(name||'Hamba Allah').trim().split(/\s+/).filter(Boolean);return((p[0]?.[0]||'H')+(p[1]?.[0]||'')).toUpperCase()}
  function frameCode(profile){return String(profile?.frame_code||'DEFAULT').toLowerCase()}
  function avatar(profile,label){const url=String(profile?.avatar_url||'').trim();return `<div class="social-profile-avatar frame-${esc(frameCode(profile))}">${url?`<img src="${esc(url)}" alt="">`:`<span>${esc(initials(label))}</span>`}</div>`}
  function ensure(){
    if(overlay)return;
    overlay=document.createElement('div');overlay.className='donation-social-overlay-v058';overlay.hidden=true;
    overlay.innerHTML='<aside class="donation-social-sheet-v058" role="dialog" aria-modal="true"><div data-social-content></div></aside>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden)close()});
  }
  function close(){if(!overlay)return;overlay.hidden=true;document.body.classList.remove('social-open-v058');currentRef='';currentData=null}
  async function api(path,options={}){
    if(window.KiaAuth?.request)return KiaAuth.request(path,{timeout:10500,attempts:1,...options});
    const c=new AbortController(),t=setTimeout(()=>c.abort(),10500);
    try{
      const r=await fetch((KIA_CONFIG.BACKEND_URL||'').replace(/\/$/,'')+path,{cache:'no-store',...options,signal:c.signal});
      const raw=await r.text();let j;try{j=JSON.parse(raw)}catch{throw new Error('Server belum siap. Coba lagi sebentar.')}
      if(!r.ok||!j.success)throw new Error(j.message||'REQUEST_FAILED');return j;
    }finally{clearTimeout(t)}
  }
  function profileHtml(d){
    const p=d.donor_profile||null,label=d.donor_label||'Hamba Allah';
    const badges=Array.isArray(p?.badges)?p.badges:[];
    return `<div class="social-donor-profile-v058">${avatar(p,label)}<div class="social-profile-copy-v058"><div class="social-profile-name-v058"><strong>${esc(label)}</strong><span class="donor-badge donor-badge--${esc(String(d.donor_badge_code||'REGISTERED').toLowerCase())}">${esc(d.donor_badge||'Terdaftar')}</span>${p?.verified?'<span class="profile-verified-mini-v058"><span class="material-symbols-outlined">verified</span>Identitas</span>':''}</div>${p?`<div class="social-level-v058">${esc(p.level_label||'Teman KIA')}</div><div class="social-achievements-v058">${badges.slice(0,4).map(b=>`<span><span class="material-symbols-outlined">${esc(b.icon||'workspace_premium')}</span>${esc(b.label||'Badge')}</span>`).join('')||'<span class="muted">Badge aktivitas akan muncul seiring kontribusi.</span>'}</div>`:'<div class="social-level-v058 muted">Profil aktivitas belum tersedia.</div>'}</div></div>`
  }
  function timelineHtml(items){
    if(!items?.length)return '<div class="social-empty-v058">Belum ada interaksi. Jadilah yang pertama memberi dukungan atau doa.</div>';
    return `<div class="social-timeline-v058">${items.map(x=>`<div class="social-event-v058" ${x._optimistic?'data-optimistic="1"':''}><span class="material-symbols-outlined">${x.type==='LOVE'?'favorite':'volunteer_activism'}</span><div><strong>${esc(x.actor_label||'Pengguna KIA')}</strong> ${x.type==='LOVE'?'memberi love':'menitipkan doa'}${x.message?`<p>“${esc(x.message)}”</p>`:''}<time>${esc(dt(x.created_at))}</time></div></div>`).join('')}</div>`
  }
  function render(data,{stale=false}={}){
    currentData=data;
    const d=data?.donation||{},counts=data?.counts||{},viewer=data?.viewer||{},content=$('[data-social-content]',overlay);
    if(!d.social_enabled){
      content.innerHTML=`<div class="social-sheet-head-v058"><div><span class="social-kicker-v058">DONASI TERVALIDASI</span><h2>Interaksi Donatur</h2></div><button class="social-close-v058" type="button" data-social-close>×</button></div><div class="social-empty-v058">Interaksi hanya tersedia untuk donasi yang dibuat melalui akun KIA dan tidak disembunyikan sebagai anonim.</div>`;
      $('[data-social-close]',overlay)?.addEventListener('click',close);return;
    }
    content.innerHTML=`<div class="social-sheet-head-v058"><div><span class="social-kicker-v058">DONASI TERVALIDASI</span><h2>Timeline Dukungan</h2></div><button class="social-close-v058" type="button" data-social-close aria-label="Tutup">×</button></div>
      ${stale?'<div class="social-sync-note-v058">Menampilkan data tersimpan sambil menyinkronkan…</div>':''}
      <div class="social-donation-summary-v058"><strong>${idr(d.amount)}</strong><span>${esc(d.program_name||'Program KIA')}</span><time>${esc(dt(d.paid_at))}</time></div>
      ${profileHtml(d)}
      ${d.message?`<blockquote class="social-original-message-v058">“${esc(d.message)}”</blockquote>`:''}
      <div class="social-actions-v058"><button class="btn ${viewer.loved?'btn-primary':'btn-ghost'}" type="button" data-social-love ${viewer.authenticated?'':'disabled'}><span class="material-symbols-outlined">favorite</span> <span data-love-label>${viewer.loved?'Disukai':'Love'}</span> <b data-love-count>${Number(counts.love)||0}</b></button><span class="muted mini"><b data-message-count>${Number(counts.messages)||0}</b> doa/pesan</span></div>
      ${viewer.authenticated?`<form class="social-message-form-v058" data-social-form><textarea maxlength="280" name="message" placeholder="Tulis doa atau pesan positif…" required></textarea><div><span class="muted mini">Maks. 280 karakter</span><button class="btn btn-primary" type="submit">Kirim Doa</button></div></form>`:`<div class="social-login-note-v058">Masuk ke akun KIA untuk memberi love atau mengirim doa. <a href="./login.html">Masuk</a></div>`}
      <div class="social-timeline-head-v058"><h3>Aktivitas</h3><span>${(data.timeline||[]).length} terbaru</span></div>
      <div data-social-timeline>${timelineHtml(data.timeline||[])}</div>`;
    $('[data-social-close]',overlay)?.addEventListener('click',close);
    $('[data-social-love]',overlay)?.addEventListener('click',toggleLove);
    $('[data-social-form]',overlay)?.addEventListener('submit',sendMessage);
  }
  function refreshTimelineOnly(){const root=$('[data-social-timeline]',overlay);if(root)root.innerHTML=timelineHtml(currentData?.timeline||[]);const head=$('.social-timeline-head-v058 span',overlay);if(head)head.textContent=`${(currentData?.timeline||[]).length} terbaru`}
  function syncCounts(){if(!currentData)return;const love=$('[data-love-count]',overlay),messages=$('[data-message-count]',overlay),btn=$('[data-social-love]',overlay),label=$('[data-love-label]',overlay);if(love)love.textContent=Number(currentData.counts?.love)||0;if(messages)messages.textContent=Number(currentData.counts?.messages)||0;if(btn){btn.classList.toggle('btn-primary',!!currentData.viewer?.loved);btn.classList.toggle('btn-ghost',!currentData.viewer?.loved)}if(label)label.textContent=currentData.viewer?.loved?'Disukai':'Love'}
  async function fetchSocial(ref){const r=await api(`/api/public/donations/${encodeURIComponent(ref)}/social`);r.data._partial=false;writeCache(ref,r.data);return r.data}
  async function load({background=false}={}){
    const ref=currentRef;if(!ref)return;
    const content=$('[data-social-content]',overlay),cached=readCache(ref);
    if(cached&&!currentData){render(cached,{stale:true})}
    else if(!cached&&!background)content.innerHTML='<div class="social-loading-v058 social-loading-soft-v058"><strong>Timeline Dukungan</strong><span>Menyiapkan aktivitas terbaru…</span></div>';
    const slow=null;
    try{const data=await fetchSocial(ref);if(currentRef===ref)render(data)}catch(e){if(currentRef!==ref)return;if(cached){render(cached);showInline('Sinkronisasi belum selesai. Data tersimpan tetap ditampilkan.')}else if(!background){content.innerHTML=`<div class="social-error-v058">${esc(e.message||'Timeline belum dapat dimuat.')}<button class="btn btn-ghost" type="button" data-social-retry>Coba Lagi</button></div>`;$('[data-social-retry]',overlay)?.addEventListener('click',()=>load())}}finally{if(slow)clearTimeout(slow)}
  }
  async function prefetch(ref,{force=false}={}){if(!ref)return;const cached=readCache(ref);if(!force&&cached&&!cached._partial)return;try{await fetchSocial(ref)}catch(_){}}
  function seed(item){if(!item?.social_enabled||!item?.donation_ref)return;const existing=readCache(item.donation_ref);if(existing&&!existing._partial)return;const user=window.KiaAuth?.getUser?.()||{};const data={_partial:true,donation:{donation_ref:item.donation_ref,donor_label:item.donor_label||'Pengguna KIA',donor_badge:item.donor_badge||'Terdaftar',donor_badge_code:item.donor_badge_code||'REGISTERED',social_enabled:true,donor_profile:item.donor_profile||null,amount:Number(item.amount)||0,message:item.message||'',program_id:item.program_id||'',program_name:item.program_name||'Program KIA',paid_at:item.paid_at||''},counts:{love:0,messages:0},viewer:{authenticated:!!window.KiaAuth?.getToken?.(),loved:false,actor_label:user.full_name||''},timeline:[]};writeCache(item.donation_ref,data)}
  async function toggleLove(){
    if(busy||!currentRef||!currentData?.viewer?.authenticated)return;
    busy=true;
    const beforeLoved=!!currentData.viewer.loved,beforeCount=Number(currentData.counts?.love)||0;
    currentData.viewer.loved=!beforeLoved;
    currentData.counts.love=Math.max(0,beforeCount+(beforeLoved?-1:1));
    syncCounts();writeCache(currentRef,currentData);
    const btn=$('[data-social-love]',overlay);
    btn?.classList.add('is-optimistic');
    try{
      const r=await api(`/api/social/donations/${encodeURIComponent(currentRef)}/love`,{method:'POST',body:'{}'});
      currentData.viewer.loved=!!r.data?.liked;
      currentData.counts.love=Math.max(0,beforeCount+(r.data?.liked?(beforeLoved?0:1):(beforeLoved?-1:0)));
      writeCache(currentRef,currentData);syncCounts();
    }catch(e){
      currentData.viewer.loved=beforeLoved;currentData.counts.love=beforeCount;writeCache(currentRef,currentData);syncCounts();showInline(e.message);
    }finally{
      busy=false;btn?.classList.remove('is-optimistic');
    }
  }
  async function sendMessage(e){
    e.preventDefault();if(busy||!currentRef||!currentData?.viewer?.authenticated)return;
    const form=e.currentTarget,msg=String(new FormData(form).get('message')||'').trim();if(!msg)return;
    busy=true;const btn=form.querySelector('button[type=submit]'),textarea=form.querySelector('textarea');
    const originalLabel=btn.textContent;btn.disabled=true;btn.textContent='Terkirim ✓';
    const messageId='msg_'+(crypto.randomUUID?crypto.randomUUID().replace(/-/g,''):Date.now().toString(36)+Math.random().toString(36).slice(2));
    const optimistic={type:'MESSAGE',actor_label:currentData.viewer.actor_label||window.KiaAuth?.getUser?.()?.full_name||'Pengguna KIA',message:msg,created_at:new Date().toISOString(),_optimistic:true,_id:messageId};
    currentData.timeline=[optimistic,...(currentData.timeline||[])].slice(0,30);currentData.counts.messages=(Number(currentData.counts?.messages)||0)+1;textarea.value='';writeCache(currentRef,currentData);refreshTimelineOnly();syncCounts();
    try{
      const r=await api(`/api/social/donations/${encodeURIComponent(currentRef)}/messages`,{method:'POST',body:JSON.stringify({message:msg,message_id:messageId})});
      const event=r.data?.event||optimistic;currentData.timeline=(currentData.timeline||[]).map(x=>x._id===messageId?event:x);writeCache(currentRef,currentData);refreshTimelineOnly();
    }catch(err){
      currentData.timeline=(currentData.timeline||[]).filter(x=>x._id!==messageId);currentData.counts.messages=Math.max(0,(Number(currentData.counts?.messages)||1)-1);textarea.value=msg;writeCache(currentRef,currentData);refreshTimelineOnly();syncCounts();showInline(err.message);
    }finally{busy=false;setTimeout(()=>{btn.disabled=false;btn.textContent=originalLabel},250)}
  }
  function showInline(message){let el=$('[data-social-inline]',overlay);if(!el){el=document.createElement('div');el.dataset.socialInline='1';el.className='social-inline-v058';$('[data-social-content]',overlay)?.prepend(el)}el.textContent=message||'Aksi belum dapat diproses.';setTimeout(()=>el?.remove(),3500)}
  function open(ref){if(!ref)return;ensure();currentRef=String(ref);currentData=null;overlay.hidden=false;document.body.classList.add('social-open-v058');const cached=readCache(currentRef);if(cached){render(cached,{stale:true});load({background:true})}else load()}
  function bind(){document.addEventListener('click',e=>{if(e.target.closest('a,button,textarea,input'))return;const row=e.target.closest('[data-donation-ref][data-social-enabled="1"]');if(row)open(row.dataset.donationRef)});document.addEventListener('keydown',e=>{const row=e.target.closest?.('[data-donation-ref][data-social-enabled="1"]');if(row&&(e.key==='Enter'||e.key===' ')){e.preventDefault();open(row.dataset.donationRef)}})}
  document.addEventListener('DOMContentLoaded',bind);
  window.KiaDonationSocial={open,close,prefetch,dropCache,seed};
})();
