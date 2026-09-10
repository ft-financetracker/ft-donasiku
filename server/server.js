import express from 'express';
import crypto from 'node:crypto';

const app=express();
app.use(express.json({limit:'256kb'}));

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

  const r=await fetch(GAS_URL,{
    method:'POST',
    headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify({
      action,
      gateway_secret:GATEWAY_SECRET,
      ...payload
    })
  });

  const out=await r.json();

  if(!out.success) throw new Error(out.code||'GATEWAY_ERROR');
  return out.data;
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
    version:'0.2.5'
  }
}));

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

    const auth=await saveSession(req,user_id);

    res.status(201).json({
      success:true,
      data:{
        token:auth.token,
        user:{
          user_id,
          email,
          full_name,
          account_type
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

    const now=new Date().toISOString();

    // Satu row session per user + perangkat.
    // Retry login pada browser yang sama hanya memperbarui row yang sama.
    const auth=await saveSession(req,u.user_id);

    // Response dikirim SEGERA setelah session siap.
    // last_login_at tidak lagi menahan login di layar.
    res.json({
      success:true,
      data:{
        token:auth.token,
        user:{
          user_id:u.user_id,
          email:u.email,
          full_name:u.full_name,
          account_type:u.account_type
        }
      }
    });

    // Non-critical write berjalan setelah response.
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
    const u=await sessionUser(req);

    if(!u){
      return res.status(401).json({
        success:false,
        message:'Sesi tidak valid atau kedaluwarsa.'
      });
    }

    res.json({
      success:true,
      data:{
        user:{
          user_id:u.user_id,
          email:u.email,
          full_name:u.full_name,
          account_type:u.account_type
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

app.listen(PORT,()=>console.log(`KIA backend ${PORT}`));
