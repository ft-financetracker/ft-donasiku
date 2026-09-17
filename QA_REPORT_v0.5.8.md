# QA Report v0.5.8

## Static checks
- `server/server.js`: syntax OK.
- `apps-script/Code.gs`: syntax OK via Node syntax check copy.
- seluruh JS patch: syntax OK.
- version sync: frontend/backend/Apps Script/PWA = 0.5.8; Build 58.

## Architecture checks
- Payment != Donation tetap dipertahankan.
- PAID tetap server-verified; browser polling tidak menetapkan PAID sendiri.
- Social write tetap account-only dan target donation harus social-enabled.
- Love/Doa masing-masing satu compound Apps Script write action.
- Room Donasi membaca materialized `23_LIVE_DONATIONS` dan tidak membuka data kontak/payment secret.

## Runtime yang wajib dites setelah deploy
- Apps Script cold/warm latency.
- DOKU callback + auto status detect.
- Hero 3 CMS -> payment hero.
- Print dialog pada desktop/mobile browser.
