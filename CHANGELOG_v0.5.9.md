# Changelog v0.5.9 — Instant Social & Target Completion

## Baru
- Breakdown **Masuk ke Program** dan **Dana Lebih** saat nominal donasi melebihi sisa target.
- Cap semi-transparan **100% SELESAI** pada cover program yang sudah mencapai target.

## Peningkatan
- Love/unlove mengubah count dan Timeline langsung di frontend; sinkronisasi server berjalan di background.
- Doa/pesan langsung muncul di Timeline tanpa menunggu response Spreadsheet.
- Kegagalan sementara tidak langsung me-rollback Love. State lokal dipertahankan lalu direkonsiliasi dengan server.
- Pesan gagal tetap terlihat dan menyediakan **Coba lagi**.
- Progress publik dan nominal Terkumpul dikunci maksimal 100% / sebesar target.

## Fondasi yang tidak diubah
- Design system, font, token warna, layout utama.
- Struktur Donation / Payment dan DOKU engine.
- Apps Script / Spreadsheet schema.
- Role, auth, route, Live Donation layout, Room Donasi.
- Nilai bruto pembayaran tetap tersedia pada Transparansi.

## Prinsip Dana Lebih v0.5.9
`Dana Lebih` adalah alokasi turunan:
- `sisa_target = max(target - raised_paid, 0)`
- `masuk_program = min(donasi, sisa_target)`
- `dana_lebih = max(donasi - masuk_program, 0)`

Tidak ada migrasi database pada v0.5.9.
