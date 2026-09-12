document.addEventListener('DOMContentLoaded', async () => {
  const slot = document.querySelector('[data-auth-nav]');
  const fundraiseLinks = [...document.querySelectorAll('[data-fundraise-link]')];
  const mobileAccount = document.querySelector('[data-mobile-account]');
  if(!slot || !window.KiaAuth) return;

  const guestHtml = `<a href="./login.html">Masuk</a><a class="btn btn-primary" href="./register.html">Daftar</a>`;
  const firstName = name => String(name || 'Pengguna').trim().split(/\s+/)[0];
  const escapeHtml = value => String(value || '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#039;");

  const setFundraiseDestination = loggedIn => {
    fundraiseLinks.forEach(link => link.href = loggedIn ? './app.html#fundraise' : './register.html?intent=fundraise');
  };
  const setMobileAccount = loggedIn => {
    if(!mobileAccount) return;
    mobileAccount.href=loggedIn?'./app.html#account':'./login.html';
  };

  const renderGuest = () => {
    slot.classList.remove('is-resolving');
    slot.removeAttribute('aria-busy');
    slot.innerHTML = guestHtml;
    setFundraiseDestination(false);
    setMobileAccount(false);
  };

  const renderUser = user => {
    slot.classList.remove('is-resolving');
    slot.removeAttribute('aria-busy');
    slot.innerHTML = `<span class="nav-user" title="${escapeHtml(user.full_name)}">Halo, ${escapeHtml(firstName(user.full_name))}</span><a class="btn btn-primary" href="./app.html">Dashboard</a>`;
    setFundraiseDestination(true);
    setMobileAccount(true);
  };

  const token = KiaAuth.getToken();
  if(!token){renderGuest();return;}

  const cachedUser = KiaAuth.getUser();
  if(cachedUser?.full_name) renderUser(cachedUser);

  try{
    const response = await KiaAuth.me();
    const user = response.data.user;
    localStorage.setItem('kia_user', JSON.stringify({...cachedUser,...user}));
    renderUser({...cachedUser,...user});
  }catch(err){
    if(err.status === 401){KiaAuth.clear();renderGuest();}
    else if(!cachedUser) renderGuest();
  }
});
