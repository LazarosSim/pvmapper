# PV Mapper

XP Energy's app for recording the solar-panel barcodes of a park, row by row. Crews scan with
a phone (hardware scanner or typing), offline as well as online; managers follow progress on
the dashboard and export each park to Excel.

**Lovable project**: https://lovable.dev/projects/72d1b4e5-834d-476c-8cb7-831a0cf3013c

## How it works

- **The phone keeps its own copy** of every active park (parks, rows, barcodes) in IndexedDB
  (`src/lib/local/db.ts`, Dexie). Every screen reads from it, so the app behaves the same with
  or without signal. Archived parks are read from the server when online.
- **Every change goes to the copy and to an outbox** in one step (`src/lib/local/repo.ts`).
  Scans have fixed ids, so uploading again never creates duplicates.
- **Sync** (`src/lib/local/sync.ts`) uploads the outbox in batches and downloads only rows whose
  `version` changed. It runs on start, on reconnect, when the app comes back to the front and
  every minute; shortly after a change only the upload runs. One sync at a time across tabs.
- **Scanning never waits**: the scan screen checks a code in memory, plays the sound and counts
  it at once, then saves it. Screens that re-read after every scan count from the indexes
  instead of reading every barcode. Changes the server
  refuses are set aside and shown in the sync chip in the header, never dropped.
- **The service worker** (`vite-plugin-pwa`, generated at build time) caches only the app
  itself, so it opens without a connection after one online visit. It never caches Supabase
  data.
- **First start of a new version** moves anything left by the previous offline system into
  the outbox (`src/lib/local/legacy-migration.ts`, `src/lib/offline/legacy-sw-rescue.ts`).

Rows themselves (add, rename, delete) and parks are changed on the server, so they need a
connection; barcodes can be added, edited, inserted, deleted and reset offline.

## Getting started

Requires Node 18+.

```sh
npm install
npm run dev        # http://localhost:8080
```

The Supabase project URL and public key are in `src/integrations/supabase/client.ts`.

| Script | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build (adds the service worker) |
| `npm run preview` | Serve the production build |
| `npm test` | Unit and component tests (Vitest, fake IndexedDB) |
| `npm run typecheck` | Strict TypeScript check |
| `npm run lint` | ESLint |

CI runs lint, type check, tests and build on every pull request (`.github/workflows/ci.yml`).

## Database

- Changes live in `supabase/migrations/` and match the live database.
- `supabase/pending/` holds changes written but not applied yet (security rules, a trigger
  cleanup); see its README.
- After a schema change, regenerate `src/integrations/supabase/types.ts`.
- Statistics count the barcodes that currently exist, by date in Greece (`daily_user_scans`,
  `user_stats` views).

## Contributing

- Keep every feature in `docs/feature-checklist.md` working; check them before merging.
- `docs/improvement-plan.md` records the decisions and what is done.
- Screens read through the hooks in `src/lib/local/hooks.ts` and write through
  `src/lib/local/repo.ts`; don't call Supabase for barcodes from components.
- TypeScript is strict and `any` is an error.
- Deploy from Lovable (Share → Publish). The Lovable editor script is only included in
  development builds.
