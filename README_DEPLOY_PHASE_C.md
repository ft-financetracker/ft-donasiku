# KIA v0.5.10 Build 512 — Phase C FINAL

## GitHub / frontend
Upload isi paket ke root repository dan replace path yang sama.

Changed frontend:
- assets/css/v0510-patch.css
- assets/js/public-v0510.js
- assets/js/program-v0510.js
- assets/js/donor-impact-v051.js
- assets/js/payment-phase-c-v0512.js (new)
- payment.html
- app-version.json
- changelog.json
- service-worker.js

## Server / Render — full replacement
Masuk folder `server/` lalu TIMPA langsung:
- server.js
- package.json
- README.md

Tidak perlu edit manual. Tidak ada ENV baru.

## Apps Script / Spreadsheet
Tidak disentuh dan tidak ada migration.

## Test prioritas
1. Checkout harus pindah ke payment page lebih cepat; channel muncul otomatis setelah background preparation selesai.
2. Payment page kembali clean (tidak ada dua note auto-sync Phase B).
3. Dashboard: Verifikasi hilang sebagai tab dan muncul di Akun.
4. Upload avatar.
5. Dampak Saya: EXP, Level & Misi, Riwayat scroll, Pending compact.
6. Draft program dapat dihapus; ACTIVE menampilkan Stop Donasi.
7. Landing: hero zoom berkurang, spacing rapi, hanya satu Lihat Semua Program.
8. Live indicator dan ticker tetap berjalan.
9. Footer supporter tampil; SUPER_ADMIN dapat mengatur daftar.
10. Program publik: Perkembangan & Transparansi menjadi satu room.
