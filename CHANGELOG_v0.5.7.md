# Changelog v0.5.7

## Fixed

- Ringkasan program tidak lagi memakai desktop one-line donor row; sekarang minimum 2 baris agar hierarchy lebih jelas.
- Badge `Umum` yang ambigu diganti dengan semantics akun yang eksplisit.
- Guest/no-account donation tidak lagi dapat menjadi target Love/Doa.
- Anonymous donation tetap `Hamba Allah` dan social interaction dimatikan.
- Love/Doa tidak lagi melakukan beberapa round-trip Spreadsheet terpisah.
- Timeline tidak lagi selalu membuka spinner kosong; seed/cache tampil terlebih dahulu dan refresh berjalan di background.
- Love dan Doa menggunakan optimistic update sehingga user tidak menunggu reload timeline penuh setelah write.
- Login cold-start tidak lagi memicu full-table user warm scan.
- Login session sekarang dipersist dahulu sebelum token dikembalikan, menghindari race login-success tetapi dashboard belum mengenali session.

## Badge semantics

- `Tamu`: donasi tidak terhubung akun login KIA.
- `Akun KIA`: donasi terhubung akun KIA, tetapi profil identitas belum `APPROVED`.
- `Terverifikasi`: akun KIA dengan `02_USER_PROFILES.identity_status = APPROVED`.
- `Anonim`: donor memilih anonim; publik tampil `Hamba Allah`.

Semua item yang muncul pada donor feed tetap berasal dari donasi berstatus PAID/tervalidasi. Badge di atas menjelaskan identitas akun, bukan status pembayaran.
