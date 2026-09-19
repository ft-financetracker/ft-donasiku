# KIA v0.5.10 Build 520 — Avatar Identity Sync

Baseline: Build 519 stable + Program Saya Build 518 complete.

## Frontend — replace
- assets/js/donor-impact-v051.js
- assets/js/program-v0510.js
- assets/js/donation-social-v059.js
- assets/js/program-donations-v058.js
- app-version.json
- changelog.json
- service-worker.js

## Server — FULL REPLACEMENT
Replace directly:
- server/server.js
- server/package.json
- server/README.md

## Tidak disentuh
- Apps Script
- Spreadsheet schema
- Payment / DOKU
- Landing
- Program lifecycle rules

## Test
1. Account → pilih ikon Material.
2. Refresh Account: ikon tetap sama.
3. Buka Program publik milik akun: avatar Penggalang mengikuti ikon profil bila owner perorangan.
4. Donasi dari akun: Donasi Terbaru / Semua Donasi / Timeline menggunakan ikon yang sama bila donor_profile tersedia.
5. Upload foto: avatar kembali menggunakan foto dan cache publik ikut diperbarui.
