

# Plan: Data Sync, Navigation Persistence, and Park Archive Feature

## Problem Summary

Based on my exploration of the codebase, I've identified three distinct issues:

### 1. Data Sync Between "Home" and "Scan" Sections

**Root Cause:** The application has two parallel park data systems:
- **Index.tsx (Home):** Uses `useParkStats()` from React Query, which queries the `park_stats` view (includes `current_barcodes` calculated via SQL JOIN)
- **ScanPage.tsx / ScanParkPage.tsx:** Uses `useDB().parks` from the legacy DBProvider, which fetches from the `parks` table directly (no barcode counts)

When barcodes are synced or added, only the React Query cache is invalidated (`['barcodes', 'row']`, `['barcodes', 'park']`), but:
- The `['parks']` query is **not** invalidated, so the Home page shows stale `current_barcodes`
- The legacy `parks` state in DBProvider is never updated

### 2. Navigation Persistence on Page Refresh

**Root Cause:** There is no scroll restoration or navigation state management. React Router v6 doesn't automatically preserve the current route on refresh when using `BrowserRouter` without additional configuration.

Currently:
- `localStorage` stores `selectedParkId` and `selectedRowId` for redirects within the app
- But these are only used for fallback navigation when a resource isn't found, not for restoring the user's last viewed section

The app correctly stays on the current route on refresh (verified by the route configuration), but the issue may be:
1. The AuthGuard showing a loading state that looks like a redirect
2. Or the user is being redirected to `/login` because their session isn't being restored fast enough

### 3. Park Archive Feature

**Requirement:** Allow users to "archive" parks they're no longer actively using, reducing the active dataset and improving sync performance.

---

## Implementation Plan

### Phase 1: Fix Data Sync Between Home and Scan Sections

**Goal:** Ensure barcode counts are consistent across all views

**Changes:**

1. **Update `use-sync.ts`** to invalidate the `['parks']` query after sync:
   ```typescript
   // After successful sync, also invalidate parks to refresh current_barcodes
   queryClient.invalidateQueries({ queryKey: ['parks'] });
   ```

2. **Migrate ScanPage.tsx to React Query:**
   - Replace `useDB().parks` with `useParkStats()` so both Home and Scan use the same data source
   - This ensures both views always show the same park list with accurate counts

3. **Migrate ScanParkPage.tsx similarly** if it uses legacy parks state

4. **Update barcode mutation hooks** (`useAddBarcodeToRow`, etc.) to invalidate `['parks']` on success:
   - When a barcode is added/deleted, the `park_stats` view's `current_barcodes` changes
   - Currently only row-level cache is invalidated

**Files to modify:**
- `src/hooks/use-sync.ts` - Add parks query invalidation
- `src/hooks/use-barcodes-queries.tsx` - Add parks invalidation to mutations
- `src/pages/ScanPage.tsx` - Use `useParkStats()` instead of `useDB().parks`
- `src/pages/ScanParkPage.tsx` - Same migration if applicable

---

### Phase 2: Fix Navigation Persistence

**Goal:** Ensure users stay on their current route after page refresh

**Investigation findings:**
- React Router v6 with `BrowserRouter` does preserve the URL on refresh
- The issue is likely the 500ms artificial loading delay in `App.tsx` combined with AuthGuard's async initialization

**Changes:**

1. **Add ScrollRestoration component** (React Router v6.4+ built-in, or custom):
   ```typescript
   // src/components/ScrollToTop.tsx
   import { useEffect } from 'react';
   import { useLocation } from 'react-router-dom';
   
   export const ScrollToTop = () => {
     const { pathname } = useLocation();
     useEffect(() => {
       window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
     }, [pathname]);
     return null;
   };
   ```

2. **Improve AuthGuard initialization:**
   - The AuthGuard already handles async auth checking properly
   - Ensure the supabase session is restored from localStorage quickly
   - The issue may be the 500ms delay in `App.tsx` - consider removing it or making it smarter

3. **Store last active route in localStorage** as a fallback:
   ```typescript
   // In App.tsx or a dedicated hook
   useEffect(() => {
     localStorage.setItem('lastRoute', location.pathname);
   }, [location.pathname]);
   ```

**Files to modify:**
- `src/components/ScrollToTop.tsx` - Create new component
- `src/App.tsx` - Add ScrollToTop inside BrowserRouter
- `src/lib/supabase-provider.tsx` - Verify session restoration is fast

---

### Phase 3: Implement Park Archive Feature

**Goal:** Allow managers to archive parks to reduce active dataset

**Database changes:**

1. **Add `archived` column to `parks` table:**
   ```sql
   ALTER TABLE parks ADD COLUMN archived BOOLEAN DEFAULT FALSE;
   ALTER TABLE parks ADD COLUMN archived_at TIMESTAMP WITH TIME ZONE;
   ```

2. **Update `park_stats` view** to filter out archived parks by default (or create a separate `active_park_stats` view)

**Backend changes:**

3. **Add archive/unarchive RPC functions** (optional, can use direct update):
   ```sql
   CREATE FUNCTION archive_park(p_id UUID) RETURNS VOID AS $$
     UPDATE parks SET archived = TRUE, archived_at = NOW() WHERE id = p_id;
   $$ LANGUAGE SQL;
   ```

**Frontend changes:**

4. **Update `src/hooks/use-park-queries.tsx`:**
   - Add `useArchivePark()` mutation
   - Add `useUnarchivePark()` mutation
   - Update `loadParkStats()` to accept an `includeArchived` parameter

5. **Update `src/types/types.ts`:**
   - Add `archived: boolean` and `archivedAt: Date | null` to Park type

6. **Update `src/pages/Index.tsx` (Home):**
   - Add toggle or filter to show/hide archived parks
   - Default to showing only active parks

7. **Update `src/components/parks/park-card.tsx`:**
   - Add "Archive" option to the dropdown menu (for managers)
   - Show visual indicator for archived parks (grayed out, badge, etc.)
   - Add "Unarchive" option for archived parks

8. **Create Archive management UI:**
   - Consider a dedicated "Archived Parks" section or filter
   - Allow bulk archive operations for multiple parks

**Files to create:**
- SQL migration for `archived` column

**Files to modify:**
- `src/types/types.ts` - Add archive fields
- `src/hooks/use-park-queries.tsx` - Add archive mutations, filter logic
- `src/pages/Index.tsx` - Add archive filter toggle
- `src/components/parks/park-card.tsx` - Add archive/unarchive actions

---

## Rollout Strategy

| Phase | Risk | Effort | Dependencies |
|-------|------|--------|--------------|
| 1 | Low | 1-2 hours | None |
| 2 | Low | 1 hour | None |
| 3 | Medium | 3-4 hours | Phase 1 |

**Recommended order:** Phase 1 (fixes critical data sync) -> Phase 2 (UX improvement) -> Phase 3 (new feature)

---

## Testing Checklist

### Phase 1 (Data Sync)
- [ ] Scan barcodes on Scan page, verify Home page shows updated counts
- [ ] Sync offline barcodes, verify Home page updates
- [ ] Delete barcodes, verify counts decrease on Home

### Phase 2 (Navigation)
- [ ] Navigate to /scan/row/{id}, refresh page, verify you stay on that route
- [ ] Navigate to /profile, refresh page, verify you stay on profile
- [ ] Verify scroll position is reset on route change

### Phase 3 (Archive)
- [ ] Archive a park, verify it disappears from active list
- [ ] Toggle "Show archived" filter, verify archived parks appear
- [ ] Unarchive a park, verify it returns to active list
- [ ] Verify archived parks don't appear in Scan page park selector

---

## Technical Notes

### Query Key Structure Reference
```text
['parks']                    - Park list with stats
['barcodes', 'row', rowId]   - Row-scoped barcodes
['barcodes', 'park', parkId] - Park-scoped barcodes
```

### Data Flow After Fix
```text
                    ┌─────────────────┐
                    │   Scan Barcode  │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Add to IndexedDB│ (offline)
                    │   or Supabase   │ (online)
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
    ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │ Invalidate   │ │ Invalidate   │ │ Invalidate   │
    │ row barcodes │ │ park barcodes│ │    parks     │
    └──────────────┘ └──────────────┘ └──────────────┘
              │              │              │
              └──────────────┼──────────────┘
                             ▼
                    ┌─────────────────┐
                    │ All views show  │
                    │ consistent data │
                    └─────────────────┘
```

