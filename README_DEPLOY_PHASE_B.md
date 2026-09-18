# Deploy v0.5.10 Build 511 — Phase B

Phase A harus sudah terpasang.

## GitHub root — replace
- `assets/css/v0510-patch.css`
- `assets/js/donor-impact-v051.js`
- `payment.html`
- `app-version.json`
- `changelog.json`
- `service-worker.js`

## GitHub root — new
- `assets/css/v0510b-patch.css`
- `assets/js/payment-phase-b-v0510.js`

## Server folder
Upload NEW:
- `server/v0510-phase-b.js`

Replace:
- `server/package.json`

Lalu edit `server/server.js` mengikuti:
- `server/PATCH_SERVER_PHASE_B.md`

## Apps Script / Spreadsheet
Tidak ada perubahan.
Tidak ada migration.

## Setelah deploy
1. Render harus sukses.
2. `/health` harus `0.5.10`.
3. Info Aplikasi harus v0.5.10 Build 511.
4. Test Dashboard > Dampak Saya.
5. Test Dashboard > Akun > Profil Akun.
6. Test payment sandbox sampai auto berubah PAID.
7. Test Cetak Struk.
