# Server Version Patch v0.5.9

Fitur v0.5.9 tidak membutuhkan perubahan business logic `server/server.js`.
Agar versioning sinkron, lakukan **dua replacement literal saja** pada `server/server.js`:

```diff
- version:'0.5.8',
+ version:'0.5.9',
```

Ada dua lokasi aktif:
1. response `/health`
2. `platform.version` pada admin bootstrap

Komentar historis yang menyebut `v0.5.8` **jangan diubah**.

`server/package.json` dalam paket ini sudah menjadi `0.5.9`.

Tidak ada environment variable baru.
Tidak ada perubahan DOKU.
Tidak ada perubahan GAS action.
