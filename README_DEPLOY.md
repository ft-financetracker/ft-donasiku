# DEPLOY KIA v0.5.2 — STEP BY STEP

> v0.5.0 tetap disimpan sebagai rollback baseline.  
> v0.5.2 tidak menambah sheet/header baru.

## 1. Apps Script

1. Buka Apps Script KIA.
2. Replace seluruh `Code.gs` dengan:

```text
apps-script/Code.gs
```

3. Save.
4. **Jangan jalankan `setupKiaDatabase()`.**
5. Jika `migrateKiaV051()` sudah pernah berhasil pada upgrade v0.5.1, **tidak perlu menjalankan migration lagi**.
6. Deploy:

```text
Deploy
→ Manage deployments
→ deployment lama
→ Edit
→ New version
→ Execute as: Me
→ Who has access: Anyone
→ Deploy
```

Pertahankan URL `/exec` yang sama.

## 2. GitHub — upload lengkap

Repository:

```text
ft-financetracker/ft-donasiku
```

**Penting:** kali ini replace **seluruh ISI folder `github/` ke ROOT repo**, termasuk:

```text
app-version.json
service-worker.js
changelog.json
info.html
assets/js/pwa-v040.js
```

Ini mencegah kasus backend sudah versi baru tetapi Info Aplikasi masih membaca versi lama.

Lalu replace folder:

```text
server/
```

Commit ke `main`.

## 3. Render

Tidak perlu membuat service baru. Tunggu auto-deploy dari GitHub.

Environment yang sudah ada tetap dipertahankan:

```text
KIA_PUBLIC_APP_URL=https://ft-financetracker.github.io/ft-donasiku
KIA_DOKU_ENV=sandbox
KIA_DOKU_CLIENT_ID=<secret di Render>
KIA_DOKU_SECRET_KEY=<secret di Render>
```

Jangan kirim secret ke chat / GitHub.

## 4. Cek versi

Render:

```text
https://ft-donasiku.onrender.com/health
```

Target:

```text
0.5.2
```

Info Aplikasi target:

```text
Versi Terpasang : v0.5.2
Versi Terbaru   : v0.5.2
Build           : 52
Status          : Sudah terbaru
```

## 5. DOKU Notification URL

Gunakan endpoint yang sama:

```text
https://ft-donasiku.onrender.com/api/payments/doku/notify
```

v0.5.2 menambahkan response aman untuk health/probe URL. Setelah Render v0.5.2 aktif, buka kembali:

```text
DOKU Sandbox
→ Settings
→ Payment Settings
→ QRIS
→ Edit
→ Notification URL
→ Submit
```

Jika DOKU tetap menolak saat Submit, catat pesan error persis dari Back Office. Jangan mengubah endpoint secara acak.

## 6. Smoke test

Gunakan `CHECKPOINT_v0.5.2.md`. Fokus utama:
- Semua Program tidak perlu F5;
- Ganti Metode membuat payment attempt baru;
- DOKU notification URL dapat disimpan;
- PAID memperbarui Live Donation tepat satu kali.
