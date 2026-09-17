# Changelog v0.5.8 — Payment, Social & UX Polish

## Baru
- Room Donasi publik dengan filter Hari Ini, 7 Hari, Bulan Ini, Semua.
- Live Donation hingga 10 transaksi terbaru dengan carousel horizontal otomatis + manual scroll.
- Payment Hero horizontal compact. Mengikuti Hero slot 3 KIA sehingga admin dapat mengganti visual dari Hero & Media.
- Cetak Struk tersedia setelah pembayaran PAID.

## Perbaikan
- Timeline Dukungan memakai seed/cache dan tidak lagi membuka skeleton penuh bila data ringkas sudah ada.
- Love/unlove memakai optimistic UI; database commit tetap satu action Apps Script.
- Kirim Doa langsung tampil optimistik dan database commit tetap satu action Apps Script.
- Badge publik: Tamu, Terdaftar, Terverifikasi, Moderator, Super Admin, Anonim.
- Role pill dashboard ditampilkan manusiawi: User, Moderator, Super Admin.
- Riwayat Update v0.5.6/v0.5.7 kembali terbaca karena changelog dikembalikan ke format yang didukung renderer.
- Payment page auto-poll status lokal tiap ±5 detik dan Check Status provider sebagai fallback. Tombol Sinkronkan Status hanya manual.
- Ganti Metode memakai panel yang lebih rapi dan safe loading.
- Payment success dibuat serasi dengan waiting state serta menyediakan struk.
- Footer landing mendapat active/hover/touch feedback yang lebih jelas.

## Privasi
- Room Donasi hanya memakai data yang memang sudah publik di Live Donation.
- Tidak menampilkan email, WhatsApp, user_id internal, payment_id, VA, request/provider reference.
- Tidak ada ranking donor berdasarkan nominal. Room hanya chronological + filter periode.
