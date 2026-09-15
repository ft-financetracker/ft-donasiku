# CHECKPOINT TEST — KIA v0.5.2

Jalankan urut:

```text
1. /health
   → 0.5.2

2. Info Aplikasi
   → v0.5.2 / Build 52 / Sudah terbaru

3. Landing → Semua Program
   → program langsung muncul dari cache/seed bila tersedia
   → tidak perlu F5 agar berhasil

4. Donasi → QRIS / VA
   → Donation = PENDING
   → Payment = CREATED/PENDING

5. Payment Status → Ganti Metode
   → pilih QRIS atau VA
   → Donation ID tetap
   → payment_id baru / attempt bertambah

6. DOKU QRIS Notify URL
   → submit endpoint KIA lagi
   → jika DOKU menerima, lanjut simulator

7. Pembayaran sukses sandbox
   → Payment = PAID
   → Donation = PAID
   → Live Donation muncul sekali
   → Program stats bertambah sekali
```

**PASS STABLE** setelah poin 1–7 lolos runtime.
