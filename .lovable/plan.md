

## CRP & Auth Guard Audit — Findings

### Current pipeline (verified)

```text
1. index.html paints #initial-loader (full-screen, z-9999, var(--initial-bg))
2. main.tsx → React mounts <App/>
3. App tree: QueryClient → Theme → Auth → Company → DateRange → Subscription → BrowserRouter → Routes
4. <ProtectedLayout/> wraps all protected routes (single mount, persists across nav)
5. ProtectedLayout calls useAppReady() → returns null until auth+company+role resolved
6. Once ready: removes #initial-loader, mounts <AppLayout/> (Sidebar + Outlet)
7. <ProtectedPage/> wraps each page → ProtectedRoute does a SECOND profile/role check
8. Page lazy chunk loads inside <Suspense fallback={ContentSkeleton}/>
```

### Strengths already in place

- **Persistent shell**: `<ProtectedLayout/>` is a parent route, not duplicated per page → Sidebar does NOT remount on navigation. ✓
- **Blocking shell**: `useAppReady()` returns `isReady=false` until auth+company+role are all resolved; `ProtectedLayout` returns `null` so the HTML loader stays visible. ✓
- **Sidebar role gate**: After the previous fix, `useUserRole` uses `isPending` and `isEmployee` is correctly resolved before first render. ✓
- **Loader fade-out**: only triggers after `isReady` flips true (rAF + 220ms fade). ✓

### Real issues found

**Issue 1 — Double role/profile gate causes a second skeleton flash on every navigation.**
`ProtectedPage` wraps every route in `<ProtectedRoute>`, which:
- Re-runs a `profile-check` query (already cached, but on first nav still shows `<ContentSkeleton/>` if `cachedProfile` undefined for a frame).
- Re-runs `roleLoading` check (already resolved by `useAppReady`, but re-evaluated → can flash skeleton on cache transitions).
- Has a second `useEffect` employee-redirect that fires AFTER mount. Because `ProtectedPage` content renders before the redirect, an employee can briefly see another page's lazy chunk loading.

Result: on every route change a skeleton can pop in for 1 frame even though the shell is stable.

**Issue 2 — Employee leak window via lazy chunks.**
`<ProtectedPage><InvoicesPage/></ProtectedPage>` is what the route element resolves to. React Router mounts the element first, then `ProtectedRoute` runs the employee-redirect effect. The `<Suspense>` fallback for the lazy import paints before the redirect → employee sees an "Invoices loading skeleton" for ~1 frame.

**Issue 3 — Sidebar disabled-state flash on `/auth → /`.**
After login, `selectedCompany` is briefly `null` while the Companies query refetches. `AppSidebar` reads `hasNoCompany = !selectedCompany` and renders the entire menu in `grayscale opacity-50 cursor-not-allowed`. This is a real flash because `useAppReady` only waits for `isInitialLoading` (first ever load), not for the post-login refetch. Only happens on first login where `companies` cache is empty.

**Issue 4 — `RootRedirect` and `LegacyRedirect` return `null` instead of a skeleton while `selectedCompany` is null.**
Inside `ProtectedLayout` they should never see null (gate already passed), but on signOut→signIn transitions there is one render where `selectedCompany` is briefly null inside an already-mounted layout. Returning `null` makes the main content area go blank for a frame.

**Issue 5 — Real-time race on company switch.**
`AppSidebar` and the page content read different contexts. When `setSelectedCompany` fires:
- Sidebar re-renders immediately with new company name (synchronous context update)
- Main content's data queries (`useDashboardData`, `useInvoiceData`) start refetching with the new `companyId`
- During refetch, `keepPreviousData` shows OLD company data under the NEW company name in sidebar → 200–500ms of mismatch.

Currently mitigated by `multi-tenancy-reactivity` invalidation but not by a Suspense boundary.

### What "Pro" means here

A "Pro" architecture has:
- **One** auth/role gate, not two.
- Route-level Suspense boundaries that **never flash** between same-shell navigations.
- A `<key={companyId}>` boundary so company switches re-mount the content tree atomically (no half-old/half-new state).
- Redirect guards that **block render** before the lazy chunk is even requested, not after.

---

## Fix Plan (4 files, surgical)

### 1. `src/components/ProtectedRoute.tsx` — collapse the double gate

- Remove `profile-check` query duplication (move it into `useAppReady` so it's part of the single root gate).
- Replace `useEffect`-based employee redirect with **synchronous render block**: if `isEmployee && !isAllowed`, return `<Navigate to="working-time" replace/>` immediately. This prevents the lazy chunk from loading at all.
- Drop the second `roleLoading` skeleton (already handled by `useAppReady`).

### 2. `src/hooks/useAppReady.ts` — make it the single source of truth

- Add `profile-check` query into the readiness chain (uses `useQuery` with same key as ProtectedRoute used).
- Return `isReady=true` only when auth + company + role + profile are all resolved.
- Add a `redirectTarget` field: `"auth" | "onboarding" | "working-time" | null` so `ProtectedLayout` can do all redirects in one place.

### 3. `src/components/ProtectedLayout.tsx` — route the redirects

- Read `redirectTarget` from `useAppReady` and `<Navigate>` synchronously before mounting `<AppLayout/>`. This removes all per-route `useEffect` redirects → zero flash.
- Wait for `companies.length > 0 || hasNoCompanies` to be settled before showing AppLayout (fixes the disabled-sidebar flash on first login).
- Keep the existing sign-out overlay.

### 4. `src/components/AppLayout.tsx` — atomic company switch

- Wrap `<Outlet/>` in `<div key={selectedCompany?.id}>` so when company changes, the entire content subtree unmounts + remounts. Combined with TanStack's existing invalidation, this guarantees no half-old/half-new render. Sidebar stays mounted (it's outside the key boundary), so no shell flash.
- Wrap the keyed Outlet in a dedicated `<Suspense fallback={<ContentSkeleton/>}/>` (already there) — now it serves as the "content boundary" while sidebar is the "shell boundary".

### Out of scope (won't touch)

- `AppSidebar` is already correct and `React.memo`'d — no changes.
- `index.html` loader is correct — no changes.
- React 18 `<Suspense>` for data is not enabled in this project (TanStack v5 in non-suspense mode); we keep the existing skeleton-fallback pattern, which achieves the same UX without rewriting every hook.

### Result after fix

```text
Cold load:    HTML loader → (auth+company+role+profile resolved) → Sidebar+Page paint TOGETHER. No flash.
Navigation:   Sidebar untouched. Only Outlet swaps. Suspense fallback only on first visit per chunk.
Employee:     Forbidden routes never mount their lazy chunk. <Navigate/> fires synchronously.
Company swap: Sidebar updates instantly; Outlet remounts with new key → content is atomic, never mixed.
Login:        Loader stays until companies query AND profile-check both resolve.
```

