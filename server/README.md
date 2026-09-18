# KIA Backend v0.5.10 Build 511

Runtime: Node.js / Render.
Root Directory di Render: `server`.
Build: `npm install`.
Start: `node server.js`.

Build 511 sudah mengintegrasikan langsung:
- Account Profile API
- Pending Donation / resume payment API
- Active payment quick-status reconciliation
- DOKU/webhook/payment engine sebelumnya tetap dipertahankan

## Cara deploy
Timpa langsung isi folder `server/` di repository dengan:
- `README.md`
- `package.json`
- `server.js`

Tidak ada module tambahan dan tidak perlu edit `server.js` manual.
Tidak ada ENV baru.
Tidak ada perubahan Apps Script / Spreadsheet.
