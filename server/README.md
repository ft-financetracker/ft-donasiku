# KIA Backend v0.5.10 Build 520 — Avatar Identity Sync

Full replacement server based on stable Build 515.

Build 520 only adds profile avatar synchronization:
- POST `/api/account/avatar-icon`
- Material icon selection stored in existing `02_USER_PROFILES.avatar_url` as `material:<icon>`
- uploaded photo continues using normal URL
- public and social response caches are cleared after avatar change

No Spreadsheet schema change.
No Apps Script migration.
No Payment/DOKU change.
