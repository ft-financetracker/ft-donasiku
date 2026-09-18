# CHECKPOINT — KIA v0.5.9

**Version:** 0.5.9  
**Build:** 59  
**Baseline:** v0.5.8 Build 58  
**Scope:** Instant Social + Target Completion only

## LOCK
- UI/design foundation v0.5.8 dipertahankan.
- Payment/DOKU foundation tidak diubah.
- Tidak ada sheet/header baru.
- Tidak ada migration Apps Script.
- Program tetap dapat menerima donasi setelah target; kelebihan dijelaskan sebagai Dana Lebih.
- Progress visual maksimal 100%.
- Transparansi tetap boleh menampilkan nilai bruto tervalidasi.

## Social v0.5.9
- Love/unlove: instant local state + background persistence.
- Timeline Love: ikut berubah langsung.
- Server timeout: tidak langsung rollback.
- Reconcile sebelum retry bila hasil write tidak pasti.
- Doa/pesan: optimistic + pending/failed/retry.
- Tidak reload seluruh Timeline setelah aksi.

## Target Completion v0.5.9
- Target belum penuh + donasi melebihi sisa → split preview.
- Target sudah penuh → seluruh donasi baru menjadi Dana Lebih secara preview.
- Card landing, catalog, detail → cap `100% SELESAI`.
- `Terkumpul` publik maksimal sebesar target.
- `Transparansi` mempertahankan gross PAID.

## Backend
Tidak ada perubahan business logic backend yang diperlukan untuk fitur inti ini.
Hanya label version `/health` disarankan naik ke 0.5.9 agar versioning sinkron.
