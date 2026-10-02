# PV Mapper improvement plan

Agreed 2026-10-02. Goal: make the app offline-first, simpler and safer while keeping all
data and every feature.

## Decisions

| Question | Decision |
|---|---|
| What do statistics count? | Barcodes that currently exist (deleted or reset barcodes no longer count) |
| New accounts | Anyone can sign up; a manager approves them before they can see or change data |
| Same barcode in two rows of a park | Warn, but allow |
| What each phone keeps offline | All active (non-archived) parks |

## Target model

- The phone keeps its own copy of every active park (rows and barcodes) in an on-device
  database, refreshed automatically whenever there is signal; only changed rows are downloaded.
- Every screen reads from that copy, so online and offline behave the same.
- Every change is written to the copy and to an outbox in one step; the outbox uploads in the
  background, in batches, and is safe to retry.

This replaces "Prepare for offline", the browser cache of server answers, and the merging of
server data with pending scans on every screen.

The 6 active parks hold about 7,300 barcodes (largest: 4,340), so the on-phone copy is ~1 MB.

## Data protection rules

- Database: back up before any change; only additive changes; nothing deleted.
- Phones: on first launch of each new version, anything waiting is moved into the new outbox,
  including items stuck in "syncing" and writes held by the old service worker.
- An outbox item is removed only after the server confirms it; every scan has a fixed id so
  retries never create duplicates.
- Items the server rejects are set aside and shown, never dropped silently.

## Phases

### Phase 0 — Preparation
- [x] Test runner (Vitest, fake IndexedDB, Testing Library) and first tests
- [x] CI on every pull request: lint, type check, tests, build (`.github/workflows/ci.yml`)
- [x] Live database schema and security rules reviewed (findings below)
- [x] Feature checklist (`docs/feature-checklist.md`)
- [ ] Database backup before applying `supabase/pending/` (owner)

### Phase 1 — Urgent fixes
Security
- [x] Demo-account creation removed from the login page
- [x] "Waiting for approval" screen for pending accounts; managers approve from Dashboard → Users
- [x] Debug logging of every network request removed
- [x] Lovable editor script only in development builds
- [ ] Database rules: `supabase/pending/01_security.sql` (needs approval to apply)
- [ ] Change the passwords of `lazaros` and `antrian` (owner)
- [ ] Decide about the four accounts created on 2026-05-18 (owner)

Data safety
- [x] Service worker generated at build time (`vite-plugin-pwa`); caches only the app itself,
      never Supabase data, never fakes a successful save
- [x] Scans stranded in the old service worker's queue are uploaded (`legacy-sw-rescue.ts`)
- [x] Caches of the old service worker deleted (they held other users' data)
- [x] Items stuck in "syncing" are recovered on startup
- [x] One sync at a time, shared by every screen (and across tabs)
- [x] Online "Reset row" uses the server function and clears the row's unsent scans
- [x] Deleting a row clears its unsent scans (they would block sync forever)

Scan screen
- [x] Input focused on open; focus returns after every action
- [x] Placeholder button no longer re-pressed by the scanner's Enter
- [x] GPS switch works (first barcode of a row)
- [x] Codes trimmed before the duplicate check
- [x] Fast consecutive scans are queued, never merged or dropped
- [x] New scans go after the highest position (no repeated positions)
- [x] "Add" button works (it did nothing; only Enter worked)
- [x] Length validation also applies when the app starts offline
- [x] Scanning is not blocked while a sync runs

Broken features
- [x] "Add row" numbering, "Add subrow" (always failed), and list refresh after
      add/rename/delete/reset
- [x] Profile kept on the device: the app no longer sends users to the login page offline
- [x] Logging out clears cached data, so the next user doesn't see it
- [x] Parks with more than 1000 rows load completely
- [x] "Prepare for offline" no longer makes one request per row

### Phase 2 — Database groundwork
- [ ] Indexes and duplicate trigger removal: `supabase/pending/02_performance.sql`
- [ ] Row version number, bumped by trigger when a row's barcodes change
- [ ] Statistics from existing barcodes, by Greek date (Europe/Athens)
- [ ] Atomic "insert barcode at position" function
- [ ] Duplicate report (codes in several rows, repeated positions); report only

### Phase 3 — Offline-first core
- [ ] On-device database (Dexie): parks, rows, barcodes, outbox
- [ ] Sync engine: batched upload, changed-rows download, automatic triggers, set-aside failures
- [ ] Move queued items from the old queue on first run
- [ ] Pages read from the local copy; remove Prepare-for-offline, merging, polling and
      localStorage cache persistence
- [ ] Browser test: scan offline, reload, reconnect, check the server

### Phase 4 — Consolidate and slim down
- [ ] Remove the old data layer (`DBProvider`, `src/lib/hooks`); one set of types
- [ ] Export from the local copy after a sync; warn about unsent scans; identical files (golden test)
- [ ] Load Excel and chart code on demand; split pages
- [ ] Delete unused pages, hooks and packages

### Phase 5 — Field usability
- [ ] Scan screen: progress, "Row complete → Next row", vibration, bundled sounds,
      inline confirmation, park-wide duplicate warning, GPS in the background
- [ ] One sync status chip; no overlapping buttons
- [ ] Barcode search reachable and working offline
- [ ] Row detail usable offline and on a phone
- [ ] Dashboard fixes

### Phase 6 — Keep it healthy
- [ ] Strict TypeScript; `no-explicit-any` back to an error
- [ ] README and contributor notes

## Live database findings (2026-10-02)

Security
- Parks, rows, barcodes and daily scans were readable without logging in (`SELECT ... true`).
- Any user could update their own profile with no column restriction, i.e. make themselves a manager.
- Sign-up took the role from the request, so anyone could register as a manager.
- Any logged-in user could delete any barcode or row; `reset_row_barcodes` (security definer)
  could be called without logging in.
- `lazaros` (manager, ~63k scans) and `antrian` (user, ~44k scans) are real accounts whose
  passwords were published in the app code.
- Four manager accounts created on 2026-05-18 (`testrecon14360`, `reconrec2018991`,
  `validate2683279`, `cleanupval`) have no scans and look like automated test or probing accounts.

Performance
- `barcodes` (323k rows, 67 MB) has no index on `row_id`; `rows` has none on `park_id`.
- Three triggers recount a row after each scan, two per insert/delete, each reading the whole
  barcodes table.

Data quality (report only, nothing changed)
- Row counts (`rows.current_barcodes`) are all correct.
- Repeated positions within a row: up to 85 per park (caused by the old position bug, now fixed).
- The same code in several rows of a park: 518 in KL 88, 155 in ΑΚΡΙΝΗ, 15 in Test park,
  6 in Park 1, and a few elsewhere.
