# KIA Backend v0.5.10 Build 513 — Stability Recovery

Full replacement server.

Build 513:
- returns to the stable payment engine baseline
- filters ARCHIVED drafts from Dashboard bootstrap
- confirms draft archive before returning success
- profile avatar upload
- Hero & Media + Settings enforced for SUPER_ADMIN server-side
- Review Admin remains available to PLATFORM_ADMIN / SUPER_ADMIN

Deploy: replace `server.js`, `package.json`, and `README.md`.
No Apps Script migration. No new ENV.
