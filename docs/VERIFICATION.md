# Verification

Komari Next Pro 3.0.0 release candidate, 2026-09-21.

- 42 Microsoft Edge browser scenarios passed, with 0 unexpected failures.
- 73 data/service tests passed across 13 files.
- Production build and five synthetic-data screenshots verified locally.
- New original default media loaded; image/video background tests passed.
- Public tree and archive checks run through scripts/audit-public.mjs.
- Source ZIP clean rebuild passed: all 298 packaged production files match SHA-256.
- Real isolated Komari 1.5.0 chunked ZIP installation, native routes, missing-asset 404 and rollback passed.

GitHub Actions is configured for Linux/Chromium; remote CI has not run until this candidate is pushed. Production servers were not changed by this preparation.
