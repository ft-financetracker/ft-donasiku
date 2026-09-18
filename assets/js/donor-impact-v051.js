(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const idr=v=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v)||0);
let impactLoaded=false,pendingLoaded=false,profileLoaded=false,lastBadges=[];
const LEVELS=[{label:'Teman KIA',xp:0},{label:'Sahabat KIA',xp:100},{label:'Penggerak Kebaikan',xp:250},{label:'Penjaga Konsistensi',xp:500},{label:'Jejak Kebaikan',xp:900},{label:'Inspirator KIA',xp:1400}];
const MISSIONS=[
 {code:'LANGKAH_PERTAMA',label:'Langkah Pertama',metric:'paid_donation_count',target:1,unit:'donasi PAID'},
 {code:'SAHABAT_PROGRAM',label:'Sahabat Program',metric:'programs_supported',target:3,unit:'program'},
 {code:'KONSISTEN_3_BULAN',label:'Konsisten 3 Bulan',metric:'active_months',target:3,unit:'bulan'},
 {code:'KONSISTEN_6_BULAN',label:'Konsisten 6 Bulan',metric:'active_months',target:6,unit:'bulan'},
 {code:'LINTAS_PROGRAM',label:'Lintas Program',metric:'programs_supported',target:5,unit:'program'},
 {code:'PROGRAM_TUNTAS',label:'Program Tuntas',metric:'completed_programs',target:1,unit:'program tuntas'}
];
const xpOf=m=>(Number(m.paid_donation_count)||0)*20+(Number(m.programs_supported)||0)*30+(Number(m.active_months)||0)*25+(Number(m.completed_programs)||0)*60;
function levelOf(xp){let cur=LEVELS[0];for(const l of LEVELS)if(xp>=l.xp)cur=l;const i=LEVELS.indexOf(cur);return{cur,next:LEVELS[i+1]||null}}
function initials(name){const p=String(name||'KIA').trim().split(/\s+/);return((p[0]?.[0]||'K')+(p[1]?.[0]||'')).toUpperCase()}
function role(){return KiaAuth.getUser?.()?.platform_role||'USER'}
function enforceRole(){
  const r=role();
  document.body.classList.toggle('kia-role-super',r==='SUPER_ADMIN');
  document.body.classList.toggle('kia-role-review',['PLATFORM_ADMIN','SUPER_ADMIN'].includes(r));
  $$('[data-dashboard-route="cms"],[data-dashboard-route="settings"]').forEach(x=>x.hidden=r!=='SUPER_ADMIN');
  $$('[data-dashboard-route="admin"]').forEach(x=>x.hidden=!['PLATFORM_ADMIN','SUPER_ADMIN'].includes(r));
  if(r!=='SUPER_ADMIN'&&['#cms','#settings'].includes(location.hash))location.hash=r==='PLATFORM_ADMIN'?'#admin':'#home';
}
function removeVerificationRoute(){
  const top=$('[data-dashboard-route="verification"]');if(top)top.hidden=true;
  const mob=$('[data-mobile-route="verification"]');if(mob){mob.hidden=true}
  $$('[data-go="verification"]').forEach(b=>{b.dataset.go='account';b.textContent='Akun & Verifikasi'});
  if(location.hash==='#verification')location.hash='#account';
}
function syncVerification(){
  const badge=$('[data-verification-status]'),box=$('[data-account-verification-v0513]');
  if(!badge||!box)return;
  const t=(badge.textContent||'').trim();
  box.classList.toggle('is-approved',/Disetujui|APPROVED/i.test(t));
}
function account(){
  const sec=$('[data-section="account"]'),vsec=$('[data-section="verification"]');if(!sec||sec.dataset.v0513)return;
  sec.dataset.v0513='1';const card=sec.querySelector('.section-card');if(!card)return;
  const head=card.querySelector('.section-head'),info=card.querySelector('.system-info-list'),actions=card.querySelector('.form-actions');
  if(head){
    const status=$('[data-verification-status]');
    if(status){status.classList.add('account-verify-badge-v0513');head.appendChild(status)}
  }
  if(info){
    const shell=document.createElement('div');shell.className='account-shell-v0513';
    const avatar=document.createElement('div');avatar.className='account-avatar-v0513';avatar.innerHTML=`<div class="account-avatar-img-v0513" data-profile-avatar-v0513><span>${esc(initials(KiaAuth.getUser()?.full_name))}</span></div><strong>Foto Profil</strong><small>JPG, PNG, atau WEBP · maks. 2 MB · rasio 1:1 disarankan. Foto otomatis dipotong persegi.</small><label class="btn btn-soft">Ganti Foto<input type="file" accept="image/jpeg,image/png,image/webp" data-avatar-input-v0513 hidden></label><div class="muted mini" data-avatar-status-v0513></div>`;
    const main=document.createElement('div');main.className='account-main-v0513';
    info.parentNode.insertBefore(shell,info);main.appendChild(info);if(actions)main.appendChild(actions);shell.append(avatar,main);
    $('[data-avatar-input-v0513]')?.addEventListener('change',uploadAvatar);
  }
  card.insertAdjacentHTML('beforeend',`<div class="account-inline-block-v0513" data-profile-editor-v0513><h3>Profil Akun</h3><p class="muted">Data kontak dan korespondensi akun.</p><form data-profile-form-v0513><div class="account-profile-grid-v0513"><label>Nama<input name="full_name" maxlength="140" required></label><label>WhatsApp / Telepon<input name="phone" maxlength="60"></label><label>Email<input name="email" readonly></label><label>Jenis Akun<input name="account_type" readonly></label><label class="full">Alamat<textarea name="address" maxlength="600"></textarea></label></div><div class="form-actions"><button class="btn btn-primary" type="submit">Simpan Profil</button><span class="muted mini" data-profile-status-v0513></span></div></form></div><div class="account-badges-v0513"><strong>Lencana Saya</strong><p class="muted mini">Pilih lencana yang sudah diperoleh untuk ditonjolkan pada perangkat ini.</p><div class="account-badge-list-v0513" data-account-badges-v0513><span class="muted mini">Memuat lencana…</span></div></div>`);
  $('[data-profile-form-v0513]')?.addEventListener('submit',saveProfile);
  if(vsec){
    const vcard=vsec.querySelector('.section-card');
    if(vcard){
      const inline=document.createElement('div');inline.className='account-verification-v0513';inline.dataset.accountVerificationV0513='1';
      const title=vcard.querySelector('.section-head');
      if(title)title.remove();
      [...vcard.children].forEach(n=>inline.appendChild(n));
      card.appendChild(inline);
      vsec.hidden=true;
    }
  }
  syncVerification();
}
async function loadProfile(force=false){
  if(profileLoaded&&!force)return;const f=$('[data-profile-form-v0513]');if(!f)return;
  const st=$('[data-profile-status-v0513]');if(st)st.textContent='Memuat…';
  try{
    const r=await KiaAuth.request('/api/account/profile',{timeout:14000}),u=r.data?.user||{},p=r.data?.profile||{};
    f.elements.full_name.value=u.full_name||'';f.elements.phone.value=u.phone||'';f.elements.email.value=u.email||'';f.elements.account_type.value=u.account_type==='ORGANIZATION'?'Yayasan / Organisasi':'Perorangan';f.elements.address.value=p.address||'';
    renderAvatar(p.avatar_url,u.full_name);profileLoaded=true;if(st)st.textContent='Profil tersinkron.';
  }catch(e){if(st)st.textContent=e.message||'Profil belum dapat dimuat.'}
}
function renderAvatar(url,name){const a=$('[data-profile-avatar-v0513]');if(!a)return;a.innerHTML=url?`<img src="${esc(url)}" alt="Foto profil">`:`<span>${esc(initials(name))}</span>`}
async function saveProfile(e){
  e.preventDefault();const f=e.currentTarget,b=f.querySelector('button[type=submit]'),st=$('[data-profile-status-v0513]');
  b.disabled=true;b.textContent='Menyimpan…';
  try{
    const r=await KiaAuth.request('/api/account/profile',{method:'POST',body:JSON.stringify({full_name:f.elements.full_name.value.trim(),phone:f.elements.phone.value.trim(),address:f.elements.address.value.trim()}),timeout:18000,attempts:1});
    KiaAuth.setSession({user:r.data.user});$$('[data-user-name]').forEach(x=>x.textContent=r.data.user.full_name);$('[data-account-name]').textContent=r.data.user.full_name;renderAvatar(r.data.profile?.avatar_url,r.data.user.full_name);st.textContent='Profil berhasil diperbarui.';
  }catch(err){st.textContent=err.message||'Profil gagal disimpan.'}finally{b.disabled=false;b.textContent='Simpan Profil'}
}
async function fileToAvatar(file){
  const bmp=await createImageBitmap(file),side=Math.min(bmp.width,bmp.height),sx=(bmp.width-side)/2,sy=(bmp.height-side)/2,c=document.createElement('canvas');c.width=512;c.height=512;c.getContext('2d').drawImage(bmp,sx,sy,side,side,0,0,512,512);bmp.close();
  const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.84));
  return new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve({file_name:'avatar.jpg',mime_type:'image/jpeg',base64:String(fr.result).split(',')[1]});fr.onerror=reject;fr.readAsDataURL(blob)})
}
async function uploadAvatar(e){
  const file=e.target.files?.[0],st=$('[data-avatar-status-v0513]');e.target.value='';if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){st.textContent='Format harus JPG, PNG, atau WEBP.';return}
  if(file.size>2*1024*1024){st.textContent='Ukuran foto maksimal 2 MB.';return}
  const preview=URL.createObjectURL(file);renderAvatar(preview,KiaAuth.getUser()?.full_name);st.textContent='Mengunggah…';
  try{const payload=await fileToAvatar(file),r=await KiaAuth.request('/api/account/avatar',{method:'POST',body:JSON.stringify(payload),timeout:30000,attempts:1});renderAvatar(r.data.avatar_url,KiaAuth.getUser()?.full_name);st.textContent='Foto profil berhasil diperbarui.'}
  catch(err){st.textContent=err.message||'Foto profil gagal diunggah.'}finally{URL.revokeObjectURL(preview)}
}
function xpHtml(m){
  const xp=xpOf(m),lv=levelOf(xp),start=lv.cur.xp,end=lv.next?.xp||Math.max(start+1,xp),pct=lv.next?Math.min(100,Math.max(0,(xp-start)/(end-start)*100)):100;
  return {xp,lv,pct,html:`<div class="impact-xp-v0513"><div class="impact-xp-row-v0513"><span>EXP ${xp}</span><span>${lv.next?`${lv.next.xp} EXP`:'MAX'}</span></div><div class="impact-xp-bar-v0513"><i style="width:${pct}%"></i></div><div class="muted mini" style="color:#dcece6;margin-top:5px">${lv.next?`${Math.max(0,lv.next.xp-xp)} EXP lagi menuju ${esc(lv.next.label)}`:'Level aktivitas tertinggi saat ini'}</div></div>`}
}
function missions(m){
  return MISSIONS.map(x=>{const have=Number(m[x.metric]||0),pct=Math.min(100,Math.round(have/x.target*100));return `<div class="impact-mission-v0513"><strong>${esc(x.label)}</strong><small>${Math.min(have,x.target)}/${x.target} ${esc(x.unit)}</small><div class="impact-mission-bar-v0513"><i style="width:${pct}%"></i></div></div>`}).join('')
}
function badgePanel(m){
  const card=[...$$('[data-impact-root] .impact-columns .section-card')].find(x=>x.querySelector('h3')?.textContent.trim()==='Badge Saya');if(!card)return;
  let btn=card.querySelector('[data-mission-toggle-v0513]');
  if(!btn){btn=document.createElement('button');btn.className='btn btn-ghost';btn.type='button';btn.dataset.missionToggleV0513='1';btn.textContent='Level & Misi';card.querySelector('.section-head')?.appendChild(btn);const box=document.createElement('div');box.hidden=true;box.dataset.missionBoxV0513='1';card.insertBefore(box,card.querySelector('[data-impact-badges]'));btn.onclick=()=>box.hidden=!box.hidden}
  const box=card.querySelector('[data-mission-box-v0513]');box.innerHTML=`<div class="impact-missions-v0513">${missions(m)}</div>`;
}
function renderAccountBadges(){
  const root=$('[data-account-badges-v0513]');if(!root)return;const key=`kia_badge_v0513_${KiaAuth.getUser()?.user_id||'x'}`,sel=localStorage.getItem(key)||'';
  root.innerHTML=lastBadges.length?lastBadges.map(b=>`<button type="button" class="account-badge-v0513 ${sel===b.code?'is-selected':''}" data-badge-code="${esc(b.code)}"><span class="material-symbols-outlined">${esc(b.icon||'workspace_premium')}</span>${esc(b.label)}</button>`).join(''):'<span class="muted mini">Belum ada lencana yang diperoleh.</span>';
  $$('[data-badge-code]',root).forEach(b=>b.onclick=()=>{localStorage.setItem(key,b.dataset.badgeCode);renderAccountBadges()})
}
function pending(){
  const impact=$('[data-impact-root]');if(!impact||impact.querySelector('[data-pending-v0513]'))return;const metrics=impact.querySelector('.impact-metrics');if(!metrics)return;
  metrics.insertAdjacentHTML('afterend',`<section class="card pending-card-v0513" data-pending-v0513><div class="pending-head-v0513"><div><h3>Menunggu Pembayaran</h3><p class="muted">Lanjutkan transaksi yang belum PAID tanpa membuat Donation baru.</p></div><button class="btn btn-ghost" type="button" data-pending-refresh-v0513>Refresh</button></div><div class="pending-list-v0513" data-pending-list-v0513><div class="empty-state">Memuat…</div></div></section>`);
  $('[data-pending-refresh-v0513]').onclick=()=>loadPending(true)
}
async function loadPending(force=false){
  if(pendingLoaded&&!force)return;const root=$('[data-pending-list-v0513]');if(!root)return;
  try{const r=await KiaAuth.request('/api/donor/pending-payments',{timeout:18000,attempts:1}),rows=r.data?.items||[];
    root.innerHTML=rows.length?rows.map(x=>`<article class="pending-item-v0513"><div><h4>${esc(x.program_name||'Program KIA')}</h4><div class="meta">${esc(x.donation_code||'')} · ${esc(x.payment_status||'PENDING')}</div></div><div class="amount">${idr(x.gross_amount)}</div><a class="btn btn-primary" href="./payment.html?token=${encodeURIComponent(x.view_token||'')}">Lanjutkan</a></article>`).join(''):'<div class="empty-state">Tidak ada transaksi menunggu pembayaran.</div>';pendingLoaded=true
  }catch(e){root.innerHTML=`<div class="empty-state">${esc(e.message||'Transaksi belum dapat dimuat.')}</div>`}
}
async function loadImpact(force=false){
  if(impactLoaded&&!force)return;
  try{
    const r=await KiaAuth.request('/api/donor/impact',{timeout:15000}),d=r.data||{},m=d.metrics||{},badges=d.badges||[],recent=d.recent||[];lastBadges=badges;
    const x=xpHtml(m);$('[data-impact-level]').textContent=x.lv.cur.label;const lvl=$('.impact-level');if(lvl){lvl.querySelector('.impact-xp-v0513')?.remove();lvl.insertAdjacentHTML('beforeend',x.html)}
    $('[data-impact-donations]').textContent=String(m.paid_donation_count||0);$('[data-impact-programs]').textContent=String(m.programs_supported||0);$('[data-impact-months]').textContent=String(m.active_months||0);$('[data-impact-completed]').textContent=String(m.completed_programs||0);
    const br=$('[data-impact-badges]');br.innerHTML=badges.length?badges.map(b=>`<article class="impact-badge"><span class="material-symbols-outlined">${esc(b.icon||'workspace_premium')}</span><div><strong>${esc(b.label)}</strong><small>Lencana aktivitas KIA</small></div></article>`).join(''):'<div class="empty-state">Belum ada lencana.</div>';
    const rr=$('[data-impact-recent]');rr.innerHTML=recent.length?recent.map(x=>`<a class="impact-recent" href="./program.html?id=${encodeURIComponent(x.program_id||'')}"><div><strong>${esc(x.program_name)}</strong><small>${x.paid_at?new Date(x.paid_at).toLocaleDateString('id-ID'):'—'}</small></div><span>${idr(x.amount)}</span></a>`).join(''):'<div class="empty-state">Belum ada riwayat dukungan.</div>';
    badgePanel(m);renderAccountBadges();pending();loadPending();impactLoaded=true;
  }catch(e){KiaUI.toast(e.message||'Dampak Saya belum dapat dimuat',{type:'warning'})}
}
function patchSnapshotDelete(id){
  try{const k='kia_dashboard_snapshot_v040',x=JSON.parse(localStorage.getItem(k)||'null');if(x?.programs){x.programs=x.programs.filter(p=>p.program_id!==id);localStorage.setItem(k,JSON.stringify(x))}}catch(_){}
}
function enhancePrograms(){
  const root=$('[data-program-list]');if(!root)return;
  root.querySelectorAll('.program-item').forEach(row=>{
    const status=row.querySelector('.status-pill')?.textContent.trim()||'';
    if(/Diarsipkan/i.test(status)){row.classList.add('is-archived-v0513');return}
    const actions=row.querySelector('.program-actions'),edit=actions?.querySelector('[data-program-edit]');if(!actions||!edit)return;
    const id=edit.dataset.programEdit;
    const submit=actions.querySelector('[data-program-submit]');
    if(submit&&!actions.querySelector('[data-delete-draft-v0513]')){
      const b=document.createElement('button');b.type='button';b.className='btn btn-ghost program-delete-v0513';b.dataset.deleteDraftV0513=id;b.textContent='Hapus Draft';actions.appendChild(b);
      b.onclick=async()=>{const ok=await KiaUI.confirm({title:'Hapus Draft Program?',message:'Draft akan diarsipkan dan hilang dari daftar Program Saya.',confirmText:'Hapus Draft',danger:true});if(!ok)return;b.disabled=true;b.textContent='Menghapus…';try{await KiaAuth.request(`/api/programs/${encodeURIComponent(id)}/delete-draft`,{method:'POST',body:'{}',timeout:22000,attempts:1});patchSnapshotDelete(id);row.remove();KiaUI.toast('Draft berhasil dihapus',{type:'success'})}catch(e){b.disabled=false;b.textContent='Hapus Draft';KiaUI.toast(e.message||'Draft gagal dihapus',{type:'error',duration:5000})}}
    }
    const pause=actions.querySelector('[data-program-status="PAUSE"]');if(pause)pause.textContent='Stop Donasi';
    const resume=actions.querySelector('[data-program-status="RESUME"]');if(resume)resume.textContent='Buka Donasi';
  })
}
function observe(){
  const nav=$('.app-tabs');if(nav)new MutationObserver(()=>enforceRole()).observe(nav,{attributes:true,subtree:true,attributeFilter:['hidden','class']});
  const programs=$('[data-program-list]');if(programs)new MutationObserver(()=>enhancePrograms()).observe(programs,{childList:true,subtree:true});
  const ver=$('[data-verification-status]');if(ver)new MutationObserver(()=>syncVerification()).observe(ver,{childList:true,subtree:true,characterData:true});
}
function init(){
  enforceRole();removeVerificationRoute();account();observe();enhancePrograms();setTimeout(()=>{enforceRole();account();syncVerification();enhancePrograms()},700);
  window.addEventListener('hashchange',()=>{removeVerificationRoute();enforceRole();if(location.hash==='#impact')loadImpact();if(location.hash==='#account'){loadProfile();if(!impactLoaded)loadImpact()}});
  if(location.hash==='#impact')loadImpact();if(location.hash==='#account'){loadProfile();loadImpact()}
}
document.addEventListener('DOMContentLoaded',init);
window.KiaDonorImpact={load:loadImpact,refresh:()=>{impactLoaded=false;pendingLoaded=false;return loadImpact(true)}};
})();