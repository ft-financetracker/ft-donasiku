# DEPLOY KIA v0.5.3 — PAYMENT RELIABILITY

## 1 — Apps Script

**Tidak ada perubahan Apps Script dan tidak ada migration.**

Jangan replace `Code.gs`.
Jangan menjalankan fungsi migration/setup.

## 2 — GitHub Frontend

Upload/replace **ISI** folder:

```text
github/
```

ke ROOT repository:

```text
ft-financetracker/ft-donasiku
```

File yang berubah:

```text
app-version.json
app.html
changelog.json
service-worker.js
assets/js/payment-v050.js
assets/js/pwa-v040.js
```

Jangan hapus file lain.

## 3 — GitHub Backend

Replace:

```text
server/server.js
server/package.json
server/.env.example
```

`server/.env.example` hanya dokumentasi; credential asli tetap berada di Render Environment.

## 4 — Render

Environment lama tetap dipakai:

```text
KIA_GAS_URL=...
KIA_GATEWAY_SECRET=...
KIA_ALLOWED_ORIGIN=https://ft-financetracker.github.io
KIA_PUBLIC_APP_URL=https://ft-financetracker.github.io/ft-donasiku
KIA_DOKU_ENV=sandbox
KIA_DOKU_CLIENT_ID=<secret Render>
KIA_DOKU_SECRET_KEY=<secret Render>
KIA_DOKU_NOTIFY_URL=https://ft-donasiku.onrender.com/api/payments/doku/notify
```

Tunggu auto-deploy `Deploy successful`.

## 5 — Checkpoint versi

Buka:

```text
https://ft-donasiku.onrender.com/health
```

Target:

```text
version = 0.5.3
```

Info Aplikasi:

```text
Versi Terpasang : v0.5.3
Versi Terbaru   : v0.5.3
Build           : 53
```

## 6 — Recovery transaksi BRI yang SUDAH SUCCESS

Tidak perlu membuat transaksi baru.

Buka kembali halaman status Payment BRI yang masih `PENDING`, lalu tekan:

```text
Sinkronkan Status
```

KIA akan:

```text
payment token
→ payment_id exact
→ DOKU Check Status API
→ SUCCESS
→ 09_PAYMENTS = PAID
→ 08_DONATIONS = PAID
→ 21_PROGRAM_STATS update
→ 23_LIVE_DONATIONS update
→ 15_FT_SYNC enqueue
```

DOKU menyarankan Check Status dipanggil setelah ±60 detik; backend v0.5.3 menerapkan guard tersebut.

## 7 — Test Ganti Metode

Pada Donation PENDING:

```text
Payment Attempt #1 = metode lama
→ Ganti Metode
→ pilih metode berbeda
→ Payment Attempt #2 tampil LANGSUNG
```

Target:

- `donation_id` tetap sama;
- `payment_id` berbeda;
- `attempt_no` naik;
- metode aktif langsung berubah di UI;
- attempt lama tetap tersimpan di `09_PAYMENTS`.

## 8 — Auto reconciliation

Selama Render aktif, backend memeriksa payment DOKU `PENDING` secara berkala.
Ini fallback, bukan pengganti webhook.

Urutan keandalan:

```text
1. Webhook DOKU
2. Check Status saat halaman status dibuka / tombol Sinkronkan Status
3. Auto reconciliation backend
```
