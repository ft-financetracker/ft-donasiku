import express from 'express';
import crypto from 'node:crypto';

const app=express();
app.use(express.json({limit:'6mb',verify:(req,res,buf)=>{req.rawBody=buf.toString('utf8')}}));
app.use('/api',(req,res,next)=>{
  if(String(req.path||'').startsWith('/public/')){
    res.setHeader('Cache-Control','public, max-age=15, stale-while-revalidate=180');
  }else{
    res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, private');
  }
  next();
});

const PORT=process.env.PORT||3000;
const GAS_URL=process.env.KIA_GAS_URL;
const GATEWAY_SECRET=process.env.KIA_GATEWAY_SECRET;
const ALLOWED_ORIGIN=process.env.KIA_ALLOWED_ORIGIN||'*';
const PUBLIC_APP_URL=String(process.env.KIA_PUBLIC_APP_URL||((ALLOWED_ORIGIN&&ALLOWED_ORIGIN!=='*')?ALLOWED_ORIGIN:'https://ft-financetracker.github.io/ft-donasiku')).replace(/\/$/,'');
const DOKU_ENV=String(process.env.KIA_DOKU_ENV||'sandbox').toLowerCase();
const DOKU_CLIENT_ID=String(process.env.KIA_DOKU_CLIENT_ID||'').trim();
const DOKU_SECRET_KEY=String(process.env.KIA_DOKU_SECRET_KEY||'').trim();
const DOKU_NOTIFY_URL=String(process.env.KIA_DOKU_NOTIFY_URL||'').trim();
const DOKU_API_BASE=DOKU_ENV==='production'?'https://api.doku.com':'https://api-sandbox.doku.com';
const DOKU_CHECKOUT_TARGET='/checkout/v1/payment';
const DOKU_STATUS_TARGET_PREFIX='/orders/v1/status/';
const DOKU_STATUS_MIN_AGE_MS=60*1000;
const DOKU_RECONCILE_INTERVAL_MS=2*60*1000;
const DOKU_RECONCILE_MAX_PER_RUN=8;

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


function checkoutTokenSecret(){
  return process.env.KIA_PAYMENT_VIEW_SECRET || GATEWAY_SECRET || 'kia-payment-view';
}

function signCheckoutViewToken(payload){
  const body=Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig=crypto.createHmac('sha256',checkoutTokenSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyCheckoutViewToken(token){
  try{
    const [body,sig]=String(token||'').split('.');
    if(!body||!sig) return null;
    const expected=crypto.createHmac('sha256',checkoutTokenSecret()).update(body).digest('base64url');
    const a=Buffer.from(sig);
    const b=Buffer.from(expected);
    if(a.length!==b.length||!crypto.timingSafeEqual(a,b)) return null;
    const payload=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));
    if(!payload?.donation_id||!payload?.payment_id||Number(payload.exp||0)<Date.now()) return null;
    return payload;
  }catch{return null;}
}

function donationCode(){
  const now=new Date();
  const stamp=[String(now.getUTCFullYear()).slice(-2),String(now.getUTCMonth()+1).padStart(2,'0'),String(now.getUTCDate()).padStart(2,'0')].join('');
  return `KIA-${stamp}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}


function dokuConfigured(){return !!(DOKU_CLIENT_ID&&DOKU_SECRET_KEY)}
function sha256Base64(value){return crypto.createHash('sha256').update(String(value),'utf8').digest('base64')}
function sha256Hex(value){return crypto.createHash('sha256').update(String(value),'utf8').digest('hex')}
function hmacDokuSignature({clientId,requestId,timestamp,target,digest,secret}){
  const parts=[`Client-Id:${clientId}`,`Request-Id:${requestId}`,`Request-Timestamp:${timestamp}`,`Request-Target:${target}`];
  if(digest) parts.push(`Digest:${digest}`);
  return 'HMACSHA256='+crypto.createHmac('sha256',secret).update(parts.join('\n')).digest('base64');
}
function safeEqualString(a,b){
  const aa=Buffer.from(String(a||''));const bb=Buffer.from(String(b||''));
  return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb);
}
function dokuPaymentTypes(method){
  if(method==='QRIS') return ['QRIS'];
  if(method==='VIRTUAL_ACCOUNT') return [
    'VIRTUAL_ACCOUNT_BCA','VIRTUAL_ACCOUNT_BANK_MANDIRI','VIRTUAL_ACCOUNT_BANK_SYARIAH_MANDIRI',
    'VIRTUAL_ACCOUNT_BRI','VIRTUAL_ACCOUNT_BNI','VIRTUAL_ACCOUNT_BANK_PERMATA'
  ];
  return [];
}
function dokuExpiredIso(value){
  const raw=String(value||'').replace(/\D/g,'');
  if(raw.length!==14) return '';
  const y=raw.slice(0,4),m=raw.slice(4,6),d=raw.slice(6,8),h=raw.slice(8,10),mi=raw.slice(10,12),sec=raw.slice(12,14);
  const date=new Date(`${y}-${m}-${d}T${h}:${mi}:${sec}+07:00`);
  return isNaN(date.getTime())?'':date.toISOString();
}
async function dokuCreateCheckout({invoice,amount,paymentMethod,donor,callbackUrl}){
  if(!dokuConfigured()) return {ready:false,reason:'DOKU_NOT_CONFIGURED'};
  const requestId=crypto.randomUUID();
  const timestamp=new Date().toISOString().replace(/\.\d{3}Z$/,'Z');
  const body={
    order:{
      amount,
      invoice_number:invoice,
      currency:'IDR',
      callback_url:callbackUrl,
      callback_url_result:callbackUrl,
      language:'ID',
      auto_redirect:false
    },
    payment:{payment_due_date:60,payment_method_types:dokuPaymentTypes(paymentMethod)}
  };
  const customer={};
  if(donor?.id) customer.id=String(donor.id).replace(/[^A-Za-z0-9_-]/g,'').slice(0,50);
  if(donor?.name) customer.name=String(donor.name).slice(0,100);
  if(donor?.email) customer.email=String(donor.email).slice(0,120);
  if(donor?.phone) customer.phone=String(donor.phone).replace(/[^0-9+]/g,'').slice(0,30);
  if(Object.keys(customer).length) body.customer=customer;
  if(DOKU_NOTIFY_URL) body.additional_info={override_notification_url:DOKU_NOTIFY_URL};
  const raw=JSON.stringify(body);
  const signature=hmacDokuSignature({
    clientId:DOKU_CLIENT_ID,requestId,timestamp,target:DOKU_CHECKOUT_TARGET,
    digest:sha256Base64(raw),secret:DOKU_SECRET_KEY
  });
  const response=await fetch(DOKU_API_BASE+DOKU_CHECKOUT_TARGET,{
    method:'POST',
    headers:{'Content-Type':'application/json','Client-Id':DOKU_CLIENT_ID,'Request-Id':requestId,'Request-Timestamp':timestamp,'Signature':signature},
    body:raw,
    signal:AbortSignal.timeout(15000)
  });
  let out={};
  try{out=await response.json()}catch{out={}}
  if(!response.ok||!out?.response?.payment?.url){
    const err=new Error((out?.error_messages||out?.message||['DOKU_CREATE_FAILED']).join?.('; ')||'DOKU_CREATE_FAILED');
    err.code='DOKU_CREATE_FAILED';
    throw err;
  }
  return {
    ready:true,
    requestId,
    paymentUrl:String(out.response.payment.url||''),
    expiredAt:dokuExpiredIso(out.response.payment.expired_date),
    raw:out
  };
}
function verifyDokuNotification(req){
  if(!dokuConfigured()) throw httpError(503,'DOKU belum dikonfigurasi.','DOKU_NOT_CONFIGURED');
  const clientId=String(req.headers['client-id']||'');
  const requestId=String(req.headers['request-id']||'');
  const timestamp=String(req.headers['request-timestamp']||'');
  const signature=String(req.headers['signature']||'');
  if(!clientId||!requestId||!timestamp||!signature) throw httpError(401,'Header notifikasi DOKU tidak lengkap.','DOKU_INVALID_HEADERS');
  if(clientId!==DOKU_CLIENT_ID) throw httpError(401,'Client DOKU tidak valid.','DOKU_INVALID_CLIENT');
  const raw=String(req.rawBody||JSON.stringify(req.body||{}));
  const expected=hmacDokuSignature({clientId,requestId,timestamp,target:req.path,digest:sha256Base64(raw),secret:DOKU_SECRET_KEY});
  if(!safeEqualString(signature,expected)) throw httpError(401,'Signature DOKU tidak valid.','DOKU_INVALID_SIGNATURE');
  return {requestId,raw,payloadHash:sha256Hex(raw)};
}

function paymentIsTerminal(status){
  return ['PAID','FAILED','EXPIRED','CANCELLED','REFUNDED'].includes(String(status||'').toUpperCase());
}

function dokuStatusPayload(out,identifier,requestId){
  const response=out?.response||out||{};
  const order=response?.order||out?.order||{};
  const transaction=response?.transaction||out?.transaction||{};
  const status=String(transaction?.status||'').toUpperCase();
  return {
    requestId,
    identifier:String(identifier||''),
    invoice:String(order?.invoice_number||identifier||''),
    amount:Number(order?.amount)||0,
    status,
    paidAt:String(transaction?.date||''),
    providerReference:String(transaction?.original_request_id||transaction?.identifier||''),
    raw:out
  };
}

async function dokuCheckStatus(identifier){
  if(!dokuConfigured()) throw httpError(503,'DOKU belum dikonfigurasi.','DOKU_NOT_CONFIGURED');
  const value=String(identifier||'').trim();
  if(!value) throw httpError(400,'Reference pembayaran DOKU belum tersedia.','DOKU_STATUS_REFERENCE_MISSING');

  const requestId=crypto.randomUUID();
  const timestamp=new Date().toISOString().replace(/\.\d{3}Z$/,'Z');
  const target=DOKU_STATUS_TARGET_PREFIX+encodeURIComponent(value);
  const signature=hmacDokuSignature({
    clientId:DOKU_CLIENT_ID,
    requestId,
    timestamp,
    target,
    secret:DOKU_SECRET_KEY
  });

  const response=await fetch(DOKU_API_BASE+target,{
    method:'GET',
    headers:{
      'Accept':'application/json',
      'Client-Id':DOKU_CLIENT_ID,
      'Request-Id':requestId,
      'Request-Timestamp':timestamp,
      'Signature':signature
    },
    signal:AbortSignal.timeout(15000)
  });

  let out={};
  try{out=await response.json()}catch{out={}}

  if(!response.ok){
    const message=Array.isArray(out?.error_messages)
      ? out.error_messages.join('; ')
      : String(out?.message||out?.error?.message||`DOKU_STATUS_HTTP_${response.status}`);
    const err=new Error(message||'DOKU_STATUS_FAILED');
    err.code='DOKU_STATUS_FAILED';
    err.httpStatus=response.status;
    throw err;
  }

  const parsed=dokuStatusPayload(out,value,requestId);
  if(!parsed.status){
    const err=new Error('DOKU_STATUS_EMPTY');
    err.code='DOKU_STATUS_EMPTY';
    throw err;
  }
  return parsed;
}

function reconciliationEventId(invoice,status){
  return 'inq_'+sha256Hex(`${invoice}|${status}`).slice(0,36);
}

async function applyDokuStatus(payment,inquiry,{source='STATUS_API'}={}){
  const providerStatus=String(inquiry?.status||'').toUpperCase();
  if(!providerStatus) return {changed:false,provider_status:'UNKNOWN'};

  if(providerStatus==='SUCCESS'){
    const invoice=String(payment?.provider_invoice_number||inquiry?.invoice||'');
    const raw=JSON.stringify(inquiry?.raw||{});
    const data=await gas('commitDokuPaymentFast',{event:{
      event_id:reconciliationEventId(invoice,'SUCCESS'),
      provider_invoice_number:invoice,
      provider_reference:inquiry?.providerReference||payment?.provider_reference||inquiry?.requestId||'',
      status:'SUCCESS',
      amount:Number(inquiry?.amount)||Number(payment?.requested_amount)||0,
      fee_amount:Number(payment?.fee_amount)||0,
      paid_at:inquiry?.paidAt||new Date().toISOString(),
      payload_hash:sha256Hex(raw),
      payload_json:raw,
      source
    }},{timeout:18000,attempts:1});
    clearPublicResponseCache();
    return {changed:true,provider_status:'SUCCESS',data};
  }

  if(providerStatus==='FAILED'||providerStatus==='EXPIRED'){
    const localStatus=providerStatus;
    if(String(payment?.status||'').toUpperCase()!==localStatus){
      await gas('update',{
        sheet:'09_PAYMENTS',
        idField:'payment_id',
        id:payment.payment_id,
        patch:{
          status:localStatus,
          updated_at:new Date().toISOString()
        }
      },{timeout:12000,attempts:1});
    }
    return {changed:true,provider_status:providerStatus,local_status:localStatus};
  }

  // PENDING/TIMEOUT/REDIRECT tidak mengubah Donation. Attempt tetap menunggu.
  if(String(payment?.status||'').toUpperCase()==='CREATED'&&providerStatus==='PENDING'){
    await gas('update',{
      sheet:'09_PAYMENTS',
      idField:'payment_id',
      id:payment.payment_id,
      patch:{status:'PENDING',updated_at:new Date().toISOString()}
    },{timeout:12000,attempts:1});
  }

  return {changed:false,provider_status:providerStatus};
}

async function paymentSnapshot(donationId,paymentId){
  const view=await gas('publicPaymentStatusFast',{
    donation_id:donationId,
    payment_id:paymentId
  },{timeout:16000,attempts:2});
  const payment=view?.payment||null;
  if(!payment) throw httpError(404,'Payment tidak ditemukan.','PAYMENT_NOT_FOUND');
  return {view,payment};
}

function paymentAgeMs(payment){
  const ts=Date.parse(payment?.created_at||payment?.updated_at||'');
  return Number.isFinite(ts)?Math.max(0,Date.now()-ts):Number.POSITIVE_INFINITY;
}

async function reconcilePayment(payment,{source='STATUS_API'}={}){
  if(!payment||paymentIsTerminal(payment.status)||!dokuConfigured()){
    return {checked:false,reason:'NOT_REQUIRED'};
  }
  if(paymentAgeMs(payment)<DOKU_STATUS_MIN_AGE_MS){
    return {
      checked:false,
      reason:'WAIT_60_SECONDS',
      retry_after_ms:Math.max(0,DOKU_STATUS_MIN_AGE_MS-paymentAgeMs(payment))
    };
  }

  const identifier=String(payment.provider_invoice_number||payment.provider_reference||'').trim();
  if(!identifier) return {checked:false,reason:'REFERENCE_MISSING'};

  const inquiry=await dokuCheckStatus(identifier);
  const applied=await applyDokuStatus(payment,inquiry,{source});
  return {
    checked:true,
    source,
    provider_status:inquiry.status,
    identifier,
    changed:!!applied.changed
  };
}

let autoReconcileRunning=false;
async function reconcilePendingPayments(){
  if(autoReconcileRunning||!dokuConfigured()) return;
  autoReconcileRunning=true;
  try{
    const rows=await gas('listWhere',{
      sheet:'09_PAYMENTS',
      filters:{provider:'DOKU',status:'PENDING'},
      limit:120
    },{timeout:12000,attempts:1});

    const candidates=(Array.isArray(rows)?rows:[])
      .filter(row=>row?.payment_id&&row?.provider_invoice_number&&paymentAgeMs(row)>=DOKU_STATUS_MIN_AGE_MS)
      .sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')))
      .slice(0,DOKU_RECONCILE_MAX_PER_RUN);

    for(const payment of candidates){
      try{
        const result=await reconcilePayment(payment,{source:'AUTO_RECONCILE'});
        if(result?.checked&&result?.provider_status!=='PENDING'){
          console.log('DOKU_AUTO_RECONCILE',payment.payment_id,result.provider_status);
        }
      }catch(err){
        console.warn('DOKU_AUTO_RECONCILE_FAILED',payment.payment_id,err?.message||err);
      }
      await new Promise(resolve=>setTimeout(resolve,180));
    }
  }catch(err){
    console.warn('DOKU_AUTO_RECONCILE_SCAN_FAILED',err?.message||err);
  }finally{
    autoReconcileRunning=false;
  }
}

const publicResponseCache=new Map();
function clearPublicResponseCache(){publicResponseCache.clear()}
async function publicCached(key,loader,{freshMs=45000,staleMs=5*60*1000}={}){
  const now=Date.now();const item=publicResponseCache.get(key);
  if(item&&now-item.savedAt<freshMs) return item.data;
  if(item&&now-item.savedAt<staleMs){
    if(!item.refreshing){
      item.refreshing=Promise.resolve().then(loader).then(data=>{publicResponseCache.set(key,{data,savedAt:Date.now(),refreshing:null});return data}).catch(()=>item.data).finally(()=>{const x=publicResponseCache.get(key);if(x)x.refreshing=null});
    }
    return item.data;
  }
  const data=await loader();publicResponseCache.set(key,{data,savedAt:Date.now(),refreshing:null});return data;
}
async function warmPublicCache(){
  try{
    const bootstrap=await gas('publicBootstrapFast',{}, {timeout:18000,attempts:2});
    publicResponseCache.set('bootstrap',{data:bootstrap,savedAt:Date.now(),refreshing:null});
    const programs=await gas('publicProgramsFast',{page:1,limit:12,search:'',category:'ALL'},{timeout:18000,attempts:2});
    publicResponseCache.set('programs:1:12::ALL',{data:programs,savedAt:Date.now(),refreshing:null});
  }catch(err){console.warn('PUBLIC_CACHE_WARM_FAILED',err.message)}
}

function asBoolean(value){
  return value===true||value===1||['1','true','yes','ya','y'].includes(String(value||'').trim().toLowerCase());
}

function stableSessionId(userId,device){
  const digest=crypto
    .createHmac('sha256',GATEWAY_SECRET||'kia-session')
    .update(`${userId}|${device}`)
    .digest('hex')
    .slice(0,28);

  return `ses_${digest}`;
}

const PUBLIC_INVALIDATING_ACTIONS=new Set([
  'createProgramFast','updateProgramFast','submitProgramFast','programStatusFast',
  'saveProgramUpdateFast','archiveProgramUpdateFast','uploadProgramMedia','setProgramCover',
  'archiveProgramMedia','reorderProgramMedia','reviewDecisionFast','saveHeroFast','archiveMedia',
  'faqSaveFast','faqArchiveFast','siteSettingsSaveFast','commitDokuPaymentFast'
]);

const GATEWAY_RETRYABLE_CODES=new Set([
  'GATEWAY_TIMEOUT','GATEWAY_NETWORK','GATEWAY_HTML_RESPONSE','GATEWAY_INVALID_RESPONSE',
  'GATEWAY_HTTP_500','GATEWAY_HTTP_502','GATEWAY_HTTP_503','GATEWAY_HTTP_504','WRITE_BUSY'
]);

function gatewayError(code,status=502,detail=''){
  const e=new Error(code);
  e.code=code;
  e.status=status;
  e.detail=detail;
  return e;
}

function normalizeGatewayError(err){
  if(err?.name==='AbortError') return gatewayError('GATEWAY_TIMEOUT',504);
  if(err?.code) return err;
  if(err instanceof SyntaxError) return gatewayError('GATEWAY_INVALID_RESPONSE',502,err.message);
  if(err instanceof TypeError) return gatewayError('GATEWAY_NETWORK',503,err.message);
  const e=gatewayError(String(err?.message||'GATEWAY_ERROR'),Number(err?.status)||500);
  return e;
}

function isGatewayRetryable(err){
  const code=String(err?.code||'');
  return GATEWAY_RETRYABLE_CODES.has(code)||/^GATEWAY_HTTP_5\d\d$/.test(code);
}

async function gas(action,payload={},opts={}){
  if(!GAS_URL||!GATEWAY_SECRET) throw gatewayError('BACKEND_NOT_CONFIGURED',503);
  const readActions=new Set(['findOne','listWhere','resolveSession','dashboardBootstrapFast','reviewAdminFast','heroAdminFast','publicBootstrapFast','publicProgramsFast','publicProgramFast','publicProgramDonationsFast','adminUsersFast','faqPublicFast','faqAdminFast','siteSettingsPublicFast','publicHelpFast','programUpdatesFast','publicPaymentStatusFast','donorImpactFast']);
  const isRead=readActions.has(action);
  const attempts=Number.isFinite(Number(opts.attempts))
    ? Math.max(1, Number(opts.attempts))
    : (isRead ? 2 : 1); // WRITE default tetap tidak di-retry.
  const timeout=Number(opts.timeout)|| (isRead?14000:18000);
  const body=JSON.stringify({action,gateway_secret:GATEWAY_SECRET,...payload});
  let lastError=null;

  for(let attempt=1;attempt<=attempts;attempt++){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeout);
    try{
      const r=await fetch(GAS_URL,{
        method:'POST',
        headers:{'Content-Type':'text/plain;charset=utf-8'},
        body,
        signal:controller.signal
      });

      const raw=await r.text();
      let out=null;
      try{
        out=raw?JSON.parse(raw):null;
      }catch(parseErr){
        const html=/^\s*(?:<!doctype\s+html|<html|<head|<body)/i.test(raw||'');
        throw gatewayError(html?'GATEWAY_HTML_RESPONSE':'GATEWAY_INVALID_RESPONSE',502,String(parseErr?.message||''));
      }

      if(!r.ok){
        throw gatewayError(`GATEWAY_HTTP_${r.status}`,r.status>=500?503:502);
      }
      if(!out||typeof out!=='object'){
        throw gatewayError('GATEWAY_INVALID_RESPONSE',502);
      }
      if(!out.success){
        const e=new Error(out.code||'GATEWAY_ERROR');
        e.code=out.code||'GATEWAY_ERROR';
        e.status=out.code==='WRITE_BUSY'?503:500;
        throw e;
      }

      if(PUBLIC_INVALIDATING_ACTIONS.has(action)) clearPublicResponseCache();
      return out.data;
    }catch(rawErr){
      lastError=normalizeGatewayError(rawErr);
      if(attempt>=attempts||!isGatewayRetryable(lastError)) break;
      await new Promise(resolve=>setTimeout(resolve,250*attempt));
    }finally{
      clearTimeout(timer);
    }
  }

  throw lastError||gatewayError('GATEWAY_ERROR',500);
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

const authUserCache=new Map();
const AUTH_USER_CACHE_TTL=5*60*1000;

function cacheAuthUserRow(user){
  const email=normEmail(user?.email);
  if(!email||!user?.user_id) return;
  authUserCache.set(email,{user:{...user},expires:Date.now()+AUTH_USER_CACHE_TTL});
}

let authWarmPromise=null;
let authCacheReadyAt=0;

async function lookupAuthUser(email){
  const key=normEmail(email);
  let cached=authUserCache.get(key);
  if(cached&&cached.expires>Date.now()) return cached.user;
  if(cached) authUserCache.delete(key);

  // Jika cold-start sedang melakukan warm cache, beri kesempatan singkat agar
  // login tidak langsung membuat request Spreadsheet kedua yang bersaing.
  if(authWarmPromise){
    await Promise.race([
      authWarmPromise.catch(()=>false),
      new Promise(resolve=>setTimeout(resolve,1800))
    ]);
    cached=authUserCache.get(key);
    if(cached&&cached.expires>Date.now()) return cached.user;
  }

  const user=await gas('findOne',{
    sheet:'01_USERS',
    filters:{email:key,status:'ACTIVE'}
  },{timeout:14000,attempts:2});

  if(user) cacheAuthUserRow(user);
  return user;
}

async function warmAuthUserCache(){
  try{
    const rows=await gas('listWhere',{
      sheet:'01_USERS',
      filters:{status:'ACTIVE'},
      limit:5000
    },{timeout:18000,attempts:2});
    (rows||[]).forEach(cacheAuthUserRow);
    authCacheReadyAt=Date.now();
    return true;
  }catch(err){
    console.warn('AUTH_CACHE_WARM_FAILED',err.code||err.message);
    return false;
  }
}

function ensureAuthWarm(){
  if(authCacheReadyAt&&Date.now()-authCacheReadyAt<AUTH_USER_CACHE_TTL&&authUserCache.size){
    return Promise.resolve(true);
  }
  if(!authWarmPromise){
    authWarmPromise=warmAuthUserCache().finally(()=>{authWarmPromise=null});
  }
  return authWarmPromise;
}

async function saveSession(req,user){
  const now=new Date().toISOString();
  const token=crypto.randomBytes(32).toString('base64url');
  const session_id=stableSessionId(user.user_id,deviceId(req));
  const sessionRow={
    session_id,
    user_id:user.user_id,
    token_hash:tokenHash(token),
    status:'ACTIVE',
    expires_at:new Date(Date.now()+7*864e5).toISOString(),
    last_seen_at:now,
    created_at:now,
    revoked_at:''
  };

  const result=await gas('authLoginCommitFast',{
    user_id:user.user_id,
    platform_role:user.platform_role||'USER',
    session_row:sessionRow
  },{timeout:15000,attempts:2});

  return {
    token,
    session:result.session||sessionRow,
    user:result.user||user
  };
}

async function sessionUser(req){
  const raw=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!raw) return null;
  const key=tokenHash(raw);
  const cached=sessionCache.get(key);
  if(cached&&cached.expires>Date.now()) return cached.user;
  if(cached) sessionCache.delete(key);

  const resolved=await gas('resolveSession',{token_hash:key},{timeout:15000,attempts:2});
  if(!resolved?.user) return null;
  sessionCache.set(key,{user:resolved.user,expires:Date.now()+SESSION_CACHE_TTL});
  return resolved.user;
}

app.get('/health',async(req,res)=>{
  if(String(req.query.warm||'')==='1'){
    await Promise.race([
      ensureAuthWarm(),
      new Promise(resolve=>setTimeout(resolve,9000))
    ]).catch(()=>false);
  }
  res.json({
    success:true,
    data:{
      app:'KIA Backend',
      version:'0.5.5',
      auth_cache_ready:!!authCacheReadyAt,
      doku_env:DOKU_ENV
    }
  });
});

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

    if(await gas('findOne',{sheet:'01_USERS',filters:{email}},{timeout:30000,attempts:1})){
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
    const auth=await saveSession(req,{...registeredUser,user_id,email,phone:phone||'',full_name,account_type});
    cacheAuthUserRow({...registeredUser,user_id,email,phone:phone||'',full_name,account_type});
    cacheSessionToken(auth.token,{user_id,email,phone:phone||'',full_name,account_type,platform_role:(auth.user?.platform_role||registeredUser.platform_role||'USER'),status:'ACTIVE'});

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

    const u=await lookupAuthUser(email);

    if(!u||!verifyPassword(req.body.password,u.password_hash)){
      return res.status(401).json({
        success:false,
        message:'Email atau password salah.'
      });
    }

    const configured=String(process.env.KIA_SUPER_ADMIN_EMAIL||'').trim().toLowerCase();
    const effectiveUser={
      ...u,
      platform_role:(configured&&email===configured)
        ? 'SUPER_ADMIN'
        : (u.platform_role||'USER')
    };

    const auth=await saveSession(req,effectiveUser);
    const committedUser={...effectiveUser,...(auth.user||{})};
    cacheAuthUserRow(committedUser);
    cacheSessionToken(auth.token,committedUser);

    res.json({
      success:true,
      data:{
        token:auth.token,
        user:{
          user_id:committedUser.user_id,
          email:committedUser.email,
          full_name:committedUser.full_name,
          account_type:committedUser.account_type,
          platform_role:committedUser.platform_role||'USER'
        }
      }
    });

  }catch(e){
    sendError(res,e);
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
  await gas('update',{sheet:'01_USERS',idField:'user_id',id:user.user_id,patch},{timeout:30000,attempts:1});
  const nextUser={...user,...patch};
  refreshCachedUser(nextUser);
  cacheAuthUserRow(nextUser);
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
    PROGRAM_MEDIA_NOT_FOUND:404,PROGRAM_UPDATE_NOT_FOUND:404,DONATION_NOT_FOUND:404,PAYMENT_NOT_FOUND:404,REVISION_NOT_FOUND:404,
    INVALID_DECISION:400,INVALID_REVIEW_KIND:400,INCOMPLETE_PROGRAM:400,INCOMPLETE_PROGRAM_UPDATE:400,INVALID_MEDIA_TYPE:400,INVALID_DONATION_AMOUNT:400,INVALID_PAYMENT_METHOD:400,INVALID_CHECKOUT_TOKEN:401,
    MISSING_MEDIA_DATA:400,MEDIA_TOO_LARGE:413,VERIFICATION_REQUIRED:409,INVALID_PROGRAM_STATUS:409,
    SELF_ROLE_CHANGE_BLOCKED:409,LAST_SUPER_ADMIN:409,REVISION_NOT_PENDING:409,PAYMENT_AMOUNT_MISMATCH:409,PAYMENT_DONATION_MISMATCH:409,DONATION_ALREADY_PAID:409,PAYMENT_METHOD_ALREADY_ACTIVE:409,PAYMENT_ATTEMPT_LIMIT:429,
    GATEWAY_TIMEOUT:504,GATEWAY_NETWORK:503,GATEWAY_HTML_RESPONSE:502,GATEWAY_INVALID_RESPONSE:502,GATEWAY_HTTP_500:503,GATEWAY_HTTP_502:503,GATEWAY_HTTP_503:503,GATEWAY_HTTP_504:504,WRITE_BUSY:503
  };
  const friendly={
    GATEWAY_TIMEOUT:'Server data masih menyiapkan respons. KIA akan mencoba kembali secara aman.',
    GATEWAY_NETWORK:'Koneksi ke server data sedang tidak stabil. Silakan coba lagi.',
    GATEWAY_HTML_RESPONSE:'Server data sementara mengembalikan halaman sistem, bukan data KIA. Silakan coba lagi.',
    GATEWAY_INVALID_RESPONSE:'Respons server data sementara tidak valid. Silakan coba lagi.',
    GATEWAY_HTTP_500:'Server data sedang mengalami gangguan sementara.',GATEWAY_HTTP_502:'Gateway data sedang memulai ulang.',GATEWAY_HTTP_503:'Gateway data belum siap. Silakan coba lagi.',GATEWAY_HTTP_504:'Gateway data merespons terlalu lama.',
    WRITE_BUSY:'Sistem sedang menyelesaikan proses lain. Coba lagi sebentar.',
    UNAUTHORIZED:'Sesi tidak valid atau kedaluwarsa.',ADMIN_REQUIRED:'Akses admin diperlukan.',
    SUPER_ADMIN_REQUIRED:'Hanya SUPER_ADMIN yang dapat melakukan tindakan ini.',
    PROGRAM_NOT_FOUND:'Program tidak ditemukan.',VERIFICATION_REQUIRED:'Verifikasi penggalang dana harus disetujui terlebih dahulu.',
    INVALID_PROGRAM_STATUS:'Status program tidak mendukung tindakan ini.',MEDIA_TOO_LARGE:'Ukuran gambar terlalu besar setelah diproses.',
    REVISION_NOT_PENDING:'Revisi ini sudah diproses.',
    INVALID_DONATION_AMOUNT:'Nominal donasi minimal Rp1.000.',
    INVALID_PAYMENT_METHOD:'Metode pembayaran belum didukung.',
    DONATION_ALREADY_PAID:'Donasi ini sudah dibayar.',PAYMENT_METHOD_ALREADY_ACTIVE:'Metode tersebut sedang aktif. Pilih metode pembayaran yang berbeda.',PAYMENT_ATTEMPT_LIMIT:'Batas percobaan metode pembayaran telah tercapai. Silakan buat donasi baru jika masih diperlukan.',
    INVALID_CHECKOUT_TOKEN:'Tautan status pembayaran tidak valid atau sudah kedaluwarsa.',
    INCOMPLETE_PROGRAM_UPDATE:'Judul dan isi perkembangan wajib diisi.'
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
    const data=await gas('dashboardBootstrapFast',{token_hash},{timeout:18000,attempts:2});
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


app.get('/api/programs/:id/updates',async(req,res)=>{
  try{
    const token_hash=requestTokenHash(req);
    if(!token_hash) throw httpError(401,'Sesi tidak valid atau kedaluwarsa.','UNAUTHORIZED');
    const data=await gas('programUpdatesFast',{token_hash,program_id:req.params.id},{timeout:12000});
    res.json({success:true,data});
  }catch(e){sendError(res,e)}
});

app.post('/api/programs/:id/updates',async(req,res)=>{
  try{
    const token_hash=requestTokenHash(req);
    if(!token_hash) throw httpError(401,'Sesi tidak valid atau kedaluwarsa.','UNAUTHORIZED');
    const title=text(req.body.title,180),content=text(req.body.content,5000);
    if(!title||!content) throw httpError(400,'Judul dan isi perkembangan wajib diisi.','INCOMPLETE_PROGRAM_UPDATE');
    const data=await gas('saveProgramUpdateFast',{
      token_hash,
      program_id:req.params.id,
      title,
      content,
      program_media_id:text(req.body.program_media_id,160)
    },{timeout:15000,attempts:1});
    clearPublicResponseCache();
    res.status(201).json({success:true,data});
  }catch(e){sendError(res,e)}
});

app.post('/api/programs/:id/updates/:updateId/archive',async(req,res)=>{
  try{
    const token_hash=requestTokenHash(req);
    if(!token_hash) throw httpError(401,'Sesi tidak valid atau kedaluwarsa.','UNAUTHORIZED');
    const data=await gas('archiveProgramUpdateFast',{
      token_hash,
      program_id:req.params.id,
      update_id:req.params.updateId
    },{timeout:12000,attempts:1});
    clearPublicResponseCache();
    res.json({success:true,data});
  }catch(e){sendError(res,e)}
});

app.get('/api/public/bootstrap',async(req,res)=>{
  try{
    const data=await publicCached('bootstrap',()=>gas('publicBootstrapFast',{}, {timeout:18000,attempts:2}),{freshMs:45000,staleMs:10*60*1000});
    res.json({success:true,data});
  }catch(e){sendError(res,e)}
});

app.get('/api/public/programs',async(req,res)=>{
  try{
    const page=Number(req.query.page)||1,limit=Number(req.query.limit)||12;
    const search=text(req.query.search,120),category=text(req.query.category,80)||'ALL';
    const key=`programs:${page}:${limit}:${search.toLowerCase()}:${category.toUpperCase()}`;
    const data=await publicCached(key,()=>gas('publicProgramsFast',{page,limit,search,category},{timeout:18000,attempts:2}),{freshMs:60000,staleMs:10*60*1000});
    res.json({success:true,data});
  }catch(e){sendError(res,e)}
});

app.get('/api/public/programs/:id/donations',async(req,res)=>{
  try{
    const id=String(req.params.id||'');
    const page=Math.max(1,Number(req.query.page)||1);
    const limit=Math.max(5,Math.min(20,Number(req.query.limit)||10));
    const key=`program-donations:${id}:${page}:${limit}`;
    const data=await publicCached(key,()=>gas('publicProgramDonationsFast',{program_id:id,page,limit},{timeout:18000,attempts:2}),{freshMs:30000,staleMs:5*60*1000});
    res.json({success:true,data});
  }catch(e){sendError(res,e)}
});

app.get('/api/public/programs/:id',async(req,res)=>{
  try{
    const id=String(req.params.id||'');
    const data=await publicCached(`program:${id}`,()=>gas('publicProgramFast',{program_id:id},{timeout:18000,attempts:2}),{freshMs:60000,staleMs:10*60*1000});
    res.json({success:true,data});
  }catch(e){sendError(res,e)}
});


app.post('/api/donations/checkout',async(req,res)=>{
  try{
    const program_id=text(req.body.program_id,180);
    const gross_amount=Math.floor(Number(req.body.gross_amount)||0);
    const payment_method=text(req.body.payment_method,40).toUpperCase();
    const donor_name=text(req.body.donor_name,140);
    const donor_email=normEmail(req.body.donor_email);
    const donor_phone=text(req.body.donor_phone,60);
    const is_anonymous=asBoolean(req.body.is_anonymous);
    const message=text(req.body.message,600);

    if(gross_amount<1000) throw httpError(400,'Nominal donasi minimal Rp1.000.','INVALID_DONATION_AMOUNT');
    if(!['QRIS','VIRTUAL_ACCOUNT'].includes(payment_method)) throw httpError(400,'Metode pembayaran belum didukung.','INVALID_PAYMENT_METHOD');
    if(!program_id||!donor_name) throw httpError(400,'Nama donatur dan program wajib diisi.','INCOMPLETE_DONATION');

    const authUser=await sessionUser(req).catch(()=>null);
    const now=new Date().toISOString();
    const donation_id=id('don');
    const payment_id=id('pay');
    const donation_code=donationCode();
    const provider_invoice_number=donation_code.replace(/[^A-Za-z0-9]/g,'').slice(0,60);
    const view_token=signCheckoutViewToken({donation_id,payment_id,exp:Date.now()+7*864e5});
    const callbackUrl=`${PUBLIC_APP_URL}/payment.html?token=${encodeURIComponent(view_token)}`;

    const donation_row={donation_id,donation_code,program_id,user_id:authUser?.user_id||'',donor_name,donor_email,donor_phone,is_anonymous:is_anonymous?'TRUE':'FALSE',message,gross_amount,status:'PENDING',created_at:now,updated_at:now};
    const payment_row={payment_id,donation_id,attempt_no:1,provider:'DOKU',payment_method,payment_channel:payment_method==='QRIS'?'QRIS':'VA_CHECKOUT',requested_amount:gross_amount,fee_amount:0,paid_amount:0,provider_reference:'',provider_invoice_number,payment_url:'',va_number:'',qr_data:'',status:'CREATED',expired_at:'',paid_at:'',created_at:now,updated_at:now};

    const data=await gas('createDonationPaymentShellFast',{donation_row,payment_row},{timeout:18000,attempts:1});
    let provider={ready:false,reason:dokuConfigured()?'DOKU_CREATE_PENDING':'DOKU_NOT_CONFIGURED'};

    if(dokuConfigured()){
      try{
        const created=await dokuCreateCheckout({
          invoice:provider_invoice_number,amount:gross_amount,paymentMethod:payment_method,
          donor:{id:authUser?.user_id||donation_id,name:donor_name,email:donor_email,phone:donor_phone},callbackUrl
        });
        const patch={
          provider_reference:created.requestId,
          provider_invoice_number,
          payment_url:created.paymentUrl,
          status:'PENDING',
          expired_at:created.expiredAt,
          updated_at:new Date().toISOString(),
          payment_channel:payment_method==='QRIS'?'QRIS':'DOKU_CHECKOUT_VA'
        };
        await gas('updatePaymentProviderFast',{payment_id,donation_id,patch},{timeout:12000,attempts:1});
        provider={ready:true,payment_url:created.paymentUrl,expired_at:created.expiredAt,request_id:created.requestId};
      }catch(err){
        console.error('DOKU_CREATE_FAILED',err.message);
        provider={ready:false,reason:'DOKU_CREATE_FAILED'};
      }
    }

    res.status(201).json({
      success:true,
      data:{
        donation:{donation_id,donation_code,program_id,gross_amount,status:'PENDING'},
        payment:{payment_id,payment_method,payment_channel:payment_row.payment_channel,status:provider.ready?'PENDING':'CREATED',payment_url:provider.payment_url||'',expired_at:provider.expired_at||''},
        program:data.program,
        provider_ready:provider.ready,
        provider_reason:provider.reason||'',
        view_token
      }
    });
  }catch(e){sendError(res,e)}
});

app.post('/api/payments/retry',async(req,res)=>{
  try{
    const token=verifyCheckoutViewToken(req.body?.token);
    if(!token) throw httpError(401,'Tautan pembayaran tidak valid atau sudah kedaluwarsa.','INVALID_CHECKOUT_TOKEN');
    const payment_method=text(req.body?.payment_method,40).toUpperCase();
    if(!['QRIS','VIRTUAL_ACCOUNT'].includes(payment_method)) throw httpError(400,'Metode pembayaran belum didukung.','INVALID_PAYMENT_METHOD');

    const current=await gas('publicPaymentStatusFast',{donation_id:token.donation_id,payment_id:token.payment_id},{timeout:12000,attempts:1});
    if(String(current?.donation?.status||'').toUpperCase()==='PAID') throw httpError(409,'Donasi ini sudah dibayar.','DONATION_ALREADY_PAID');
    if(String(current?.payment?.payment_method||'').toUpperCase()===payment_method&&!paymentIsTerminal(current?.payment?.status)){
      throw httpError(409,'Metode tersebut sedang aktif. Pilih metode pembayaran yang berbeda.','PAYMENT_METHOD_ALREADY_ACTIVE');
    }

    const donation=await gas('findOne',{sheet:'08_DONATIONS',filters:{donation_id:token.donation_id}},{timeout:10000,attempts:1});
    if(!donation) throw httpError(404,'Donasi tidak ditemukan.','DONATION_NOT_FOUND');

    const now=new Date().toISOString();
    const payment_id=id('pay');
    const suffix=Date.now().toString(36).toUpperCase().slice(-8);
    const provider_invoice_number=`${String(donation.donation_code||'KIA').replace(/[^A-Za-z0-9]/g,'').slice(0,46)}A${suffix}`.slice(0,60);
    const payment_row={
      payment_id,
      donation_id:donation.donation_id,
      attempt_no:0,
      provider:'DOKU',
      payment_method,
      payment_channel:payment_method==='QRIS'?'QRIS':'VA_CHECKOUT',
      requested_amount:Number(donation.gross_amount)||0,
      fee_amount:0,
      paid_amount:0,
      provider_reference:'',
      provider_invoice_number,
      payment_url:'',
      va_number:'',
      qr_data:'',
      status:'CREATED',
      expired_at:'',
      paid_at:'',
      created_at:now,
      updated_at:now
    };

    const createdAttempt=await gas('createPaymentAttemptFast',{donation_id:donation.donation_id,payment_row},{timeout:15000,attempts:1});
    const view_token=signCheckoutViewToken({donation_id:donation.donation_id,payment_id,exp:Date.now()+7*864e5});
    const callbackUrl=`${PUBLIC_APP_URL}/payment.html?token=${encodeURIComponent(view_token)}`;
    let provider={ready:false,reason:dokuConfigured()?'DOKU_CREATE_PENDING':'DOKU_NOT_CONFIGURED'};

    if(dokuConfigured()){
      try{
        const checkout=await dokuCreateCheckout({
          invoice:provider_invoice_number,
          amount:Number(donation.gross_amount)||0,
          paymentMethod:payment_method,
          donor:{id:donation.user_id||donation.donation_id,name:donation.donor_name,email:donation.donor_email,phone:donation.donor_phone},
          callbackUrl
        });
        const patch={
          provider_reference:checkout.requestId,
          provider_invoice_number,
          payment_url:checkout.paymentUrl,
          status:'PENDING',
          expired_at:checkout.expiredAt,
          updated_at:new Date().toISOString(),
          payment_channel:payment_method==='QRIS'?'QRIS':'DOKU_CHECKOUT_VA'
        };
        await gas('updatePaymentProviderFast',{payment_id,donation_id:donation.donation_id,patch},{timeout:12000,attempts:1});
        provider={ready:true,payment_url:checkout.paymentUrl,expired_at:checkout.expiredAt,request_id:checkout.requestId};
      }catch(err){
        console.error('DOKU_RETRY_CREATE_FAILED',err.message);
        provider={ready:false,reason:'DOKU_CREATE_FAILED'};
      }
    }

    res.status(201).json({success:true,data:{
      donation:createdAttempt.donation,
      payment:{...createdAttempt.payment,status:provider.ready?'PENDING':'CREATED',payment_url:provider.payment_url||'',expired_at:provider.expired_at||''},
      provider_ready:provider.ready,
      provider_reason:provider.reason||'',
      view_token
    }});
  }catch(e){sendError(res,e)}
});

app.get('/api/payments/status',async(req,res)=>{
  try{
    const token=verifyCheckoutViewToken(req.query.token);
    if(!token) throw httpError(401,'Tautan status pembayaran tidak valid atau sudah kedaluwarsa.','INVALID_CHECKOUT_TOKEN');

    let snapshot=await paymentSnapshot(token.donation_id,token.payment_id);
    let reconciliation={checked:false,reason:'LOCAL_ONLY'};

    if(String(req.query.refresh||'')==='1'&&!paymentIsTerminal(snapshot.payment.status)){
      try{
        reconciliation=await reconcilePayment(snapshot.payment,{source:'USER_CHECK'});
        if(reconciliation.checked&&reconciliation.changed){
          const providerStatus=String(reconciliation.provider_status||'').toUpperCase();
          if(providerStatus==='SUCCESS'){
            snapshot.payment={...snapshot.payment,status:'PAID',paid_amount:Number(snapshot.payment.requested_amount)||0,paid_at:new Date().toISOString()};
            snapshot.view={
              ...snapshot.view,
              donation:{...snapshot.view.donation,status:'PAID',updated_at:new Date().toISOString()},
              payment:{...snapshot.view.payment,status:'PAID',paid_amount:Number(snapshot.view.payment?.requested_amount)||0,paid_at:new Date().toISOString()}
            };
          }else if(providerStatus==='FAILED'||providerStatus==='EXPIRED'){
            snapshot.payment={...snapshot.payment,status:providerStatus};
            snapshot.view={...snapshot.view,payment:{...snapshot.view.payment,status:providerStatus}};
          }
        }
      }catch(err){
        reconciliation={
          checked:true,
          failed:true,
          reason:err?.code||'DOKU_STATUS_FAILED',
          message:err?.message||'Status DOKU belum dapat diperiksa.'
        };
        console.warn('DOKU_USER_RECONCILE_FAILED',token.payment_id,err?.message||err);
      }
    }

    const data=snapshot.view;
    res.json({success:true,data:{
      ...data,
      provider_ready:!!data?.payment?.payment_url,
      doku_configured:dokuConfigured(),
      doku_env:DOKU_ENV,
      reconciliation
    }});
  }catch(e){sendError(res,e)}
});

app.get('/api/payments/doku/notify',(req,res)=>{
  res.status(200).json({success:true,data:{endpoint:'DOKU payment notification',ready:true,method:'POST'}});
});
app.head('/api/payments/doku/notify',(req,res)=>res.sendStatus(200));

app.post('/api/payments/doku/notify',async(req,res)=>{
  try{
    const hasHeaders=!!(req.headers['client-id']||req.headers['request-id']||req.headers['request-timestamp']||req.headers['signature']);
    if(!hasHeaders && !String(req.rawBody||'').trim()) return res.status(200).json({success:true,data:{probe:true}});
    const verified=verifyDokuNotification(req);
    const body=req.body||{};
    const invoice=text(body?.order?.invoice_number,100);
    const status=text(body?.transaction?.status,40).toUpperCase();
    const amount=Number(body?.order?.amount)||0;
    if(!invoice||!status) throw httpError(400,'Payload notifikasi DOKU tidak lengkap.','DOKU_INVALID_PAYLOAD');
    const providerReference=text(body?.transaction?.original_request_id||body?.transaction?.identifier||verified.requestId,180);
    const paidAt=text(body?.transaction?.date,80)||new Date().toISOString();
    const data=await gas('commitDokuPaymentFast',{event:{
      event_id:verified.requestId,
      provider_invoice_number:invoice,
      provider_reference:providerReference,
      status,
      amount,
      fee_amount:0,
      paid_at:paidAt,
      payload_hash:verified.payloadHash,
      payload_json:verified.raw
    }},{timeout:18000,attempts:1});
    clearPublicResponseCache();
    res.status(200).json({success:true,data});
  }catch(e){sendError(res,e)}
});

app.get('/api/donor/impact',async(req,res)=>{
  try{
    const token_hash=requestTokenHash(req);
    if(!token_hash) throw httpError(401,'Sesi tidak valid atau kedaluwarsa.','UNAUTHORIZED');
    const data=await gas('donorImpactFast',{token_hash},{timeout:14000,attempts:1});
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
          version:'0.5.5'
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
    if(data?.user){refreshCachedUser(data.user);cacheAuthUserRow(data.user);}
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
    const password_hash=hashPassword(next);
    await gas('update',{sheet:'01_USERS',idField:'user_id',id:u.user_id,patch:{password_hash,updated_at:new Date().toISOString()}},{timeout:15000,attempts:1});
    cacheAuthUserRow({...fresh,password_hash});
    res.json({success:true,data:{changed:true}});
  }catch(e){sendError(res,e)}
});
app.get('/api/security/sessions',async(req,res)=>{
  try{const u=await requireUser(req);const rows=await gas('listWhere',{sheet:'03_SESSIONS',filters:{user_id:u.user_id,status:'ACTIVE'},limit:50},{timeout:9000});res.json({success:true,data:{items:rows.map(x=>({session_id:x.session_id,expires_at:x.expires_at,last_seen_at:x.last_seen_at,created_at:x.created_at}))}})}catch(e){sendError(res,e)}
});
app.post('/api/security/logout-all',async(req,res)=>{
  try{const token_hash=requestTokenHash(req);const data=await gas('revokeAllSessionsFast',{token_hash},{timeout:12000});sessionCache.clear();res.json({success:true,data})}catch(e){sendError(res,e)}
});

app.listen(PORT,()=>{
  console.log(`KIA backend ${PORT}`);
  setTimeout(()=>ensureAuthWarm(),250);
  setTimeout(()=>warmPublicCache(),700);
  setTimeout(()=>reconcilePendingPayments(),20000);
  const reconcileTimer=setInterval(()=>reconcilePendingPayments(),DOKU_RECONCILE_INTERVAL_MS);
  reconcileTimer.unref?.();
});
