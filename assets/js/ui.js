window.KiaUI = (() => {
  let slowTimer = null;

  function ensureUI(){
    if(!document.querySelector('[data-kia-loading]')){
      document.body.insertAdjacentHTML('beforeend', `
        <div class="kia-loading" data-kia-loading hidden aria-live="polite" aria-busy="true">
          <div class="kia-loading__card">
            <img class="kia-loading__logo" src="./icons/kia-symbol.png" alt="">
            <div class="kia-spinner" aria-hidden="true"></div>
            <h2 class="kia-loading__title" data-kia-loading-title>Memproses…</h2>
            <p class="kia-loading__message" data-kia-loading-message>Mohon tunggu sebentar.</p>
          </div>
        </div>
      `);
    }

    if(!document.querySelector('[data-kia-modal]')){
      document.body.insertAdjacentHTML('beforeend', `
        <div class="kia-modal" data-kia-modal hidden>
          <div class="kia-modal__card" role="dialog" aria-modal="true" aria-labelledby="kiaModalTitle">
            <div class="kia-modal__icon" aria-hidden="true">↗</div>
            <h2 id="kiaModalTitle" data-kia-modal-title>Konfirmasi</h2>
            <p data-kia-modal-message></p>
            <div class="kia-modal__actions">
              <button class="btn btn-ghost" type="button" data-kia-modal-cancel>Batal</button>
              <button class="btn btn-primary" type="button" data-kia-modal-confirm>Ya, Lanjutkan</button>
            </div>
          </div>
        </div>
      `);
    }
  }

  function showLoading({title='Memproses…', message='Mohon tunggu sebentar.'} = {}){
    ensureUI();
    const layer = document.querySelector('[data-kia-loading]');
    layer.querySelector('[data-kia-loading-title]').textContent = title;
    layer.querySelector('[data-kia-loading-message]').textContent = message;
    layer.hidden = false;

    clearTimeout(slowTimer);
    slowTimer = setTimeout(() => {
      const msg = layer.querySelector('[data-kia-loading-message]');
      if(!layer.hidden){
        msg.textContent = 'Koneksi lebih lama dari biasanya. Sistem tetap mencoba dan akan berhenti otomatis bila server tidak merespons.';
      }
    }, 6500);
  }

  function setLoading({title, message} = {}){
    ensureUI();
    const layer = document.querySelector('[data-kia-loading]');
    if(title) layer.querySelector('[data-kia-loading-title]').textContent = title;
    if(message) layer.querySelector('[data-kia-loading-message]').textContent = message;
  }

  function hideLoading(){
    ensureUI();
    clearTimeout(slowTimer);
    document.querySelector('[data-kia-loading]').hidden = true;
  }

  function confirm({
    title='Konfirmasi',
    message='Apakah Anda yakin?',
    confirmText='Ya, Lanjutkan',
    cancelText='Batal'
  } = {}){
    ensureUI();
    return new Promise(resolve => {
      const modal = document.querySelector('[data-kia-modal]');
      const yes = modal.querySelector('[data-kia-modal-confirm]');
      const no = modal.querySelector('[data-kia-modal-cancel]');

      modal.querySelector('[data-kia-modal-title]').textContent = title;
      modal.querySelector('[data-kia-modal-message]').textContent = message;
      yes.textContent = confirmText;
      no.textContent = cancelText;
      modal.hidden = false;
      no.focus();

      const finish = value => {
        modal.hidden = true;
        yes.removeEventListener('click', onYes);
        no.removeEventListener('click', onNo);
        document.removeEventListener('keydown', onKey);
        resolve(value);
      };
      const onYes = () => finish(true);
      const onNo = () => finish(false);
      const onKey = e => {
        if(e.key === 'Escape') finish(false);
      };

      yes.addEventListener('click', onYes);
      no.addEventListener('click', onNo);
      document.addEventListener('keydown', onKey);
    });
  }

  document.addEventListener('DOMContentLoaded', ensureUI);

  return {showLoading, setLoading, hideLoading, confirm};
})();
