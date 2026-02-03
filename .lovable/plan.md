
# Barcode System Consolidation and Optimization Plan

**Status: ✅ COMPLETE**

This plan addresses the architectural inconsistencies identified in the audit and provides a safe, incremental approach to refactoring the barcode fetching and counter synchronization systems while ensuring production functionality remains intact.

---

## Problem Summary (RESOLVED)

The current codebase has evolved organically, resulting in:

1. **Three parallel barcode management systems** that can diverge:
   - Legacy global state in `db-provider.tsx` (fetches ALL barcodes on login)
   - React Query hooks in `use-barcodes-queries.tsx` (row/park-scoped queries)
   - Offline hooks in `use-offline-barcodes.ts` (IndexedDB + pending state)

2. **Broken statistics after offline sync**: The sync manager inserts barcodes but never updates `daily_scans` or `user_total_scans` counters

3. **Query key collisions**: Both `useRowBarcodes` and `useParkBarcodes` use `['barcodes', id]`, risking cache overwrites

4. **Incomplete offline support**: Only `ADD_BARCODE` is implemented; DELETE and UPDATE mutations are stubbed

5. **Performance bottleneck**: `db-provider.tsx` loads all barcodes globally on login

---

## Implementation Phases

### Phase 1: Fix Query Key Collisions (Low Risk)

**Goal**: Prevent cache collisions between row and park queries

**Changes**:
- `src/hooks/use-barcodes-queries.tsx`:
  - Change `useRowBarcodes` key from `['barcodes', rowId]` to `['barcodes', 'row', rowId]`
  - Change `useParkBarcodes` key from `['barcodes', parkId]` to `['barcodes', 'park', parkId]`
  - Update the `useParkBarcodes` cache-seeding logic to use the new row key pattern
  - Update all mutation hooks (`useAddBarcodeToRow`, `useUpdateRowBarcode`, `useDeleteRowBarcode`, `useResetRowBarcodes`) to use the new key pattern

- Update consumers:
  - `src/hooks/use-offline-barcodes.ts`: Update optimistic update key
  - `src/hooks/use-sync.ts`: Update invalidation queries

**Verification**: All existing barcode displays continue to work; no visual changes expected

---

### Phase 2: Fix Statistics Updates in Sync Manager (Critical)

**Goal**: Ensure `daily_scans` and `user_total_scans` are updated when offline barcodes are synced

**Changes**:
- `src/lib/offline/sync-manager.ts`:
  - After successfully inserting a barcode in `syncAddBarcode`, call a new helper function `updateStatsAfterSync`
  - This helper will:
    1. Upsert into `daily_scans` for the user and date (extracted from the barcode's timestamp)
    2. Call the existing Edge Function `update-user-total-scans` to recalculate `user_total_scans`
  - Group synced barcodes by `userId + date` to batch counter updates efficiently

- Create a new helper in `src/lib/offline/stats-sync.ts`:
  - `incrementDailyScans(userId: string, date: string, count: number)`: Upserts daily_scans
  - `triggerUserTotalScansUpdate(userId: string)`: Calls the Edge Function

**Database interaction**:
```text
For each synced barcode batch:
  1. Group by (userId, date)
  2. For each group: UPSERT daily_scans SET count = count + batchSize
  3. For each unique userId: Call update-user-total-scans Edge Function
```

**Verification**: After syncing offline barcodes, the Profile page and Dashboard should reflect correct totals

---

### Phase 3: Remove Legacy Barcode State from DB Provider (Medium Risk)

**Goal**: Eliminate the global barcode array that loads all barcodes on login

**Changes**:
- `src/lib/db-provider.tsx`:
  - Remove the `barcodes` state and `fetchBarcodes` call from `useEffect`
  - Remove `setBarcodes` from the rows hook integration
  - Keep the `barcodes: Barcode[]` property in the context but return an empty array (for backward compatibility)
  - Mark `searchBarcodes`, `countBarcodesInPark` as deprecated (they rely on the global array)

- `src/lib/hooks/use-barcodes.ts`:
  - This file becomes unused; mark for deletion after consumers are migrated

- `src/lib/types/db-types.ts`:
  - Add JSDoc deprecation notices to barcode-related methods in `DBContextType`

- Update consumers that use `useDB().barcodes`:
  - `src/pages/SearchPage.tsx`: Migrate to a new React Query hook `useSearchBarcodes(query)` that queries Supabase directly
  - `src/lib/hooks/use-stats.ts`: The `getUserTotalScans` and `getUserBarcodesScanned` functions take `barcodes[]` as a parameter; update callers to pass data from React Query or remove if unused

**New file**: `src/hooks/use-search-barcodes.tsx`
```text
- useSearchBarcodes(query: string)
  - Queries Supabase with ILIKE on code column
  - Returns paginated results
  - Disabled when query is empty
```

**Verification**: Login no longer triggers a massive barcode fetch; individual pages still load their barcodes correctly

---

### Phase 4: Implement Offline DELETE and UPDATE Operations (Medium Risk)

**Goal**: Complete the offline queue to support all barcode mutations

**Changes**:
- `src/lib/offline/types.ts`:
  - Already has `DELETE_BARCODE` and `UPDATE_BARCODE` types (no changes needed)

- `src/lib/offline/barcode-queue-service.ts`:
  - Add `queueBarcodeDelete(barcodeId: string, rowId: string, userId?: string)`
  - Add `queueBarcodeUpdate(barcodeId: string, newCode: string, rowId: string)`

- `src/lib/offline/sync-manager.ts`:
  - Implement `syncDeleteBarcode`:
    1. Delete from Supabase
    2. Decrement daily_scans for the barcode's date
    3. Trigger user total scans update
  - Implement `syncUpdateBarcode`:
    1. Update the barcode's code in Supabase
    2. No counter changes needed

- `src/hooks/use-offline-barcodes.ts`:
  - Add `useOfflineDeleteBarcode` hook
  - Add `useOfflineUpdateBarcode` hook
  - Update `mergeBarcodesWithPending` to handle DELETE mutations (filter out deleted IDs)
  - Update `mergeBarcodesWithPending` to handle UPDATE mutations (apply code changes)

- Update UI consumers:
  - `src/pages/RowDetail.tsx`: Use offline-aware delete/update hooks
  - `src/components/dialog/add-barcode-dialog.tsx`: Already uses online mutation (consider offline support later)

**Verification**: Deleting/updating barcodes while offline queues them; syncing applies changes and updates counters

---

### Phase 5: Unify Barcode Fetching Pattern (Low Risk)

**Goal**: Establish a single, consistent pattern for fetching barcodes across the app

**Changes**:
- Create `src/hooks/use-barcodes.tsx` (new consolidated file):
  - Export `useRowBarcodes` (from queries)
  - Export `useParkBarcodes` (from queries)
  - Export `useOfflineAwareRowBarcodes` - combines `useRowBarcodes` + `useMergedBarcodes`
  - Export `useAddBarcode`, `useDeleteBarcode`, `useUpdateBarcode` - offline-first versions

- Update imports across all consumers to use the new consolidated file:
  - `src/pages/ScanRowPage.tsx`
  - `src/pages/RowDetail.tsx`
  - `src/pages/ScanParkPage.tsx`
  - `src/components/scan/BarcodeScanInput.tsx`
  - `src/components/dialog/add-barcode-dialog.tsx`
  - `src/components/parks/park-card.tsx`

**Verification**: All barcode operations route through a single, well-documented module

---

### Phase 6: Add Sync Indicators for Offline DELETE/UPDATE (Polish)

**Goal**: Visual feedback for pending deletes and updates

**Changes**:
- `src/lib/offline/types.ts`:
  - Add `isDeleting?: boolean` to `OfflineBarcode`
  - Add `pendingCode?: string` to `OfflineBarcode` for pending updates

- `src/components/scan/RecentScans.tsx`:
  - Show strikethrough or red indicator for pending deletes
  - Show amber indicator for pending updates

- `src/pages/RowDetail.tsx`:
  - Disable edit/delete buttons for items with pending operations
  - Show sync status icon per row

---

## Rollout Strategy

Each phase is designed to be independently deployable:

| Phase | Risk | Estimated Effort | Dependencies |
|-------|------|------------------|--------------|
| 1 | Low | 1 hour | None |
| 2 | Medium | 2 hours | None |
| 3 | Medium | 3 hours | Phase 1 |
| 4 | Medium | 4 hours | Phase 2 |
| 5 | Low | 2 hours | Phases 1, 3, 4 |
| 6 | Low | 1 hour | Phase 4, 5 |

**Recommended order**: Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 -> Phase 5 -> Phase 6

---

## Testing Checklist

After each phase, verify:

- [ ] Login/logout works normally
- [ ] Parks list displays correct barcode counts
- [ ] Row scanning adds barcodes (online)
- [ ] Row scanning adds barcodes (offline, then sync)
- [ ] Profile page shows correct daily and total scans
- [ ] Dashboard shows correct totals for managers
- [ ] Row detail page displays and paginates barcodes
- [ ] Barcode edit/delete works in Row detail
- [ ] Search page finds barcodes (after Phase 3)
- [ ] Sync button shows correct pending count
- [ ] Sync completes without errors

---

## Technical Details

### New Query Key Structure (Phase 1)
```text
['barcodes', 'row', rowId]     - Row-scoped barcodes
['barcodes', 'park', parkId]   - Park-scoped barcodes
['barcodes', 'search', query]  - Search results (Phase 3)
```

### Stats Sync Flow (Phase 2)
```text
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  executeSync()  │───>│ syncAddBarcode  │───>│ updateStats     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                      │
                        ┌─────────────────────────────┼─────────────────────────────┐
                        │                             │                             │
                        ▼                             ▼                             ▼
                 ┌─────────────┐             ┌─────────────┐             ┌─────────────┐
                 │ daily_scans │             │ user_total_ │             │ Invalidate  │
                 │   UPSERT    │             │ scans Edge  │             │   queries   │
                 └─────────────┘             └─────────────┘             └─────────────┘
```

### Merged Barcodes Flow (Phase 4-5)
```text
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Server data │ ──> │   Merge     │ ──> │ Final list  │
│ (RQ cache)  │     │  function   │     │ for display │
└─────────────┘     └─────────────┘     └─────────────┘
       ↑                   ↑
       │                   │
┌─────────────┐     ┌─────────────┐
│  Supabase   │     │  IndexedDB  │
│   query     │     │   queue     │
└─────────────┘     └─────────────┘
```

---

## Files to Create

1. `src/lib/offline/stats-sync.ts` - Stats update helpers for sync
2. `src/hooks/use-search-barcodes.tsx` - Search query hook
3. `src/hooks/use-barcodes.tsx` - Unified barcode hooks export

## Files to Modify

1. `src/hooks/use-barcodes-queries.tsx` - Query key changes
2. `src/hooks/use-offline-barcodes.ts` - Key updates, new hooks
3. `src/hooks/use-sync.ts` - Invalidation key updates
4. `src/lib/offline/sync-manager.ts` - Stats updates, DELETE/UPDATE impl
5. `src/lib/offline/barcode-queue-service.ts` - New queue functions
6. `src/lib/db-provider.tsx` - Remove legacy barcode state
7. `src/pages/RowDetail.tsx` - Use offline-aware hooks
8. `src/pages/SearchPage.tsx` - Use new search hook
9. `src/components/scan/RecentScans.tsx` - Offline status indicators

## Files to Delete (After Migration)

1. `src/lib/hooks/use-barcodes.ts` - Replaced by React Query hooks
