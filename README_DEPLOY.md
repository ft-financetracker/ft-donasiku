# Deploy KIA v0.5.7

## 1. Apps Script

1. Replace `apps-script/Code.gs`.
2. Save.
3. Jalankan `migrateKiaV057()` **SATU KALI**.
4. Pastikan migration selesai dengan status `READY`.
5. Deploy -> Manage deployments -> Edit deployment lama -> New version -> Deploy.
6. URL `/exec` harus tetap sama.

`migrateKiaV057()` menambah kolom secara additive pada `23_LIVE_DONATIONS` dan `24_DONATION_REACTIONS`, kemudian backfill metadata sosial. Tidak membuat ulang Payment/Donation.

**Jangan** menjalankan ulang `migrateKiaV051()`, `migrateKiaV056()`, atau `setupKiaDatabase()` pada database production lama.

## 2. GitHub

Upload/replace **isi** folder `github/` ke root repository `ft-financetracker/ft-donasiku`. Jangan upload folder `github/` sebagai folder dan jangan hapus file repo lain.

## 3. Backend / Render

Replace isi folder `server/` ke `server/` repository, commit ke `main`, lalu tunggu Render `Deploy successful`.

Tidak ada environment variable baru untuk v0.5.7.

## 4. Verifikasi

- `/health` -> `version: 0.5.7`
- Info Aplikasi -> `v0.5.7`, Build `57`
- Login akun lama dan ukur login pertama + login kedua.
- Program Ringkasan donor feed desktop -> minimum 2 baris per row.
- Semua Donasi desktop -> 1 baris per row.
- Badge: Tamu / Akun KIA / Terverifikasi / Anonim.
- Donasi Tamu/Anonim -> tidak clickable, tidak dapat Love/Doa.
- Donasi Akun KIA/Terverifikasi -> Timeline terbuka, Love dan Doa dapat digunakan setelah login.
- Lakukan smoke test Donasi -> DOKU -> PAID untuk memastikan payment engine tidak regresi.
