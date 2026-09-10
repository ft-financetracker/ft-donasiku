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
  },

  async request(path, options={}){
    const base=(window.KIA_CONFIG.BACKEND_URL||'').replace(/\/$/,'');
    if(!base || base.includes('PASTE_')) throw new Error('Backend URL belum dikonfigurasi');

    const {timeout=15000, ...fetchOptions} = options;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const headers={'Content-Type':'application/json', ...(fetchOptions.headers||{})};
    const token=this.getToken();
    if(token && !headers.Authorization) headers.Authorization='Bearer '+token;

    try{
      const res=await fetch(base+path,{...fetchOptions,headers,signal:controller.signal});
      const body=await res.json().catch(()=>({success:false,message:'Respons backend tidak valid'}));

      if(!res.ok || !body.success){
        const err = new Error(body.message||body.code||'REQUEST_FAILED');
        err.status = res.status;
        throw err;
      }
      return body;
    }catch(err){
      if(err?.name === 'AbortError'){
        const timeoutError = new Error('Koneksi ke server terlalu lama. Silakan coba lagi.');
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
      body:JSON.stringify(payload)
    });
  },

  login(payload){
    return this.request('/api/auth/login',{
      method:'POST',
      body:JSON.stringify(payload)
    });
  },

  me(){
    return this.request('/api/auth/me');
  },

  async logout(){
    const base=(window.KIA_CONFIG.BACKEND_URL||'').replace(/\/$/,'');
    const token=this.getToken();

    // Hilangkan state lokal SEBELUM menunggu Render/Apps Script.
    // Landing page tidak akan lagi sempat menampilkan "Halo" setelah logout.
    this.clear();

    if(!token || !base) return {success:true,data:{logged_out:true,local_only:true}};

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    try{
      const res = await fetch(base+'/api/auth/logout',{
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'Authorization':'Bearer '+token
        },
        signal:controller.signal
      });

      const body = await res.json().catch(()=>({success:res.ok}));
      return body;
    }catch(err){
      // Logout lokal tetap final walaupun server sedang lambat/offline.
      return {success:true,data:{logged_out:true,local_only:true}};
    }finally{
      clearTimeout(timer);
    }
  }
};

window.KiaAuth.migrateLegacySession();
