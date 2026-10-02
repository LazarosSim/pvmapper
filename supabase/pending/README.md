# Database changes waiting for approval

These SQL files are **not** applied automatically: Supabase only applies files in
`supabase/migrations/`. Each one is written against the live schema (checked 2026-10-02)
and works with the app version currently in production, so it can be applied before
the new app version is deployed.

Apply them in order. Once applied, move each file to `supabase/migrations/` with a
timestamped name so the repository matches the database.

| File | What it does | Data changed |
|---|---|---|
| `01_security.sql` | Sign-ups become pending until a manager approves them; users can't change their own role; data is no longer readable without logging in; only approved users read or change data; parks are managed by managers; `reset_row_barcodes` no longer callable by anyone | None (roles of existing accounts are kept) |
| `02_performance.sql` | Adds missing indexes and removes two duplicate count triggers | None |

## Before applying

1. Take a backup (Supabase dashboard → Database → Backups, or `supabase db dump`).
2. Decide what to do with the accounts listed in the review (see `docs/improvement-plan.md`).

## After applying

- Regenerate the TypeScript types (`src/integrations/supabase/types.ts`) so `approve_user`
  appears in them, then remove the cast in `src/hooks/use-pending-users.ts`.
