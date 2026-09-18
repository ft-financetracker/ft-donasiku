# Deploy KIA v0.5.10 Build 513 — Stability Recovery

## Frontend
Upload isi ZIP ke ROOT repository dan replace file dengan path yang sama.

File frontend:
- assets/css/v0510-patch.css
- assets/css/v0510b-patch.css
- assets/js/public-v0510.js
- assets/js/donor-impact-v051.js
- assets/js/payment-receipt-v0513.js
- payment.html
- app-version.json
- changelog.json
- service-worker.js

## Server — FULL REPLACEMENT
Masuk folder `server/` lalu timpa langsung:
- server.js
- package.json
- README.md

Tidak perlu edit server.js manual.

## Jangan disentuh
- Apps Script
- Spreadsheet
- DOKU ENV / credential
- migration

## Setelah commit
1. tunggu GitHub Pages publish
2. tunggu Render deploy
3. cek `/health`
4. Info Aplikasi harus Build 513
5. tes Payment, Hapus Draft, Akun/Verifikasi, foto profil, role menu, Landing.
