# QA REPORT — KIA v0.5.3

## Static checks

- `node --check server/server.js` → PASS
- `node --check github/assets/js/payment-v050.js` → PASS
- `node --check github/assets/js/pwa-v040.js` → PASS
- JSON parse `app-version.json` → PASS
- JSON parse `changelog.json` → PASS
- JSON parse `server/package.json` → PASS

## Contract checks

- DOKU Check Status Non-SNAP memakai GET `/orders/v1/status/{invoice_number OR Request-Id}`.
- Signature GET tidak memakai Digest.
- Inquiry dibatasi minimal 60 detik.
- `SUCCESS` diproses melalui `commitDokuPaymentFast` yang sudah idempotent.
- `FAILED` / `EXPIRED` hanya mengubah Payment Attempt, tidak mengubah Donation menjadi PAID.
- Apps Script tidak diubah.

## Runtime checks yang wajib dilakukan setelah deploy

1. `/health` = `0.5.3`.
2. Payment BRI yang sudah SUCCESS di DOKU tetapi PENDING di KIA dapat berubah PAID setelah `Sinkronkan Status`.
3. Sheet `09_PAYMENTS` = PAID.
4. Sheet `08_DONATIONS` = PAID.
5. `23_LIVE_DONATIONS` bertambah satu kali.
6. Ganti Metode membuat payment attempt baru dan UI langsung menampilkan attempt tersebut.

## Batasan operasional

Auto reconciliation berjalan ketika service Render aktif. Webhook tetap jalur primer. Check Status pada halaman Payment menjadi fallback aktif apabila webhook tidak masuk.
