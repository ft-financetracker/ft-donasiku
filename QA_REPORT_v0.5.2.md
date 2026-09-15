# QA REPORT — KIA v0.5.2

## Static / Contract QA — PASS

Validated:

- Node syntax: `server/server.js`.
- Node syntax: seluruh frontend JavaScript.
- JavaScript syntax: `apps-script/Code.gs`.
- JSON parse: app-version, changelog, manifest.
- App version = `0.5.2`.
- Build = `52`.
- Service Worker = `0.5.2` / cache `kia-v0.5.2`.
- PWA fallback = `0.5.2` / Build 52.
- HTML asset query bumped dari `v=051` ke `v=052`.
- Catalog membaca cache v0.5.2 dan fallback v0.5.1.
- Catalog dapat memakai Landing bootstrap sebagai first-paint seed.
- Catalog safe GET memiliki retry otomatis.
- Payment Status memiliki Ganti Metode.
- Backend memiliki `/api/payments/retry`.
- Apps Script memiliki `createPaymentAttemptFast`.
- Payment attempt dibatasi agar tidak dapat dibuat tanpa batas.
- Donation yang sudah PAID tidak dapat membuat attempt baru.
- Double successful payment tidak menambah program stats dua kali.
- DOKU notify GET = health/probe endpoint.
- DOKU notify HEAD = health/probe endpoint.
- Empty POST probe tidak memproses transaksi.
- Real DOKU POST tetap melewati signature verification.
- Tidak ada migration/sheet/header baru.
- Hero/auth/session/design lock tidak dirombak.

## Runtime yang masih wajib dites setelah deploy

Static QA **tidak** membuktikan hal berikut sampai benar-benar dicoba live:

1. DOKU Back Office menerima Notification URL saat Submit.
2. DOKU Checkout Sandbox menerbitkan payment URL.
3. Simulator DOKU mengirim notification dengan signature yang diterima KIA.
4. Payment + Donation berubah menjadi PAID.
5. Live Donation bertambah tepat satu kali.
6. Semua Program first-load tidak lagi memerlukan F5 pada device/user flow nyata.

Status release sebelum runtime test: **STABLE PATCH CANDIDATE**.  
Rollback baseline tetap: **v0.5.0**.
