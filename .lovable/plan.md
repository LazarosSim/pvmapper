

# Plan: Streamline Offline Workspace -- Structure-Only Caching

## Current Behavior

When preparing for offline work, the app downloads:
1. Park metadata
2. All rows in the park
3. **All barcodes for every row** (the slowest and most unnecessary step)

After syncing, the workspace status resets and the user must re-enter offline mode to continue working on the same park.

## New Behavior

1. **Prefetch only park metadata and row structure** (with counts). Skip barcode downloads entirely -- you only need empty rows to scan into.
2. **Cache row structure indefinitely** until the user explicitly switches parks or clears the workspace.
3. **After sync, remain workspace-ready** -- the row structure is already cached, so there is no need to re-prepare.

---

## Changes

### 1. Remove Barcode Prefetching from Workspace

**File: `src/hooks/use-workspace.ts`**

- Remove the entire "Stage 3: Prefetch barcodes for every row" loop (lines 208-249)
- Remove the `loadBarcodesByRow` helper function (no longer needed)
- Remove `Barcode` from the type import
- Update the progress stages: remove `'barcodes'` stage, keep only `'park' | 'rows' | 'complete'`
- After fetching rows, also prefetch each individual row by ID (for ScanRowPage's `useRow` hook) -- this is already done inside the loop, so just keep that part
- Mark workspace as ready immediately after rows are fetched and individual row data is cached

### 2. Keep Workspace Ready After Sync

**File: `src/hooks/use-sync.ts`**

- After a successful sync, do NOT invalidate row structure queries (`['rows', 'park', ...]` and `['rows', 'single', ...]`). These represent the park structure which should persist.
- Only invalidate barcode-related queries and park-level count queries so counters refresh.
- The existing `queryClient.invalidateQueries({ queryKey: ['rows'] })` currently invalidates ALL row caches. Change this to only invalidate row count data by refetching rows (which updates `currentBarcodes`) without removing the cached structure.

### 3. Determine Workspace Readiness from Cache

**File: `src/hooks/use-workspace.ts`**

- On mount, if a workspace park ID exists in localStorage, check if the React Query cache already has data for `['rows', 'park', parkId]`. If so, mark `isPrefetched: true` immediately -- no need to re-download.
- This means after sync + app restart, the workspace is still ready because the row structure persists in localStorage via the query persister.

### 4. Update WorkspaceSelector UI

**File: `src/components/WorkspaceSelector.tsx`**

- Remove references to "barcodes" in progress labels (line 76: "Downloading barcodes..." becomes unnecessary)
- Simplify progress calculation: park = 30%, rows = 70%, complete = 100%
- Update description text: "All rows and barcodes will be downloaded" -> "Park structure and row layout will be downloaded"

---

## Technical Details

### Modified Prefetch Flow

```text
Before:                          After:
1. Fetch park metadata           1. Fetch park metadata
2. Fetch all rows                2. Fetch all rows
3. For EACH row:                 3. For EACH row:
   a. Fetch row details             a. Fetch row details (for ScanRowPage)
   b. Fetch ALL barcodes         4. Done! Workspace ready.
4. Done! Workspace ready.
```

### Cache Persistence After Sync

```text
Before:                          After:
Sync complete ->                 Sync complete ->
  invalidate ['rows']              invalidate ['barcodes', 'row']
  invalidate ['barcodes', 'row']   invalidate ['barcodes', 'park']
  invalidate ['barcodes', 'park']  invalidate ['parks']
  invalidate ['parks']             refetch ['rows'] (update counts only)
  User must re-prepare             Workspace remains ready
```

### Workspace Readiness on Mount

```text
App starts ->
  Read parkId from localStorage ->
  Check queryClient.getQueryData(['rows', 'park', parkId]) ->
  If data exists: isPrefetched = true (no network needed)
  If no data: isPrefetched = false (user must click Prepare)
```

---

## Files Summary

| File | Change |
|------|--------|
| `src/hooks/use-workspace.ts` | Remove barcode prefetch stage; check cache on mount for readiness |
| `src/hooks/use-sync.ts` | Preserve row structure cache after sync; only refresh counts |
| `src/components/WorkspaceSelector.tsx` | Update progress labels and description text |

