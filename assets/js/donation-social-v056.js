(()=>{
  const $=(s,r=document)=>r.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>'\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'\"':'&quot;'}[c]));
  const idr=v=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v)||0);
  const dt=v=>{if(!v)return'—';try{return new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(v))}catch{return String(v)}};
  let overlay=null,currentRef='',busy=false;

  function initials(name){const p=String(name||'Hamba Allah').trim().split(/\s+/).filter(Boolean);return((p[0]?.[0]||'H')+(p[1]?.[0]||'')).toUpperCase()}
  function frameCode(profile){return String(profile?.frame_code||'DEFAULT').toLowerCase()}
  function avatar(profile,label){const url=String(profile?.avatar_url||'').trim();return `<div class="social-profile-avatar frame-${esc(frameCode(profile))}">${url?`<img src="${esc(url)}" alt="">`:`<span>${esc(initials(label))}</span>`}</div>`}
  function ensure(){
    if(overlay)return;
    overlay=document.createElement('div');overlay.className='donation-social-overlay-v056';overlay.hidden=true;
    overlay.innerHTML='<aside class="donation-social-sheet-v056" role="dialog" aria-modal="true"><div data-social-content></div></aside>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden)close()});
  }
  function close(){if(!overlay)return;overlay.hidden=true;document.body.classList.remove('social-open-v056');currentRef=''}
  async function api(path,options={}){
    if(window.KiaAuth?.request)return KiaAuth.request(path,{timeout:30000,...options});
    const r=await fetch((KIA_CONFIG.BACKEND_URL||'').replace(/\/$/,'')+path,options);const raw=await r.text();let j;try{j=JSON.parse(raw)}catch{throw new Error('Respons server belum siap.')}if(!r.ok||!j.success)throw new Error(j.message||'REQUEST_FAILED');return j;
  }
  function profileHtml(d){
    const p=d.donor_profile||null,label=d.donor_label||'Hamba Allah';
    const badges=Array.isArray(p?.badges)?p.badges:[];
    return `<div class="social-donor-profile-v056">${avatar(p,label)}<div class="social-profile-copy-v056"><div class="social-profile-name-v056"><strong>${esc(label)}</strong><span class="donor-badge donor-badge--${esc(String(d.donor_badge_code||'GENERAL').toLowerCase())}">${esc(d.donor_badge||'Umum')}</span></div>${p?`<div class="social-level-v056">${esc(p.level_label||'Teman KIA')}</div><div class="social-achievements-v056">${badges.slice(0,4).map(b=>`<span><span class="material-symbols-outlined">${esc(b.icon||'workspace_premium')}</span>${esc(b.label||'Badge')}</span>`).join('')||'<span class="muted">Badge aktivitas akan muncul seiring kontribusi.</span>'}</div>`:'<div class="social-level-v056 muted">Profil publik tidak tersedia untuk donasi ini.</div>'}</div></div>`
  }
  function timelineHtml(items){
    if(!items?.length)return '<div class="social-empty-v056">Belum ada interaksi. Jadilah yang pertama memberi dukungan atau doa.</div>';
    return `<div class="social-timeline-v056">${items.map(x=>`<div class="social-event-v056"><span class="material-symbols-outlined">${x.type==='LOVE'?'favorite':'volunteer_activism'}</span><div><strong>${esc(x.actor_label||'Pengguna KIA')}</strong> ${x.type==='LOVE'?'memberi love':'menitipkan doa'}${x.message?`<p>“${esc(x.message)}”</p>`:''}<time>${esc(dt(x.created_at))}</time></div></div>`).join('')}</div>`
  }
  function render(data){
    const d=data.donation||{},counts=data.counts||{},viewer=data.viewer||{},content=$('[data-social-content]',overlay);
    content.innerHTML=`<div class="social-sheet-head-v056"><div><span class="social-kicker-v056">DONASI TERVALIDASI</span><h2>Timeline Dukungan</h2></div><button class="social-close-v056" type="button" data-social-close aria-label="Tutup">×</button></div>
      <div class="social-donation-summary-v056"><strong>${idr(d.amount)}</strong><span>${esc(d.program_name||'Program KIA')}</span><time>${esc(dt(d.paid_at))}</time></div>
      ${profileHtml(d)}
      ${d.message?`<blockquote class="social-original-message-v056">“${esc(d.message)}”</blockquote>`:''}
      <div class="social-actions-v056"><button class="btn ${viewer.loved?'btn-primary':'btn-ghost'}" type="button" data-social-love ${viewer.authenticated?'':'disabled'}><span class="material-symbols-outlined">favorite</span> ${viewer.loved?'Disukai':'Love'} <b>${Number(counts.love)||0}</b></button><span class="muted mini">${Number(counts.messages)||0} doa/pesan</span></div>
      ${viewer.authenticated?`<form class="social-message-form-v056" data-social-form><textarea maxlength="280" name="message" placeholder="Tulis doa atau pesan positif…" required></textarea><div><span class="muted mini">Maks. 280 karakter</span><button class="btn btn-primary" type="submit">Kirim Doa</button></div></form>`:`<div class="social-login-note-v056">Masuk ke akun KIA untuk memberi love atau mengirim doa. <a href="./login.html">Masuk</a></div>`}
      <div class="social-timeline-head-v056"><h3>Aktivitas</h3><span>${(data.timeline||[]).length} terbaru</span></div>
      ${timelineHtml(data.timeline||[])}`;
    $('[data-social-close]',overlay)?.addEventListener('click',close);
    $('[data-social-love]',overlay)?.addEventListener('click',toggleLove);
    $('[data-social-form]',overlay)?.addEventListener('submit',sendMessage);
  }
  async function load(){
    const content=$('[data-social-content]',overlay);content.innerHTML='<div class="social-loading-v056"><span class="donation-feed-spinner-v055"></span><strong>Memuat timeline dukungan…</strong></div>';
    try{const r=await api(`/api/public/donations/${encodeURIComponent(currentRef)}/social`);render(r.data)}catch(e){content.innerHTML=`<div class="social-error-v056">${esc(e.message||'Timeline belum dapat dimuat.')}<button class="btn btn-ghost" type="button" data-social-retry>Coba Lagi</button></div>`;$('[data-social-retry]',overlay)?.addEventListener('click',load)}
  }
  async function toggleLove(){if(busy||!currentRef)return;busy=true;try{await api(`/api/social/donations/${encodeURIComponent(currentRef)}/love`,{method:'POST',body:'{}'});await load()}catch(e){showInline(e.message)}finally{busy=false}}
  async function sendMessage(e){e.preventDefault();if(busy||!currentRef)return;const form=e.currentTarget,msg=String(new FormData(form).get('message')||'').trim();if(!msg)return;busy=true;const btn=form.querySelector('button[type=submit]');btn.disabled=true;btn.textContent='Mengirim…';try{await api(`/api/social/donations/${encodeURIComponent(currentRef)}/messages`,{method:'POST',body:JSON.stringify({message:msg})});await load()}catch(err){showInline(err.message);btn.disabled=false;btn.textContent='Kirim Doa'}finally{busy=false}}
  function showInline(message){let el=$('[data-social-inline]',overlay);if(!el){el=document.createElement('div');el.dataset.socialInline='1';el.className='social-inline-v056';$('[data-social-content]',overlay)?.prepend(el)}el.textContent=message||'Aksi belum dapat diproses.';setTimeout(()=>el?.remove(),3500)}
  function open(ref){if(!ref)return;ensure();currentRef=String(ref);overlay.hidden=false;document.body.classList.add('social-open-v056');load()}
  function bind(){document.addEventListener('click',e=>{if(e.target.closest('a,button,textarea,input'))return;const row=e.target.closest('[data-donation-ref]');if(row)open(row.dataset.donationRef)});document.addEventListener('keydown',e=>{const row=e.target.closest?.('[data-donation-ref]');if(row&&(e.key==='Enter'||e.key===' ')){e.preventDefault();open(row.dataset.donationRef)}})}
  document.addEventListener('DOMContentLoaded',bind);
  window.KiaDonationSocial={open,close};
})();
