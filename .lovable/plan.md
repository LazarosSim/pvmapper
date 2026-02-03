
# Plan: Fix Navigation Persistence, Logout Error, and Park 1 Data Display

## Problem Analysis

Based on my exploration, I've identified the root causes of all three issues:

---

## Issue 1: Navigation Persistence Not Working

### Root Cause
The current `ScrollToTop` component only stores the route in `localStorage` but **never restores it**. On page refresh:

1. The browser URL is correct (e.g., `/scan/row/123`)
2. But the `AuthGuard` shows a loading state during session verification
3. During this time, React Query cache is being restored from localStorage
4. The issue is that the **session isn't being restored fast enough** before the AuthGuard redirects

Additionally, I found a critical issue in `LoginPage.tsx` at lines 40-51:
```typescript
useEffect(() => {
  const clearSession = async () => {
    try {
      await supabase.auth.signOut();  // THIS CLEARS THE SESSION!
    } catch (error) {
      console.log('No active session to clear');
    }
  };
  if (location.pathname === '/login') {
    clearSession();  // This runs on every /login visit
  }
}, [location]);
```

**This is problematic because:**
- When the user refreshes ANY page, if the session restoration is slow, the AuthGuard might briefly redirect to `/login`
- When `/login` loads, it immediately calls `signOut()`, destroying the valid session
- This causes a cascade where the user appears logged out

### Solution

1. **Remove the aggressive session clearing** in `LoginPage.tsx` - Only clear session when the user explicitly navigates to login (not on refresh)
2. **Add navigation state restoration** - Store the intended route and restore it after auth is verified
3. **Enable `autoRefreshToken`** in Supabase client - Currently it's disabled (`autoRefreshToken: false`), which may cause token refresh issues

---

## Issue 2: Logout Error "Auth session missing"

### Root Cause
The auth logs show:
```
error_code: session_not_found
msg: session id (f60545d9-e6b1-48ba-ae1f-8c4f7e34ceec) doesn't exist
```

This happens because:
1. The `LoginPage.tsx` `clearSession()` effect runs when visiting `/login`
2. The user's session is already cleared before they click "Logout"
3. When `logout()` is called in `ProfilePage.tsx`, the session is already gone
4. Supabase returns a 403 error because there's no session to sign out

Additionally, the logout function in `src/lib/hooks/use-user.ts` (line 60-74) doesn't handle the "session_not_found" case gracefully.

### Solution

1. **Remove the auto-signOut in LoginPage** - This is the primary culprit
2. **Make logout resilient** - Treat "session_not_found" as a successful logout (the user is already signed out)
3. **Clear local state regardless** - When logout is called, always clear local React Query cache and navigate to login

---

## Issue 3: Park 1 Data Not Displaying

### Root Cause
I verified that "Park 1" exists in the database with:
- `archived: false` (so it should be visible)
- `current_barcodes: 395` (has data)

The `useParkStats` hook has `enabled: onlineManager.isOnline()` at line 121:
```typescript
export const useParkStats = (includeArchived: boolean = false) => {
    return useQuery({
        queryKey: ['parks', { includeArchived }],
        queryFn: () => loadParkStats(includeArchived),
        enabled: onlineManager.isOnline()  // <-- Only fetches when online!
    });
}
```

**This means:**
- If the app starts in an "offline" state (before network detection kicks in), the query never runs
- The cached data from React Query persistence might be stale or empty
- "Park 1" appears in the `park_stats` view but may not be in the persisted cache

Additionally, the query key is `['parks', { includeArchived }]` which means:
- `showArchived: false` uses key `['parks', { includeArchived: false }]`
- `showArchived: true` uses key `['parks', { includeArchived: true }]`
- These are different cache entries, so toggling "Show Archived" triggers a new fetch

### Solution

1. **Remove the `enabled: onlineManager.isOnline()` condition** - Let React Query's `networkMode: 'offlineFirst'` handle offline gracefully
2. **Force a refetch on mount** - Use `staleTime: 0` for parks or call `refetch()` on mount
3. **Add loading and error states** to the Index page to show when data is being fetched

---

## Implementation Plan

### Phase 1: Fix Session Management (Critical)

**Files to modify:**

1. **`src/pages/LoginPage.tsx`**
   - Remove the `clearSession()` useEffect that auto-signs out users
   - Only clear the session if the user explicitly navigated to `/login` (e.g., via logout button, not refresh)

2. **`src/integrations/supabase/client.ts`**
   - Enable `autoRefreshToken: true` to prevent token expiration issues

3. **`src/lib/hooks/use-user.ts`**
   - Make `logout()` resilient - treat "session_not_found" as success
   - Clear React Query cache on logout

4. **`src/lib/supabase-provider.tsx`**
   - Add logic to handle the `signOut` call gracefully when no session exists

### Phase 2: Fix Navigation Persistence

**Files to modify:**

1. **`src/components/ScrollToTop.tsx`**
   - Already stores `lastRoute` in localStorage
   - No changes needed here

2. **`src/components/auth/auth-guard.tsx`**
   - Check `localStorage.getItem('lastRoute')` on successful auth
   - If current route is `/` and `lastRoute` exists, navigate to `lastRoute`
   - Clear `lastRoute` after restoration to prevent loops

3. **`src/App.tsx`**
   - No changes needed - route definitions are correct

### Phase 3: Fix Park Data Display

**Files to modify:**

1. **`src/hooks/use-park-queries.tsx`**
   - Remove `enabled: onlineManager.isOnline()` from `useParkStats`
   - Add `networkMode: 'offlineFirst'` to allow cache-first fetching
   - Set a reasonable `staleTime` (e.g., 30 seconds) instead of relying on global Infinity

2. **`src/pages/Index.tsx`**
   - Add loading and error states to show fetch status
   - Add a manual refresh button if needed

---

## Technical Details

### Logout Flow After Fix

```text
User clicks Logout
       │
       ▼
┌─────────────────────────────┐
│ 1. Call supabase.auth.signOut() │
└──────────────┬──────────────┘
               │
       ┌───────┴───────┐
       ▼               ▼
 ┌──────────┐   ┌──────────────────┐
 │ Success  │   │ session_not_found │
 │          │   │ (already logged   │
 │          │   │  out)             │
 └────┬─────┘   └────────┬─────────┘
      │                  │
      └────────┬─────────┘
               ▼
┌─────────────────────────────┐
│ 2. Clear React Query cache  │
│    queryClient.clear()      │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ 3. Navigate to /login       │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ 4. Show toast "Logged out   │
│    successfully"            │
└─────────────────────────────┘
```

### Navigation Restoration Flow

```text
Page Refresh on /scan/row/123
              │
              ▼
┌─────────────────────────────┐
│ Browser loads /scan/row/123 │
└──────────────┬──────────────┘
              │
              ▼
┌─────────────────────────────┐
│ AuthGuard: Check auth state │
│ isInitialized: false        │
│ (show loading spinner)      │
└──────────────┬──────────────┘
              │
              ▼
┌─────────────────────────────┐
│ Supabase restores session   │
│ from localStorage           │
└──────────────┬──────────────┘
              │
       ┌──────┴──────┐
       ▼             ▼
┌──────────┐  ┌──────────────┐
│ Session  │  │ No session   │
│ found    │  │              │
└────┬─────┘  └──────┬───────┘
     │               │
     ▼               ▼
┌──────────┐  ┌──────────────┐
│ Render   │  │ Redirect to  │
│ /scan/   │  │ /login       │
│ row/123  │  │ (user logged │
│          │  │  out)        │
└──────────┘  └──────────────┘
```

---

## Files Summary

### Files to Modify
1. `src/pages/LoginPage.tsx` - Remove auto-signOut on mount
2. `src/integrations/supabase/client.ts` - Enable autoRefreshToken
3. `src/lib/hooks/use-user.ts` - Make logout resilient
4. `src/lib/supabase-provider.tsx` - Handle signOut gracefully
5. `src/hooks/use-park-queries.tsx` - Fix enabled condition for useParkStats
6. `src/pages/Index.tsx` - Add loading/error states
7. `src/components/auth/auth-guard.tsx` - Add navigation restoration logic

---

## Testing Checklist

After implementation, verify:

- [ ] Refresh page on `/scan/row/:id` - should stay on same route
- [ ] Refresh page on `/park/:id` - should stay on same route
- [ ] Click Logout - should complete without error
- [ ] Login and navigate to Home - Park 1 should be visible with 395 barcodes
- [ ] Toggle "Show Archived" - should show/hide archived parks correctly
- [ ] Go offline then back online - parks should reload correctly

---

## Risk Assessment

| Change | Risk | Mitigation |
|--------|------|------------|
| Remove auto-signOut | Low | This was causing more harm than good |
| Enable autoRefreshToken | Low | Standard Supabase behavior |
| Remove enabled condition from parks query | Low | networkMode handles offline gracefully |
| Add navigation restoration in AuthGuard | Medium | Add guards to prevent redirect loops |
