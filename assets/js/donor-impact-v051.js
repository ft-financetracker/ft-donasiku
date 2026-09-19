(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const idr=v=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v)||0);
let impactLoaded=false,impactLoading=false,pendingLoaded=false,profileLoaded=false,lastBadges=[];
const uid=()=>KiaAuth.getUser?.()?.user_id||'guest';
const badgeStore=()=>`kia_display_badge_v0512_${uid()}`;

const LEVELS=[
  {label:'Teman KIA',xp:0},{label:'Sahabat KIA',xp:100},{label:'Penggerak Kebaikan',xp:250},
  {label:'Penjaga Konsistensi',xp:500},{label:'Jejak Kebaikan',xp:900},{label:'Inspirator KIA',xp:1400}
];
const MISSIONS=[
  {code:'LANGKAH_PERTAMA',label:'Langkah Pertama',metric:'paid_donation_count',target:1,unit:'donasi PAID'},
  {code:'SAHABAT_PROGRAM',label:'Sahabat Program',metric:'programs_supported',target:3,unit:'program berbeda'},
  {code:'KONSISTEN_3_BULAN',label:'Konsisten 3 Bulan',metric:'active_months',target:3,unit:'bulan aktif'},
  {code:'KONSISTEN_6_BULAN',label:'Konsisten 6 Bulan',metric:'active_months',target:6,unit:'bulan aktif'},
  {code:'LINTAS_PROGRAM',label:'Lintas Program',metric:'programs_supported',target:5,unit:'program berbeda'},
  {code:'PROGRAM_TUNTAS',label:'Program Tuntas',metric:'completed_programs',target:1,unit:'program tuntas'}
];
function xpOf(m){return (Number(m.paid_donation_count)||0)*20+(Number(m.programs_supported)||0)*30+(Number(m.active_months)||0)*25+(Number(m.completed_programs)||0)*60}
function levelOf(xp){let cur=LEVELS[0];for(const l of LEVELS)if(xp>=l.xp)cur=l;const i=LEVELS.indexOf(cur);return{cur,next:LEVELS[i+1]||null}}

function injectStyle(){if($('#kia-phase-c-style'))return;const s=document.createElement('style');s.id='kia-phase-c-style';s.textContent=`
body>header{background:#fff;border-bottom:1px solid rgba(20,62,48,.10);box-shadow:0 5px 20px rgba(20,62,48,.045)}
[data-dashboard-route="verification"]{display:none!important}
.app-hero{border:1px solid rgba(25,70,53,.08);border-radius:16px;padding:20px 18px;background:linear-gradient(180deg,#fff,#fbfdfc);box-shadow:0 10px 30px rgba(27,61,49,.045)}
.impact-level{min-width:210px!important}.impact-level strong{font-size:18px}.impact-xp-v0512{margin-top:7px}.impact-xp-line-v0512{display:flex;justify-content:space-between;gap:10px;font-size:9px;color:#dcece6}.impact-xp-bar-v0512{height:7px;margin-top:6px;background:rgba(255,255,255,.16);border-radius:999px;overflow:hidden}.impact-xp-bar-v0512 i{display:block;height:100%;background:#ebc970;border-radius:inherit}.impact-xp-next-v0512{margin-top:5px;font-size:9px;color:#dcece6}
.badge-guide-btn-v0512{display:inline-flex;align-items:center;gap:5px;min-height:34px;padding:0 10px;border:1px solid var(--border);border-radius:10px;background:#fff;color:var(--primary);font:inherit;font-size:10px;font-weight:850;cursor:pointer}.badge-guide-btn-v0512 .material-symbols-outlined{font-size:15px}.badge-guide-v0512{margin:0 0 12px;padding:14px;border:1px solid #dce8e3;border-radius:14px;background:#f8fbf9}.badge-guide-v0512[hidden]{display:none!important}.badge-guide-v0512 h4{margin:0 0 7px}.badge-level-list-v0512,.mission-grid-v0512{display:grid;gap:7px}.badge-level-list-v0512{grid-template-columns:repeat(3,1fr);margin-bottom:13px}.level-chip-v0512,.mission-v0512{padding:9px 10px;border:1px solid var(--border);border-radius:11px;background:#fff}.level-chip-v0512.is-current{border-color:#8cc8b4;background:#eef8f4}.level-chip-v0512 strong,.level-chip-v0512 small,.mission-v0512 strong,.mission-v0512 small{display:block}.level-chip-v0512 small,.mission-v0512 small{margin-top:3px;color:var(--muted);font-size:9px}.mission-grid-v0512{grid-template-columns:1fr 1fr}.mission-head-v0512{display:flex;justify-content:space-between;gap:8px;align-items:center}.mission-progress-v0512{height:5px;margin-top:7px;border-radius:999px;background:#edf1ef;overflow:hidden}.mission-progress-v0512 i{display:block;height:100%;background:var(--primary)}
.impact-recent-list{max-height:365px;overflow-y:auto;padding-right:4px}.impact-recent-list::-webkit-scrollbar{width:5px}.impact-recent-list::-webkit-scrollbar-thumb{background:#cddbd5;border-radius:999px}
.pending-card-v0512{padding:16px!important}.pending-head-v0512{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:9px}.pending-head-v0512 h3{margin:0}.pending-head-v0512 p{margin:3px 0 0;font-size:9px}.pending-list-v0512{display:grid;gap:7px;max-height:290px;overflow-y:auto}.pending-item-v0512{display:grid;grid-template-columns:minmax(0,1fr) 150px 150px;gap:12px;align-items:center;padding:11px 12px;border:1px solid var(--border);border-radius:12px;background:#fff}.pending-item-v0512 h4{margin:0;font-size:11px}.pending-meta-v0512{margin-top:3px;color:var(--muted);font-size:9px;line-height:1.4}.pending-amount-v0512{text-align:right}.pending-amount-v0512 strong{display:block;color:var(--primary);font-family:var(--font-number);font-size:18px}.pending-amount-v0512 small{color:var(--muted);font-size:8px}.pending-item-v0512 .btn{min-height:35px;padding:0 10px;font-size:10px;width:100%}
.account-overview-v0512{display:grid;grid-template-columns:190px minmax(0,1fr);gap:20px;align-items:start}.avatar-card-v0512{display:grid;justify-items:center;gap:9px;padding:16px;border:1px solid var(--border);border-radius:15px;background:#f8fbf9}.avatar-v0512{width:112px;height:112px;border-radius:50%;overflow:hidden;border:4px solid #fff;box-shadow:0 4px 20px rgba(29,67,53,.12);display:grid;place-items:center;background:#e7f2ee;color:var(--primary);font-size:30px;font-weight:900}.avatar-v0512 img{width:100%;height:100%;object-fit:cover}.avatar-card-v0512 label{cursor:pointer}.account-verify-card-v0512{margin-top:14px!important}.account-profile-form-v0512{margin-top:16px;padding-top:16px;border-top:1px solid var(--border)}.account-profile-form-v0512 .form-grid{margin-top:10px}.account-badges-v0512{margin-top:14px;padding:15px;border:1px solid var(--border);border-radius:14px;background:#fbfdfc}.account-badges-list-v0512{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}.account-badge-choice-v0512{display:inline-flex;align-items:center;gap:5px;padding:7px 9px;border:1px solid var(--border);border-radius:999px;background:#fff;font-size:9px;font-weight:800;cursor:pointer}.account-badge-choice-v0512.is-selected{border-color:#72b59d;background:#eaf7f2;color:var(--primary)}.account-overview-v0512{grid-template-columns:220px minmax(0,1fr)!important;gap:18px!important}.avatar-card-v0512{align-content:start;justify-items:center;gap:10px;padding:16px 14px!important}.avatar-v0512 .material-symbols-outlined{font-size:46px;line-height:1}.avatar-meta-v0519{font-size:8px;line-height:1.45;color:var(--muted);text-align:center}.avatar-tools-v0519{width:100%;display:grid;gap:8px}.avatar-actions-v0519{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}.avatar-actions-v0519 .btn{min-height:34px;padding:0 11px;font-size:9px}.avatar-defaults-v0519{width:100%;padding-top:8px;border-top:1px dashed var(--border)}.avatar-defaults-v0519 strong{display:block;font-size:9px;margin-bottom:6px}.avatar-default-list-v0519{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.avatar-default-item-v0519{height:38px;border:1px solid var(--border);border-radius:10px;background:#fff;display:grid;place-items:center;cursor:pointer}.avatar-default-item-v0519.is-selected{border-color:#72b59d;background:#eaf7f2;color:var(--primary)}.avatar-default-item-v0519 .material-symbols-outlined{font-size:22px}.account-head-v0519{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px}.account-head-v0519 h3{margin:0}.account-state-badges-v0519{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end}.account-state-badge-v0519{display:inline-flex;align-items:center;gap:5px;padding:6px 9px;border-radius:999px;border:1px solid var(--border);background:#fff;font-size:8px;font-weight:900;white-space:nowrap}.account-state-badge-v0519 .material-symbols-outlined{font-size:14px}.account-state-badge-v0519.is-good{background:#edf8f3;border-color:#b8dcca;color:var(--primary)}.account-state-badge-v0519.is-warn{background:#fff6e8;border-color:#ecd6aa;color:#8a5c10}.account-profile-form-v0512 .field[data-hide-field-v0519]{display:none!important}.account-badges-v0512 strong{display:block;margin-bottom:4px}.account-badges-v0512{padding:14px!important}.account-verify-card-v0512 h2{font-size:18px!important}.account-verify-card-v0512 .section-head,.account-verify-card-v0512 h2{margin-bottom:8px!important}@media(max-width:760px){.account-overview-v0512{grid-template-columns:1fr!important}.account-head-v0519{flex-direction:column;align-items:flex-start}.account-state-badges-v0519{justify-content:flex-start}.avatar-default-list-v0519{grid-template-columns:repeat(6,minmax(0,1fr))}}
.program-delete-v0512{border-color:#efc9c5!important;color:#9a443e!important}.program-actions [data-program-status="PAUSE"]{border-color:#e6d7af}.program-actions [data-program-status="RESUME"]{background:#edf8f3}.program-lifecycle-note-v0515{margin-top:8px;padding:9px 10px;border-radius:10px;background:#f7faf8;border:1px solid var(--border);font-size:9px;line-height:1.5;color:var(--muted)}.program-lifecycle-guide-v0515{margin:0 0 12px;padding:11px 12px;border:1px solid #dce8e3;border-radius:12px;background:#f8fbf9;font-size:9px;line-height:1.55;color:#53625c}.program-lifecycle-guide-v0515 strong{color:var(--text)}.program-complete-v0515{border-color:#b9d9cd!important;background:#eef8f4!important;color:var(--primary)!important}
.program-lifecycle-guide-v0515{padding:10px 12px!important;margin-bottom:10px!important;font-size:9px!important}
.program-item{padding:14px 15px!important;border-radius:14px!important}
.program-item__top{display:block!important}
.program-item__top>img{display:none!important}
.program-head-v0518{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.program-title-wrap-v0518{min-width:0;flex:1 1 auto}
.program-item__top h3{margin:0 0 4px!important;font-size:18px!important;line-height:1.24!important}
.program-item__top .muted.mini{margin:0!important;font-size:10px!important;line-height:1.45!important}
.program-head-v0518 .status-pill{margin:0!important;flex:0 0 auto;white-space:nowrap}
.program-lifecycle-note-v0515{display:none!important}
.program-progress-v0516{margin-top:10px;padding-top:10px;border-top:1px solid var(--border)}
.program-progress-grid-v0518{display:grid;grid-template-columns:minmax(0,1fr) 94px;gap:14px;align-items:start}
.program-progress-media-v0518 img{width:94px;height:70px;border-radius:10px;object-fit:cover;display:block}
.program-progress-head-v0516{display:flex;align-items:flex-end;justify-content:space-between;gap:16px}
.program-progress-money-v0516{min-width:0}
.program-progress-money-v0516 span{display:block;color:var(--muted);font-size:9px;margin-bottom:3px}
.program-progress-money-v0516 strong{display:block;color:var(--primary);font-family:var(--font-number);font-size:21px;line-height:1.12}
.program-progress-money-v0516 small{font:inherit;color:var(--muted);font-size:10px}
.program-progress-percent-v0516{flex:0 0 auto;text-align:right}
.program-progress-percent-v0516 strong{display:block;color:var(--primary);font-family:var(--font-number);font-size:22px;line-height:1.05}
.program-progress-percent-v0516 small{display:block;color:var(--muted);font-size:9px;margin-top:3px}
.program-progress-bar-v0516{height:8px;margin-top:8px;border-radius:999px;background:#e9efec;overflow:hidden}
.program-progress-bar-v0516 i{display:block;height:100%;border-radius:inherit;background:var(--primary)}
.program-progress-foot-v0516{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:7px;color:var(--muted);font-size:9px}
.program-progress-foot-v0516 .excess{color:#916515;font-weight:900}
.program-stage-v0516{display:inline-flex;align-items:center;gap:6px;padding:5px 8px;border-radius:999px;background:#eef7f3;color:var(--primary);font-size:8px;font-weight:900}
.program-stage-v0516::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}
.program-actions{display:flex!important;flex-wrap:wrap!important;gap:7px!important;margin-top:10px!important}
.program-actions .btn{min-height:35px!important;padding:0 12px!important;font-size:10px!important;border-radius:10px!important}
@media(max-width:720px){
  .program-item__top h3{font-size:16px!important}
  .program-progress-grid-v0518{grid-template-columns:minmax(0,1fr) 78px}
  .program-progress-media-v0518 img{width:78px;height:60px}
  .program-progress-money-v0516 strong,.program-progress-percent-v0516 strong{font-size:18px!important}
}
@media(max-width:560px){
  .program-item{padding:12px!important}
  .program-head-v0518{gap:8px}
  .program-progress-grid-v0518{grid-template-columns:1fr 68px;gap:10px}
  .program-progress-media-v0518 img{width:68px;height:52px}
  .program-progress-head-v0516{align-items:flex-start!important}
  .program-progress-foot-v0516{align-items:flex-start;flex-direction:column;gap:5px}
}
.supporter-admin-list-v0512{display:grid;gap:8px;margin-top:12px}.supporter-admin-row-v0512{display:grid;grid-template-columns:1fr 1.5fr 1.5fr auto;gap:8px;align-items:center}.supporter-admin-row-v0512 input{min-height:40px;border:1px solid var(--border);border-radius:10px;padding:0 10px;font:inherit}.supporter-admin-row-v0512 button{min-height:40px}
@media(max-width:820px){.badge-level-list-v0512{grid-template-columns:1fr 1fr}.mission-grid-v0512{grid-template-columns:1fr}.pending-item-v0512{grid-template-columns:1fr auto}.pending-amount-v0512{grid-column:2;grid-row:1;text-align:right}.pending-item-v0512 .btn{grid-column:1/-1;width:auto;justify-self:start}.account-overview-v0512{grid-template-columns:1fr}.avatar-card-v0512{grid-template-columns:auto 1fr;justify-items:start;align-items:center}.avatar-v0512{width:86px;height:86px}.supporter-admin-row-v0512{grid-template-columns:1fr 1fr}.supporter-admin-row-v0512 button{grid-column:1/-1;justify-self:start}}
@media(max-width:540px){.badge-level-list-v0512{grid-template-columns:1fr}.pending-item-v0512{grid-template-columns:1fr}.pending-amount-v0512{grid-column:auto;grid-row:auto;text-align:left}.app-hero{padding:15px 12px}.impact-level{min-width:0!important;width:100%}.avatar-card-v0512{grid-template-columns:1fr;justify-items:center}.supporter-admin-row-v0512{grid-template-columns:1fr}}
`;document.head.appendChild(s)}

function initials(name){const p=String(name||'KIA').trim().split(/\s+/);return((p[0]?.[0]||'K')+(p[1]?.[0]||'')).toUpperCase()}
function restructure(){
  injectStyle();
  const topVerification=$('[data-dashboard-route="verification"]');if(topVerification)topVerification.hidden=true;
  const mobile=$('[data-mobile-route="verification"]');if(mobile){mobile.dataset.mobileRoute='impact';mobile.href='#impact';mobile.querySelector('.mobile-nav-icon').textContent='insights';mobile.querySelector('span:last-child').textContent='Dampak'}
  $$('[data-go="verification"]').forEach(b=>{b.dataset.go='account';b.textContent='Akun & Verifikasi'});
  if(location.hash==='#verification')history.replaceState(null,'','#account');

  const account=$('[data-section="account"]'),verify=$('[data-section="verification"]');
  if(account&&!account.dataset.phaseC){account.dataset.phaseC='1';const card=account.querySelector('.section-card'),info=card?.querySelector('.system-info-list');if(card&&info){
    const wrap=document.createElement('div');wrap.className='account-overview-v0512';info.parentNode.insertBefore(wrap,info);const avatar=document.createElement('div');avatar.className='avatar-card-v0512';avatar.innerHTML=`<div class="avatar-v0512" data-profile-avatar><span>${esc(initials(KiaAuth.getUser()?.full_name))}</span></div><div class="avatar-tools-v0519"><div><strong>Foto / Ikon Profil</strong><p class="avatar-meta-v0519">Upload foto JPG / PNG / WEBP maksimal 2 MB atau pilih ikon default Google Material.</p></div><div class="avatar-actions-v0519"><label class="btn btn-soft">Upload Foto<input type="file" accept="image/jpeg,image/png,image/webp" data-avatar-input hidden></label></div><div class="avatar-defaults-v0519"><strong>Ikon Default</strong><div class="avatar-default-list-v0519" data-default-avatar-list></div></div></div>`;wrap.appendChild(avatar);const right=document.createElement('div');right.appendChild(info);const actions=card.querySelector('.form-actions');if(actions)right.appendChild(actions);wrap.appendChild(right);
    card.insertAdjacentHTML('beforeend',`<div class="account-profile-form-v0512" data-profile-editor><div class="account-head-v0519"><div><h3>Profil Akun</h3><p class="muted mini">Nama, kontak, dan alamat korespondensi.</p></div><div class="account-state-badges-v0519" data-account-state-badges></div></div><form data-profile-form><div class="form-grid"><label class="field">Nama<input name="full_name" maxlength="140" required></label><label class="field">WhatsApp / Telepon<input name="phone" maxlength="60"></label><label class="field">Email<input name="email" readonly></label><label class="field">Jenis Akun<input name="account_type" readonly></label><label class="field full">Alamat<textarea name="address" maxlength="600"></textarea></label></div><div class="form-actions"><button class="btn btn-primary" type="submit" data-profile-save>Simpan Profil</button><span class="muted mini" data-profile-status></span></div></form></div><div class="account-badges-v0512" data-account-badges><strong>Pilih Lencana Tampilan</strong><p class="muted mini">Pilih salah satu lencana yang sudah didapatkan untuk ditampilkan pada perangkat ini.</p><div class="account-badges-list-v0512" data-account-badges-list><span class="muted mini">Muat Dampak Saya untuk melihat lencana.</span></div></div>`);
    $('[data-profile-form]',card)?.addEventListener('submit',saveProfile);$('[data-avatar-input]',card)?.addEventListener('change',uploadAvatar);
  }}
  if(account&&verify&&!verify.dataset.movedToAccount){verify.dataset.movedToAccount='1';const vcard=verify.querySelector('.section-card');if(vcard){vcard.classList.add('account-verify-card-v0512');vcard.querySelector('h2').textContent='Verifikasi Akun / Penggalang';account.appendChild(vcard);syncVerificationBadgeV0519()}verify.hidden=true}
  cleanAccountRowsV0519();injectSupporterAdmin();observePrograms();loadProfile();
}

function badgeMissionHtml(m){const have=Number(m.metrics?.[m.metric]||0),pct=Math.min(100,Math.round(have/m.target*100));return `<div class="mission-v0512"><div class="mission-head-v0512"><strong>${esc(m.label)}</strong><small>${Math.min(have,m.target)}/${m.target}</small></div><small>${m.target} ${esc(m.unit)}</small><div class="mission-progress-v0512"><i style="width:${pct}%"></i></div></div>`}
function ensureBadgeGuide(metrics,xp,level){const card=[...$$('[data-impact-root] .impact-columns .section-card')].find(x=>x.querySelector('h3')?.textContent.trim()==='Badge Saya');if(!card)return;let btn=card.querySelector('[data-badge-guide-toggle]');if(!btn){btn=document.createElement('button');btn.className='badge-guide-btn-v0512';btn.type='button';btn.dataset.badgeGuideToggle='1';btn.innerHTML='<span class="material-symbols-outlined">flag</span> Level & Misi';card.querySelector('.section-head')?.appendChild(btn);const guide=document.createElement('div');guide.className='badge-guide-v0512';guide.dataset.badgeGuide='1';guide.hidden=true;card.insertBefore(guide,card.querySelector('[data-impact-badges]'));btn.onclick=()=>guide.hidden=!guide.hidden}
  const guide=card.querySelector('[data-badge-guide]');guide.innerHTML=`<h4>Tingkatan Level Aktivitas</h4><p class="muted mini">EXP berasal dari aktivitas tervalidasi, bukan besar nominal donasi.</p><div class="badge-level-list-v0512">${LEVELS.map(l=>`<div class="level-chip-v0512 ${l.label===level.cur.label?'is-current':''}"><strong>${esc(l.label)}</strong><small>Mulai ${l.xp} EXP</small></div>`).join('')}</div><h4>Misi Badge</h4><div class="mission-grid-v0512">${MISSIONS.map(m=>badgeMissionHtml({...m,metrics})).join('')}</div>`}

function renderImpact(data){const m=data.metrics||{},badges=data.badges||[],recent=data.recent||[];lastBadges=badges;const xp=xpOf(m),level=levelOf(xp),start=level.cur.xp,end=level.next?.xp||Math.max(start+1,xp),pct=level.next?Math.min(100,Math.max(0,(xp-start)/(end-start)*100)):100;
  $('[data-impact-level]').textContent=level.cur.label;$('[data-impact-donations]').textContent=String(m.paid_donation_count||0);$('[data-impact-programs]').textContent=String(m.programs_supported||0);$('[data-impact-months]').textContent=String(m.active_months||0);$('[data-impact-completed]').textContent=String(m.completed_programs||0);
  const box=$('.impact-level');if(box){let exp=box.querySelector('.impact-xp-v0512');if(!exp){exp=document.createElement('div');exp.className='impact-xp-v0512';box.appendChild(exp)}exp.innerHTML=`<div class="impact-xp-line-v0512"><span>EXP ${xp}</span><span>${level.next?`${level.next.xp} EXP`:'MAX'}</span></div><div class="impact-xp-bar-v0512"><i style="width:${pct}%"></i></div><div class="impact-xp-next-v0512">${level.next?`${Math.max(0,level.next.xp-xp)} EXP lagi menuju ${esc(level.next.label)}`:'Level aktivitas tertinggi saat ini'}</div>`}
  const br=$('[data-impact-badges]');br.innerHTML=badges.length?badges.map(b=>`<article class="impact-badge"><span class="material-symbols-outlined">${esc(b.icon||'workspace_premium')}</span><div><strong>${esc(b.label)}</strong><small>${esc(MISSIONS.find(x=>x.code===b.code)?.label?'Misi tercapai':'Lencana aktivitas KIA')}</small></div></article>`).join(''):'<div class="empty-state">Belum ada lencana. Selesaikan misi aktivitas untuk membuka badge.</div>';
  const rr=$('[data-impact-recent]');rr.innerHTML=recent.length?recent.map(x=>`<a class="impact-recent" href="./program.html?id=${encodeURIComponent(x.program_id||'')}"><div><strong>${esc(x.program_name)}</strong><small>${x.paid_at?new Date(x.paid_at).toLocaleDateString('id-ID'):'—'}</small></div><span>${idr(x.amount)}</span></a>`).join(''):'<div class="empty-state">Belum ada riwayat donasi PAID.</div>';
  ensureBadgeGuide(m,xp,level);renderAccountBadges();injectPending();loadPending();impactLoaded=true;
}
async function loadImpact(force=false){if(impactLoading||impactLoaded&&!force)return;impactLoading=true;try{const r=await KiaAuth.request('/api/donor/impact',{timeout:15000});renderImpact(r.data||{})}catch(e){KiaUI.toast(e.message||'Dampak Saya belum dapat dimuat',{type:'warning'})}finally{impactLoading=false}}

function injectPending(){const root=$('[data-impact-root]');if(!root||root.querySelector('[data-pending-donations]'))return;const metrics=root.querySelector('.impact-metrics');if(!metrics)return;metrics.insertAdjacentHTML('afterend',`<section class="card pending-card-v0512" data-pending-donations><div class="pending-head-v0512"><div><h3>Menunggu Pembayaran</h3><p class="muted">Donation tetap sama; lanjutkan payment attempt yang belum selesai.</p></div><button class="btn btn-ghost" type="button" data-pending-refresh>Refresh</button></div><div class="pending-list-v0512" data-pending-list><div class="empty-state">Memuat transaksi…</div></div></section>`);$('[data-pending-refresh]')?.addEventListener('click',()=>loadPending(true))}
async function loadPending(force=false){if(pendingLoaded&&!force)return;const root=$('[data-pending-list]');if(!root)return;try{const r=await KiaAuth.request('/api/donor/pending-payments',{timeout:18000,attempts:1}),rows=r.data?.items||[];root.innerHTML=rows.length?rows.map(x=>`<article class="pending-item-v0512"><div><h4>${esc(x.program_name||'Program KIA')}</h4><div class="pending-meta-v0512">${esc(x.donation_code||'')} · ${esc(x.payment_status||'PENDING')}${x.expired_at?` · s.d. ${new Date(x.expired_at).toLocaleString('id-ID')}`:''}</div></div><div class="pending-amount-v0512"><strong>${idr(x.gross_amount)}</strong><small>Nominal donasi</small></div><a class="btn btn-primary" href="./payment.html?token=${encodeURIComponent(x.view_token||'')}&from=impact">Lanjutkan</a></article>`).join(''):'<div class="empty-state">Tidak ada transaksi yang menunggu pembayaran.</div>';pendingLoaded=true}catch(e){root.innerHTML=`<div class="empty-state">${esc(e.message||'Transaksi pending belum dapat dimuat.')}</div>`}}

async function loadProfile(force=false){if(profileLoaded&&!force)return;const form=$('[data-profile-form]');if(!form)return;const st=$('[data-profile-status]');try{const r=await KiaAuth.request('/api/account/profile',{timeout:14000}),u=r.data?.user||{},p=r.data?.profile||{};form.elements.full_name.value=u.full_name||'';form.elements.phone.value=u.phone||'';form.elements.email.value=u.email||'';form.elements.account_type.value=u.account_type==='ORGANIZATION'?'Yayasan / Organisasi':'Perorangan';form.elements.address.value=p.address||'';renderAvatar(p.avatar_url,u.full_name);st.textContent='Profil tersinkron.';profileLoaded=true}catch(e){st.textContent=e.message||'Profil belum dapat dimuat.'}}

function avatarPrefKeyV0519(){const u=KiaAuth.getUser()||{};return `kia_avatar_pref_v0519_${u.user_id||u.email||'guest'}`}
const DEFAULT_AVATAR_ICONS_V0519=['volunteer_activism','local_florist','directions_bus','school','account_balance','eco','flight','favorite'];
function readAvatarPrefV0519(){try{return JSON.parse(localStorage.getItem(avatarPrefKeyV0519())||'null')||{mode:'initials'}}catch(_){return{mode:'initials'}}}
function writeAvatarPrefV0519(v){try{localStorage.setItem(avatarPrefKeyV0519(),JSON.stringify(v||{mode:'initials'}))}catch(_){}}
function materialAvatarIconV0520(value){const s=String(value||'').trim();return s.startsWith('material:')?s.slice(9):''}
function invalidateAvatarCachesV0520(){
  for(const store of [localStorage,sessionStorage]){try{for(let i=store.length-1;i>=0;i--){const k=store.key(i)||'';if(/^kia_(program_detail|program_donations|donation_social|social|public_bootstrap|catalog)/.test(k))store.removeItem(k)}}catch(_){}}
  try{localStorage.setItem('kia_public_invalidate_at',String(Date.now()))}catch(_){}
}
function renderAvatar(url,name){const root=$('[data-profile-avatar]');if(!root)return;const icon=materialAvatarIconV0520(url),pref=readAvatarPrefV0519();
  if(icon){writeAvatarPrefV0519({mode:'icon',icon});root.innerHTML=`<span class="material-symbols-outlined">${esc(icon)}</span>`;renderDefaultAvatarChoices(icon);return}
  if(url){writeAvatarPrefV0519({mode:'photo'});root.innerHTML=`<img src="${esc(url)}" alt="Foto profil">`;renderDefaultAvatarChoices('');return}
  if(pref?.mode==='icon'&&pref.icon){root.innerHTML=`<span class="material-symbols-outlined">${esc(pref.icon)}</span>`;renderDefaultAvatarChoices(pref.icon);return}
  root.innerHTML=`<span>${esc(initials(name))}</span>`;renderDefaultAvatarChoices('')}
async function persistMaterialAvatarV0520(icon,{silent=false}={}){if(!DEFAULT_AVATAR_ICONS_V0519.includes(icon))return false;try{const r=await KiaAuth.request('/api/account/avatar-icon',{method:'POST',body:JSON.stringify({icon}),timeout:16000,attempts:1});writeAvatarPrefV0519({mode:'icon',icon});invalidateAvatarCachesV0520();renderAvatar(r.data?.avatar_url||`material:${icon}`,KiaAuth.getUser()?.full_name);if(!silent)KiaUI.toast('Ikon profil tersinkron ke akun KIA.',{type:'success'});return true}catch(e){if(!silent)KiaUI.toast(e.message||'Ikon profil belum dapat disimpan.',{type:'error'});return false}}
async function loadProfile(force=false){if(profileLoaded&&!force)return;const form=$('[data-profile-form]');if(!form)return;const st=$('[data-profile-status]');try{const r=await KiaAuth.request('/api/account/profile',{timeout:14000}),u=r.data?.user||{},p=r.data?.profile||{};form.elements.full_name.value=u.full_name||'';form.elements.phone.value=u.phone||'';form.elements.email.value=u.email||'';form.elements.account_type.value=u.account_type==='ORGANIZATION'?'Yayasan / Organisasi':'Perorangan';form.elements.address.value=p.address||'';renderAvatar(p.avatar_url,u.full_name);renderAccountHeaderBadgesV0519(u,p);syncVerificationBadgeV0519();st.textContent='Profil tersinkron.';profileLoaded=true;
    const pref=readAvatarPrefV0519();if(!p.avatar_url&&pref?.mode==='icon'&&DEFAULT_AVATAR_ICONS_V0519.includes(pref.icon)){persistMaterialAvatarV0520(pref.icon,{silent:true})}
  }catch(e){st.textContent=e.message||'Profil belum dapat dimuat.'}}
async function saveProfile(e){e.preventDefault();const f=e.currentTarget,b=f.querySelector('[data-profile-save]'),st=f.querySelector('[data-profile-status]');b.disabled=true;b.textContent='Menyimpan…';try{const r=await KiaAuth.request('/api/account/profile',{method:'POST',body:JSON.stringify({full_name:f.elements.full_name.value.trim(),phone:f.elements.phone.value.trim(),address:f.elements.address.value.trim()}),timeout:18000,attempts:1});KiaAuth.setSession({user:r.data.user});$$('[data-user-name]').forEach(x=>x.textContent=r.data.user.full_name);$('[data-account-name]').textContent=r.data.user.full_name;renderAvatar(r.data.profile?.avatar_url,r.data.user.full_name);renderAccountHeaderBadgesV0519(r.data.user,r.data.profile||{});st.textContent='Profil berhasil diperbarui.'}catch(err){st.textContent=err.message||'Profil gagal disimpan.'}finally{b.disabled=false;b.textContent='Simpan Profil'}}
async function fileToAvatar(file){
  const drawFromImage=img=>{const side=Math.min(img.width,img.height),sx=(img.width-side)/2,sy=(img.height-side)/2,c=document.createElement('canvas');c.width=600;c.height=600;const ctx=c.getContext('2d');ctx.drawImage(img,sx,sy,side,side,0,0,600,600);return new Promise((resolve,reject)=>c.toBlob(blob=>{if(!blob)return reject(new Error('Gagal memproses foto.'));const fr=new FileReader();fr.onload=()=>resolve({file_name:'avatar.jpg',mime_type:'image/jpeg',base64:String(fr.result).split(',')[1]});fr.onerror=reject;fr.readAsDataURL(blob)},'image/jpeg',0.86))};
  try{if(window.createImageBitmap){const bmp=await createImageBitmap(file);const payload=await drawFromImage(bmp);bmp.close?.();return payload}}catch(_){ }
  const dataUrl=await new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(fr.result);fr.onerror=reject;fr.readAsDataURL(file)});
  const img=await new Promise((resolve,reject)=>{const el=new Image();el.onload=()=>resolve(el);el.onerror=()=>reject(new Error('Foto tidak dapat dibuka.'));el.src=dataUrl});
  return drawFromImage(img)
}
async function uploadAvatar(e){const file=e.target.files?.[0];e.target.value='';if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)){KiaUI.toast('Format foto harus JPG, PNG, atau WEBP.',{type:'error'});return}if(file.size>2*1024*1024){KiaUI.toast('Ukuran foto maksimal 2 MB.',{type:'error'});return}try{KiaUI.showLoading({title:'Mengganti foto profil',message:'Mengoptimalkan foto…'});const payload=await fileToAvatar(file),r=await KiaAuth.request('/api/account/avatar',{method:'POST',body:JSON.stringify(payload),timeout:30000,attempts:1});writeAvatarPrefV0519({mode:'photo'});invalidateAvatarCachesV0520();renderAvatar(r.data?.avatar_url,KiaAuth.getUser()?.full_name);KiaUI.toast('Foto profil diperbarui',{type:'success'})}catch(err){KiaUI.toast(err.message||'Foto profil gagal diubah',{type:'error'})}finally{KiaUI.hideLoading()}}
function renderDefaultAvatarChoices(selected=''){const root=$('[data-default-avatar-list]');if(!root)return;const current=selected||(readAvatarPrefV0519().icon||'');root.innerHTML=DEFAULT_AVATAR_ICONS_V0519.map(icon=>`<button type="button" class="avatar-default-item-v0519 ${current===icon?'is-selected':''}" data-avatar-icon="${esc(icon)}" title="${esc(icon)}"><span class="material-symbols-outlined">${esc(icon)}</span></button>`).join('');$$('[data-avatar-icon]',root).forEach(btn=>btn.onclick=async()=>{if(btn.disabled)return;const old=btn.innerHTML;btn.disabled=true;btn.innerHTML='<span class="material-symbols-outlined">sync</span>';const ok=await persistMaterialAvatarV0520(btn.dataset.avatarIcon);btn.disabled=false;if(!ok)btn.innerHTML=old})}
function verificationBadgeStateV0519(){const pill=$('.account-verify-card-v0512 .status-pill');const text=(pill?.textContent||'').trim();if(/setuju|approved|disetujui|verified|terverifikasi/i.test(text))return{label:'Terverifikasi',icon:'verified',cls:'is-good'};if(/review|pending|menunggu/i.test(text))return{label:'Review',icon:'hourglass_top',cls:'is-warn'};return{label:'Belum Verifikasi',icon:'gpp_bad',cls:'is-warn'}}
function renderAccountHeaderBadgesV0519(user={},profile={}){const root=$('[data-account-state-badges]');if(!root)return;const type=user.account_type==='ORGANIZATION'?'Yayasan / Organisasi':'Perorangan';const role=(user.platform_role||'USER').toUpperCase();const verify=verificationBadgeStateV0519();const items=[{label:type,icon:user.account_type==='ORGANIZATION'?'apartment':'person',cls:'is-good'},{label:role,icon:role==='SUPERADMIN'?'shield_person':'badge',cls:'is-good'},verify];root.innerHTML=items.map(x=>`<span class="account-state-badge-v0519 ${esc(x.cls||'')}"><span class="material-symbols-outlined">${esc(x.icon)}</span>${esc(x.label)}</span>`).join('')}
function syncVerificationBadgeV0519(){renderAccountHeaderBadgesV0519(KiaAuth.getUser()||{},{});}
function cleanAccountRowsV0519(){const card=$('[data-section="account"] .section-card');if(!card)return;$$('.system-info-list > *',card).forEach(row=>{const txt=(row.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();if(/jenis akun|platform role/.test(txt))row.style.display='none'});$$('[name="account_type"]',card).forEach(x=>x.closest('.field')?.setAttribute('data-hide-field-v0519','1'));}
function renderAccountBadges(){const root=$('[data-account-badges-list]');if(!root)return;const selected=localStorage.getItem(badgeStore())||'';root.innerHTML=lastBadges.length?lastBadges.map(b=>`<button type="button" class="account-badge-choice-v0512 ${selected===b.code?'is-selected':''}" data-display-badge="${esc(b.code)}"><span class="material-symbols-outlined">${esc(b.icon||'workspace_premium')}</span>${esc(b.label)}</button>`).join(''):'<span class="muted mini">Belum ada lencana yang dapat dipilih.</span>';$$('[data-display-badge]',root).forEach(b=>b.onclick=()=>{localStorage.setItem(badgeStore(),b.dataset.displayBadge);renderAccountBadges();KiaUI.toast('Lencana tampilan dipilih',{type:'success'})})}
function programSnapshotV0516(){
  try{
    const snap=JSON.parse(localStorage.getItem('kia_dashboard_snapshot_v040')||'null');
    return Array.isArray(snap?.programs)?snap.programs:[];
  }catch(_){return[]}
}
function programDetailCacheV0517(id){
  const keys=[`kia_program_detail_v0510_${id}`,`kia_program_detail_v058_${id}`,`kia_program_detail_v056_${id}`];
  for(const k of keys){
    try{
      const hit=JSON.parse(localStorage.getItem(k)||'null');
      const p=hit?.data?.program||hit?.program||null;
      if(p&&String(p.program_id||'')===String(id)) return p;
    }catch(_){}
  }
  return null;
}
function progressCacheKeyV0517(id){return `kia_program_progress_v0517_${id}`}
function readProgressCacheV0517(id){
  try{
    const x=JSON.parse(localStorage.getItem(progressCacheKeyV0517(id))||'null');
    if(x&&Date.now()-Number(x.saved_at||0)<30*60*1000)return x.data||null;
  }catch(_){}
  return null;
}
function writeProgressCacheV0517(id,data){
  try{localStorage.setItem(progressCacheKeyV0517(id),JSON.stringify({saved_at:Date.now(),data}))}catch(_){}
}
function normalizeProgressV0517(p){
  if(!p)return null;
  const raw=Math.max(0,Number(p.raised_amount ?? p.gross_amount ?? 0)||0);
  const target=Math.max(0,Number(p.target_amount)||0);
  const credited=target>0?Math.min(raw,target):raw;
  const excess=target>0?Math.max(0,raw-target):0;
  const pct=target>0?Math.min(100,Math.round((credited/target)*100)):0;
  return{raw,target,credited,excess,pct,status:String(p.status||'').toUpperCase()}
}
function programProgressDataV0516(id){
  const cached=readProgressCacheV0517(id);
  if(cached) return cached;

  const detail=normalizeProgressV0517(programDetailCacheV0517(id));
  if(detail && (detail.raw>0 || detail.target>0)) return detail;

  const snap=normalizeProgressV0517(programSnapshotV0516().find(x=>String(x.program_id)===String(id)));
  return snap;
}
function stageLabelV0516(status,pct){
  if(status==='COMPLETED')return'Selesai';
  if(status==='PAUSED')return'Pelaksanaan · Donasi Ditutup';
  if(status==='PENDING_REVIEW')return'Menunggu Review';
  if(status==='APPROVED')return'Siap Dipublikasikan';
  if(status==='DRAFT'||status==='REJECTED')return'Draft / Penyusunan';
  if(status==='ACTIVE'&&pct>=100)return'Target Tercapai · Donasi Masih Terbuka';
  if(status==='ACTIVE')return'Penggalangan Aktif';
  return status||'Program';
}
function progressHtmlV0517(d,thumb=''){
  const stage=stageLabelV0516(d.status,d.pct);
  return `
    <div class="program-progress-grid-v0518">
      <div>
        <div class="program-progress-head-v0516">
          <div class="program-progress-money-v0516">
            <span>Terkumpul</span>
            <strong>${idr(d.credited)} <small>/ ${idr(d.target)}</small></strong>
          </div>
          <div class="program-progress-percent-v0516">
            <strong>${d.pct}%</strong>
            <small>progress dana</small>
          </div>
        </div>
        <div class="program-progress-bar-v0516"><i style="width:${d.pct}%"></i></div>
        <div class="program-progress-foot-v0516">
          <span class="program-stage-v0516">${esc(stage)}</span>
          ${d.excess>0?`<span class="excess">Dana Lebih ${idr(d.excess)}</span>`:`<span>Sisa target ${idr(Math.max(0,d.target-d.credited))}</span>`}
        </div>
      </div>
      ${thumb?`<div class="program-progress-media-v0518"><img src="${esc(thumb)}" alt="Thumbnail Program"></div>`:''}
    </div>`;
}
function renderProgramProgressV0516(item,id,forceData=null){
  const d=forceData||programProgressDataV0516(id); if(!d)return;
  const thumb=item.querySelector('.program-item__top>img')?.getAttribute('src')||'';
  let box=item.querySelector('[data-program-progress-v0516]');
  if(!box){
    box=document.createElement('div');
    box.className='program-progress-v0516';
    box.dataset.programProgressV0516='1';
    const actions=item.querySelector('.program-actions');
    item.insertBefore(box,actions||null);
  }
  box.innerHTML=progressHtmlV0517(d,thumb);
}
const inflightProgressV0517=new Map();
async function syncProgramProgressV0517(item,id){
  if(inflightProgressV0517.has(id)) return inflightProgressV0517.get(id);
  const run=(async()=>{
    try{
      const url=`${KIA_CONFIG.BACKEND_URL}/api/public/programs/${encodeURIComponent(id)}?refresh=${Date.now()}`;
      const res=await fetch(url,{cache:'no-store'});
      const raw=await res.text();
      let json;
      try{json=JSON.parse(raw)}catch(_){json=null}
      const prog=json?.data?.program||null;
      const d=normalizeProgressV0517(prog);
      if(d && (d.target>0 || d.raw>0)){
        writeProgressCacheV0517(id,d);
        renderProgramProgressV0516(item,id,d);
      }
    }catch(_){}
    finally{inflightProgressV0517.delete(id)}
  })();
  inflightProgressV0517.set(id,run);
  return run;
}

function enhanceProgramRows(){
  const root=$('[data-program-list]');if(!root)return;

  if(!root.parentNode.querySelector('[data-lifecycle-guide-v0515]')){
    root.insertAdjacentHTML('beforebegin',`<div class="program-lifecycle-guide-v0515" data-lifecycle-guide-v0515><strong>Alur Program:</strong> Draft → Review → Aktif menerima donasi → Stop Donasi → Pelaksanaan & Update Perkembangan → Selesai. <br>Dana yang sudah PAID, termasuk Dana Lebih yang sudah masuk, tetap tercatat walaupun penerimaan donasi dihentikan.</div>`);
  }

  root.querySelectorAll('.program-item').forEach(item=>{
    const actions=item.querySelector('.program-actions'),
          edit=actions?.querySelector('[data-program-edit]');
    if(!actions||!edit)return;

    const id=edit.dataset.programEdit,
          statusText=item.querySelector('.status-pill')?.textContent.trim()||'',
          meta=item.querySelector('.muted.mini');

    const top=item.querySelector('.program-item__top'),
          title=top?.querySelector('h3'),
          badge=top?.querySelector('.status-pill');
    if(top && title && !top.querySelector('.program-head-v0518')){
      const head=document.createElement('div');
      head.className='program-head-v0518';
      const wrap=document.createElement('div');
      wrap.className='program-title-wrap-v0518';
      title.parentNode.insertBefore(head,title);
      head.appendChild(wrap);
      wrap.appendChild(title);
      if(meta) wrap.appendChild(meta);
      if(badge) head.appendChild(badge);
    }

    renderProgramProgressV0516(item,id);
    syncProgramProgressV0517(item,id);

    const oldNote=item.querySelector('[data-lifecycle-note-v0515]');
    if(oldNote) oldNote.remove();

    const submit=actions.querySelector('[data-program-submit]');
    if(submit&&!actions.querySelector('[data-delete-draft]')){
      const del=document.createElement('button');
      del.type='button';
      del.className='btn btn-ghost program-delete-v0512';
      del.dataset.deleteDraft=id;
      del.textContent='Hapus Draft';
      actions.appendChild(del);
      del.onclick=()=>deleteDraft(id,item);
    }

    const pause=actions.querySelector('[data-program-status="PAUSE"]');
    if(pause){
      pause.textContent='Stop Donasi';
      pause.title='Menutup penerimaan donasi baru. Dana yang sudah masuk tetap tercatat.';
      pause.onclick=e=>{e.preventDefault();e.stopImmediatePropagation();lifecycleProgram(id,'STOP_DONATION')};
    }

    const resume=actions.querySelector('[data-program-status="RESUME"]');
    if(resume){
      resume.textContent='Buka Donasi';
      resume.onclick=e=>{e.preventDefault();e.stopImmediatePropagation();lifecycleProgram(id,'RESUME_DONATION')};

      if(!actions.querySelector('[data-program-complete-v0515]')){
        const complete=document.createElement('button');
        complete.type='button';
        complete.className='btn btn-soft program-complete-v0515';
        complete.dataset.programCompleteV0515=id;
        complete.textContent='Tandai Selesai';
        actions.appendChild(complete);
        complete.onclick=()=>lifecycleProgram(id,'COMPLETE_PROGRAM');
      }
    }

    if(/Selesai/i.test(statusText)&&!actions.querySelector('[data-public-completed-v0515]')){
      const view=document.createElement('a');
      view.className='btn btn-soft';
      view.dataset.publicCompletedV0515='1';
      view.href=`./program.html?id=${encodeURIComponent(id)}`;
      view.target='_blank';
      view.textContent='Lihat Publik';
      actions.appendChild(view);
    }
  })
}

async function lifecycleProgram(id,action){
  const config={
    STOP_DONATION:{
      title:'Stop penerimaan donasi?',
      message:'Donasi baru akan ditolak. Dana yang sudah PAID, termasuk Dana Lebih yang sudah masuk, tetap tercatat dan tetap masuk laporan.',
      confirmText:'Stop Donasi',
      danger:true
    },
    RESUME_DONATION:{
      title:'Buka kembali donasi?',
      message:'Program akan kembali menerima donasi baru.',
      confirmText:'Buka Donasi',
      danger:false
    },
    COMPLETE_PROGRAM:{
      title:'Tandai program selesai?',
      message:'Program akan ditutup permanen dari donasi baru. Pastikan perkembangan/laporan akhir sudah dipublikasikan.',
      confirmText:'Program Selesai',
      danger:false
    }
  }[action];

  const ok=await KiaUI.confirm(config);if(!ok)return;

  KiaUI.showLoading({
    title:action==='COMPLETE_PROGRAM'?'Menyelesaikan program':'Memperbarui program',
    message:'Menyimpan status terbaru…'
  });

  try{
    await KiaAuth.request(`/api/programs/${encodeURIComponent(id)}/lifecycle`,{
      method:'POST',
      body:JSON.stringify({action}),
      timeout:22000,
      attempts:1
    });
    try{
      localStorage.removeItem('kia_dashboard_snapshot_v040');
      localStorage.setItem('kia_public_invalidate_at',String(Date.now()));
    }catch(_){}
    KiaUI.hideLoading();
    KiaUI.toast(
      action==='STOP_DONATION'?'Penerimaan donasi dihentikan.':
      action==='RESUME_DONATION'?'Penerimaan donasi dibuka kembali.':
      'Program ditandai selesai.',
      {type:'success'}
    );
    setTimeout(()=>location.reload(),350);
  }catch(e){
    KiaUI.hideLoading();
    KiaUI.toast(e.message||'Status program belum dapat diperbarui.',{type:'error',duration:5000});
  }
}
async function deleteDraft(id,row){const ok=await KiaUI.confirm({title:'Hapus Draft Program?',message:'Draft akan diarsipkan dan hilang dari daftar Program Saya.',confirmText:'Hapus Draft',danger:true});if(!ok)return;const btn=row.querySelector(`[data-delete-draft="${CSS.escape(id)}"]`);if(btn){btn.disabled=true;btn.textContent='Menghapus…'}try{await KiaAuth.request(`/api/programs/${encodeURIComponent(id)}/delete-draft`,{method:'POST',body:'{}',timeout:22000,attempts:1});try{const k='kia_dashboard_snapshot_v040',snap=JSON.parse(localStorage.getItem(k)||'null');if(Array.isArray(snap?.programs)){snap.programs=snap.programs.filter(p=>p.program_id!==id);localStorage.setItem(k,JSON.stringify(snap))}}catch(_){}row.remove();KiaUI.toast('Draft program dihapus',{type:'success'})}catch(e){if(btn){btn.disabled=false;btn.textContent='Hapus Draft'}KiaUI.toast(e.message||'Draft belum dapat dihapus',{type:'error',duration:5000})}}
function observePrograms(){const root=$('[data-program-list]');if(!root||root.dataset.phaseCObserver)return;root.dataset.phaseCObserver='1';new MutationObserver(()=>setTimeout(enhanceProgramRows,20)).observe(root,{childList:true,subtree:true});enhanceProgramRows()}

function injectSupporterAdmin(){const user=KiaAuth.getUser?.();if(user?.platform_role!=='SUPER_ADMIN')return;const shell=$('[data-settings-view="home"] .settings-shell');if(!shell||$('[data-supporter-settings-entry]'))return;const group=document.createElement('div');group.className='settings-group';group.dataset.supporterSettingsEntry='1';group.innerHTML=`<button class="settings-group__head" type="button"><span class="material-symbols-outlined settings-group__icon">handshake</span><span class="settings-group__copy"><strong>Supporter & Partner</strong><small>Logo sponsor, partner, supporter, atau iklan di footer publik.</small></span><span class="material-symbols-outlined settings-group__chevron">chevron_right</span></button>`;shell.appendChild(group);const parent=$('[data-section="settings"]');parent.insertAdjacentHTML('beforeend',`<div class="settings-view" data-settings-view="supporters" hidden><div class="settings-view-head"><button class="settings-back" type="button" data-supporter-back><span class="material-symbols-outlined">arrow_back</span></button><div><h3 style="margin:0">Supporter & Partner</h3><p class="muted mini">Atur logo yang tampil di footer landing.</p></div></div><div class="supporter-admin-list-v0512" data-supporter-admin-list></div><div class="form-actions"><button class="btn btn-soft" type="button" data-supporter-add>+ Tambah Logo</button><button class="btn btn-primary" type="button" data-supporter-save>Simpan</button></div></div>`);group.querySelector('button').onclick=()=>openSupporters();$('[data-supporter-back]').onclick=()=>showSetting('home');$('[data-supporter-add]').onclick=()=>addSupporterRow();$('[data-supporter-save]').onclick=saveSupporters}
function showSetting(name){$$('[data-settings-view]').forEach(v=>v.hidden=v.dataset.settingsView!==name)}
async function openSupporters(){showSetting('supporters');const root=$('[data-supporter-admin-list]');root.innerHTML='<div class="skeleton skeleton-card"></div>';let items=[];try{const r=await KiaAuth.request('/api/public/settings',{timeout:12000}),raw=r.data?.supporter_logos_json||'';if(raw)items=JSON.parse(raw)}catch(_){}root.innerHTML='';(Array.isArray(items)&&items.length?items:[{name:'KIA',image_url:'./icons/kia-symbol-v030.png',link:''},{name:'Finance Tracker',image_url:'',link:''}]).forEach(addSupporterRow)}
function addSupporterRow(item={}){const root=$('[data-supporter-admin-list]');if(!root)return;const row=document.createElement('div');row.className='supporter-admin-row-v0512';row.innerHTML=`<input data-sup-name placeholder="Nama" value="${esc(item.name||'')}"><input data-sup-image placeholder="URL Logo" value="${esc(item.image_url||'')}"><input data-sup-link placeholder="Link tujuan (opsional)" value="${esc(item.link||'')}"><button class="btn btn-danger" type="button">Hapus</button>`;row.querySelector('button').onclick=()=>row.remove();root.appendChild(row)}
async function saveSupporters(){const items=$$('.supporter-admin-row-v0512').map(r=>({name:r.querySelector('[data-sup-name]').value.trim(),image_url:r.querySelector('[data-sup-image]').value.trim(),link:r.querySelector('[data-sup-link]').value.trim()})).filter(x=>x.name||x.image_url);try{await KiaAuth.request('/api/admin/site-settings',{method:'POST',body:JSON.stringify({supporter_logos_json:JSON.stringify(items)}),timeout:16000});KiaUI.toast('Supporter footer disimpan',{type:'success'})}catch(e){KiaUI.toast(e.message||'Supporter gagal disimpan',{type:'error'})}}


function applyRoleGuardV514(){
  const role=String(KiaAuth.getUser?.()?.platform_role||'USER').toUpperCase();
  $$('[data-dashboard-route="admin"]').forEach(x=>x.hidden=!['PLATFORM_ADMIN','SUPER_ADMIN'].includes(role));
  $$('[data-dashboard-route="cms"],[data-dashboard-route="settings"]').forEach(x=>x.hidden=role!=='SUPER_ADMIN');
  if(role!=='SUPER_ADMIN'&&['#cms','#settings'].includes(location.hash))location.hash=role==='PLATFORM_ADMIN'?'#admin':'#home';
  if(!['PLATFORM_ADMIN','SUPER_ADMIN'].includes(role)&&location.hash==='#admin')location.hash='#home';
}

function init(){applyRoleGuardV514();restructure();window.addEventListener('hashchange',()=>{applyRoleGuardV514();if(location.hash==='#verification')location.hash='#account';if(location.hash==='#impact'){loadImpact();loadPending()}if(location.hash==='#account')loadProfile()});setTimeout(()=>{applyRoleGuardV514();restructure();if(location.hash==='#impact')loadImpact()},900)}
document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0));
window.KiaDonorImpact={load:loadImpact,refresh:()=>{impactLoaded=false;pendingLoaded=false;return loadImpact(true)}};
})();
