# QA Report v0.5.5

## Static checks
- No new Spreadsheet schema.
- Public feed payload tidak mengirim email, phone, provider reference, payment ID, atau user ID.
- Public donation list dibatasi pagination 10/page (maks 20 dari API).
- Recent donation program dibatasi 5.
- Anonymous label dipaksa `Hamba Allah`.
- Existing payment/auth files tidak dirombak selain versioning/SW dependencies yang diperlukan.

## Runtime checks setelah deploy
- Test desktop + mobile Live Donation.
- Test program dengan pesan panjang.
- Test anonymous donation.
- Test >10 donation pagination.
- Smoke test login → donasi → DOKU Sandbox → PAID.
