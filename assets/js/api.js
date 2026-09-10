window.KiaApi = {
  call(action, params={}) {
    return new Promise((resolve,reject)=>{
      const base=window.KIA_CONFIG.API_URL;
      if(!base || base.includes('PASTE_')) return reject(new Error('API URL belum dikonfigurasi'));
      const cb='kia_cb_'+Date.now()+'_'+Math.random().toString(36).slice(2);
      const script=document.createElement('script');
      const timer=setTimeout(()=>done(new Error('API timeout')),12000);
      const done=(err,data)=>{clearTimeout(timer);delete window[cb];script.remove();err?reject(err):resolve(data)};
      window[cb]=(res)=>res && res.success?done(null,res):done(new Error(res?.code||'API_ERROR'));
      const q=new URLSearchParams({action,callback:cb,...params});
      script.onerror=()=>done(new Error('Gagal terhubung ke API'));
      script.src=base+'?'+q.toString(); document.head.appendChild(script);
    });
  },
  health(){ return this.call('health'); }
};
