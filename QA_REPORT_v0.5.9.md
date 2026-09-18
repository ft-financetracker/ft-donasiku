# QA Report v0.5.9

## Static QA
- JavaScript baru harus lolos `node --check`.
- JSON version/changelog harus valid.
- Service Worker cache = `kia-v0.5.9`.
- Tidak ada referensi aktif ke `public-v040.js`, `catalog-v040.js`, `program-v040.js`, `donate-v050.js`, atau `donation-social-v058.js` pada halaman yang dipatch.
- File v0.5.8 lama tidak dihapus.

## Runtime QA wajib
1. Love → icon, count, dan Timeline berubah langsung.
2. Unlike → icon, count, dan Timeline berubah langsung.
3. Putus internet saat Love → UI tetap; online kembali → tersinkron otomatis.
4. Simulasikan response write timeout → reconcile tidak melakukan double-toggle.
5. Kirim Doa → langsung muncul `Mengirim…`.
6. Gagal kirim → pesan tidak hilang dan muncul `Coba lagi`.
7. Retry → pesan tersimpan tanpa duplikasi.
8. Target Rp5.000.000, terkumpul Rp4.950.000, donasi Rp100.000:
   - Sisa target Rp50.000
   - Masuk Program Rp50.000
   - Dana Lebih Rp50.000
9. Program sudah target:
   - progress 100%
   - Terkumpul tidak melebihi target
   - cap `100% SELESAI`
   - checkout menjelaskan seluruh donasi berikutnya masuk Dana Lebih.
10. Smoke test Donasi → DOKU → PAID → Live Donation.
11. Desktop/mobile: layout v0.5.8 tidak bergeser di luar elemen baru.
