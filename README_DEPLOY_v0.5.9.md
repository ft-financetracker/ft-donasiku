# Deploy KIA v0.5.9 — Isolated Patch

Baseline wajib: **v0.5.8 Build 58**.

## 1. GitHub Pages
Upload/replace file dari paket ini dengan struktur path yang sama.

File baru:
- `assets/js/donation-social-v059.js`
- `assets/js/donate-v059.js`
- `assets/js/public-v059.js`
- `assets/js/catalog-v059.js`
- `assets/js/program-v059.js`
- `assets/css/v059-patch.css`
- `CHANGELOG_v0.5.9.md`
- `CHECKPOINT_v0.5.9.md`
- `QA_REPORT_v0.5.9.md`
- `README_DEPLOY_v0.5.9.md`

File replace:
- `index.html`
- `programs.html`
- `program.html`
- `program-donations.html`
- `donate.html`
- `service-worker.js`
- `app-version.json`
- `changelog.json`

**Jangan hapus file v0.5.8.** File lama adalah rollback baseline.

## 2. Apps Script / Spreadsheet
**Tidak ada perubahan. Tidak ada migration.**
Jangan menjalankan migration lama.

## 3. Render backend
Business logic backend v0.5.8 tetap digunakan.
Untuk sinkronisasi label versi saja:
- replace `server/package.json`
- terapkan `server/PATCH_SERVER_V059.md` pada dua literal version di `server/server.js`
- commit/redeploy Render.

Tidak ada ENV baru.

## 4. Verifikasi
- Info Aplikasi: v0.5.9 / Build 59
- Service Worker: `kia-v0.5.9`
- `/health`: v0.5.9 setelah version-label patch
- Jalankan seluruh `QA_REPORT_v0.5.9.md`.

## Rollback
Kembalikan HTML + service-worker + app-version + changelog ke v0.5.8.
Karena tidak ada DB migration, rollback tidak membutuhkan perubahan Spreadsheet.
