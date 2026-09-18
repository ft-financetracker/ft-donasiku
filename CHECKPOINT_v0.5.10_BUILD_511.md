# KIA v0.5.10 — Build 511 / Phase B

Baseline wajib: v0.5.10 Phase A.

## Corrections
- Landing hero: typography lebih kecil dan proporsional.
- Info badge dipindahkan ke container Badge Saya.
- Penjelasan badge menggunakan rule yang sudah ada, bukan ranking nominal.
- Form Profil Akun: nama, telepon, alamat.
- USER tetap tidak melihat menu admin.

## Reliability
- Payment page mengecek local state otomatis.
- Provider DOKU dapat dicek lebih cepat melalui quick-status setelah payment cukup umur.
- Manual Sinkronkan Status tetap fallback.
- Tidak mengubah global DOKU reconciliation engine.

## Donor history
- Donation status PENDING milik user login muncul di Dampak Saya.
- User dapat Lanjutkan Pembayaran.
- Jika attempt expired/failed, payment page tetap memakai Donation lama untuk membuat Payment Attempt baru.

## Receipt
- Header + status + detail.
- Ucapan terima kasih.
- Attribution statement: donasi berasal dari donor, bukan dari platform KIA.
- Split Program/Dana Lebih ditampilkan bila allocation preview masih tersedia pada payment shell.

## No migration
Tidak ada perubahan Apps Script dan tidak ada header Spreadsheet baru.
