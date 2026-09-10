document.addEventListener('DOMContentLoaded', async () => {
  const slot = document.querySelector('[data-auth-nav]');
  if(!slot || !window.KiaAuth) return;

  const guestHtml = `
    <a href="./login.html">Masuk</a>
    <a class="btn btn-primary" href="./register.html">Daftar</a>
  `;

  const renderGuest = () => {
    slot.innerHTML = guestHtml;
  };

  const token = KiaAuth.getToken();
  if(!token){
    renderGuest();
    return;
  }

  const cachedUser = KiaAuth.getUser();
  if(cachedUser?.full_name){
    slot.innerHTML = `
      <span class="nav-user" title="${escapeHtml(cachedUser.full_name)}">Halo, ${escapeHtml(firstName(cachedUser.full_name))}</span>
      <a class="btn btn-primary" href="./app.html">Dashboard</a>
    `;
  }

  try {
    const response = await KiaAuth.me();
    const user = response.data.user;
    localStorage.setItem('kia_user', JSON.stringify(user));

    slot.innerHTML = `
      <span class="nav-user" title="${escapeHtml(user.full_name)}">Halo, ${escapeHtml(firstName(user.full_name))}</span>
      <a class="btn btn-primary" href="./app.html">Dashboard</a>
    `;
  } catch (err) {
    if(err.status === 401){
      KiaAuth.clear();
      renderGuest();
    }
  }

  function firstName(name){
    return String(name || 'Pengguna').trim().split(/\s+/)[0];
  }

  function escapeHtml(value){
    return String(value || '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#039;");
  }
});
