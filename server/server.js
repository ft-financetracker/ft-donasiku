import express from 'express';
import crypto from 'node:crypto';

const app=express();
app.use(express.json({limit:'6mb'}));
app.use('/api',(req,res,next)=>{res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, private');next();});

const PORT=process.env.PORT||3000;
const GAS_URL=process.env.KIA_GAS_URL;
const GATEWAY_SECRET=process.env.KIA_GATEWAY_SECRET;
const ALLOWED_ORIGIN=process.env.KIA_ALLOWED_ORIGIN||'*';

app.use((req,res,next)=>{
  res.setHeader('Access-Control-Allow-Origin',ALLOWED_ORIGIN);
  res.setHeader('Vary','Origin');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-KIA-Device-ID'
  );
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');

  if(req.method==='OPTIONS') return res.sendStatus(204);
  next();
});

const id=(p)=>p+'_'+Date.now().toString(36)+'_'+crypto.randomBytes(6).toString('hex');
const normEmail=e=>String(e||'').trim().toLowerCase();

const hashPassword=p=>{
  const salt=crypto.randomBytes(16);
  const hash=crypto.scryptSync(String(p),salt,64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
};

const verifyPassword=(p,stored)=>{
  try{
    const [,s,h]=stored.split('$');
    const a=crypto.scryptSync(String(p),Buffer.from(s,'hex'),64);
    const b=Buffer.from(h,'hex');
    return a.length===b.length&&crypto.timingSafeEqual(a,b);
  }catch{
    return false;
  }
};

const tokenHash=t=>crypto.createHash('sha256').update(t).digest('hex');
const requestTokenHash=req=>{const raw=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');return raw?tokenHash(raw):'';};

function deviceId(req){
  const raw=String(req.headers['x-kia-device-id']||'').trim();
  if(raw && raw.length<=160) return raw;
  return 'legacy-browser';
}

function stableSessionId(userId,device){
  const digest=crypto
    .createHmac('sha256',GATEWAY_SECRET||'kia-session')
    .update(`${userId}|${device}`)
    .digest('hex')
    .slice(0,28);

  return `ses_${digest}`;
}

async function gas(action,payload={},opts={}){
  if(!GAS_URL||!GATEWAY_SECRET) throw new Error('BACKEND_NOT_CONFIGURED');
  const readActions=new Set(['findOne','listWhere','resolveSession','dashboardBootstrapFast','reviewAdminFast','heroAdminFast','publicBootstrapFast','publicProgramsFast','publicProgramFast','adminUsersFast','faqPublicFast','faqAdminFast','siteSettingsPublicFast','publicHelpFast']);
  const isRead=readActions.has(action);
  const attempts=isRead?2:1; // WRITE tidak di-retry: cegah duplicate + delay ganda.
  const timeout=Number(opts.timeout)|| (isRead?9000:15000);
  const body=JSON.stringify({action,gateway_secret:GATEWAY_SECRET,...payload});
  let lastError=null;
  for(let attempt=1;attempt<=attempts;attempt++){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeout);
    try{
      const r=await fetch(GAS_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body,signal:controller.signal});
      const out=await r.json();
      if(!out.success){const e=new Error(out.code||'GATEWAY_ERROR');e.code=out.code;throw e;}
      return out.data;
    }catch(err){
      lastError=err;
      if(attempt<attempts) await new Promise(resolve=>setTimeout(resolve,180));
    }finally{clearTimeout(timer)}
  }
  const e=new Error(lastError?.name==='AbortError'?'GATEWAY_TIMEOUT':(lastError?.message||'GATEWAY_ERROR'));
  e.code=e.message;
  throw e;
}

const sessionCache=new Map();
const SESSION_CACHE_TTL=10*60*1000;
function cacheSessionToken(token,user){if(token&&user) sessionCache.set(tokenHash(token),{user,expires:Date.now()+SESSION_CACHE_TTL});}
function dropSessionToken(token){if(token) sessionCache.delete(tokenHash(token));}
function refreshCachedUser(user){
  if(!user?.user_id) return;
  for(const [key,item] of sessionCache.entries()){
    if(String(item?.user?.user_id)===String(user.user_id)){
      sessionCache.set(key,{user:{...item.user,...user},expires:Date.now()+SESSION_CACHE_TTL});
    }
  }
}

async function saveSession(req,userId){
  const now=new Date().toISOString();
  const token=crypto.randomBytes(32).toString('base64url');
  const session_id=stableSessionId(userId,deviceId(req));

  const result=await gas('upsert',{
    sheet:'03_SESSIONS',
    match:{session_id},
    preserveFields:['session_id','created_at'],
    row:{
      session_id,
      user_id:userId,
      token_hash:tokenHash(token),
      status:'ACTIVE',
      expires_at:new Date(Date.now()+7*864e5).toISOString(),
      last_seen_at:now,
      created_at:now,
      revoked_at:''
    }
  });

  return {
    token,
    session:result.row
  };
}

async function sessionUser(req){
  const raw=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!raw) return null;
  const key=tokenHash(raw);
  const cached=sessionCache.get(key);
  if(cached&&cached.expires>Date.now()) return cached.user;
  if(cached) sessionCache.delete(key);

  const resolved=await gas('resolveSession',{token_hash:key});
  if(!resolved?.user) return null;
  sessionCache.set(key,{user:resolved.user,expires:Date.now()+SESSION_CACHE_TTL});
  return resolved.user;
}

app.get('/health',(req,res)=>res.json({
  success:true,
  data:{
    app:'KIA Backend',
    version:'0.4.0'
  }
}));

// ------------------------------------------------------------------
// AUTH BASELINE v0.2.5 — LOCK. Do not alter behavior.
// ------------------------------------------------------------------
app.post('/api/auth/register',async(req,res)=>{
  try{
    const {
      full_name,
      phone,
      password,
      account_type,
      organization_name
    }=req.body;

    const email=normEmail(req.body.email);

    if(!full_name||!email||!password||password.length<8){
      return res.status(400).json({
        success:false,
        message:'Lengkapi data. Password minimal 8 karakter.'
      });
    }

    if(!['INDIVIDUAL','ORGANIZATION'].includes(account_type)){
      return res.status(400).json({
        success:false,
        message:'Jenis akun tidak valid.'
      });
    }

    if(await gas('findOne',{sheet:'01_USERS',filters:{email}})){
      return res.status(409).json({
        success:false,
        message:'Email sudah terdaftar.'
      });
    }

    const now=new Date().toISOString();
    const user_id=id('usr');

    await gas('insert',{
      sheet:'01_USERS',
      row:{
        user_id,
        email,
        phone:phone||'',
        password_hash:hashPassword(password),
        full_name,
        account_type,
        platform_role:'USER',
        status:'ACTIVE',
        email_verified_at:'',
        last_login_at:'',
        created_at:now,
        updated_at:now
      }
    });

    await gas('insert',{
      sheet:'02_USER_PROFILES',
      row:{
        profile_id:id('prf'),
        user_id,
        address:'',
        avatar_url:'',
        identity_status:'UNVERIFIED',
        identity_type:'',
        identity_number:'',
        created_at:now,
        updated_at:now
      }
    });

    let organization=null;

    if(account_type==='ORGANIZATION'){
      if(!organization_name) throw new Error('ORGANIZATION_NAME_REQUIRED');

      const organization_id=id('org');
      organization={organization_id,name:organization_name};

      await gas('insert',{
        sheet:'04_ORGANIZATIONS',
        row:{
          organization_id,
          name:organization_name,
          slug:'',
          type:'YAYASAN',
          legal_name:'',
          registration_number:'',
          phone:phone||'',
          email,
          address:'',
          logo_url:'',
          verification_status:'UNVERIFIED',
          status:'ACTIVE',
          created_by:user_id,
          created_at:now,
          updated_at:now
        }
      });

      await gas('insert',{
        sheet:'05_ORGANIZATION_MEMBERS',
        row:{
          membership_id:id('mem'),
          organization_id,
          user_id,
          role:'OWNER',
          status:'ACTIVE',
          invited_by:'',
          joined_at:now,
          created_at:now,
          updated_at:now
        }
      });
    }

    const registeredUser=await applyBootstrapAdmin({
      user_id,email,full_name,account_type,platform_role:'USER'
    });
    const auth=await saveSession(req,user_id);
    cacheSessionToken(auth.token,{user_id,email,phone:phone||'',full_name,account_type,platform_role:'USER',status:'ACTIVE'});

    res.status(201).json({
      success:true,
      data:{
        token:auth.token,
        user:{
          user_id,
          email,
          full_name,
          account_type,
          platform_role:registeredUser.platform_role||'USER'
        },
        organization
      }
    });

  }catch(e){
    res.status(500).json({success:false,message:e.message});
  }
});

app.post('/api/auth/login',async(req,res)=>{
  try{
    const email=normEmail(req.body.email);

    const u=await gas('findOne',{
      sheet:'01_USERS',
      filters:{
        email,
        status:'ACTIVE'
      }
    });

    if(!u||!verifyPassword(req.body.password,u.password_hash)){
      return res.status(401).json({
        success:false,
        message:'Email atau password salah.'
      });
    }

    const effectiveUser=await applyBootstrapAdmin(u);
    const now=new Date().toISOString();

    const auth=await saveSession(req,effectiveUser.user_id);
    cacheSessionToken(auth.token,effectiveUser);

    res.json({
      success:true,
      data:{
        token:auth.token,
        user:{
          user_id:effectiveUser.user_id,
          email:effectiveUser.email,
          full_name:effectiveUser.full_name,
          account_type:effectiveUser.account_type,
          platform_role:effectiveUser.platform_role||'USER'
        }
      }
    });

    gas('update',{
      sheet:'01_USERS',
      idField:'user_id',
      id:u.user_id,
      patch:{
        last_login_at:now,
        updated_at:now
      }
    }).catch(err=>console.error('LAST_LOGIN_UPDATE_FAILED',err.message));

  }catch(e){
    res.status(500).json({success:false,message:e.message});
  }
});

app.get('/api/auth/me',async(req,res)=>{
  try{
    let u=await sessionUser(req);

    if(!u){
      return res.status(401).json({
        success:false,
        message:'Sesi tidak valid atau kedaluwarsa.'
      });
    }

    u=await applyBootstrapAdmin(u);

    res.json({
      success:true,
      data:{
        user:{
          user_id:u.user_id,
          email:u.email,
          full_name:u.full_name,
          account_type:u.account_type,
          platform_role:u.platform_role||'USER'
        }
      }
    });

  }catch(e){
    res.status(500).json({success:false,message:e.message});
  }
});

app.post('/api/auth/logout',async(req,res)=>{
  try{
    const raw=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
    dropSessionToken(raw);

    if(raw){
      const s=await gas('findOne',{
        sheet:'03_SESSIONS',
        filters:{
          token_hash:tokenHash(raw),
          status:'ACTIVE'
        }
      });

      if(s){
        await gas('update',{
          sheet:'03_SESSIONS',
          idField:'session_id',
          id:s.session_id,
          patch:{
            status:'REVOKED',
            revoked_at:new Date().toISOString()
          }
        });
      }
    }

    res.json({success:true,data:{logged_out:true}});

  }catch(e){
    res.status(500).json({success:false,message:e.message});
  }
});

// ------------------------------------------------------------------
// CHECKPOINT 003 — VERIFICATION + PROGRAM + PUBLIC LANDING + CMS HERO
// ------------------------------------------------------------------
const PLATFORM_ADMINS=new Set(['PLATFORM_ADMIN','SUPER_ADMIN']);
const PLATFORM_ROLES=new Set(['USER','PLATFORM_ADMIN','SUPER_ADMIN']);
const PROGRAM_STATUSES=new Set(['DRAFT','PENDING_REVIEW','APPROVED','ACTIVE','PAUSED','COMPLETED','REJECTED','ARCHIVED']);

function text(value,max=5000){
  return String(value??'').trim().slice(0,max);
}
function positiveAmount(value){
  const n=Number(value);
  return Number.isFinite(n)&&n>0?n:0;
}
function slugify(value){
  return text(value,120).toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'')
    .slice(0,80)||'program';
}
function publicUser(u){
  return {
    user_id:u.user_id,
    email:u.email,
    phone:u.phone||'',
    full_name:u.full_name,
    account_type:u.account_type,
    platform_role:u.platform_role||'USER'
  };
}
function isAdmin(u){
  return PLATFORM_ADMINS.has(u?.platform_role);
}
function isSuperAdmin(u){
  return u?.platform_role==='SUPER_ADMIN';
}
async function applyBootstrapAdmin(user){
  const configured=String(process.env.KIA_SUPER_ADMIN_EMAIL||'').trim().toLowerCase();
  if(!configured||!user||String(user.email||'').trim().toLowerCase()!==configured||user.platform_role==='SUPER_ADMIN') return user;
  const patch={platform_role:'SUPER_ADMIN',updated_at:new Date().toISOString()};
  await gas('update',{sheet:'01_USERS',idField:'user_id',id:user.user_id,patch});
  const nextUser={...user,...patch};
  refreshCachedUser(nextUser);
  console.log('KIA_BOOTSTRAP_SUPER_ADMIN',user.email);
  return nextUser;
}
function httpError(status,message,code){
  const e=new Error(message);
  e.status=status;
  e.code=code||'REQUEST_ERROR';
  return e;
}
function sendError(res,e){
  const code=String(e.code||e.message||'SERVER_ERROR');
  const statusMap={
    UNAUTHORIZED:401,ADMIN_REQUIRED:403,SUPER_ADMIN_REQUIRED:403,FORBIDDEN:403,
    USER_NOT_FOUND:404,PROGRAM_NOT_FOUND:404,PROFILE_NOT_FOUND:404,ORGANIZATION_NOT_FOUND:404,
    PROGRAM_MEDIA_NOT_FOUND:404,REVISION_NOT_FOUND:404,
    INVALID_DECISION:400,INVALID_REVIEW_KIND:400,INCOMPLETE_PROGRAM:400,INVALID_MEDIA_TYPE:400,
    MISSING_MEDIA_DATA:400,MEDIA_TOO_LARGE:413,VERIFICATION_REQUIRED:409,INVALID_PROGRAM_STATUS:409,
    SELF_ROLE_CHANGE_BLOCKED:409,LAST_SUPER_ADMIN:409,REVISION_NOT_PENDING:409,
    GATEWAY_TIMEOUT:504
  };
  const friendly={
    GATEWAY_TIMEOUT:'Server data merespons terlalu lama. Data lokal tetap aman; silakan coba lagi.',
    UNAUTHORIZED:'Sesi tidak valid atau kedaluwarsa.',ADMIN_REQUIRED:'Akses admin diperlukan.',
    SUPER_ADMIN_REQUIRED:'Hanya SUPER_ADMIN yang dapat melakukan tindakan ini.',
    PROGRAM_NOT_FOUND:'Program tidak ditemukan.',VERIFICATION_REQUIRED:'Verifikasi penggalang dana harus disetujui terlebih dahulu.',
    INVALID_PROGRAM_STATUS:'Status program tidak mendukung tindakan ini.',MEDIA_TOO_LARGE:'Ukuran gambar terlalu besar setelah diproses.',
    REVISION_NOT_PENDING:'Revisi ini sudah diproses.'
  };
  const status=Number(e.status)||statusMap[code]||500;
  res.status(status).json({success:false,code,message:friendly[code]||e.message||'Terjadi kesalahan server.'});
}
async function requireUser(req){
  let u=await sessionUser(req);
  if(!u) throw httpError(401,'Sesi tidak valid atau kedaluwarsa.','UNAUTHORIZED');
  u=await applyBootstrapAdmin(u);
  return u;
}
async function organizationContext(user){
  const membership=await gas('findOne',{
    sheet:'05_ORGANIZATION_MEMBERS',
    filters:{user_id:user.user_id,status:'ACTIVE'}
  });
  if(!membership) return {membership:null,organization:null};
  const organization=await gas('findOne',{
    sheet:'04_ORGANIZATIONS',
    filters:{organization_id:membership.organization_id,status:'ACTIVE'}
  });
  return {membership,organization};
}
async function verificationContext(user,profile=null,orgCtx=null){
  if(user.account_type==='ORGANIZATION'){
    const ctx=orgCtx||await organizationContext(user);
    return {
      type:'ORGANIZATION',
      status:ctx.organization?.verification_status||'UNVERIFIED',
      organization:ctx.organization||null
    };
  }
  const p=profile||await gas('findOne',{
    sheet:'02_USER_PROFILES',
    filters:{user_id:user.user_id}
  });
  return {
    type:'INDIVIDUAL',
    status:p?.identity_status||'UNVERIFIED',
    profile:p||null
  };
}
async function ownedPrograms(user,orgCtx=null){
  if(user.account_type==='ORGANIZATION'){
    const ctx=orgCtx||await organizationContext(user);
    if(!ctx.organization) return [];
    return gas('listWhere',{
      sheet:'06_PROGRAMS',
      filters:{organization_id:ctx.organization.organization_id},
      limit:500
    });
  }
  return gas('listWhere',{
    sheet:'06_PROGRAMS',
    filters:{owner_user_id:user.user_id},
    limit:500
  });
}
async function ownedProgram(user,programId,orgCtx=null){
  const program=await gas('findOne',{
    sheet:'06_PROGRAMS',
    filters:{program_id:programId}
  });
  if(!program) throw httpError(404,'Program tidak ditemukan.','PROGRAM_NOT_FOUND');
  if(user.account_type==='ORGANIZATION'){
    const ctx=orgCtx||await organizationContext(user);
    if(!ctx.organization||program.organization_id!==ctx.organization.organization_id){
      throw httpError(403,'Program bukan milik organisasi akun ini.','FORBIDDEN');
    }
  }else if(program.owner_user_id!==user.user_id){
    throw httpError(403,'Program bukan milik akun ini.','FORBIDDEN');
  }
  return program;
}
async function audit(user,action,entityType,entityId,before={},after={}){
  const now=new Date().toISOString();
  return gas('insert',{
    sheet:'16_AUDIT_LOG',
    row:{
      audit_id:id('aud'),
      actor_user_id:user?.user_id||'',
      actor_type:user?'USER':'SYSTEM',
      action,
      entity_type:entityType,
      entity_id:entityId,
      before_json:JSON.stringify(before||{}),
      after_json:JSON.stringify(after||{}),
      ip_hash:'',
      user_agent:'',
      created_at:now
    }
  }).catch(err=>console.error('AUDIT_FAILED',err.message));
}

app.get('/api/dashboard/bootstrap',async(req,res)=>{
  try{
    const token_hash=requestTokenHash(req);
    if(!token_hash) return res.status(401).json({success:false,message:'Sesi tidak valid atau kedaluwarsa.'});
    const data=await gas('dashboardBootstrapFast',{token_hash},{timeout:12000});
    // Pertahankan bootstrap SUPER_ADMIN dari environment bila diperlukan.
    if(data?.user){
      const effective=await applyBootstrapAdmin(data.user);
      data.user=publicUser(effective);
    }
    res.json({success:true,data});
  }catch(e){sendError(res,e)}
});

app.post('/api/verification/submit',async(req,res)=>{
  try{
    const user=await requireUser(req);
    const now=new Date().toISOString();

    if(user.account_type==='ORGANIZATION'){
      const ctx=await organizationContext(user);
      if(!ctx.organization) throw httpError(404,'Organisasi akun tidak ditemukan.','ORGANIZATION_NOT_FOUND');
      if(ctx.organization.verification_status==='APPROVED'){
        throw httpError(409,'Organisasi sudah terverifikasi.','ALREADY_VERIFIED');
      }

      const legal_name=text(req.body.legal_name,160);
      const registration_number=text(req.body.registration_number,100);
      const phone=text(req.body.phone,40);
      const address=text(req.body.address,600);
      if(!legal_name||!registration_number||!phone||!address){
        throw httpError(400,'Lengkapi nama legal, nomor legalitas, WhatsApp, dan alamat.','INCOMPLETE_VERIFICATION');
      }

      const patch={
        legal_name,
        registration_number,
        phone,
        email:normEmail(req.body.email||user.email),
        address,
        verification_status:'PENDING_REVIEW',
        updated_at:now
      };
      await gas('update',{
        sheet:'04_ORGANIZATIONS',
        idField:'organization_id',
        id:ctx.organization.organization_id,
        patch
      });
      await audit(user,'SUBMIT_VERIFICATION','ORGANIZATION',ctx.organization.organization_id,{verification_status:ctx.organization.verification_status},patch);
      return res.json({success:true,data:{status:'PENDING_REVIEW'}});
    }

    const profile=await gas('findOne',{
      sheet:'02_USER_PROFILES',
      filters:{user_id:user.user_id}
    });
    if(!profile) throw httpError(404,'Profil akun tidak ditemukan.','PROFILE_NOT_FOUND');
    if(profile.identity_status==='APPROVED'){
      throw httpError(409,'Identitas sudah terverifikasi.','ALREADY_VERIFIED');
    }

    const identity_type=text(req.body.identity_type,40);
    const identity_number=text(req.body.identity_number,100);
    const address=text(req.body.address,600);
    if(!identity_type||!identity_number||!address){
      throw httpError(400,'Lengkapi jenis identitas, nomor identitas, dan alamat.','INCOMPLETE_VERIFICATION');
    }

    const patch={
      identity_type,
      identity_number,
      address,
      identity_status:'PENDING_REVIEW',
      updated_at:now
    };
    await gas('update',{
      sheet:'02_USER_PROFILES',
      idField:'profile_id',
      id:profile.profile_id,
      patch
    });
    await audit(user,'SUBMIT_VERIFICATION','USER_PROFILE',profile.profile_id,{identity_status:profile.identity_status},patch);
    res.json({success:true,data:{status:'PENDING_REVIEW'}});
  }catch(e){sendError(res,e)}
});

app.post('/api/programs',async(req,res)=>{
  try{
    const token_hash=requestTokenHash(req);
    if(!token_hash) throw httpError(401,'Sesi tidak valid atau kedaluwarsa.','UNAUTHORIZED');
    const program_name=text(req.body.program_name,180),category=text(req.body.category,80),target_amount=positiveAmount(req.body.target_amount);
    if(!program_name||!category||!target_amount) throw httpError(400,'Nama program, kategori, dan target dana wajib diisi.','INCOMPLETE_PROGRAM');
    const data=await gas('createProgramFast',{token_hash,row:{
      program_name,category,target_amount,
      short_description:text(req.body.short_description,320),description:text(req.body.description,6000),
      start_date:text(req.body.start_date,30),end_date:text(req.body.end_date,30),share_message:text(req.body.share_message,800)
    }},{timeout:15000});
    res.status(201).json({success:true,data});
  }catch(e){sendError(res,e)}
});

app.post('/api/programs/:id/update',async(req,res)=>{
  try{
    const token_hash=requestTokenHash(req);
    if(!token_hash) throw httpError(401,'Sesi tidak valid atau kedaluwarsa.','UNAUTHORIZED');
    const program_name=text(req.body.program_name,180),category=text(req.body.category,80),target_amount=positiveAmount(req.body.target_amount);
    if(!program_name||!category||!target_amount) throw httpError(400,'Nama program, kategori, dan target dana wajib diisi.','INCOMPLETE_PROGRAM');
    const patch={program_name,category,short_description:text(req.body.short_description,320),description:text(req.body.description,6000),target_amount,start_date:text(req.body.start_date,30),end_date:text(req.body.end_date,30),share_message:text(req.body.share_message,800),updated_at:new Date().toISOString()};
    const data=await gas('updateProgramFast',{program_id:req.params.id,token_hash,patch},{timeout:15000});
    res.json({success:true,data});
  }catch(e){sendError(res,e)}
});

app.post('/api/programs/:id/submit',async(req,res)=>{
  try{
    const token_hash=requestTokenHash(req);
    if(!token_hash) throw httpError(401,'Sesi tidak valid atau kedaluwarsa.','UNAUTHORIZED');
    const data=await gas('submitProgramFast',{program_id:req.params.id,token_hash},{timeout:15000});
    res.json({success:true,data});
  }catch(e){sendError(res,e)}
});

app.post('/api/programs/:id/status',async(req,res)=>{
  try{
    const token_hash=requestTokenHash(req);
    if(!token_hash) throw httpError(401,'Sesi tidak valid atau kedaluwarsa.','UNAUTHORIZED');
    const data=await gas('programStatusFast',{program_id:req.params.id,status_action:text(req.body.action,30),token_hash},{timeout:12000});
    res.json({success:true,data});
  }catch(e){sendError(res,e)}
});

app.get('/api/public/bootstrap',async(req,res)=>{
  try{
    const data=await gas('publicBootstrapFast',{}, {timeout:12000});
    res.json({success:true,data});
  }catch(e){sendError(res,e)}
});

app.get('/api/public/programs',async(req,res)=>{
  try{
    const data=await gas('publicProgramsFast',{
      page:Number(req.query.page)||1,limit:Number(req.query.limit)||12,
      search:text(req.query.search,120),category:text(req.query.category,80)||'ALL'
    },{timeout:12000});
    res.json({success:true,data});
  }catch(e){sendError(res,e)}
});

app.get('/api/public/programs/:id',async(req,res)=>{
  try{
    const data=await gas('publicProgramFast',{program_id:req.params.id},{timeout:12000});
    res.json({success:true,data});
  }catch(e){sendError(res,e)}
});

app.get('/api/admin/review',async(req,res)=>{
  try{
    const token_hash=requestTokenHash(req);
    if(!token_hash) throw httpError(401,'Sesi tidak valid atau kedaluwarsa.','UNAUTHORIZED');
    const data=await gas('reviewAdminFast',{token_hash},{timeout:12000});
    res.json({success:true,data});
  }catch(e){sendError(res,e)}
});

app.get('/api/admin/hero-settings',async(req,res)=>{
  try{
    const token_hash=requestTokenHash(req);
    if(!token_hash) throw httpError(401,'Sesi tidak valid atau kedaluwarsa.','UNAUTHORIZED');
    const data=await gas('heroAdminFast',{token_hash},{timeout:10000});
    res.json({success:true,data});
  }catch(e){sendError(res,e)}
});

app.post('/api/admin/verification/decision',async(req,res)=>{
  try{
    const token_hash=requestTokenHash(req);
    if(!token_hash) throw httpError(401,'Sesi tidak valid atau kedaluwarsa.','UNAUTHORIZED');
    const data=await gas('reviewDecisionFast',{token_hash,kind:text(req.body.kind,30),decision:text(req.body.decision,30),target_id:text(req.body.target_id,160)},{timeout:15000});
    res.json({success:true,data});
  }catch(e){sendError(res,e)}
});

app.post('/api/admin/programs/:id/decision',async(req,res)=>{
  try{
    const token_hash=requestTokenHash(req);
    if(!token_hash) throw httpError(401,'Sesi tidak valid atau kedaluwarsa.','UNAUTHORIZED');
    const data=await gas('reviewDecisionFast',{token_hash,kind:'PROGRAM',decision:text(req.body.decision,30),target_id:req.params.id},{timeout:15000});
    res.json({success:true,data});
  }catch(e){sendError(res,e)}
});

app.post('/api/admin/revisions/:id/decision',async(req,res)=>{
  try{
    const token_hash=requestTokenHash(req);
    if(!token_hash) throw httpError(401,'Sesi tidak valid atau kedaluwarsa.','UNAUTHORIZED');
    const data=await gas('reviewDecisionFast',{token_hash,kind:'REVISION',decision:text(req.body.decision,30),target_id:req.params.id},{timeout:15000});
    res.json({success:true,data});
  }catch(e){sendError(res,e)}
});

async function saveHeroSlot(req,res,slotRaw){
  try{
    const token_hash=requestTokenHash(req);
    if(!token_hash) throw httpError(401,'Sesi tidak valid atau kedaluwarsa.','UNAUTHORIZED');
    const slot=Number(slotRaw)||1;
    if(![1,2,3].includes(slot)) throw httpError(400,'Slot hero hanya 1 sampai 3.','INVALID_HERO_SLOT');
    const title=text(req.body.title,180), subtitle=text(req.body.subtitle,500);
    const cta_label=text(req.body.cta_label,80)||'Mulai Berdonasi';
    const cta_url=text(req.body.cta_url,500)||'#program';
    const image_url=text(req.body.image_url,1000);
    if(!title||!subtitle) throw httpError(400,'Judul dan subtitle hero wajib diisi.','INCOMPLETE_HERO');
    const row={title,subtitle,cta_label,cta_url,image_url};
    const result=await gas('saveHeroFast',{slot,row,token_hash},{timeout:15000});
    res.json({success:true,data:{hero:result.hero}});
  }catch(e){sendError(res,e)}
}

app.post('/api/admin/heroes/:slot',async(req,res)=>saveHeroSlot(req,res,req.params.slot));
app.post('/api/admin/hero',async(req,res)=>saveHeroSlot(req,res,1));


app.get('/api/admin/media',async(req,res)=>{
  try{
    const user=await requireUser(req);
    if(!isAdmin(user)) throw httpError(403,'Akses admin diperlukan.','ADMIN_REQUIRED');
    const rows=await gas('listWhere',{sheet:'17_MEDIA_LIBRARY',filters:{media_type:'HERO',status:'ACTIVE'},limit:500});
    const items=[...rows].sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));
    res.json({success:true,data:{items}});
  }catch(e){sendError(res,e)}
});

async function uploadMediaRequest(req,res,mediaType,adminOnly=false){
  try{
    const token_hash=requestTokenHash(req);
    if(!token_hash) throw httpError(401,'Sesi tidak valid atau kedaluwarsa.','UNAUTHORIZED');
    const file_name=text(req.body.file_name,140);
    const mime_type=text(req.body.mime_type,80).toLowerCase();
    const base64=String(req.body.base64||'');
    if(!file_name||!base64) throw httpError(400,'File gambar belum dipilih.','MISSING_MEDIA');
    if(!['image/jpeg','image/png','image/webp'].includes(mime_type)) throw httpError(400,'Format gambar harus JPG, PNG, atau WEBP.','INVALID_MEDIA_TYPE');
    const media=await gas('uploadMedia',{file_name,mime_type,base64,media_type:mediaType,token_hash},{timeout:18000});
    res.status(201).json({success:true,data:{media}});
  }catch(e){sendError(res,e)}
}
app.post('/api/admin/media/upload',async(req,res)=>uploadMediaRequest(req,res,'HERO',true));
app.post('/api/media/program-cover',async(req,res)=>uploadMediaRequest(req,res,'PROGRAM_COVER',false));

app.post('/api/admin/media/:id/archive',async(req,res)=>{
  try{
    const token_hash=requestTokenHash(req);
    if(!token_hash) throw httpError(401,'Sesi tidak valid atau kedaluwarsa.','UNAUTHORIZED');
    await gas('archiveMedia',{media_id:req.params.id,token_hash},{timeout:12000});
    res.json({success:true,data:{media_id:req.params.id,status:'ARCHIVED'}});
  }catch(e){sendError(res,e)}
});

app.get('/api/admin/settings',async(req,res)=>{
  try{
    const user=await requireUser(req);
    if(!isAdmin(user)) throw httpError(403,'Akses admin diperlukan.','ADMIN_REQUIRED');
    res.json({
      success:true,
      data:{
        current_user:publicUser(user),
        can_manage_roles:isSuperAdmin(user),
        platform:{
          name:'KIA — Donasi Online',
          founder:'Finance Tracker',
          version:'0.4.0'
        }
      }
    });
  }catch(e){sendError(res,e)}
});

app.get('/api/admin/users',async(req,res)=>{
  try{
    const token_hash=requestTokenHash(req);
    if(!token_hash) throw httpError(401,'Sesi tidak valid atau kedaluwarsa.','UNAUTHORIZED');
    const data=await gas('adminUsersFast',{token_hash,page:Number(req.query.page)||1,limit:Number(req.query.limit)||8,search:text(req.query.search,120),role:text(req.query.role,40)||'ALL'},{timeout:12000});
    res.json({success:true,data:{users:data.items||[],page:data.page,total:data.total,total_pages:data.total_pages,can_manage_roles:data.can_manage_roles}});
  }catch(e){sendError(res,e)}
});

app.post('/api/admin/users/:id/role',async(req,res)=>{
  try{
    const token_hash=requestTokenHash(req);
    if(!token_hash) throw httpError(401,'Sesi tidak valid atau kedaluwarsa.','UNAUTHORIZED');
    const data=await gas('updateRoleFast',{token_hash,target_id:req.params.id,platform_role:text(req.body.platform_role,40)},{timeout:12000});
    if(data?.user) refreshCachedUser(data.user);
    res.json({success:true,data});
  }catch(e){sendError(res,e)}
});

// ------------------------------------------------------------------
// v0.4.0 PROGRAM MEDIA + TRUST CENTER + SECURITY
// ------------------------------------------------------------------
app.post('/api/programs/:id/media/upload',async(req,res)=>{
  try{
    const token_hash=requestTokenHash(req); if(!token_hash) throw httpError(401,'Sesi tidak valid.','UNAUTHORIZED');
    const data=await gas('uploadProgramMedia',{token_hash,program_id:req.params.id,file_name:text(req.body.file_name,140),mime_type:text(req.body.mime_type,80),base64:String(req.body.base64||''),caption:text(req.body.caption,240)},{timeout:18000});
    res.status(201).json({success:true,data:{media:data}});
  }catch(e){sendError(res,e)}
});
app.post('/api/programs/:id/media/:mediaId/cover',async(req,res)=>{
  try{const token_hash=requestTokenHash(req);const data=await gas('setProgramCover',{token_hash,program_id:req.params.id,program_media_id:req.params.mediaId},{timeout:12000});res.json({success:true,data});}catch(e){sendError(res,e)}
});
app.post('/api/programs/:id/media/:mediaId/archive',async(req,res)=>{
  try{const token_hash=requestTokenHash(req);const data=await gas('archiveProgramMedia',{token_hash,program_id:req.params.id,program_media_id:req.params.mediaId},{timeout:12000});res.json({success:true,data});}catch(e){sendError(res,e)}
});
app.post('/api/programs/:id/media/reorder',async(req,res)=>{
  try{const token_hash=requestTokenHash(req);const data=await gas('reorderProgramMedia',{token_hash,program_id:req.params.id,order:Array.isArray(req.body.order)?req.body.order:[]},{timeout:15000});res.json({success:true,data});}catch(e){sendError(res,e)}
});

app.get('/api/public/help',async(req,res)=>{try{res.json({success:true,data:await gas('publicHelpFast',{}, {timeout:10000})})}catch(e){sendError(res,e)}});
app.get('/api/public/faq',async(req,res)=>{try{res.json({success:true,data:{items:await gas('faqPublicFast',{}, {timeout:9000})}})}catch(e){sendError(res,e)}});
app.get('/api/public/settings',async(req,res)=>{try{res.json({success:true,data:await gas('siteSettingsPublicFast',{}, {timeout:9000})})}catch(e){sendError(res,e)}});
app.get('/api/admin/faq',async(req,res)=>{try{const token_hash=requestTokenHash(req);res.json({success:true,data:{items:await gas('faqAdminFast',{token_hash},{timeout:10000})}})}catch(e){sendError(res,e)}});
app.post('/api/admin/faq',async(req,res)=>{try{const token_hash=requestTokenHash(req);const item=await gas('faqSaveFast',{token_hash,row:req.body||{}},{timeout:12000});res.json({success:true,data:{item}})}catch(e){sendError(res,e)}});
app.post('/api/admin/faq/:id/archive',async(req,res)=>{try{const token_hash=requestTokenHash(req);const data=await gas('faqArchiveFast',{token_hash,faq_id:req.params.id},{timeout:10000});res.json({success:true,data})}catch(e){sendError(res,e)}});
app.post('/api/admin/site-settings',async(req,res)=>{try{const token_hash=requestTokenHash(req);const data=await gas('siteSettingsSaveFast',{token_hash,items:req.body||{}},{timeout:12000});res.json({success:true,data})}catch(e){sendError(res,e)}});

app.post('/api/security/change-password',async(req,res)=>{
  try{
    const u=await requireUser(req); const current=String(req.body.current_password||''),next=String(req.body.new_password||'');
    if(next.length<10) throw httpError(400,'Password baru minimal 10 karakter.','WEAK_PASSWORD');
    const fresh=await gas('findOne',{sheet:'01_USERS',filters:{user_id:u.user_id,status:'ACTIVE'}},{timeout:9000});
    if(!fresh||!verifyPassword(current,fresh.password_hash)) throw httpError(401,'Password saat ini tidak sesuai.','INVALID_CURRENT_PASSWORD');
    await gas('update',{sheet:'01_USERS',idField:'user_id',id:u.user_id,patch:{password_hash:hashPassword(next),updated_at:new Date().toISOString()}},{timeout:12000});
    res.json({success:true,data:{changed:true}});
  }catch(e){sendError(res,e)}
});
app.get('/api/security/sessions',async(req,res)=>{
  try{const u=await requireUser(req);const rows=await gas('listWhere',{sheet:'03_SESSIONS',filters:{user_id:u.user_id,status:'ACTIVE'},limit:50},{timeout:9000});res.json({success:true,data:{items:rows.map(x=>({session_id:x.session_id,expires_at:x.expires_at,last_seen_at:x.last_seen_at,created_at:x.created_at}))}})}catch(e){sendError(res,e)}
});
app.post('/api/security/logout-all',async(req,res)=>{
  try{const token_hash=requestTokenHash(req);const data=await gas('revokeAllSessionsFast',{token_hash},{timeout:12000});sessionCache.clear();res.json({success:true,data})}catch(e){sendError(res,e)}
});

app.listen(PORT,()=>console.log(`KIA backend ${PORT}`));
