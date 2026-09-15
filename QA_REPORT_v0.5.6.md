# QA REPORT v0.5.6

Static checks yang dilakukan saat build:
- Version frontend/backend/Apps Script disinkronkan ke 0.5.6 / Build 56.
- Apps Script menambah migration idempotent untuk sheet 24 dan 25.
- Endpoint social memerlukan sesi untuk write, sementara read tetap public.
- Doa/pesan dibatasi 280 karakter dan rate-limited di backend.
- Donasi anonim mengembalikan donor_profile = null.
- Service Worker cache dinaikkan ke `kia-v0.5.6` dan memasukkan asset social baru.
- Layout desktop/tablet/mobile donor row dibatasi sesuai acceptance.

Catatan: QA runtime tetap wajib setelah deploy karena Render, Apps Script, dan DOKU adalah dependency eksternal.
