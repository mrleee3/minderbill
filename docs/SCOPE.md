# Childminder Hours & Invoicing PWA — Scoping Document

**Working title:** MinderBill (placeholder)
**User:** A childminder caring for several children of mixed ages, England
**Goal:** Log hours with near-zero daily effort and generate correct, itemised monthly invoices that account for government-funded hours on a term-time-only model.

---

## 1. Core design principle: log by exception

The single biggest input-saver. Each child has a **usual weekly schedule** (e.g. Mon–Wed 8:00–17:30). The app pre-populates every day of the month from that schedule. The childminder only ever touches the exceptions:

- One glance at "Today" → everything as planned → do nothing (auto-confirms at day end, or one tap to confirm).
- Late pickup / early drop-off → adjust the time with a scroll wheel.
- Absence → tap the child, pick a reason chip: **Child sick · Family holiday · Childminder holiday · Childminder sick · Bank holiday · Setting closed · Other**.

A normal month should need under a minute of total input.

## 2. Funding model (England, current scheme)

The engine must model the real entitlement structure, not a single "free hours" number:

- **Universal entitlement:** 570 hrs/yr (15 hrs/wk × 38 weeks) for all 3–4 year olds.
- **Working-families entitlement:** up to 1,140 hrs/yr (30 hrs/wk × 38 weeks) for eligible children from 9 months (post-Sept-2025 expansion).
- **Term-time only delivery** (the friend's model): funded hours apply only during the LA's funded term weeks (~38/yr); holiday weeks are charged fully at the private rate.
- Funding can be **split across up to two providers**, so each child's record stores *funded hours per week with this childminder*, not the national maximum.
- **Her model: parents top up funded hours to a minimum effective rate (~£8/hr).** The engine models this as a configurable **per-funded-hour parent charge** = max(0, minimum effective rate − LA funding rate she receives), shown as its own invoice line with a **configurable label**.
- ⚠️ Compliance note: DfE statutory guidance prohibits *mandatory* top-ups on funded hours — additional charges are supposed to be itemised, in-principle-optional charges for consumables/additional services, and the Jan-2026 itemised-invoice rules exist precisely to surface this. The app should make the line label editable (e.g. "Additional services charge") and it's worth her sanity-checking the framing with her LA. The app models reality; it doesn't police it.
- **Itemised invoices are now expected under DfE statutory guidance (from Jan 2026)** — funded hours shown distinctly from private charges. The app should produce compliant invoices by default; this is a genuine selling point.

### Term calendar
- App ships with editable term dates (per academic year). Defaults seeded from typical LA dates; the childminder confirms/adjusts hers once a year (LAs publish funded-week calendars against the April–March financial year).
- Each week is classified **funded** or **non-funded**; the invoice engine allocates funded hours only in funded weeks.
- UK bank holidays built in (static table, updated with app releases).

## 3. Data model (per child "contract")

- Child: name/initials, DOB (drives entitlement age gates), start date.
- Rates: hourly rate with **effective-from dates** (versioned, so a September rate rise doesn't corrupt old invoices — same pattern as Haematinics Trace's versioned ruleset).
- Usual weekly schedule (per weekday: start/end, or "not attending").
- Funding: funded hrs/week with this setting, funded weeks model (term-time), entitlement type (universal / working families / none), eligibility code + validity dates (optional, for records), **LA funding rate received (£/hr), minimum effective rate (£/hr, ~£8), top-up line label**.
- Policies (per contract, because childminders vary):
  - Child sick → **full rate (her confirmed policy — default)**, half / not charged remain configurable
  - Family holiday → **full rate (her confirmed policy — default)**, half / free-weeks remain configurable
  - Childminder holiday → not charged (default) / retainer %
  - Childminder sick → not charged (default) / configurable
  - Bank holiday → charged / not charged
  - Late pickup fee: £X per 15 min after grace period
- Extras/consumables: **her rate is all-inclusive (confirmed)** — extras engine ships off by default and moves to MVP2 (kept for late fees, trips, and other childminders).
- Parent/payer details: name, email, payment method — **confirmed: bank transfer and Tax-Free Childcare**. Per child, store the TFC payment reference (TFC payments land via NS&I with the child's reference — needed to reconcile which payment is which). Invoice footer shows her bank details and/or a TFC note reminding parents payments take ~1–3 working days to clear from their TFC account.

## 4. Invoice engine (deterministic, explainable)

Follows the Haematinics Trace philosophy: **pure deterministic function over versioned config, with the working shown**.

`invoice = f(daily logs, contract, term calendar, policy config)` — same inputs always produce the same invoice; every line traceable.

Monthly run per child (**confirmed: calendar month, billed in arrears** — generate on/after the 1st for the month just ended):
1. Expand logs → attended hours per day (planned + adjustments).
2. Classify each week funded/non-funded from the term calendar.
3. In funded weeks, allocate up to the child's weekly funded hours — itemised as "Government funded — N hrs" plus the per-hour parent top-up line where configured; remainder at private rate.
4. Apply absence policies per the reason chips.
5. Add extras/consumables and late fees as separate lines.
6. Output: itemised invoice + a **"how this was calculated" trace** (expandable per line — good for parent disputes and for the childminder's own confidence).

Also produce a **monthly/annual income summary** (childminders are self-employed — a self-assessment-ready total of invoiced income, split funded-scheme income vs private income, is a big value-add).

## 5. Invoice output

- Client-side PDF generation (pdf-lib) → iOS share sheet (AirDrop / WhatsApp / Mail to parent).
- Clean template: childminder details, Ofsted reg no., child, period, itemised lines (funded hrs at £0 shown explicitly, chargeable hrs, absences with policy applied, extras), total due, payment details + reference, due date.
- Payment tracking: mark paid / part-paid; unpaid balance carries forward and shows on the next invoice.

## 6. Screens (MVP)

1. **Today** — child cards with planned times; tap to adjust/absence; everything defaults to confirmed.
2. **Month grid** — per child, colour-coded days (attended / adjusted / absence type / funded week shading); tap any day to edit retrospectively.
3. **Invoices** — generate month, preview, share PDF, mark paid; list of past invoices (immutable snapshots — regenerating creates a new version, never silently mutates a sent invoice).
4. **Children** — contracts, rates, schedules, policies.
5. **Settings** — term calendar, business details, backup.

## 7. Tech stack

- **Vite + React + TypeScript**, single-file `index.html` build (Waymark pattern) or standard dist — either way deployed via **GitHub Pages with the CI build workflow** (push source → Actions builds → Pages deploys; update banner with red Restart pill via `version.json`, as proven on Waymark).
- **PWA**: installable to home screen, offline-first (this must work with no signal, mid-school-run). iOS patterns from H@H mobile: safe-area insets, persistent-storage request, optional PIN lock (children's data on a personal phone).
- **Storage: local-first, no backend.** IndexedDB via Dexie. This is deliberate — it's children's personal data plus financial data; keeping it entirely on-device sidesteps GDPR/hosting headaches for a one-user app.
- **Backup/restore**: one-tap JSON export via share sheet (nag monthly), JSON import; CSV export of logs/invoices for spreadsheets. Optional later: the H@H OneDrive JSON sync pattern if she wants a second device.
- **PDF**: pdf-lib in the browser.
- No LLM needed anywhere — fully deterministic.

## 8. Build phases

**MVP1** — contracts + schedules, term calendar, log-by-exception day/month views, invoice engine with funded-hours split + absence policies, PDF invoice via share sheet, JSON backup.

**MVP2** — payments tracking + carried balances, extras/consumables presets and auto-add, late-fee automation, self-assessment income summary, invoice numbering + immutable history, rate-change versioning UI.

**MVP3 (nice-to-haves)** — stretched-funding mode (year-round offer) so the app suits other childminders too, expense logging (food, mileage, toys) for a fuller tax picture, reminders ("invoices due to send", "backup overdue"), and if she likes it: polish for sharing/selling to other childminders (same instinct as PcLock — this is a real underserved niche; existing tools are subscription-heavy nursery software).

## 9. Open questions for the friend

*Answered so far: sickness/family holiday charged at full rate; all-inclusive rate with parents topping up funded hours to ~£8/hr minimum effective; calendar month billed in arrears; parents pay by bank transfer + Tax-Free Childcare; split funding unknown — the design already copes (each child stores funded hrs with her only, so a split just means a smaller number).*

Still needed from her (config values only — none block the build):
1. Her LA's funded term dates and the exact LA funding rate she receives per hour; confirm the £8 minimum figure.
2. Her bank details / TFC references for the invoice footer.
3. Deposits/retainers — wanted or not?
4. Confirm childminder's own holiday/sickness is not charged (assumed default).
