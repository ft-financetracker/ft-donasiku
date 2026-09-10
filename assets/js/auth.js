window.KiaAuth = {
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
    if(data?.user) localStorage.setItem('kia_user', JSON.stringify(data.user));
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

    const {timeout=15000, ...fetchOptions} = options;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const headers={
      'Content-Type':'application/json',
      'X-KIA-Device-ID':this.getDeviceId(),
      ...(fetchOptions.headers||{})
    };

    const token=this.getToken();
    if(token && !headers.Authorization) {
      headers.Authorization='Bearer '+token;
    }

    try{
      const res=await fetch(base+path,{
        ...fetchOptions,
        headers,
        signal:controller.signal
      });

      const body=await res.json().catch(()=>({
        success:false,
        message:'Respons backend tidak valid'
      }));

      if(!res.ok || !body.success){
        const err = new Error(body.message||body.code||'REQUEST_FAILED');
        err.status = res.status;
        throw err;
      }

      return body;
    }catch(err){
      if(err?.name === 'AbortError'){
        const timeoutError = new Error(
          'Server membutuhkan waktu lebih lama. Silakan coba lagi.'
        );
        timeoutError.code = 'REQUEST_TIMEOUT';
        throw timeoutError;
      }
      throw err;
    }finally{
      clearTimeout(timer);
    }
  },

  register(payload){
    return this.request('/api/auth/register',{
      method:'POST',
      body:JSON.stringify(payload),
      timeout:60000
    });
  },

  login(payload){
    return this.request('/api/auth/login',{
      method:'POST',
      body:JSON.stringify(payload),
      timeout:35000
    });
  },

  me(){
    return this.request('/api/auth/me',{
      timeout:12000
    });
  },

  async warmup(){
    const base=(window.KIA_CONFIG.BACKEND_URL||'').replace(/\/$/,'');
    if(!base) return;
    try{
      await fetch(base+'/health',{
        method:'GET',
        cache:'no-store',
        headers:{'X-KIA-Device-ID':this.getDeviceId()}
      });
    }catch(_){}
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
