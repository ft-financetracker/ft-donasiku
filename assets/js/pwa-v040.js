window.KiaPWA = (() => {
  const FALLBACK_VERSION = '0.4.3';
  const FALLBACK_BUILD = 43;
  let deferredInstall = null;
  let registration = null;

  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  function compareVersion(a, b) {
    const aa = String(a || '0').split('.').map(x => Number(x) || 0);
    const bb = String(b || '0').split('.').map(x => Number(x) || 0);
    const len = Math.max(aa.length, bb.length);
    for (let i = 0; i < len; i++) {
      const av = aa[i] || 0;
      const bv = bb[i] || 0;
      if (av > bv) return 1;
      if (av < bv) return -1;
    }
    return 0;
  }

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function getRegistration() {
    return registration
      ? Promise.resolve(registration)
      : navigator.serviceWorker?.getRegistration('./').then(reg => {
          registration = reg || null;
          return registration;
        });
  }

  function workerVersion(worker, timeout = 1800) {
    return new Promise(resolve => {
      if (!worker) {
        resolve(null);
        return;
      }

      const channel = new MessageChannel();
      const timer = setTimeout(() => resolve(null), timeout);

      channel.port1.onmessage = event => {
        clearTimeout(timer);
        resolve(event.data || null);
      };

      try {
        worker.postMessage({ type: 'KIA_GET_VERSION' }, [channel.port2]);
      } catch (_) {
        clearTimeout(timer);
        resolve(null);
      }
    });
  }

  async function installedRelease() {
    if (!('serviceWorker' in navigator)) {
      return { version: FALLBACK_VERSION, build: FALLBACK_BUILD, source: 'frontend' };
    }

    const reg = await getRegistration().catch(() => null);
    const worker = navigator.serviceWorker.controller || reg?.active || null;
    const info = await workerVersion(worker);

    return {
      version: String(info?.version || FALLBACK_VERSION),
      build: Number(info?.build || FALLBACK_BUILD),
      source: info?.version ? 'service-worker' : 'frontend'
    };
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstall = event;
    window.dispatchEvent(new CustomEvent('kia:pwa-install-ready'));
  });

  window.addEventListener('appinstalled', () => {
    deferredInstall = null;
    window.dispatchEvent(new CustomEvent('kia:pwa-installed'));
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        registration = await navigator.serviceWorker.register('./service-worker.js');
        registration.update().catch(() => {});
      } catch (error) {
        console.warn('SW_REGISTER_FAILED', error);
      }
    });
  }

  async function install() {
    if (isStandalone()) {
      return { installed: true, already: true };
    }

    if (!deferredInstall) {
      return { installed: false, reason: 'PROMPT_UNAVAILABLE' };
    }

    deferredInstall.prompt();
    const choice = await deferredInstall.userChoice;
    deferredInstall = null;

    return {
      installed: choice.outcome === 'accepted',
      choice: choice.outcome
    };
  }

  async function latestRelease() {
    const response = await fetch('./app-version.json?ts=' + Date.now(), {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });

    if (!response.ok) {
      throw new Error('VERSION_CHECK_FAILED');
    }

    return response.json();
  }

  async function checkUpdate() {
    try {
      const [installed, latest] = await Promise.all([
        installedRelease(),
        latestRelease()
      ]);

      const latestVersion = String(latest.version || installed.version);
      const updateAvailable = compareVersion(latestVersion, installed.version) > 0;

      return {
        installed: installed.version,
        installedBuild: installed.build,
        latest: latestVersion,
        latestBuild: Number(latest.build || 0),
        updateAvailable,
        required: !!latest.required_update,
        release: latest,
        source: installed.source
      };
    } catch (error) {
      const installed = await installedRelease().catch(() => ({
        version: FALLBACK_VERSION,
        build: FALLBACK_BUILD,
        source: 'frontend'
      }));

      return {
        installed: installed.version,
        installedBuild: installed.build,
        latest: installed.version,
        latestBuild: installed.build,
        updateAvailable: false,
        required: false,
        error: true,
        code: error?.message || 'VERSION_CHECK_FAILED'
      };
    }
  }

  async function activateWorker(worker) {
    if (!worker) return false;

    return new Promise(resolve => {
      let settled = false;
      const finish = value => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      const timer = setTimeout(() => finish(false), 8000);

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        clearTimeout(timer);
        finish(true);
      }, { once: true });

      try {
        worker.postMessage({ type: 'SKIP_WAITING' });
      } catch (_) {
        clearTimeout(timer);
        finish(false);
      }
    });
  }

  async function waitForInstalling(reg) {
    if (reg.waiting) return reg.waiting;
    if (!reg.installing) return null;

    return new Promise(resolve => {
      const worker = reg.installing;
      const timer = setTimeout(() => resolve(reg.waiting || null), 12000);

      const handle = () => {
        if (worker.state === 'installed') {
          clearTimeout(timer);
          resolve(reg.waiting || worker);
        } else if (worker.state === 'redundant') {
          clearTimeout(timer);
          resolve(null);
        }
      };

      worker.addEventListener('statechange', handle);
      handle();
    });
  }

  async function applyUpdate(onProgress = () => {}) {
    const state = await checkUpdate();

    if (!state.updateAvailable) {
      onProgress('up-to-date');
      return { updated: false, reason: 'UP_TO_DATE', state };
    }

    if (!('serviceWorker' in navigator)) {
      onProgress('reload');
      location.reload();
      return { updated: true, reason: 'RELOAD_ONLY' };
    }

    onProgress('checking-worker');
    const reg = await getRegistration();

    if (!reg) {
      onProgress('reload');
      location.reload();
      return { updated: true, reason: 'NO_REGISTRATION' };
    }

    await reg.update();
    await wait(250);

    let worker = reg.waiting || await waitForInstalling(reg);

    if (!worker) {
      // GitHub Pages / CDN kadang belum menyajikan service-worker baru pada detik yang sama.
      await wait(1200);
      await reg.update();
      worker = reg.waiting || await waitForInstalling(reg);
    }

    if (!worker) {
      onProgress('worker-not-ready');
      return { updated: false, reason: 'WORKER_NOT_READY', state };
    }

    onProgress('installing');
    const changed = await activateWorker(worker);

    if (!changed) {
      onProgress('reload');
      location.reload();
      return { updated: true, reason: 'RELOAD_FALLBACK' };
    }

    onProgress('reloading');
    location.reload();
    return { updated: true, reason: 'UPDATED' };
  }

  return {
    currentVersion: FALLBACK_VERSION,
    currentBuild: FALLBACK_BUILD,
    isStandalone,
    install,
    installedRelease,
    checkUpdate,
    applyUpdate,
    compareVersion
  };
})();
