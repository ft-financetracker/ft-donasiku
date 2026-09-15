(() => {
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[char]));

  const CATEGORY = {
    new: { label:'BARU', icon:'auto_awesome', className:'release-new' },
    improvements: { label:'PENINGKATAN', icon:'trending_up', className:'release-improvement' },
    fixes: { label:'PERBAIKAN', icon:'build_circle', className:'release-fix' },
    security: { label:'KEAMANAN', icon:'shield_lock', className:'release-security' }
  };

  function setText(selector, value) {
    const el = $(selector);
    if (el) el.textContent = value;
  }

  function setUpdateBadge(type, text) {
    const el = $('[data-update-status]');
    if (!el) return;
    el.className = 'version-status ' + type;
    el.innerHTML = `<span class="material-symbols-outlined">${type==='is-update'?'system_update_alt':type==='is-error'?'warning':'check_circle'}</span><span>${esc(text)}</span>`;
  }

  function setButtonBusy(button, busy, label, icon) {
    if (!button) return;
    button.disabled = !!busy;
    if (label) {
      button.innerHTML = `${icon?`<span class="material-symbols-outlined">${icon}</span>`:''}<span>${esc(label)}</span>`;
    }
  }

  async function refreshVersion({ manual = false } = {}) {
    const checkButton = $('[data-check-update]');
    if (manual) setButtonBusy(checkButton, true, 'Memeriksa…', 'sync');

    setUpdateBadge('is-checking', 'Memeriksa versi…');

    const result = await KiaPWA.checkUpdate();
    const installed = result.installed || KiaPWA.currentVersion;
    const latest = result.latest || installed;

    setText('[data-installed-version]', 'v' + installed);
    setText('[data-installed-build]', 'Build ' + (result.installedBuild || KiaPWA.currentBuild || '—'));
    setText('[data-latest-version]', 'v' + latest);
    setText('[data-latest-build]', result.latestBuild ? 'Build ' + result.latestBuild : 'Build —');
    setText('[data-release-date]', result.release?.released_at || '—');

    const applyButton = $('[data-apply-update]');

    if (result.error) {
      setUpdateBadge('is-error', 'Pemeriksaan gagal');
      if (applyButton) applyButton.hidden = true;
      setText('[data-update-note]', 'Tidak dapat memeriksa versi terbaru. Coba lagi beberapa saat.');
    } else if (result.updateAvailable) {
      setUpdateBadge('is-update', 'Update tersedia');
      if (applyButton) applyButton.hidden = false;
      setText('[data-update-note]', `Versi ${latest} siap dipasang. Session dan data akun tidak akan dihapus.`);
    } else {
      setUpdateBadge('is-current', 'Sudah terbaru');
      if (applyButton) applyButton.hidden = true;
      setText('[data-update-note]', 'KIA yang digunakan saat ini sudah sama dengan versi rilis terbaru.');
    }

    const standalone = KiaPWA.isStandalone();
    const installButton = $('[data-install-pwa]');

    if (installButton) installButton.hidden = standalone;
    setText(
      '[data-install-status]',
      standalone
        ? 'KIA terpasang sebagai PWA di perangkat ini.'
        : 'KIA sedang dibuka melalui browser. Anda dapat memasangnya seperti aplikasi.'
    );

    if (manual) {
      setButtonBusy(checkButton, false, 'Cek Update', 'refresh');
    }

    return result;
  }

  function normalizeReleases(raw) {
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.releases)) return raw.releases;
    return [];
  }

  function normalizeChanges(release) {
    if (release?.changes && typeof release.changes === 'object') {
      return Object.entries(release.changes).map(([key, items]) => ({
        key,
        items: Array.isArray(items) ? items : []
      }));
    }

    return ['new','improvements','fixes','security']
      .filter(key => Array.isArray(release?.[key]) && release[key].length)
      .map(key => ({ key, items: release[key] }));
  }

  function renderRelease(release, index) {
    const groups = normalizeChanges(release);
    const current = index === 0;

    return `
      <article class="release-card ${current?'is-current-release':''}">
        <div class="release-head">
          <div>
            <div class="release-version-row">
              <strong class="release-version">v${esc(release.version || '—')}</strong>
              ${current?'<span class="release-current-pill">TERBARU</span>':''}
            </div>
            <h3>${esc(release.title || 'Pembaruan KIA')}</h3>
          </div>
          <time>${esc(release.date || '')}</time>
        </div>
        <div class="release-groups">
          ${groups.length ? groups.map(group => {
            const meta = CATEGORY[group.key] || {
              label: String(group.key || 'UPDATE').toUpperCase(),
              icon: 'update',
              className: 'release-general'
            };
            return `
              <section class="release-group ${meta.className}">
                <div class="release-group-title">
                  <span class="material-symbols-outlined">${meta.icon}</span>
                  <span>${esc(meta.label)}</span>
                </div>
                <ul>${group.items.map(item => `<li>${esc(item)}</li>`).join('')}</ul>
              </section>`;
          }).join('') : '<p class="muted">Tidak ada catatan perubahan tambahan.</p>'}
        </div>
      </article>`;
  }

  async function loadChangelog() {
    const root = $('[data-changelog]');
    try {
      const response = await fetch('./changelog.json?ts=' + Date.now(), { cache:'no-store' });
      if (!response.ok) throw new Error('CHANGELOG_FAILED');
      const raw = await response.json();
      const releases = normalizeReleases(raw);

      root.innerHTML = releases.length
        ? releases.map(renderRelease).join('')
        : '<div class="empty-state">Belum ada riwayat update.</div>';
    } catch (_) {
      root.innerHTML = '<div class="empty-state">Riwayat update belum dapat dimuat. Silakan coba lagi.</div>';
    }
  }

  async function applyUpdate() {
    const button = $('[data-apply-update]');
    const checkButton = $('[data-check-update]');
    setButtonBusy(button, true, 'Menyiapkan update…', 'system_update_alt');
    if (checkButton) checkButton.disabled = true;
    setText('[data-update-note]', 'Mengambil versi aplikasi terbaru…');

    const progress = step => {
      const copy = {
        'checking-worker':'Memeriksa Service Worker terbaru…',
        'installing':'Mengaktifkan versi terbaru…',
        'reloading':'Update selesai. Memuat ulang KIA…',
        'reload':'Memuat ulang aplikasi…',
        'worker-not-ready':'File update belum sepenuhnya tersedia. Tunggu beberapa detik lalu coba lagi.',
        'up-to-date':'KIA sudah menggunakan versi terbaru.'
      };
      if (copy[step]) setText('[data-update-note]', copy[step]);
    };

    try {
      const result = await KiaPWA.applyUpdate(progress);
      if (result?.reason === 'WORKER_NOT_READY') {
        setButtonBusy(button, false, 'Coba Update Lagi', 'system_update_alt');
        if (checkButton) checkButton.disabled = false;
      } else if (result?.reason === 'UP_TO_DATE') {
        setButtonBusy(button, false, 'Update Sekarang', 'system_update_alt');
        if (checkButton) checkButton.disabled = false;
        await refreshVersion();
      }
    } catch (_) {
      setText('[data-update-note]', 'Update belum berhasil dipasang. Periksa koneksi lalu coba lagi.');
      setButtonBusy(button, false, 'Coba Update Lagi', 'system_update_alt');
      if (checkButton) checkButton.disabled = false;
    }
  }

  async function installPwa() {
    const button = $('[data-install-pwa]');
    setButtonBusy(button, true, 'Menyiapkan…', 'install_mobile');

    const result = await KiaPWA.install();

    if (result?.already) {
      button.hidden = true;
      setText('[data-install-status]', 'KIA terpasang sebagai PWA di perangkat ini.');
      return;
    }

    if (result?.installed) {
      button.hidden = true;
      setText('[data-install-status]', 'Instalasi KIA dimulai. Ikuti petunjuk perangkat jika muncul.');
      return;
    }

    setButtonBusy(button, false, 'Pasang Aplikasi KIA', 'install_mobile');
    setText('[data-install-status]', 'Prompt instalasi otomatis belum tersedia. Gunakan menu browser → Install app / Tambahkan ke layar utama.');
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('[data-check-update]')?.addEventListener('click', () => refreshVersion({ manual:true }));
    $('[data-apply-update]')?.addEventListener('click', applyUpdate);
    $('[data-install-pwa]')?.addEventListener('click', installPwa);

    window.addEventListener('kia:pwa-installed', () => refreshVersion());

    refreshVersion();
    loadChangelog();
  });
})();
