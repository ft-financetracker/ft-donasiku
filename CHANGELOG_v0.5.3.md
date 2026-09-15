# KIA v0.5.3 — Payment Reliability & Auto Reconciliation

- Tambah server-side DOKU Check Status API.
- Tombol `Cek Status` menjadi `Sinkronkan Status` dan melakukan inquiry provider saat aman.
- Initial payment page dapat memulihkan payment lama yang tertahan PENDING.
- Auto reconciliation untuk payment DOKU PENDING saat backend aktif.
- Ganti Metode merender Payment Attempt baru langsung tanpa reload.
- Payment Attempt sekarang ditampilkan di halaman status.
- SUCCESS tetap memakai commit idempotent yang sama dengan webhook.
- FAILED/EXPIRED hanya menutup attempt terkait; Donation tetap dapat memiliki attempt berikutnya.
- Apps Script tidak diubah.
