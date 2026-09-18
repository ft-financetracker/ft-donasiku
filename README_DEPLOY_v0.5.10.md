# Deploy KIA v0.5.10 Phase A

Upload ke root GitHub.

NEW:
- assets/css/v0510-patch.css
- assets/js/donations-v0510.js
- assets/js/catalog-v0510.js
- assets/js/public-v0510.js
- assets/js/program-v0510.js

REPLACE:
- assets/js/donor-impact-v051.js
- index.html
- program.html
- programs.html
- donations.html
- app-version.json
- changelog.json
- service-worker.js

Apps Script/Spreadsheet: tidak ada perubahan.

Backend: business logic tidak berubah. Untuk label versi, ubah dua literal aktif `version:'0.5.9'` menjadi `version:'0.5.10'` pada server/server.js dan package.json ke 0.5.10.
