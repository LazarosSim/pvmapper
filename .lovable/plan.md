

# Plan: Offline Row Reset and Natural Row Ordering

## Issue 1: Cannot Reset a Row While Offline

**Root cause:** The `useResetRowBarcodes` mutation (in `use-barcodes-queries.tsx`) calls Supabase directly to delete barcodes. When offline, this network call fails silently or throws an error. There is no offline queue support for a "reset row" operation.

**Solution:** When offline, instead of calling Supabase, clear the row's pending barcodes from IndexedDB and the React Query cache locally. When back online, queue individual DELETE operations or simply let the next sync handle it.

The approach:

1. **Detect offline state** in the reset handler (`ScanRowPage.tsx` and `RowDetail.tsx`).
2. **When offline:**
   - Remove all `ADD_BARCODE` mutations for this row from IndexedDB (they haven't been synced yet, so just discard them).
   - Queue `DELETE_BARCODE` mutations for any **server-synced** barcodes that are in the React Query cache for this row.
   - Clear the React Query cache for `['barcodes', 'row', rowId]`.
   - Show a success toast indicating the reset is queued.
3. **When online:** Keep the existing direct Supabase delete behavior (it already works).

**Files to modify:**
- `src/lib/offline/types.ts` -- Add `RESET_ROW` mutation type (or reuse `DELETE_BARCODE` per-barcode)
- `src/lib/offline/offline-queue.ts` -- Add helper: `removeQueuedMutationsByRow(rowId)` to bulk-remove pending adds for a row
- `src/hooks/use-barcodes-queries.tsx` -- Update `useResetRowBarcodes` to handle offline case
- `src/hooks/use-offline-counts.ts` -- Ensure counter adjustments reflect the reset

---

## Issue 2: Rows Appear in Wrong Order

**Root cause:** Row ordering happens in three places, all using simple lexicographic (string) sorting which fails for multi-part numeric names:

| Location | Sorting Method | Problem |
|---|---|---|
| Database query (`use-row-queries.tsx`) | `.order('name', { ascending: true })` | PostgreSQL sorts strings: `"10.1_19"` < `"10.1_2"` because `"1" < "2"` at position 5 |
| `ParkDetail.tsx` grouping | Regex `^Row\s+(\d+)` only captures first integer | Names like `Row 10.1_2` -- the dot makes the regex miss the full number |
| `ScanParkPage.tsx` grouping | Same regex, same problem | Same issue |

**Example of the bug:**
```text
Lexicographic:  10.1_17, 10.1_18, 10.1_19, 10.1_2, 10.1_20
Natural order:  10.1_1, 10.1_2, ..., 10.1_17, 10.1_18, 10.1_19, 10.1_20
```

**Solution:** Implement a natural sort comparison function and apply it everywhere rows are displayed.

### Natural Sort Function

Create a shared utility that splits row names into numeric and non-numeric segments, then compares segments numerically where possible:

```text
"Row 10.1_2"  -> ["Row ", 10, ".", 1, "_", 2]
"Row 10.1_19" -> ["Row ", 10, ".", 1, "_", 19]

Compare segment by segment:
  "Row " == "Row "  -> equal
  10 == 10          -> equal
  "." == "."        -> equal
  1 == 1            -> equal
  "_" == "_"        -> equal
  2 < 19            -> Row 10.1_2 comes first
```

### Where to Apply

1. **Database queries** (`use-row-queries.tsx`, `use-workspace.ts`): Keep `.order('name')` for the DB (can't do natural sort in PostgreSQL easily), but add a **client-side re-sort** after fetching.
2. **ParkDetail.tsx** `groupRows()`: Update regex to capture full numeric identifiers like `10.1` (e.g., `^Row\s+([\d.]+)`), and sort groups using natural comparison.
3. **ScanParkPage.tsx** `groupRows()`: Same fix as ParkDetail.
4. **Within-group sorting**: Replace `suffixA.localeCompare(suffixB)` with the natural sort function so `_2` sorts before `_19`.

**Files to modify:**
- `src/lib/utils.ts` -- Add `naturalCompare(a: string, b: string): number` utility
- `src/hooks/use-row-queries.tsx` -- Add client-side natural sort after query
- `src/hooks/use-workspace.ts` -- Add client-side natural sort after fetch
- `src/pages/ParkDetail.tsx` -- Update `groupRows()` regex and sorting
- `src/pages/ScanParkPage.tsx` -- Update `groupRows()` regex and sorting

---

## Summary of All File Changes

| File | Change |
|---|---|
| `src/lib/utils.ts` | Add `naturalCompare` sort utility |
| `src/lib/offline/offline-queue.ts` | Add `removeQueuedMutationsByRow(rowId)` helper |
| `src/hooks/use-barcodes-queries.tsx` | Offline-aware `useResetRowBarcodes` |
| `src/hooks/use-row-queries.tsx` | Client-side natural sort on query results |
| `src/hooks/use-workspace.ts` | Client-side natural sort on prefetched rows |
| `src/hooks/use-offline-counts.ts` | Account for reset operations in adjustments |
| `src/pages/ParkDetail.tsx` | Fix `groupRows()` regex and use natural sort |
| `src/pages/ScanParkPage.tsx` | Fix `groupRows()` regex and use natural sort |

---

## Testing Checklist

- [ ] Go offline, open a row with scanned barcodes, tap Reset -- barcodes should clear from the UI
- [ ] Go back online, sync -- the reset should persist on the server
- [ ] Verify rows with names like `Row 10.1_1` through `Row 10.1_20` appear in correct numeric order on both Home (ParkDetail) and Scan (ScanParkPage) navigation
- [ ] Verify rows with simple names (`Row 1`, `Row 2`, ..., `Row 10`) also sort correctly
- [ ] Verify subrow suffixes sort correctly: `Row 5_a`, `Row 5_b`, ..., `Row 5_z`

