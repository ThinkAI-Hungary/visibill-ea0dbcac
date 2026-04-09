

## Audit: Employee role menu flash problem

### Root cause identified

There is a **one-frame race condition** in `useUserRole` that causes the full menu to flash before the role resolves.

Here is the sequence:

```text
Frame 1:  companyLoading=true  → useAppReady blocks → nothing rendered ✓
Frame 2:  companyLoading=false, company resolved
          useUserRole query just got enabled (enabled: true)
          BUT TanStack Query v5: isPending=true, isFetching=false → isLoading=false
          roleLoading = false (isLoading && !!companyId = false)
          → useAppReady says isReady=true
          → AppSidebar renders with role=null → isEmployee=false → FULL MENU SHOWN
Frame 3:  Query starts fetching → isLoading=true → but too late, UI already painted
Frame 4:  Query resolves → role='employee' → isEmployee=true → menu filters
```

The bug is in `useUserRole` line 52: `isLoading: isLoading && !!companyId`. TanStack Query v5's `isLoading` equals `isPending && isFetching`. When a query transitions from `enabled:false` to `enabled:true`, there is one render where `isFetching` is still `false`, so `isLoading` is `false` -- but data hasn't been fetched yet.

### Additional issues found

1. **`useUserRole` defaults to non-employee while loading** (line 46-48 comment: "default to non-employee (safe: shows everything)") -- this is the opposite of safe for employee accounts. It means during the gap frame, `isEmployee=false` and the full menu renders.

2. **Duplicate role queries**: `ProtectedRoute` fetches the role separately with query key `['user-role-guard', ...]` while `useUserRole` uses `['user-role', ...]`. These are two independent queries hitting the same table. Should be unified.

3. **`ProtectedRoute` employee redirect is async**: The employee route guard uses `useEffect` + `navigate`, which means for one render the forbidden page content is visible before the redirect fires.

### Fix plan (3 files)

**1. `src/hooks/useUserRole.ts`** -- Fix the loading gap

- Change `isLoading` to use `isPending` instead of `isLoading` when enabled. `isPending` is true whenever there's no data yet, regardless of whether fetching has started.
- Return value: `isLoading: isPending && !!companyId` (true until first successful fetch)
- This ensures `useAppReady` blocks rendering until role data actually arrives.

**2. `src/components/AppSidebar.tsx`** -- No changes needed

The sidebar logic is correct -- it reads `isEmployee` from `useUserRole`. Once the loading gap is fixed, it will never render with stale defaults.

**3. `src/components/ProtectedRoute.tsx`** -- Unify role query and block render

- Remove the duplicate `user-role-guard` query. Use `useUserRole()` hook instead (same data, single cache entry).
- Instead of `useEffect` redirect for employees, block rendering: if role is still loading, show `ContentSkeleton`; if role is `employee` and route is not allowed, return `null` (redirect via `useEffect` stays but content is hidden immediately).

### Summary

The core fix is a one-line change in `useUserRole.ts`: use `isPending` instead of `isLoading` from TanStack Query. This closes the gap frame completely. The `useAppReady` guard then correctly blocks all rendering (sidebar included) until the role is definitively known.

