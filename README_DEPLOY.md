# KIA v0.5.10 Build 517 — Program Saya Layout & Progress Fix

Baseline: Build 516 stabil.

## FRONTEND ONLY
Replace:
- assets/js/donor-impact-v051.js
- app-version.json
- changelog.json
- service-worker.js

## SERVER
Tidak diubah.

## Fokus patch
- Thumbnail card Program Saya dipindah ke kiri.
- Card diperbesar dan dirapikan agar tidak terlihat terlalu kecil.
- Struktur card dipadatkan menjadi 3 blok utama: header, progress, actions.
- Progress tidak lagi hanya mengandalkan dashboard snapshot; ada fallback ke cache detail program dan fetch public detail program.

## Tidak disentuh
- dashboard-v040.js
- app.html
- landing
- akun
- payment
- room donasi
- Apps Script
- Spreadsheet
- DOKU

## Test
1. Dashboard tetap boot normal.
2. Program Saya tampil dengan gambar di kiri.
3. Card terlihat lebih besar dan ringkas.
4. Nominal progress tidak lagi 0 jika program sebenarnya sudah penuh / overfunding.
5. Dana Lebih tampil jika raw > target.
