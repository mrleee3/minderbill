# MinderBill

Phone-first PWA for a childminder: log hours by exception, generate itemised
monthly invoices that correctly split government-funded hours (term-time
model), parent top-ups and private hours.

- All data is local-first (IndexedDB) — nothing leaves the device.
- Deterministic invoice engine over versioned config (`src/engine/`), unit
  tested with vitest.
- `app.html` is the build entry. The repo-root `index.html` and `version.json`
  are build artifacts written **only** by CI (`.github/workflows/build.yml`).
  Never commit a local build.
- Deployed via GitHub Pages (deploy from branch, `main` / root).

Full scope: [docs/SCOPE.md](docs/SCOPE.md)
