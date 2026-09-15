# Deploy KIA v0.5.5

## Apps Script
1. Replace `apps-script/Code.gs`.
2. Save.
3. **Tidak ada migration.**
4. Deploy → Manage deployments → Edit deployment lama → New version → Deploy.
5. Pertahankan URL `/exec` yang sama.

## GitHub
Upload/replace **isi** folder `github/` ke root repository. Jangan upload folder `github/` sebagai subfolder dan jangan hapus file lain.

## Render
Replace `server/server.js` dan file server yang tersedia. Commit ke `main`, lalu tunggu auto-deploy.

## Test urut
`/health=0.5.5` → Info v0.5.5 build 55 → Live Donation → Program detail (5 item) → Lihat Semua Donasi → pagination → smoke test payment.
