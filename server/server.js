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

async function gas(action,payload={}){
  if(!GAS_URL||!GATEWAY_SECRET) throw new Error('BACKEND_NOT_CONFIGURED');

  const body=JSON.stringify({action,gateway_secret:GATEWAY_SECRET,...payload});
  let lastError=null;
  for(let attempt=1;attempt<=2;attempt++){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),12000);
    try{
      const r=await fetch(GAS_URL,{
        method:'POST',
        headers:{'Content-Type':'text/plain;charset=utf-8'},
        body,
        signal:controller.signal
      });
      const out=await r.json();
      if(!out.success) throw new Error(out.code||'GATEWAY_ERROR');
      return out.data;
    }catch(err){
      lastError=err;
      // retry hanya sekali untuk timeout/network; write tetap aman karena operasi penting
      // menggunakan id/upsert stabil pada jalur auth.
      if(attempt===2) break;
      await new Promise(resolve=>setTimeout(resolve,250));
    }finally{clearTimeout(timer)}
  }
  const e=new Error(lastError?.name==='AbortError'?'GATEWAY_TIMEOUT':(lastError?.message||'GATEWAY_ERROR'));
  e.code=e.message;
  throw e;
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

  const s=await gas('findOne',{
    sheet:'03_SESSIONS',
    filters:{
      token_hash:tokenHash(raw),
      status:'ACTIVE'
    }
  });

  if(!s||new Date(s.expires_at)<=new Date()) return null;

  return gas('findOne',{
    sheet:'01_USERS',
    filters:{
      user_id:s.user_id,
      status:'ACTIVE'
    }
  });
}

app.get('/health',(req,res)=>res.json({
  success:true,
  data:{
    app:'KIA Backend',
    version:'0.3.5'
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
  console.log('KIA_BOOTSTRAP_SUPER_ADMIN',user.email);
  return {...user,...patch};
}
function httpError(status,message,code){
  const e=new Error(message);
  e.status=status;
  e.code=code||'REQUEST_ERROR';
  return e;
}
function sendError(res,e){
  const status=Number(e.status)||500;
  res.status(status).json({
    success:false,
    code:e.code||'SERVER_ERROR',
    message:e.message||'Terjadi kesalahan server.'
  });
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
    const user=await requireUser(req);
    const profilePromise=gas('findOne',{
      sheet:'02_USER_PROFILES',
      filters:{user_id:user.user_id}
    });
    const orgPromise=user.account_type==='ORGANIZATION'
      ?organizationContext(user)
      :Promise.resolve({membership:null,organization:null});

    const [profile,orgCtx]=await Promise.all([profilePromise,orgPromise]);
    const programs=await ownedPrograms(user,orgCtx);
    const verification=await verificationContext(user,profile,orgCtx);

    res.json({
      success:true,
      data:{
        user:publicUser(user),
        profile,
        membership:orgCtx.membership,
        organization:orgCtx.organization,
        verification,
        programs
      }
    });
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
    const user=await requireUser(req);
    const orgCtx=user.account_type==='ORGANIZATION'?await organizationContext(user):{membership:null,organization:null};
    if(user.account_type==='ORGANIZATION'&&!orgCtx.organization){
      throw httpError(404,'Organisasi akun tidak ditemukan.','ORGANIZATION_NOT_FOUND');
    }

    const program_name=text(req.body.program_name,180);
    const category=text(req.body.category,80);
    const target_amount=positiveAmount(req.body.target_amount);
    if(!program_name||!category||!target_amount){
      throw httpError(400,'Nama program, kategori, dan target dana wajib diisi.','INCOMPLETE_PROGRAM');
    }

    const now=new Date().toISOString();
    const program_id=id('prg');
    const row={
      program_id,
      program_code:`KIA-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
      owner_type:user.account_type,
      owner_user_id:user.account_type==='INDIVIDUAL'?user.user_id:'',
      organization_id:user.account_type==='ORGANIZATION'?orgCtx.organization.organization_id:'',
      program_name,
      slug:`${slugify(program_name)}-${program_id.slice(-6)}`,
      category,
      short_description:text(req.body.short_description,320),
      description:text(req.body.description,6000),
      cover_image_url:text(req.body.cover_image_url,1000),
      target_amount,
      start_date:text(req.body.start_date,30),
      end_date:text(req.body.end_date,30),
      visibility:'PRIVATE',
      status:'DRAFT',
      created_by:user.user_id,
      approved_by:'',
      approved_at:'',
      created_at:now,
      updated_at:now
    };

    await gas('insert',{sheet:'06_PROGRAMS',row});
    await audit(user,'CREATE_PROGRAM','PROGRAM',program_id,{},row);
    res.status(201).json({success:true,data:{program:row}});
  }catch(e){sendError(res,e)}
});

app.post('/api/programs/:id/update',async(req,res)=>{
  try{
    const user=await requireUser(req);
    const orgCtx=user.account_type==='ORGANIZATION'?await organizationContext(user):null;
    const program=await ownedProgram(user,req.params.id,orgCtx);
    if(!['DRAFT','REJECTED'].includes(program.status)){
      throw httpError(409,'Program hanya dapat diedit saat Draft atau Ditolak.','PROGRAM_NOT_EDITABLE');
    }

    const program_name=text(req.body.program_name,180);
    const category=text(req.body.category,80);
    const target_amount=positiveAmount(req.body.target_amount);
    if(!program_name||!category||!target_amount){
      throw httpError(400,'Nama program, kategori, dan target dana wajib diisi.','INCOMPLETE_PROGRAM');
    }

    const patch={
      program_name,
      slug:program.slug||`${slugify(program_name)}-${program.program_id.slice(-6)}`,
      category,
      short_description:text(req.body.short_description,320),
      description:text(req.body.description,6000),
      cover_image_url:text(req.body.cover_image_url,1000),
      target_amount,
      start_date:text(req.body.start_date,30),
      end_date:text(req.body.end_date,30),
      updated_at:new Date().toISOString()
    };
    await gas('update',{
      sheet:'06_PROGRAMS',
      idField:'program_id',
      id:program.program_id,
      patch
    });
    await audit(user,'UPDATE_PROGRAM','PROGRAM',program.program_id,program,patch);
    res.json({success:true,data:{program:{...program,...patch}}});
  }catch(e){sendError(res,e)}
});

app.post('/api/programs/:id/submit',async(req,res)=>{
  try{
    const user=await requireUser(req);
    const orgCtx=user.account_type==='ORGANIZATION'?await organizationContext(user):null;
    const program=await ownedProgram(user,req.params.id,orgCtx);
    if(!['DRAFT','REJECTED'].includes(program.status)){
      throw httpError(409,'Status program tidak dapat diajukan untuk review.','INVALID_PROGRAM_STATUS');
    }

    const verification=await verificationContext(user,null,orgCtx);
    if(verification.status!=='APPROVED'){
      throw httpError(409,'Verifikasi penggalang dana harus disetujui sebelum program diajukan.','VERIFICATION_REQUIRED');
    }
    if(!program.program_name||!program.category||!positiveAmount(program.target_amount)||!program.short_description||!program.description){
      throw httpError(400,'Lengkapi nama, kategori, target, ringkasan, dan deskripsi program sebelum submit.','INCOMPLETE_PROGRAM');
    }

    const patch={status:'PENDING_REVIEW',visibility:'PRIVATE',updated_at:new Date().toISOString()};
    await gas('update',{sheet:'06_PROGRAMS',idField:'program_id',id:program.program_id,patch});
    await audit(user,'SUBMIT_PROGRAM','PROGRAM',program.program_id,{status:program.status},patch);
    res.json({success:true,data:{status:'PENDING_REVIEW'}});
  }catch(e){sendError(res,e)}
});

app.post('/api/programs/:id/status',async(req,res)=>{
  try{
    const user=await requireUser(req);
    const orgCtx=user.account_type==='ORGANIZATION'?await organizationContext(user):null;
    const program=await ownedProgram(user,req.params.id,orgCtx);
    const action=text(req.body.action,30).toUpperCase();
    let patch=null;

    if(action==='PUBLISH'){
      const verification=await verificationContext(user,null,orgCtx);
      if(verification.status!=='APPROVED') throw httpError(409,'Verifikasi belum disetujui.','VERIFICATION_REQUIRED');
      if(program.status!=='APPROVED') throw httpError(409,'Program belum disetujui oleh KIA.','PROGRAM_NOT_APPROVED');
      patch={status:'ACTIVE',visibility:'PUBLIC',updated_at:new Date().toISOString()};
    }else if(action==='PAUSE'){
      if(program.status!=='ACTIVE') throw httpError(409,'Hanya program aktif yang dapat dijeda.','INVALID_PROGRAM_STATUS');
      patch={status:'PAUSED',visibility:'PRIVATE',updated_at:new Date().toISOString()};
    }else if(action==='RESUME'){
      if(program.status!=='PAUSED') throw httpError(409,'Hanya program jeda yang dapat diaktifkan kembali.','INVALID_PROGRAM_STATUS');
      patch={status:'ACTIVE',visibility:'PUBLIC',updated_at:new Date().toISOString()};
    }else{
      throw httpError(400,'Aksi status program tidak dikenali.','UNKNOWN_STATUS_ACTION');
    }

    await gas('update',{sheet:'06_PROGRAMS',idField:'program_id',id:program.program_id,patch});
    await audit(user,`PROGRAM_${action}`,'PROGRAM',program.program_id,{status:program.status,visibility:program.visibility},patch);
    res.json({success:true,data:{status:patch.status,visibility:patch.visibility}});
  }catch(e){sendError(res,e)}
});

app.get('/api/public/bootstrap',async(req,res)=>{
  try{
    const [heroes,programs,paidDonations,settledWithdrawals]=await Promise.all([
      gas('listWhere',{sheet:'12_HERO_CONTENT',filters:{status:'ACTIVE'},limit:20}),
      gas('listWhere',{sheet:'06_PROGRAMS',filters:{status:'ACTIVE',visibility:'PUBLIC'},limit:200}),
      gas('listWhere',{sheet:'08_DONATIONS',filters:{status:'PAID'},limit:5000}),
      gas('listWhere',{sheet:'11_WITHDRAWALS',filters:{status:'SETTLED'},limit:5000})
    ]);

    const raisedByProgram={};
    let totalPaid=0;
    for(const d of paidDonations){
      const amount=Number(d.gross_amount)||0;
      totalPaid+=amount;
      raisedByProgram[d.program_id]=(raisedByProgram[d.program_id]||0)+amount;
    }
    const publicPrograms=programs.map(p=>({
      program_id:p.program_id,
      program_code:p.program_code,
      program_name:p.program_name,
      slug:p.slug,
      category:p.category,
      short_description:p.short_description,
      description:p.description,
      cover_image_url:p.cover_image_url,
      target_amount:p.target_amount,
      start_date:p.start_date,
      end_date:p.end_date,
      status:p.status,
      raised_amount:raisedByProgram[p.program_id]||0
    }));
    const totalWithdrawn=settledWithdrawals.reduce((sum,w)=>sum+(Number(w.net_amount)||0),0);
    const sortedHeroes=[...heroes].sort((a,b)=>(Number(a.sort_order)||999)-(Number(b.sort_order)||999));
    const hero=sortedHeroes[0]||null;

    res.json({
      success:true,
      data:{
        hero,
        heroes:sortedHeroes,
        programs:publicPrograms,
        stats:{
          total_paid_amount:totalPaid,
          active_programs:publicPrograms.length,
          total_withdrawn_net:totalWithdrawn
        }
      }
    });
  }catch(e){sendError(res,e)}
});

app.get('/api/public/programs/:id',async(req,res)=>{
  try{
    const program=await gas('findOne',{
      sheet:'06_PROGRAMS',
      filters:{program_id:req.params.id,status:'ACTIVE',visibility:'PUBLIC'}
    });
    if(!program) throw httpError(404,'Program publik tidak ditemukan.','PROGRAM_NOT_FOUND');
    const donations=await gas('listWhere',{
      sheet:'08_DONATIONS',
      filters:{program_id:program.program_id,status:'PAID'},
      limit:5000
    });
    const raised_amount=donations.reduce((sum,d)=>sum+(Number(d.gross_amount)||0),0);
    res.json({success:true,data:{program:{
      program_id:program.program_id,
      program_code:program.program_code,
      program_name:program.program_name,
      slug:program.slug,
      category:program.category,
      short_description:program.short_description,
      description:program.description,
      cover_image_url:program.cover_image_url,
      target_amount:program.target_amount,
      start_date:program.start_date,
      end_date:program.end_date,
      status:program.status,
      raised_amount
    }}});
  }catch(e){sendError(res,e)}
});

app.get('/api/admin/review',async(req,res)=>{
  try{
    const user=await requireUser(req);
    if(!isAdmin(user)) throw httpError(403,'Akses admin diperlukan.','ADMIN_REQUIRED');

    const [profiles,organizations,programs,users,heroes]=await Promise.all([
      gas('listWhere',{sheet:'02_USER_PROFILES',filters:{identity_status:'PENDING_REVIEW'},limit:500}),
      gas('listWhere',{sheet:'04_ORGANIZATIONS',filters:{verification_status:'PENDING_REVIEW'},limit:500}),
      gas('listWhere',{sheet:'06_PROGRAMS',filters:{status:'PENDING_REVIEW'},limit:500}),
      gas('listWhere',{sheet:'01_USERS',filters:{status:'ACTIVE'},limit:5000}),
      gas('listWhere',{sheet:'12_HERO_CONTENT',filters:{status:'ACTIVE'},limit:20})
    ]);
    const userMap=Object.fromEntries(users.map(u=>[u.user_id,publicUser(u)]));

    res.json({
      success:true,
      data:{
        profiles:profiles.map(p=>({...p,user:userMap[p.user_id]||null})),
        organizations,
        programs,
        heroes:[...heroes].sort((a,b)=>(Number(a.sort_order)||999)-(Number(b.sort_order)||999)),
        hero:[...heroes].sort((a,b)=>(Number(a.sort_order)||999)-(Number(b.sort_order)||999))[0]||null
      }
    });
  }catch(e){sendError(res,e)}
});

app.post('/api/admin/verification/decision',async(req,res)=>{
  try{
    const user=await requireUser(req);
    if(!isAdmin(user)) throw httpError(403,'Akses admin diperlukan.','ADMIN_REQUIRED');
    const kind=text(req.body.kind,30).toUpperCase();
    const targetId=text(req.body.id,140);
    const decision=text(req.body.decision,30).toUpperCase();
    if(!['APPROVE','REJECT'].includes(decision)) throw httpError(400,'Keputusan tidak valid.','INVALID_DECISION');
    const status=decision==='APPROVE'?'APPROVED':'REJECTED';

    if(kind==='INDIVIDUAL'){
      const profile=await gas('findOne',{sheet:'02_USER_PROFILES',filters:{profile_id:targetId}});
      if(!profile) throw httpError(404,'Profil tidak ditemukan.','PROFILE_NOT_FOUND');
      const patch={identity_status:status,updated_at:new Date().toISOString()};
      await gas('update',{sheet:'02_USER_PROFILES',idField:'profile_id',id:targetId,patch});
      await audit(user,`VERIFICATION_${decision}`,'USER_PROFILE',targetId,{identity_status:profile.identity_status},patch);
    }else if(kind==='ORGANIZATION'){
      const org=await gas('findOne',{sheet:'04_ORGANIZATIONS',filters:{organization_id:targetId}});
      if(!org) throw httpError(404,'Organisasi tidak ditemukan.','ORGANIZATION_NOT_FOUND');
      const patch={verification_status:status,updated_at:new Date().toISOString()};
      await gas('update',{sheet:'04_ORGANIZATIONS',idField:'organization_id',id:targetId,patch});
      await audit(user,`VERIFICATION_${decision}`,'ORGANIZATION',targetId,{verification_status:org.verification_status},patch);
    }else{
      throw httpError(400,'Jenis verifikasi tidak valid.','INVALID_VERIFICATION_KIND');
    }

    res.json({success:true,data:{status}});
  }catch(e){sendError(res,e)}
});

app.post('/api/admin/programs/:id/decision',async(req,res)=>{
  try{
    const user=await requireUser(req);
    if(!isAdmin(user)) throw httpError(403,'Akses admin diperlukan.','ADMIN_REQUIRED');
    const program=await gas('findOne',{sheet:'06_PROGRAMS',filters:{program_id:req.params.id}});
    if(!program) throw httpError(404,'Program tidak ditemukan.','PROGRAM_NOT_FOUND');
    if(program.status!=='PENDING_REVIEW') throw httpError(409,'Program tidak sedang menunggu review.','INVALID_PROGRAM_STATUS');

    const decision=text(req.body.decision,30).toUpperCase();
    let patch;
    if(decision==='APPROVE'){
      patch={status:'APPROVED',approved_by:user.user_id,approved_at:new Date().toISOString(),updated_at:new Date().toISOString()};
    }else if(decision==='REJECT'){
      patch={status:'REJECTED',visibility:'PRIVATE',updated_at:new Date().toISOString()};
    }else{
      throw httpError(400,'Keputusan tidak valid.','INVALID_DECISION');
    }

    await gas('update',{sheet:'06_PROGRAMS',idField:'program_id',id:program.program_id,patch});
    await audit(user,`PROGRAM_REVIEW_${decision}`,'PROGRAM',program.program_id,{status:program.status},patch);
    res.json({success:true,data:{status:patch.status}});
  }catch(e){sendError(res,e)}
});


async function saveHeroSlot(req,res,slotRaw){
  try{
    const user=await requireUser(req);
    if(!isAdmin(user)) throw httpError(403,'Akses admin diperlukan.','ADMIN_REQUIRED');

    const slot=Number(slotRaw)||1;
    if(![1,2,3].includes(slot)) throw httpError(400,'Slot hero hanya 1 sampai 3.','INVALID_HERO_SLOT');

    const title=text(req.body.title,180);
    const subtitle=text(req.body.subtitle,500);
    const cta_label=text(req.body.cta_label,80)||'Mulai Berdonasi';
    const cta_url=text(req.body.cta_url,500)||'#program';
    const image_url=text(req.body.image_url,1000);
    if(!title||!subtitle) throw httpError(400,'Judul dan subtitle hero wajib diisi.','INCOMPLETE_HERO');
    if(!/^(#|\.\/|\/|https:\/\/)/.test(cta_url)) throw httpError(400,'URL CTA harus berupa anchor, URL relatif, atau HTTPS.','INVALID_CTA_URL');
    if(image_url && !/^(\.\/|\/|https:\/\/)/.test(image_url)) throw httpError(400,'URL gambar harus berupa URL relatif atau HTTPS.','INVALID_HERO_IMAGE');

    const now=new Date().toISOString();
    const hero_id=`hero_${slot}`;
    const existing=await gas('findOne',{sheet:'12_HERO_CONTENT',filters:{hero_id}});
    const row={
      hero_id,
      title,
      subtitle,
      cta_label,
      cta_url,
      image_url,
      status:'ACTIVE',
      sort_order:slot,
      created_at:existing?.created_at||now,
      updated_at:now
    };
    const result=await gas('upsert',{
      sheet:'12_HERO_CONTENT',
      match:{hero_id},
      row,
      preserveFields:['hero_id','created_at']
    });
    await audit(user,'UPDATE_HERO','HERO_CONTENT',hero_id,existing||{},result.row);
    res.json({success:true,data:{hero:result.row}});
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

app.post('/api/admin/media/upload',async(req,res)=>{
  try{
    const user=await requireUser(req);
    if(!isAdmin(user)) throw httpError(403,'Akses admin diperlukan.','ADMIN_REQUIRED');
    const file_name=text(req.body.file_name,140);
    const mime_type=text(req.body.mime_type,80).toLowerCase();
    const base64=String(req.body.base64||'');
    if(!file_name||!base64) throw httpError(400,'File gambar belum dipilih.','MISSING_MEDIA');
    if(!['image/jpeg','image/png','image/webp'].includes(mime_type)) throw httpError(400,'Format gambar harus JPG, PNG, atau WEBP.','INVALID_MEDIA_TYPE');
    const media=await gas('uploadHeroMedia',{file_name,mime_type,base64,created_by:user.user_id});
    await audit(user,'UPLOAD_HERO_MEDIA','MEDIA_LIBRARY',media.media_id,{},media);
    res.status(201).json({success:true,data:{media}});
  }catch(e){sendError(res,e)}
});

app.post('/api/admin/media/:id/archive',async(req,res)=>{
  try{
    const user=await requireUser(req);
    if(!isAdmin(user)) throw httpError(403,'Akses admin diperlukan.','ADMIN_REQUIRED');
    const before=await gas('findOne',{sheet:'17_MEDIA_LIBRARY',filters:{media_id:req.params.id}});
    if(!before) throw httpError(404,'Media tidak ditemukan.','MEDIA_NOT_FOUND');
    await gas('archiveHeroMedia',{media_id:req.params.id});
    await audit(user,'ARCHIVE_HERO_MEDIA','MEDIA_LIBRARY',req.params.id,before,{status:'ARCHIVED'});
    res.json({success:true,data:{media_id:req.params.id,status:'ARCHIVED'}});
  }catch(e){sendError(res,e)}
});

app.get('/api/admin/settings',async(req,res)=>{
  try{
    const user=await requireUser(req);
    if(!isAdmin(user)) throw httpError(403,'Akses admin diperlukan.','ADMIN_REQUIRED');

    let users=[];
    if(isSuperAdmin(user)){
      const rows=await gas('listWhere',{sheet:'01_USERS',filters:{status:'ACTIVE'},limit:5000});
      users=rows.map(publicUser).sort((a,b)=>String(a.full_name||'').localeCompare(String(b.full_name||''),'id'));
    }

    res.json({
      success:true,
      data:{
        current_user:publicUser(user),
        can_manage_roles:isSuperAdmin(user),
        users,
        platform:{
          name:'KIA — Donasi Online',
          founder:'Finance Tracker',
          version:'0.3.5'
        }
      }
    });
  }catch(e){sendError(res,e)}
});

app.post('/api/admin/users/:id/role',async(req,res)=>{
  try{
    const user=await requireUser(req);
    if(!isSuperAdmin(user)) throw httpError(403,'Hanya SUPER_ADMIN yang dapat mengubah role platform.','SUPER_ADMIN_REQUIRED');

    const targetId=text(req.params.id,140);
    const nextRole=text(req.body.platform_role,40).toUpperCase();
    if(!PLATFORM_ROLES.has(nextRole)) throw httpError(400,'Role platform tidak valid.','INVALID_PLATFORM_ROLE');

    const target=await gas('findOne',{sheet:'01_USERS',filters:{user_id:targetId,status:'ACTIVE'}});
    if(!target) throw httpError(404,'Akun tidak ditemukan.','USER_NOT_FOUND');

    if(target.user_id===user.user_id && nextRole!==user.platform_role){
      throw httpError(409,'Role akun SUPER_ADMIN yang sedang digunakan tidak dapat diubah dari sesi ini. Gunakan SUPER_ADMIN lain.','SELF_ROLE_CHANGE_BLOCKED');
    }

    if(target.platform_role==='SUPER_ADMIN' && nextRole!=='SUPER_ADMIN'){
      const all=await gas('listWhere',{sheet:'01_USERS',filters:{status:'ACTIVE'},limit:5000});
      const superAdmins=all.filter(x=>x.platform_role==='SUPER_ADMIN');
      if(superAdmins.length<=1) throw httpError(409,'Minimal harus ada satu SUPER_ADMIN aktif.','LAST_SUPER_ADMIN');
    }

    if(target.platform_role===nextRole){
      return res.json({success:true,data:{user:publicUser(target),unchanged:true}});
    }

    const patch={platform_role:nextRole,updated_at:new Date().toISOString()};
    await gas('update',{sheet:'01_USERS',idField:'user_id',id:target.user_id,patch});
    await audit(user,'UPDATE_PLATFORM_ROLE','USER',target.user_id,{platform_role:target.platform_role},patch);
    res.json({success:true,data:{user:publicUser({...target,...patch})}});
  }catch(e){sendError(res,e)}
});

app.listen(PORT,()=>console.log(`KIA backend ${PORT}`));
