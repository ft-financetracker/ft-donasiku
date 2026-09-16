# KIA v0.5.7 — Social Reliability & Auth Speed

Patch bertahap di atas v0.5.6. Fokus versi ini adalah memperbaiki reliability interaksi donor, semantics badge, performa timeline/login, dan layout donor feed tanpa membongkar payment engine yang sudah stabil.

## Fokus utama

- Program Ringkasan: donor feed desktop minimum 2 baris; tablet 2 baris; mobile maksimum 3 baris.
- Halaman Semua Donasi: desktop tetap 1 baris dengan struktur `No | Profil | Nama + Pesan | Program | Badge | Nominal + DateTime`.
- Landing Live Donation tetap compact 3 baris.
- Badge donor diperjelas: `Tamu`, `Akun KIA`, `Terverifikasi`, `Anonim`.
- Hanya donasi yang terhubung akun KIA dan tidak anonim yang mempunyai Timeline/Love/Doa.
- Guest/no-account donation tidak clickable dan tidak bisa menerima interaksi.
- Love dan Doa menggunakan optimistic UI + compound Apps Script action.
- Timeline memakai seed/cache/prefetch agar drawer dapat terbuka cepat, lalu sinkronisasi data berjalan di background.
- Login tidak lagi melakukan full scan user pada cold start; session harus persisted sebelum token diberikan ke browser.

Boundary tetap: Donation != Payment, multi payment attempt tetap, PAID hanya dari verifikasi server/DOKU, webhook/idempotency dan Check Status DOKU tetap dipertahankan.
