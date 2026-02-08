

# Plan: Fix Offline Barcode Editing Display and Counter Accuracy

## Issues Identified

### 1. Build Error (Blocking)
`src/hooks/use-workspace.ts` line 52 sets `createdBy` on a `Park` object, but the imported `Park` type from `src/lib/types/db-types.ts` has `userId` instead. This must be fixed first.

### 2. Editing Offline Barcode Not Displayed Until Sync
When a user edits a barcode that was scanned offline, the change appears briefly (optimistic cache update) but then reverts because `useMergedBarcodes` re-runs and reconstructs from IndexedDB. The merge logic in `mergeBarcodesWithPending` only applies pending UPDATE_BARCODE mutations to **server barcodes**, not to **pending adds**.

**Current flow:**
```text
1. Barcode "ABC" scanned offline -> queued as ADD_BARCODE
2. User edits "ABC" to "XYZ" -> queued as UPDATE_BARCODE
3. Optimistic cache update shows "XYZ" briefly
4. useMergedBarcodes re-merges from IndexedDB:
   - Pending adds: still shows "ABC" (original ADD_BARCODE)
   - Pending updates: only checked against server barcodes
5. Display reverts to "ABC"
```

### 3. Row and Park Card Counters Ignore Offline Mutations
- **Row cards** (`row-card.tsx` line 51): Display `row.currentBarcodes` from the database, which does not include pending offline adds or reflect pending deletes.
- **Park cards** (`park-card.tsx` line 61): Display `park.currentBarcodes` from the `park_stats` view, same issue.
- **ScanParkPage** (line 183): Uses `countBarcodesInRow(row.id)` from `useDB()`, which relies on the deprecated global rows state (no longer populated since `fetchRows` was removed).

---

## Solution

### Phase 1: Fix Build Error

**File: `src/hooks/use-workspace.ts`**
- Change `createdBy: data.created_by || ''` to `userId: data.created_by || ''` to match the `Park` type from `db-types.ts`.

### Phase 2: Fix Offline Edit Display in mergeBarcodesWithPending

**File: `src/hooks/use-offline-barcodes.ts`**

Update `mergeBarcodesWithPending` to also apply pending updates to pending adds:

```text
Current logic:
  1. Get pending adds, deletes, updates
  2. Process server barcodes (apply updates + mark deletes)
  3. Combine server + pending adds
  4. Sort

Fixed logic:
  1. Get pending adds, deletes, updates
  2. Process server barcodes (apply updates + mark deletes)
  3. Process pending adds (apply updates to them too)
  4. Combine server + updated pending adds
  5. Sort
```

The key change is adding step 3: iterating pending adds and checking if any UPDATE_BARCODE mutation targets them (matching by `barcodeId`). If so, update the displayed code.

### Phase 3: Create an Offline-Aware Counter Hook

**New file: `src/hooks/use-offline-counts.ts`**

Create a hook `useOfflineAdjustedCounts` that:
1. Reads the offline queue from IndexedDB
2. Computes per-row adjustments: `+1` for each pending ADD_BARCODE, `-1` for each pending DELETE_BARCODE
3. Aggregates per-park adjustments from row adjustments
4. Returns functions: `getRowCountAdjustment(rowId)` and `getParkCountAdjustment(parkId)`
5. Refreshes periodically (every 2 seconds, matching `usePendingCount`)

### Phase 4: Update Row Card to Use Offline-Aware Counter

**File: `src/components/rows/row-card.tsx`**

- Import `useOfflineAdjustedCounts`
- Change barcode count display from `row.currentBarcodes` to `row.currentBarcodes + adjustment`
- Show a small indicator when there are pending offline changes

### Phase 5: Update Park Card to Use Offline-Aware Counter

**File: `src/components/parks/park-card.tsx`**

- Import `useOfflineAdjustedCounts`
- Adjust `currentBarcodesSafe` to include offline adjustment
- Recalculate progress based on adjusted count

### Phase 6: Fix ScanParkPage Counter

**File: `src/pages/ScanParkPage.tsx`**

- Replace `countBarcodesInRow(row.id)` (from deprecated `useDB()`) with `row.currentBarcodes + adjustment` using the new offline-aware hook
- Remove the `countBarcodesInRow` import from `useDB()`

---

## Technical Details

### Offline Counter Hook Design

```typescript
// src/hooks/use-offline-counts.ts

export const useOfflineAdjustedCounts = () => {
  // State: Map<rowId, adjustment>
  // Reads from IndexedDB queue periodically
  
  // For each pending ADD_BARCODE: rowAdjustments[rowId] += 1
  // For each pending DELETE_BARCODE: rowAdjustments[rowId] -= 1
  // UPDATE_BARCODE doesn't change counts
  
  return {
    getRowAdjustment: (rowId: string) => number,
    getParkAdjustment: (parkId: string, rows: Row[]) => number,
    hasPendingChanges: boolean,
  };
};
```

### mergeBarcodesWithPending Fix

The fix applies pending updates to pending adds by checking `barcodeId` matches:

```typescript
// After getting pendingAdds, apply any UPDATE_BARCODE mutations
const updatedPendingAdds = pendingAdds.map(add => {
  const updatedCode = pendingUpdates.get(add.id);
  if (updatedCode) {
    return { ...add, code: updatedCode, pendingCode: updatedCode };
  }
  return add;
});
```

---

## Files Summary

| File | Change |
|------|--------|
| `src/hooks/use-workspace.ts` | Fix `createdBy` -> `userId` build error |
| `src/hooks/use-offline-barcodes.ts` | Apply pending updates to pending adds in merge |
| `src/hooks/use-offline-counts.ts` | **New** - Offline-aware counter adjustment hook |
| `src/components/rows/row-card.tsx` | Use adjusted counter |
| `src/components/parks/park-card.tsx` | Use adjusted counter |
| `src/pages/ScanParkPage.tsx` | Replace deprecated `countBarcodesInRow` with adjusted counter |

---

## Testing Checklist

- [ ] Build error resolved - app compiles without errors
- [ ] Scan a barcode offline, then edit it from Home > Row Detail - the new code should display immediately without syncing
- [ ] Scan barcodes offline - row card counter should increase on Home and Scan navigation
- [ ] Delete a barcode offline - row card counter should decrease
- [ ] Park card total should reflect offline adds/deletes
- [ ] After syncing, counters should still be accurate (adjustments reset to 0)
- [ ] While online with no pending changes, counters should match database values exactly

