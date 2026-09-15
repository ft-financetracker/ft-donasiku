# CHANGELOG — KIA v0.5.2

## Stable Performance & Payment Recovery Patch

### Baru
- Ganti Metode Pembayaran dari halaman Payment Status.
- Payment attempt baru tanpa membuat Donation baru.
- DOKU notify endpoint health/probe response.

### Peningkatan
- Semua Program memakai cache/seed Landing terlebih dahulu bila tersedia.
- Safe GET retry untuk mengurangi first-load gagal lalu baru berhasil setelah F5.
- Cache v0.5.1 tetap dapat dipakai sebagai fallback saat upgrade.
- Versioning seluruh layer disinkronkan ke v0.5.2 Build 52.

### Perbaikan
- Mengurangi skeleton lama pada katalog.
- User tidak lagi terjebak pada metode QRIS/VA pertama.
- Donation tidak dihitung dua kali jika dua payment attempt sama-sama dibayar.
- Frontend tidak lagi tertinggal di v0.5.0/v0.5.1 ketika backend sudah naik.

### Security
- DOKU transaction webhook tetap HMAC-protected.
- Endpoint probe tidak menjalankan mutation.
- Guest payment retry memakai signed checkout token.
