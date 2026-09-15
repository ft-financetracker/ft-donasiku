# KIA v0.5.3 — PAYMENT RELIABILITY

Patch ini fokus khusus pada masalah pembayaran yang ditemukan saat Sandbox:

1. DOKU sudah `SUCCESS`, tetapi KIA / Spreadsheet masih `PENDING`.
2. Webhook/IPN tidak boleh menjadi satu-satunya jalur update status.
3. `Ganti Metode` harus benar-benar pindah ke Payment Attempt baru.
4. Satu Donation boleh memiliki beberapa Payment Attempt, tetapi hanya dihitung satu kali sebagai donasi berhasil.

## Arsitektur recovery

```text
DOKU WEBHOOK
   │
   ├── masuk → commit PAID
   │
   └── hilang/gagal
            ↓
     Check Status API
            ↓
       reconcile PAID
```

KIA v0.5.3 memakai DOKU Check Status API server-side untuk memulihkan payment `PENDING`.
Status `SUCCESS` masuk ke engine `commitDokuPaymentFast` yang sama dengan webhook agar Program Stats, Live Donation, Donor Progress, dan FT Sync tetap konsisten.

## Apps Script

Tidak ada perubahan `Code.gs` pada patch ini.

Business logic baru DOKU tetap berada di backend Render/GitHub sesuai Architecture Lock.
Apps Script tetap Spreadsheet Data Gateway.

## File patch

```text
github/
├── app-version.json
├── app.html
├── changelog.json
├── service-worker.js
└── assets/js/
    ├── payment-v050.js
    └── pwa-v040.js

server/
├── server.js
├── package.json
└── .env.example
```
