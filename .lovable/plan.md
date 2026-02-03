

# Plan: Fix Park 1 Data Not Displaying (1000-Row Limit Issue)

## Root Cause

The database contains **2018 rows** total, but the Supabase/PostgREST default limit is **1000 rows per query**. The legacy `fetchRows()` function in `src/lib/hooks/rows/row-operations/fetch-rows.ts` fetches rows with:

```typescript
supabase.from('rows').select('*').order('created_at', { ascending: false })
```

This returns only the newest 1000 rows. Since **Park 1** was created in April 2025 (older data) and all its 21 rows fall **beyond position 1000**, they are silently excluded from the result set.

**Query Analysis:**
- Total rows in database: 2018
- Park 1 rows within first 1000 (by created_at DESC): **0**
- Park 1 rows beyond the limit (excluded): **21**
- Test park rows within first 1000: **14** (all included)

This explains why Test park shows its rows correctly while Park 1 appears empty.

---

## Solution Overview

Replace the global row fetching approach with **on-demand, park-scoped queries** using React Query. This aligns with the existing architecture pattern (already used for barcodes) and eliminates the 1000-row limit problem.

---

## Implementation Plan

### Phase 1: Migrate Row Fetching to React Query (Park-Scoped)

The app already has `useRowsByParkId` in `src/hooks/use-row-queries.tsx`. The problem is that some pages still use the legacy `useDB().getRowsByParkId()` which relies on the globally-fetched `rows` state.

**Pages using legacy pattern (need migration):**
1. `src/pages/ParkDetail.tsx` - Uses `getRowsByParkId` from useDB
2. `src/pages/ScanParkPage.tsx` - Uses `getRowsByParkId` from useDB

**Files to modify:**

1. **`src/pages/ParkDetail.tsx`**
   - Replace `const rows = getRowsByParkId(parkId)` with `const { data: rows, isLoading } = useRowsByParkId(parkId)`
   - Add loading state handling
   - Remove dependency on `parks.some()` for validation (use React Query park data instead)

2. **`src/pages/ScanParkPage.tsx`**
   - Already uses `useParkStats()` for parks
   - Replace `getRowsByParkId(parkId)` with `useRowsByParkId(parkId)`
   - Add loading state for rows

3. **`src/hooks/use-row-queries.tsx`**
   - Add `networkMode: 'offlineFirst'` for offline support
   - Add `staleTime: 30000` for reasonable caching

### Phase 2: Deprecate Global Row Fetching

Once pages are migrated to React Query, the global `fetchRows()` call in DBProvider becomes unnecessary for rows.

**Files to modify:**

1. **`src/lib/db-provider.tsx`**
   - Remove or comment out `await fetchRows(user.id)` in the initialization effect
   - Keep the `rows` state and `getRowsByParkId` for backward compatibility with any remaining legacy code
   - Add deprecation comments

2. **`src/lib/hooks/rows/row-operations/fetch-rows.ts`**
   - Add deprecation notice in comments
   - (Optional) Add pagination if global fetch is still needed elsewhere

### Phase 3: Update Row Query to Handle Edge Cases

**Files to modify:**

1. **`src/hooks/use-row-queries.tsx`**
   - Ensure proper error handling and logging
   - Add `refetchOnMount: 'always'` for data freshness

---

## Technical Details

### Current Data Flow (Broken)

```text
App Start
    │
    ▼
DBProvider.fetchRows()
    │
    ▼
supabase.from('rows').select('*')  ─────► Returns first 1000 rows (oldest excluded)
    │
    ▼
setRows([...1000 rows])  ─────────────────► Park 1's 21 rows NOT included
    │
    ▼
ParkDetail: getRowsByParkId(parkId)
    │
    ▼
rows.filter(r => r.parkId === parkId)  ───► Park 1: 0 matches, Test park: 14 matches
```

### New Data Flow (Fixed)

```text
User navigates to ParkDetail
    │
    ▼
useRowsByParkId(parkId) query starts
    │
    ▼
supabase.from('rows').select(...).eq('park_id', parkId)
    │
    ▼
Returns ALL rows for this park (no 1000 limit issue for single park)
    │
    ▼
Park 1: 21 rows, Test park: 14 rows ✓
```

### Why Park-Scoped Queries Solve This

- Each park query fetches only that park's rows
- Park 1 has 21 rows (well under 1000 limit)
- No cross-park competition for the 1000-row limit
- Queries are cached per-park with React Query

---

## Files Summary

| File | Change |
|------|--------|
| `src/pages/ParkDetail.tsx` | Replace useDB().getRowsByParkId with useRowsByParkId |
| `src/pages/ScanParkPage.tsx` | Replace useDB().getRowsByParkId with useRowsByParkId |
| `src/hooks/use-row-queries.tsx` | Add offlineFirst mode, staleTime |
| `src/lib/db-provider.tsx` | Remove global fetchRows call |

---

## Testing Checklist

After implementation:

- [ ] Open Home page - Both Park 1 and Test park should be visible with correct barcode counts
- [ ] Open Park 1 - Should show all 21 rows
- [ ] Open Test park - Should show all 14 rows
- [ ] Scan page > Park 1 - Should show all 21 rows
- [ ] Verify row counts match database (Park 1: 21, Test park: 14)
- [ ] Test offline behavior - Cached rows should be available

---

## Risk Assessment

| Change | Risk | Mitigation |
|--------|------|------------|
| Replace getRowsByParkId with React Query | Low | useRowsByParkId already exists and works |
| Remove global fetchRows | Medium | Keep rows state for backward compatibility |
| Add loading states | Low | Improves UX, shows clear loading feedback |

---

## Why This Wasn't Caught Earlier

1. Test park was created recently (Feb 2026), so all its data was within the 1000-row limit
2. Park 1's rows were created in April-May 2025, pushed beyond the limit as more data was added
3. No error is thrown - PostgREST silently returns only 1000 rows
4. The console logs showed "2 parks received" but didn't expose that rows were truncated

