(()=>{
  const $=(s,r=document)=>r.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':'&quot;'}[c]));
  const idr=v=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v)||0);
  const dt=v=>{if(!v)return'—';try{return new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(v))}catch{return String(v)}};
  const CACHE_TTL=3*60*1000;
  const QUEUE_KEY='kia_social_pending_v059';
  let overlay=null,currentRef='',currentData=null;
  const loveWorkers=new Map();
  const messageWorkers=new Set();
  const retryTimers=new Map();
  const key=ref=>`kia_social_v059_${String(ref||'')}`;
  const legacyKey=ref=>`kia_social_v058_${String(ref||'')}`;

  function readCache(ref){
    try{
      for(const k of [key(ref),legacyKey(ref)]){
        const x=JSON.parse(sessionStorage.getItem(k)||'null');
        if(x&&Date.now()-Number(x.saved_at||0)<CACHE_TTL)return x.data;
      }
      return null;
    }catch{return null}
  }
  function writeCache(ref,data){try{sessionStorage.setItem(key(ref),JSON.stringify({saved_at:Date.now(),data}))}catch{}}
  function dropCache(ref){try{sessionStorage.removeItem(key(ref));sessionStorage.removeItem(legacyKey(ref))}catch{}}
  function readQueue(){
    try{
      const q=JSON.parse(localStorage.getItem(QUEUE_KEY)||'null');
      return q&&typeof q==='object'?{love:q.love||{},messages:Array.isArray(q.messages)?q.messages:[]}:{love:{},messages:[]};
    }catch{return {love:{},messages:[]}}
  }
  function writeQueue(q){try{localStorage.setItem(QUEUE_KEY,JSON.stringify(q))}catch{}}
  function initials(name){const p=String(name||'Hamba Allah').trim().split(/\s+/).filter(Boolean);return((p[0]?.[0]||'H')+(p[1]?.[0]||'')).toUpperCase()}
  function frameCode(profile){return String(profile?.frame_code||'DEFAULT').toLowerCase()}
  function materialAvatarV0520(v){const s=String(v||'').trim();return s.startsWith('material:')?s.slice(9):''}
  function avatar(profile,label){const url=String(profile?.avatar_url||'').trim(),mi=materialAvatarV0520(url);return `<div class="social-profile-avatar frame-${esc(frameCode(profile))}">${mi?`<span class="material-symbols-outlined">${esc(mi)}</span>`:url?`<img src="${esc(url)}" alt="">`:`<span>${esc(initials(label))}</span>`}</div>`}
  function ensure(){
    if(overlay)return;
    overlay=document.createElement('div');
    overlay.className='donation-social-overlay-v058';
    overlay.hidden=true;
    overlay.innerHTML='<aside class="donation-social-sheet-v058" role="dialog" aria-modal="true"><div data-social-content></div></aside>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click',e=>{
      if(e.target===overlay)close();
      const retry=e.target.closest?.('[data-social-retry-message]');
      if(retry){e.preventDefault();retryMessage(retry.dataset.socialRetryMessage)}
    });
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden)close()});
  }
  function close(){if(!overlay)return;overlay.hidden=true;document.body.classList.remove('social-open-v058');currentRef='';currentData=null}
  async function api(path,options={}){
    if(window.KiaAuth?.request)return KiaAuth.request(path,{timeout:10500,attempts:1,...options});
    const c=new AbortController(),t=setTimeout(()=>c.abort(),10500);
    try{
      const r=await fetch((KIA_CONFIG.BACKEND_URL||'').replace(/\/$/,'')+path,{cache:'no-store',...options,signal:c.signal});
      const raw=await r.text();let j;try{j=JSON.parse(raw)}catch{throw new Error('Server belum siap. Coba lagi sebentar.')}
      if(!r.ok||!j.success)throw new Error(j.message||'REQUEST_FAILED');
      return j;
    }finally{clearTimeout(t)}
  }
  function profileHtml(d){
    const p=d.donor_profile||null,label=d.donor_label||'Hamba Allah';
    const badges=Array.isArray(p?.badges)?p.badges:[];
    return `<div class="social-donor-profile-v058">${avatar(p,label)}<div class="social-profile-copy-v058"><div class="social-profile-name-v058"><strong>${esc(label)}</strong><span class="donor-badge donor-badge--${esc(String(d.donor_badge_code||'REGISTERED').toLowerCase())}">${esc(d.donor_badge||'Terdaftar')}</span>${p?.verified?'<span class="profile-verified-mini-v058"><span class="material-symbols-outlined">verified</span>Identitas</span>':''}</div>${p?`<div class="social-level-v058">${esc(p.level_label||'Teman KIA')}</div><div class="social-achievements-v058">${badges.slice(0,4).map(b=>`<span><span class="material-symbols-outlined">${esc(b.icon||'workspace_premium')}</span>${esc(b.label||'Badge')}</span>`).join('')||'<span class="muted">Badge aktivitas akan muncul seiring kontribusi.</span>'}</div>`:'<div class="social-level-v058 muted">Profil aktivitas belum tersedia.</div>'}</div></div>`
  }
  function timelineHtml(items){
    if(!items?.length)return '<div class="social-empty-v058">Belum ada interaksi. Jadilah yang pertama memberi dukungan atau doa.</div>';
    return `<div class="social-timeline-v058">${items.map(x=>{
      const pending=x._syncState==='sending'?'<span class="social-event-state-v059">Mengirim…</span>':'';
      const failed=x._syncState==='failed'?`<button class="social-retry-v059" type="button" data-social-retry-message="${esc(x._id||'')}">Gagal dikirim · Coba lagi</button>`:'';
      return `<div class="social-event-v058" ${x._optimistic?'data-optimistic="1"':''}><span class="material-symbols-outlined">${x.type==='LOVE'?'favorite':'volunteer_activism'}</span><div><strong>${esc(x.actor_label||'Pengguna KIA')}</strong> ${x.type==='LOVE'?'memberi love':'menitipkan doa'}${x.message?`<p>“${esc(x.message)}”</p>`:''}<time>${esc(dt(x.created_at))}</time>${pending}${failed}</div></div>`;
    }).join('')}</div>`
  }
  function applyPending(data,ref){
    const q=readQueue();
    const out={...data,counts:{...(data?.counts||{})},viewer:{...(data?.viewer||{})},timeline:[...(data?.timeline||[])]};
    const love=q.love?.[ref];
    if(love&&out.viewer?.authenticated){
      const serverLoved=!!out.viewer.loved;
      const desired=!!love.desired;
      out.viewer.loved=desired;
      out.counts.love=Math.max(0,(Number(out.counts.love)||0)+(desired===serverLoved?0:(desired?1:-1)));
      const actor=out.viewer.actor_label||window.KiaAuth?.getUser?.()?.full_name||'Pengguna KIA';
      const exists=out.timeline.some(x=>x.type==='LOVE'&&(x._viewerLove||x.actor_label===actor));
      if(desired&&!exists)out.timeline.unshift({type:'LOVE',actor_label:actor,created_at:love.updated_at||new Date().toISOString(),_optimistic:true,_viewerLove:true,_id:`love_${ref}`});
      if(!desired)out.timeline=out.timeline.filter(x=>!(x.type==='LOVE'&&(x._viewerLove||x.actor_label===actor)));
    }
    q.messages.filter(x=>x.ref===ref).forEach(item=>{
      const exists=out.timeline.some(x=>String(x._id||x.message_id||'')===String(item.message_id));
      if(!exists)out.timeline.unshift({type:'MESSAGE',actor_label:item.actor_label,message:item.message,created_at:item.created_at,_optimistic:true,_syncState:item.status==='failed'?'failed':'sending',_id:item.message_id});
    });
    return out;
  }
  function render(data,{stale=false}={}){
    currentData=applyPending(data,currentRef);
    const d=currentData?.donation||{},counts=currentData?.counts||{},viewer=currentData?.viewer||{},content=$('[data-social-content]',overlay);
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
      <div class="social-timeline-head-v058"><h3>Aktivitas</h3><span>${(currentData.timeline||[]).length} terbaru</span></div>
      <div data-social-timeline>${timelineHtml(currentData.timeline||[])}</div>`;
    $('[data-social-close]',overlay)?.addEventListener('click',close);
    $('[data-social-love]',overlay)?.addEventListener('click',toggleLove);
    $('[data-social-form]',overlay)?.addEventListener('submit',sendMessage);
  }
  function refreshTimelineOnly(){
    const root=$('[data-social-timeline]',overlay);
    if(root)root.innerHTML=timelineHtml(currentData?.timeline||[]);
    const head=$('.social-timeline-head-v058 span',overlay);
    if(head)head.textContent=`${(currentData?.timeline||[]).length} terbaru`;
  }
  function syncCounts(){
    if(!currentData)return;
    const love=$('[data-love-count]',overlay),messages=$('[data-message-count]',overlay),btn=$('[data-social-love]',overlay),label=$('[data-love-label]',overlay);
    if(love)love.textContent=Number(currentData.counts?.love)||0;
    if(messages)messages.textContent=Number(currentData.counts?.messages)||0;
    if(btn){btn.classList.toggle('btn-primary',!!currentData.viewer?.loved);btn.classList.toggle('btn-ghost',!currentData.viewer?.loved)}
    if(label)label.textContent=currentData.viewer?.loved?'Disukai':'Love';
  }
  async function fetchSocial(ref){
    const r=await api(`/api/public/donations/${encodeURIComponent(ref)}/social`);
    r.data._partial=false;
    const merged=applyPending(r.data,ref);
    writeCache(ref,merged);
    return merged;
  }
  async function load({background=false}={}){
    const ref=currentRef;if(!ref)return;
    const content=$('[data-social-content]',overlay),cached=readCache(ref);
    if(cached&&!currentData)render(cached,{stale:true});
    else if(!cached&&!background)content.innerHTML='<div class="social-loading-v058 social-loading-soft-v058"><strong>Timeline Dukungan</strong><span>Menyiapkan aktivitas terbaru…</span></div>';
    try{
      const data=await fetchSocial(ref);
      if(currentRef===ref)render(data);
    }catch(e){
      if(currentRef!==ref)return;
      if(cached){render(cached);showInline('Sinkronisasi terbaru belum selesai. Data lokal tetap ditampilkan.')}
      else if(!background){content.innerHTML=`<div class="social-error-v058">${esc(e.message||'Timeline belum dapat dimuat.')}<button class="btn btn-ghost" type="button" data-social-retry>Coba Lagi</button></div>`;$('[data-social-retry]',overlay)?.addEventListener('click',()=>load())}
    }
  }
  async function prefetch(ref,{force=false}={}){
    if(!ref)return;
    const cached=readCache(ref);
    if(!force&&cached&&!cached._partial)return;
    try{await fetchSocial(ref)}catch(_){}
  }
  function seed(item){
    if(!item?.social_enabled||!item?.donation_ref)return;
    const existing=readCache(item.donation_ref);
    if(existing&&!existing._partial)return;
    const user=window.KiaAuth?.getUser?.()||{};
    const data={_partial:true,donation:{donation_ref:item.donation_ref,donor_label:item.donor_label||'Pengguna KIA',donor_badge:item.donor_badge||'Terdaftar',donor_badge_code:item.donor_badge_code||'REGISTERED',social_enabled:true,donor_profile:item.donor_profile||null,amount:Number(item.amount)||0,message:item.message||'',program_id:item.program_id||'',program_name:item.program_name||'Program KIA',paid_at:item.paid_at||''},counts:{love:0,messages:0},viewer:{authenticated:!!window.KiaAuth?.getToken?.(),loved:false,actor_label:user.full_name||''},timeline:[]};
    writeCache(item.donation_ref,applyPending(data,item.donation_ref));
  }
  function queueLove(ref,desired){
    const q=readQueue();
    q.love[ref]={desired:!!desired,updated_at:new Date().toISOString(),needs_reconcile:false,attempts:0};
    writeQueue(q);
  }
  function markLoveUncertain(ref){
    const q=readQueue();
    if(q.love[ref]){q.love[ref].needs_reconcile=true;q.love[ref].attempts=Number(q.love[ref].attempts||0)+1;writeQueue(q)}
  }
  function clearLoveQueue(ref){
    const q=readQueue();
    delete q.love[ref];
    writeQueue(q);
  }
  function scheduleLoveRetry(ref){
    clearTimeout(retryTimers.get(ref));
    const q=readQueue(),attempts=Number(q.love?.[ref]?.attempts||0);
    const delay=Math.min(30000,2500*Math.max(1,attempts));
    retryTimers.set(ref,setTimeout(()=>syncLove(ref),delay));
  }
  async function syncLove(ref){
    if(loveWorkers.get(ref))return;
    const worker=(async()=>{
      while(true){
        const q=readQueue(),item=q.love?.[ref];
        if(!item)return;
        const desired=!!item.desired;
        try{
          if(item.needs_reconcile){
            const fresh=await api(`/api/public/donations/${encodeURIComponent(ref)}/social`);
            const serverLoved=!!fresh.data?.viewer?.loved;
            if(serverLoved===desired){
              clearLoveQueue(ref);
              if(currentRef===ref){currentData=applyPending(fresh.data,ref);writeCache(ref,currentData);syncCounts();refreshTimelineOnly()}
              return;
            }
          }
          const r=await api(`/api/social/donations/${encodeURIComponent(ref)}/love`,{method:'POST',body:'{}'});
          const serverLoved=!!r.data?.liked;
          const newest=readQueue().love?.[ref];
          if(!newest)return;
          if(serverLoved===!!newest.desired){
            clearLoveQueue(ref);
            if(currentRef===ref&&currentData){
              currentData.viewer.loved=serverLoved;
              writeCache(ref,currentData);
              syncCounts();
            }
            return;
          }
          newest.needs_reconcile=false;newest.attempts=0;
          const q2=readQueue();q2.love[ref]=newest;writeQueue(q2);
        }catch(_){
          markLoveUncertain(ref);
          scheduleLoveRetry(ref);
          if(currentRef===ref)showInline('Love tersimpan di perangkat dan akan disinkronkan otomatis.');
          return;
        }
      }
    })().finally(()=>loveWorkers.delete(ref));
    loveWorkers.set(ref,worker);
    return worker;
  }
  function toggleLove(){
    if(!currentRef||!currentData?.viewer?.authenticated)return;
    const before=!!currentData.viewer.loved,desired=!before;
    currentData.viewer.loved=desired;
    currentData.counts.love=Math.max(0,(Number(currentData.counts?.love)||0)+(desired?1:-1));
    const actor=currentData.viewer.actor_label||window.KiaAuth?.getUser?.()?.full_name||'Pengguna KIA';
    if(desired){
      currentData.timeline=[{type:'LOVE',actor_label:actor,created_at:new Date().toISOString(),_optimistic:true,_viewerLove:true,_id:`love_${currentRef}`},...(currentData.timeline||[]).filter(x=>!(x.type==='LOVE'&&(x._viewerLove||x.actor_label===actor)))].slice(0,30);
    }else{
      currentData.timeline=(currentData.timeline||[]).filter(x=>!(x.type==='LOVE'&&(x._viewerLove||x.actor_label===actor)));
    }
    queueLove(currentRef,desired);
    writeCache(currentRef,currentData);
    syncCounts();
    refreshTimelineOnly();
    syncLove(currentRef);
  }
  function queueMessage(item){
    const q=readQueue();
    const i=q.messages.findIndex(x=>x.message_id===item.message_id);
    if(i>=0)q.messages[i]={...q.messages[i],...item};else q.messages.push(item);
    q.messages=q.messages.slice(-80);
    writeQueue(q);
  }
  function removeMessageQueue(messageId){
    const q=readQueue();
    q.messages=q.messages.filter(x=>x.message_id!==messageId);
    writeQueue(q);
  }
  function updateLocalMessageState(messageId,state){
    if(!currentData)return;
    currentData.timeline=(currentData.timeline||[]).map(x=>x._id===messageId?{...x,_syncState:state,_optimistic:state!=='sent'}:x);
    writeCache(currentRef,currentData);
    refreshTimelineOnly();
  }
  async function syncMessage(messageId){
    if(messageWorkers.has(messageId))return;
    const q=readQueue(),item=q.messages.find(x=>x.message_id===messageId);
    if(!item)return;
    messageWorkers.add(messageId);
    try{
      const r=await api(`/api/social/donations/${encodeURIComponent(item.ref)}/messages`,{method:'POST',body:JSON.stringify({message:item.message,message_id:item.message_id})});
      const event=r.data?.event||{type:'MESSAGE',actor_label:item.actor_label,message:item.message,created_at:item.created_at};
      removeMessageQueue(messageId);
      if(currentRef===item.ref&&currentData){
        currentData.timeline=(currentData.timeline||[]).map(x=>x._id===messageId?{...event,_id:messageId}:x);
        writeCache(currentRef,currentData);refreshTimelineOnly();
      }
    }catch(_){
      const q2=readQueue(),idx=q2.messages.findIndex(x=>x.message_id===messageId);
      if(idx>=0){q2.messages[idx].status='failed';q2.messages[idx].attempts=Number(q2.messages[idx].attempts||0)+1;writeQueue(q2)}
      if(currentRef===item.ref)updateLocalMessageState(messageId,'failed');
    }finally{messageWorkers.delete(messageId)}
  }
  function retryMessage(messageId){
    const q=readQueue(),idx=q.messages.findIndex(x=>x.message_id===messageId);
    if(idx<0)return;
    q.messages[idx].status='sending';writeQueue(q);
    updateLocalMessageState(messageId,'sending');
    syncMessage(messageId);
  }
  function sendMessage(e){
    e.preventDefault();
    if(!currentRef||!currentData?.viewer?.authenticated)return;
    const form=e.currentTarget,msg=String(new FormData(form).get('message')||'').trim();if(!msg)return;
    const textarea=form.querySelector('textarea'),btn=form.querySelector('button[type=submit]');
    const messageId='msg_'+(crypto.randomUUID?crypto.randomUUID().replace(/-/g,''):Date.now().toString(36)+Math.random().toString(36).slice(2));
    const actor=currentData.viewer.actor_label||window.KiaAuth?.getUser?.()?.full_name||'Pengguna KIA';
    const createdAt=new Date().toISOString();
    const optimistic={type:'MESSAGE',actor_label:actor,message:msg,created_at:createdAt,_optimistic:true,_syncState:'sending',_id:messageId};
    currentData.timeline=[optimistic,...(currentData.timeline||[])].slice(0,30);
    currentData.counts.messages=(Number(currentData.counts?.messages)||0)+1;
    textarea.value='';
    queueMessage({ref:currentRef,message_id:messageId,message:msg,actor_label:actor,created_at:createdAt,status:'sending',attempts:0});
    writeCache(currentRef,currentData);refreshTimelineOnly();syncCounts();
    const old=btn.textContent;btn.textContent='Terkirim ✓';setTimeout(()=>btn.textContent=old,450);
    syncMessage(messageId);
  }
  function flushQueue(){
    const q=readQueue();
    Object.keys(q.love||{}).forEach(syncLove);
    q.messages.filter(x=>x.status!=='sent').forEach(x=>{if(x.status==='failed')return;syncMessage(x.message_id)});
  }
  function showInline(message){
    let el=$('[data-social-inline]',overlay);
    if(!el){el=document.createElement('div');el.dataset.socialInline='1';el.className='social-inline-v058';$('[data-social-content]',overlay)?.prepend(el)}
    el.textContent=message||'Aksi belum dapat diproses.';
    setTimeout(()=>el?.remove(),3500);
  }
  function open(ref){
    if(!ref)return;
    ensure();currentRef=String(ref);currentData=null;overlay.hidden=false;document.body.classList.add('social-open-v058');
    const cached=readCache(currentRef);
    if(cached){render(cached,{stale:true});load({background:true})}else load();
    flushQueue();
  }
  function bind(){
    document.addEventListener('click',e=>{
      if(e.target.closest('a,button,textarea,input'))return;
      const row=e.target.closest('[data-donation-ref][data-social-enabled="1"]');
      if(row)open(row.dataset.donationRef);
    });
    document.addEventListener('keydown',e=>{
      const row=e.target.closest?.('[data-donation-ref][data-social-enabled="1"]');
      if(row&&(e.key==='Enter'||e.key===' ')){e.preventDefault();open(row.dataset.donationRef)}
    });
    window.addEventListener('online',flushQueue);
    setInterval(()=>{if(navigator.onLine)flushQueue()},15000);
  }
  document.addEventListener('DOMContentLoaded',bind);
  window.KiaDonationSocial={open,close,prefetch,dropCache,seed,flushQueue};
})();
