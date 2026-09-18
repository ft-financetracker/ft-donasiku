# KIA Backend v0.5.10 Build 515 — Program Lifecycle

Full replacement server based on stable Build 514 backend.

Build 515 changes only Program Lifecycle:
- POST /api/programs/:id/lifecycle
  - STOP_DONATION: ACTIVE -> PAUSED
  - RESUME_DONATION: PAUSED -> ACTIVE
  - COMPLETE_PROGRAM: PAUSED -> COMPLETED
- checkout rejects new donations unless program status is ACTIVE
- existing PAID donations and Dana Lebih remain untouched

No Apps Script migration.
No Spreadsheet schema change.
No DOKU/Payment engine changes.
