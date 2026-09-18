# KIA v0.5.10 Build 515 — Program Lifecycle

Baseline wajib: Build 514 STABLE.

## Frontend — replace only
- assets/js/donor-impact-v051.js
- assets/js/program-v0510.js
- app-version.json
- changelog.json
- service-worker.js

## Server — full replacement
Masuk folder `server/` lalu timpa:
- server.js
- package.json
- README.md

## Jangan disentuh
- app.html
- dashboard-v040.js
- payment
- landing/public-v0510.js
- Account/Profile
- Room Donasi
- Apps Script
- Spreadsheet
- DOKU ENV / credentials

## Test
1. Dashboard harus tetap boot normal.
2. Program ACTIVE → Stop Donasi → status PAUSED.
3. Program PAUSED → Buka Donasi → ACTIVE.
4. Program PAUSED → Tandai Selesai → COMPLETED.
5. Program PAUSED/COMPLETED tidak dapat membuat checkout baru.
6. Donasi PAID lama dan Dana Lebih tetap tampil di transparansi.
7. Program COMPLETED tetap dapat dibuka publik tetapi tombol donasi tertutup.
