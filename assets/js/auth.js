window.KiaAuth = {
  getToken(){ return sessionStorage.getItem('kia_session_token') || ''; },
  setSession(data){
    if(data?.token) sessionStorage.setItem('kia_session_token', data.token);
    if(data?.user) sessionStorage.setItem('kia_user', JSON.stringify(data.user));
  },
  clear(){ sessionStorage.removeItem('kia_session_token'); sessionStorage.removeItem('kia_user'); },
  async request(path, options={}){
    const base=(window.KIA_CONFIG.BACKEND_URL||'').replace(/\/$/,'');
    if(!base || base.includes('PASTE_')) throw new Error('Backend URL belum dikonfigurasi');
    const headers={'Content-Type':'application/json', ...(options.headers||{})};
    const token=this.getToken(); if(token) headers.Authorization='Bearer '+token;
    const res=await fetch(base+path,{...options,headers});
    const body=await res.json().catch(()=>({success:false,message:'Respons backend tidak valid'}));
    if(!res.ok || !body.success) throw new Error(body.message||body.code||'REQUEST_FAILED');
    return body;
  },
  register(payload){ return this.request('/api/auth/register',{method:'POST',body:JSON.stringify(payload)}); },
  login(payload){ return this.request('/api/auth/login',{method:'POST',body:JSON.stringify(payload)}); },
  me(){ return this.request('/api/auth/me'); },
  logout(){ return this.request('/api/auth/logout',{method:'POST'}).finally(()=>this.clear()); }
};
