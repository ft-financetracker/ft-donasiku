# KIA v0.5.10 Build 514 — Emergency Dashboard Recovery

Penyebab yang ditargetkan:
Build 513 memasang layer enhancement dashboard terlalu awal dan memonitor perubahan navigasi.
Recovery ini mengembalikan enhancer Dashboard ke baseline Build 512 yang sudah terbukti dapat dibuka,
lalu menjalankannya setelah core Dashboard mendapat kesempatan boot.

## Upload ke ROOT GitHub — hanya 3 file
- assets/js/donor-impact-v051.js
- app-version.json
- service-worker.js

## SERVER
JANGAN DIUBAH.
Biarkan server Build 513 yang sekarang.

## Setelah commit
1. tunggu GitHub Pages selesai
2. buka Landing
3. refresh sekali
4. buka Dashboard
5. jika PWA menawarkan update, tekan Update
6. bila tab Dashboard lama masih terbuka, tutup tab lalu buka Dashboard lagi

Tidak ada Apps Script / Spreadsheet / DOKU / ENV change.
