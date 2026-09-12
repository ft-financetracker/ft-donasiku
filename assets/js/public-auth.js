document.addEventListener('DOMContentLoaded', async () => {
  const slot = document.querySelector('[data-auth-nav]');
  const fundraiseLinks = [...document.querySelectorAll('[data-fundraise-link]')];
  if(!slot || !window.KiaAuth) return;

  const guestHtml = `
    <a href="./login.html">Masuk</a>
    <a class="btn btn-primary" href="./register.html">Daftar</a>
  `;

  const firstName = name => String(name || 'Pengguna').trim().split(/\s+/)[0];

  const escapeHtml = value => String(value || '')
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#039;");

  const setFundraiseDestination = loggedIn => {
    fundraiseLinks.forEach(link => {
      link.href = loggedIn
        ? './app.html#fundraise'
        : './register.html?intent=fundraise';
    });
  };

  const renderGuest = () => {
    slot.classList.remove('is-resolving');
    slot.removeAttribute('aria-busy');
    slot.innerHTML = guestHtml;
    setFundraiseDestination(false);
  };

  const renderUser = user => {
    slot.classList.remove('is-resolving');
    slot.removeAttribute('aria-busy');
    slot.innerHTML = `
      <span class="nav-user" title="${escapeHtml(user.full_name)}">
        Halo, ${escapeHtml(firstName(user.full_name))}
      </span>
      <a class="btn btn-primary" href="./app.html">Dashboard</a>
    `;
    setFundraiseDestination(true);
  };

  const token = KiaAuth.getToken();
  if(!token){
    renderGuest();
    return;
  }

  // Render cached user seketika agar tidak ada flash Masuk/Daftar.
  const cachedUser = KiaAuth.getUser();
  if(cachedUser?.full_name){
    renderUser(cachedUser);
  }

  try{
    const response = await KiaAuth.me();
    const freshUser = response.data.user||{};
    const user = {
      ...(cachedUser||{}),
      ...freshUser,
      platform_role:freshUser.platform_role||cachedUser?.platform_role||'USER'
    };
    localStorage.setItem('kia_user', JSON.stringify(user));
    renderUser(user);
  }catch(err){
    if(err.status === 401){
      KiaAuth.clear();
      renderGuest();
    }else if(!cachedUser){
      // Jangan menganggap logout hanya karena jaringan sedang lambat.
      renderGuest();
    }
  }
});
