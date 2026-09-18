# KIA v0.5.10 Phase A — CHECKPOINT

Baseline: v0.5.9 Build 59

## Scope
- Room Donasi publik lebih matang.
- Hero landing dipendekkan dan responsive.
- Continuous Live Donation ticker.
- Dana Lebih di Ringkasan + Transparansi Program.
- Cap 100% diberi dark translucent layer.
- Dampak Saya: info Level/Badge + progress tipis.
- Fix admin-only hidden navigation.

## Public Room policy — LOCK
Room Donasi boleh dilihat semua visitor. Hanya nama publik/Hamba Allah, badge publik, program, pesan publik, nominal, dan waktu PAID. Kontak, internal ID, VA, provider reference, dan data identitas dilarang.

## Timestamp cap
Frontend hanya menampilkan tanggal bila backend menyediakan `target_reached_at`. v0.5.10 tidak mengarang timestamp dari `updated_at`.

## Belum disentuh Phase A
Payment realtime/receipt, pending donation cross-device, lifecycle program v0.6.0.
