# KIA Backend v0.5.10 Build 512 — Phase C

Full replacement server.

Phase C adds:
- fast checkout shell: browser tidak menunggu DOKU create selesai
- background DOKU channel preparation
- safe channel recovery using a new Payment Attempt on the same Donation
- avatar profile upload
- draft program archive/delete

Deploy by replacing `server.js`, `package.json`, and `README.md` in the Render server folder.
No new ENV. No Apps Script migration.
