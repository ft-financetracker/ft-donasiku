# Deploy KIA v0.5.6

1. Apps Script: replace `apps-script/Code.gs`, Save.
2. Jalankan `migrateKiaV056()` **SATU KALI**. Target: `24_DONATION_REACTIONS` dan `25_DONATION_MESSAGES` tersedia.
3. Deploy -> Manage deployments -> Edit deployment lama -> New version -> Deploy. URL `/exec` tetap sama.
4. GitHub: upload/replace **isi** folder `github/` ke root repository. Jangan hapus file lain.
5. Replace isi `server/` ke folder `server/`, commit `main`, tunggu Render auto-deploy.
6. Cek `/health` = `0.5.6`, lalu Info Aplikasi = `0.5.6 Build 56`.

Tidak perlu menjalankan `migrateKiaV051()` lagi dan jangan menjalankan `setupKiaDatabase()` pada database production lama.
