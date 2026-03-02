
I traced the issue in the current codebase and found why the bug persists:

1) The export you’re using from the home page (`/`) comes from `src/components/parks/park-card.tsx` (confirmed in session replay by clicking the Park card export icon).
2) That export path still sorts worksheet tabs with plain string sort:
- `worksheets.sort((a, b) => a.name.localeCompare(b.name));`
3) That is why you still get `..._1, ..._10, ..._11, ..._2...` in Excel.
4) The previous natural-sort fix was applied in `src/pages/BackupPage.tsx`, but that page is not the export path used from park cards.

Implementation plan to fully fix tab ordering:

1. Fix the active export path in `src/components/parks/park-card.tsx`
- Import and use `naturalCompare`.
- Stop sorting by sanitized tab name with `localeCompare`.
- Sort row sheets by the original row name (`row.name`) using `naturalCompare`, then append in that order.
- Keep Summary pinned first (not mixed into general alphabetical sorting).

2. Make sorting deterministic after sheet-name sanitization/truncation
- Build worksheet entries with metadata:
  - `originalName` (for sorting)
  - `sheetName` (sanitized/truncated Excel tab name)
  - `type` (`summary` | `row`)
- Sort by:
  - Summary first
  - Then `naturalCompare(originalNameA, originalNameB)`
- Add a uniqueness guard for `sheetName` collisions after truncation (e.g., append `_2`, `_3` within 31-char limit) so Excel never reorders/fails due duplicates.

3. Align `src/pages/BackupPage.tsx` to the same shared ordering rule
- It already uses `naturalCompare`, but should use the exact same “sort by original row name + summary first + unique safe name” logic as ParkCard export to avoid future drift.
- This keeps all export entry points consistent.

4. Optional hardening (recommended)
- Extract shared helpers to avoid repeating export logic:
  - `toSafeSheetName(name: string): string`
  - `ensureUniqueSheetName(name, usedNames): string`
  - `sortWorksheetEntries(entries): entries`
- Use these in both `park-card.tsx` and `BackupPage.tsx`.

Validation checklist after implementation:
- Export from Park card (`/`) and verify tab order:
  - `Row_10_1_1, Row_10_1_2, ... Row_10_1_9, Row_10_1_10, ...`
- Verify `Row 10.1_2` appears before `Row 10.1_19`.
- Verify Summary tab remains first.
- Verify long/similar row names do not break due duplicate/truncated tab names.
- Re-test Backup page export to confirm matching behavior across both export flows.

Technical file targets:
- `src/components/parks/park-card.tsx` (primary fix)
- `src/pages/BackupPage.tsx` (consistency fix)
- `src/lib/utils.ts` or a new shared helper file (if extracting common export helpers)
