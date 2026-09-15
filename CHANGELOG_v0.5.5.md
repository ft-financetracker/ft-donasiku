# Changelog v0.5.5

- Redesain Live Donation sesuai hierarchy nominal-program-donatur-pesan.
- Program detail dibatasi 5 donasi terbaru.
- Tambah halaman Semua Donasi dengan pagination 10/page.
- Public donation API membaca materialized `23_LIVE_DONATIONS`, lalu hanya join item halaman aktif ke `08_DONATIONS`.
- Tambah badge dasar publik Umum / Terverifikasi / Anonim.
- Tidak ada migration database.
