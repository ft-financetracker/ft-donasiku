# Deploy KIA v0.5.10 Build 511 — Phase B FINAL

Baseline: Phase A v0.5.10 Build 510.

## A. GitHub frontend
Upload isi ZIP ke ROOT repository dan replace file dengan path yang sama.

Frontend yang berubah:
- `assets/css/v0510-patch.css`
- `assets/css/v0510b-patch.css`
- `assets/js/donor-impact-v051.js`
- `assets/js/payment-phase-b-v0510.js`
- `payment.html`
- `app-version.json`
- `changelog.json`
- `service-worker.js`

## B. Server / Render — FULL REPLACEMENT
Masuk ke folder `server/` di repository.

Timpa langsung 3 file:
- `server.js`
- `package.json`
- `README.md`

Tidak perlu:
- edit import
- copy route manual
- file module tambahan
- ubah angka versi manual

`server.js` di paket ini sudah FULL dan sudah mengandung Phase B.

## C. Apps Script / Spreadsheet
Tidak disentuh.
Tidak ada migration.

## D. Setelah commit
Render auto-deploy.

Cek:
`https://ft-donasiku.onrender.com/health`

Harus menunjukkan:
- version: `0.5.10`

Lalu cek Info Aplikasi:
- v0.5.10
- Build 511
