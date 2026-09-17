window.KiaAuth = {
  _warmupPromise:null,
  _lastWarmupAt:0,

  migrateLegacySession(){
    const oldToken = sessionStorage.getItem('kia_session_token');
    const oldUser = sessionStorage.getItem('kia_user');

    if(!localStorage.getItem('kia_session_token') && oldToken){
      localStorage.setItem('kia_session_token', oldToken);
    }
    if(!localStorage.getItem('kia_user') && oldUser){
      localStorage.setItem('kia_user', oldUser);
    }

    if(oldToken || oldUser){
      sessionStorage.removeItem('kia_session_token');
      sessionStorage.removeItem('kia_user');
    }
  },

  getDeviceId(){
    let value = localStorage.getItem('kia_device_id');
    if(value) return value;

    if(window.crypto?.randomUUID){
      value = crypto.randomUUID();
    }else{
      value = 'dev_' + Date.now().toString(36) + '_' +
        Math.random().toString(36).slice(2,14);
    }

    localStorage.setItem('kia_device_id', value);
    return value;
  },

  getToken(){
    this.migrateLegacySession();
    return localStorage.getItem('kia_session_token') || '';
  },

  getUser(){
    this.migrateLegacySession();
    try {
      return JSON.parse(localStorage.getItem('kia_user') || 'null');
    } catch {
      return null;
    }
  },

  setSession(data){
    if(data?.token) localStorage.setItem('kia_session_token', data.token);
    if(data?.user){
      const previous=this.getUser()||{};
      const merged={...previous,...data.user};
      if(!merged.platform_role) merged.platform_role=previous.platform_role||'USER';
      localStorage.setItem('kia_user', JSON.stringify(merged));
    }
    sessionStorage.removeItem('kia_session_token');
    sessionStorage.removeItem('kia_user');
  },

  clear(){
    localStorage.removeItem('kia_session_token');
    localStorage.removeItem('kia_user');
    sessionStorage.removeItem('kia_session_token');
    sessionStorage.removeItem('kia_user');

    // Device ID sengaja TIDAK dihapus.
    // Browser/perangkat yang sama tetap memiliki identitas device stabil.
  },

  async request(path, options={}){
    const base=(window.KIA_CONFIG.BACKEND_URL||'').replace(/\/$/,'');
    if(!base || base.includes('PASTE_')) {
      throw new Error('Backend URL belum dikonfigurasi');
    }

    const {
      timeout=20000,
      attempts,
      retrySafe=false,
      retryDelay=500,
      ...fetchOptions
    }=options;
    const method=String(fetchOptions.method||'GET').toUpperCase();
    const maxAttempts=Math.max(1,Number(attempts)||((method==='GET'||retrySafe)?2:1));
    const headers={
      'Content-Type':'application/json',
      'X-KIA-Device-ID':this.getDeviceId(),
      ...(fetchOptions.headers||{})
    };

    const token=this.getToken();
    if(token && !headers.Authorization) headers.Authorization='Bearer '+token;

    let lastError=null;
    for(let attempt=1;attempt<=maxAttempts;attempt++){
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),timeout);
      try{
        const res=await fetch(base+path,{
          cache:'no-store',
          ...fetchOptions,
          headers,
          signal:controller.signal
        });

        const raw=await res.text();
        let body=null;
        try{
          body=raw?JSON.parse(raw):null;
        }catch(_){
          const html=/^\s*</.test(raw||'');
          const err=new Error(html
            ? 'Server sedang memulai layanan. KIA akan mencoba lagi.'
            : 'Respons server sementara tidak valid. KIA akan mencoba lagi.');
          err.code='INVALID_SERVER_RESPONSE';
          err.status=res.status||502;
          err.retryable=true;
          throw err;
        }

        if(!res.ok || !body?.success){
          const err=new Error(body?.message||body?.code||'REQUEST_FAILED');
          err.status=res.status;
          err.code=body?.code||'REQUEST_FAILED';
          err.retryable=[502,503,504].includes(res.status)||[
            'GATEWAY_TIMEOUT','GATEWAY_NETWORK','GATEWAY_HTML_RESPONSE','GATEWAY_INVALID_RESPONSE',
            'GATEWAY_HTTP_500','GATEWAY_HTTP_502','GATEWAY_HTTP_503','GATEWAY_HTTP_504'
          ].includes(err.code);
          throw err;
        }

        return body;
      }catch(rawErr){
        let err=rawErr;
        if(rawErr?.name==='AbortError'){
          err=new Error('Server masih menyiapkan data. KIA akan mencoba kembali secara aman.');
          err.code='REQUEST_TIMEOUT';
          err.status=504;
          err.retryable=true;
        }else if(rawErr instanceof TypeError){
          err=new Error('Koneksi ke server sedang tidak stabil. KIA akan mencoba lagi.');
          err.code='NETWORK_ERROR';
          err.status=503;
          err.retryable=true;
        }
        lastError=err;
        if(attempt>=maxAttempts||!err.retryable) throw err;
        await new Promise(resolve=>setTimeout(resolve,retryDelay*attempt));
      }finally{
        clearTimeout(timer);
      }
    }
    throw lastError||new Error('REQUEST_FAILED');
  },

  register(payload){
    return this.request('/api/auth/register',{
      method:'POST',
      body:JSON.stringify(payload),
      timeout:60000
    });
  },

  async login(payload){
    try{
      await Promise.race([
        this.warmup(),
        new Promise(resolve=>setTimeout(resolve,1200))
      ]);
    }catch(_){ }
    return this.request('/api/auth/login',{
      method:'POST',
      body:JSON.stringify(payload),
      timeout:24000,
      attempts:1,
      retrySafe:false
    });
  },

  me(){
    return this.request('/api/auth/me',{
      timeout:15000,
      attempts:2
    });
  },

  async warmup(){
    const base=(window.KIA_CONFIG.BACKEND_URL||'').replace(/\/$/,'');
    if(!base) return null;
    if(Date.now()-Number(this._lastWarmupAt||0)<60000) return {success:true,warm:true};
    if(this._warmupPromise) return this._warmupPromise;

    this._warmupPromise=(async()=>{
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),10000);
      try{
        const res=await fetch(base+'/health?warm=1',{
          method:'GET',
          cache:'no-store',
          headers:{'X-KIA-Device-ID':this.getDeviceId()},
          signal:controller.signal
        });
        if(res.ok) this._lastWarmupAt=Date.now();
        return {success:res.ok};
      }catch(_){
        return null;
      }finally{
        clearTimeout(timer);
        setTimeout(()=>{this._warmupPromise=null},500);
      }
    })();
    return this._warmupPromise;
  },

  async logout(){
    const base=(window.KIA_CONFIG.BACKEND_URL||'').replace(/\/$/,'');
    const token=this.getToken();

    this.clear();

    if(!token || !base) {
      return {success:true,data:{logged_out:true,local_only:true}};
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    try{
      const res = await fetch(base+'/api/auth/logout',{
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'Authorization':'Bearer '+token,
          'X-KIA-Device-ID':this.getDeviceId()
        },
        signal:controller.signal
      });

      return await res.json().catch(()=>({success:res.ok}));
    }catch(_){
      return {success:true,data:{logged_out:true,local_only:true}};
    }finally{
      clearTimeout(timer);
    }
  }
};

window.KiaAuth.migrateLegacySession();
window.KiaAuth.getDeviceId();


// v0.5.8 — human-friendly platform badge labels without changing role codes.
(()=>{
  const roleLabel=v=>({USER:'User',PLATFORM_ADMIN:'Moderator',SUPER_ADMIN:'Super Admin'}[String(v||'').trim().toUpperCase()]||v);
  const apply=()=>document.querySelectorAll('[data-role-badge]').forEach(el=>{const next=roleLabel(el.textContent);if(next&&el.textContent!==next)el.textContent=next});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
  const obs=new MutationObserver(apply);obs.observe(document.documentElement,{subtree:true,childList:true,characterData:true});
})();
