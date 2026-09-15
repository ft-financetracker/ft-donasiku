# KIA v0.5.5 — Live Donation & Donor Feed

Patch bertahap setelah v0.5.4. Fokus versi ini adalah penyajian donasi publik yang scalable tanpa mengubah payment engine yang sudah stabil.

## Scope
- Live Donation hierarchy baru: nominal → program → donatur/badge → pesan.
- Ringkasan program hanya 5 donasi terbaru.
- Halaman Semua Donasi per program, pagination 10/page.
- Badge publik dasar: Umum / Terverifikasi / Anonim.
- Avatar/frame placeholder untuk fondasi donor profile v0.5.6.
- Tidak ada sheet baru dan tidak ada migration.

## Tidak masuk v0.5.5
Love, doa/komentar antar-user, timeline sosial, achievement badge publik, dan donor profile penuh tetap untuk v0.5.6 agar payment/public-read stability tidak tercampur dengan write-social flow.
