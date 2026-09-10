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

    const headers={'Content-Type':'application/json', ...(options.headers||{})};
    const token=this.getToken();
    if(token) headers.Authorization='Bearer '+token;

    const res=await fetch(base+path,{...options,headers});
    const body=await res.json().catch(()=>({success:false,message:'Respons backend tidak valid'}));

    if(!res.ok || !body.success){
      const err = new Error(body.message||body.code||'REQUEST_FAILED');
      err.status = res.status;
      throw err;
    }
    return body;
  },

  register(payload){ return this.request('/api/auth/register',{method:'POST',body:JSON.stringify(payload)}); },
  login(payload){ return this.request('/api/auth/login',{method:'POST',body:JSON.stringify(payload)}); },
  me(){ return this.request('/api/auth/me'); },
  logout(){ return this.request('/api/auth/logout',{method:'POST'}).finally(()=>this.clear()); }
};

window.KiaAuth.migrateLegacySession();
