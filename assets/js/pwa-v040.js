window.KiaPWA = (() => {
  const FALLBACK_VERSION = '0.5.3';
  const FALLBACK_BUILD = 53;

  let deferredInstall = window.__KIA_PWA_INSTALL_PROMPT__ || null;
  let registration = null;
  let installWaiters = [];

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

  function rememberInstallPrompt(event) {
    if (!event) return;
    try { event.preventDefault(); } catch (_) {}

    deferredInstall = event;
    window.__KIA_PWA_INSTALL_PROMPT__ = event;

    const waiters = installWaiters;
    installWaiters = [];
    waiters.forEach(resolve => resolve(event));

    window.dispatchEvent(new CustomEvent('kia:pwa-install-ready'));
  }

  function currentInstallPrompt() {
    if (!deferredInstall && window.__KIA_PWA_INSTALL_PROMPT__) {
      deferredInstall = window.__KIA_PWA_INSTALL_PROMPT__;
    }
    return deferredInstall;
  }

  function canInstall() {
    return !isStandalone() && !!currentInstallPrompt();
  }

  function waitForInstallPrompt(timeout = 2200) {
    const current = currentInstallPrompt();
    if (current) return Promise.resolve(current);

    return new Promise(resolve => {
      let done = false;
      const finish = value => {
        if (done) return;
        done = true;
        resolve(value || null);
      };

      installWaiters.push(finish);

      setTimeout(() => {
        installWaiters = installWaiters.filter(item => item !== finish);
        finish(currentInstallPrompt());
      }, timeout);
    });
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

  window.addEventListener('beforeinstallprompt', rememberInstallPrompt);

  window.addEventListener('appinstalled', () => {
    deferredInstall = null;
    window.__KIA_PWA_INSTALL_PROMPT__ = null;
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

    const promptEvent = currentInstallPrompt() || await waitForInstallPrompt();

    if (!promptEvent) {
      return { installed: false, reason: 'PROMPT_UNAVAILABLE' };
    }

    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;

      deferredInstall = null;
      window.__KIA_PWA_INSTALL_PROMPT__ = null;

      return {
        installed: choice.outcome === 'accepted',
        choice: choice.outcome
      };
    } catch (error) {
      deferredInstall = null;
      window.__KIA_PWA_INSTALL_PROMPT__ = null;
      return {
        installed: false,
        reason: 'PROMPT_FAILED',
        error: error?.message || 'INSTALL_PROMPT_FAILED'
      };
    }
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
      const latestBuild = Number(latest.build || 0);
      const versionAhead = compareVersion(latestVersion, installed.version) > 0;
      const sameVersionNewerBuild =
        compareVersion(latestVersion, installed.version) === 0 &&
        latestBuild > Number(installed.build || 0);

      return {
        installed: installed.version,
        installedBuild: installed.build,
        latest: latestVersion,
        latestBuild,
        updateAvailable: versionAhead || sameVersionNewerBuild,
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
    canInstall,
    waitForInstallPrompt,
    install,
    installedRelease,
    checkUpdate,
    applyUpdate,
    compareVersion
  };
})();
