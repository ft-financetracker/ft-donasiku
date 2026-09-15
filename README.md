# KIA — Donasi Online v0.5.2

**Stable patch target:** Performance + Payment Recovery + Version Sync  
**Tanggal:** 15 September 2026  
**Rollback baseline yang tetap dipertahankan:** **v0.5.0**

v0.5.2 dibuat dari source v0.5.1 dan **tidak merombak fitur yang sudah di-lock**. Fokus release ini hanya pada temuan runtime setelah deploy v0.5.1.

## Yang diperbaiki

1. **Semua Program first-load**
   - memakai seed dari cache Landing jika tersedia;
   - kompatibel dengan cache v0.5.1 agar upgrade tidak terasa kosong;
   - safe GET retry otomatis sebelum menampilkan error;
   - jika refresh jaringan gagal tetapi cache tersedia, data lama tetap ditampilkan;
   - query search/filter tetap tidak memakai retry write apa pun.

2. **Payment Recovery / Ganti Metode**
   - Payment Status memiliki tombol **Ganti Metode**;
   - Donation lama tetap sama;
   - KIA membuat **payment attempt baru**, bukan Donation baru;
   - QRIS dan Virtual Account dapat dipilih ulang;
   - signed checkout token tetap menjadi pengaman untuk guest donor.

3. **Proteksi double-paid**
   - bila dua payment attempt untuk Donation yang sama sama-sama berhasil dibayar, program stats / Live Donation / FT Sync **tidak dihitung dua kali**;
   - payment kedua tetap tercatat untuk kebutuhan review finansial.

4. **DOKU Notification URL probe**
   - GET/HEAD endpoint notification membalas 200;
   - empty POST probe tanpa header transaksi juga membalas 200 tanpa memproses transaksi;
   - POST notifikasi pembayaran yang sebenarnya tetap wajib HMAC/signature DOKU.

5. **Version Sync**
   - Frontend/PWA/Service Worker/App Version/Backend/Apps Script disinkronkan ke **v0.5.2 Build 52**.

## LOCK yang dipertahankan

- KIA / Finance Tracker branding tetap.
- Hero HD 3 PNG tetap.
- Auth/session baseline tidak dirombak.
- Donation != Payment.
- `PAID` hanya berasal dari notifikasi provider yang tervalidasi.
- Live Donation hanya membaca transaksi PAID tervalidasi.
- Credential DOKU hanya di Render environment.
- Apps Script tetap Spreadsheet Data Gateway.
- Badge/level donor tidak menjadi leaderboard nominal.

## Database

**Tidak ada sheet/header baru pada v0.5.2.**  
Jika `migrateKiaV051()` sudah pernah berhasil dijalankan, **jangan jalankan migration lagi hanya untuk v0.5.2**.

Lihat `README_DEPLOY.md` untuk urutan deploy.
