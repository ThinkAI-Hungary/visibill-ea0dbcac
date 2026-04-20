

## Diagnózis: TENY full-app villanás + cégváltó 2-klikk bug

### BUG 1 — TENY első kattintáskor "egész app újrarenderelődik" (sidebar + navbar villan)

**Gyökérok:**

```tsx
// src/App.tsx, sor 42-44
const fixedAssetsImport = import("./pages/FixedAssetsPage");
const FixedAssetsPage = lazy(() => fixedAssetsImport);
```

Ez a "preload" minta **nem** szünteti meg a Suspense fallback-et — csak előre tölti a chunk-ot. Amikor a user először kattint TENY-re:

1. React Router navigál → `<Suspense fallback={<ContentSkeleton/>}>` az `AppLayout`-ban → **a tartalom helyén skeleton villan 1 frame-re** (még akkor is, ha a chunk már le van töltve, mert a React Suspense először a fallback-et rendereli a következő render-ig, amíg a `lazy()` promise resolved-nak nem mondja magát).
2. Amikor a `FixedAssetsPage` modul kiértékelődik, a top-level `useFixedAssets` query azonnal regisztrálódik a React Query cache-ben → cache subscriber notify → **`useUserRole` (ami az `AppLayout`-ban fut) is újrarenderel**, mert a TanStack Query store update minden subscribed komponenst értesít.
3. `AppLayout` újrarenderel → `<GlobalDatePicker/>` (a navbar) is újrarenderelődik → vizuálisan villan.

A többi oldalnál ez nem ennyire észrevehető, mert a TENY chunk a legnagyobb (7+ dialog + táblázat + detail panel), és a `fixedAssetsImport` preload **plusz szinkronizációt** okoz: a chunk már be van töltve, így a Suspense fallback és a tényleges page render között szinte nincs késleltetés → a két frame közötti váltás vakuszerűen érzékelhető.

**Másodlagos ok:** Az `AppLayout` minden navigációnál újrarenderel, mert a `useLocation()`, `useUserRole()`, `useCompany()` mind változó hook-okat hív. Az `AppSidebar` `React.memo`-zott, de a `useLocation()` minden URL változásra új location objectet ad → memo bukik.

### BUG 2 — Cégváltó: első kattintás "nem váltja meg" a céget (2 klikk kell)

**Gyökérok — ScopedLayout race condition (a query-string elveszik):**

A jelenlegi URL: `/A/2026-01-01_2026-12-31/invoices/submitted_inbound?invoice=3d28bd1f...`

Mi történik az első kattintáskor B cégre:

1. `setSelectedCompany(B)` → Context update
2. `ScopedLayout` Context→URL `useEffect` fut (`selectedCompany?.id` változott):
   - `expectedPrefix = /B/2026-01-01_2026-12-31`
   - URL nem kezdődik így → `navigate('/B/2026-01-01_2026-12-31/invoices/submitted_inbound', { replace: true })`
   - **A `?invoice=...` query string ELVESZIK** mert `generateScopedPath` nem őrzi meg
3. URL frissül → `InvoicesPage` újrarenderel → mivel a `?invoice=...` eltűnt, a kinyitott számla popup bezárul, de a háttérben a `selectedCompany` már B
4. **A vizuális visszajelzés azonban félrevezető:** a `Select` trigger a `selectedCompany?.name`-et mutatja (B-t), DE a teljes Outlet újrarenderelődött, az `InvoicesPage` újra lekér adatokat, és a **`keepPreviousData` miatt a régi A-cég számláit látja még pár száz ms-ig**. A user azt hiszi, semmi nem történt → újra kattint B-re → a 2. kattintásnál már nem fut a Context→URL effect (`selectedCompany.id` nem változott), csak a Select bezárul → a már lefutott adatfrissítés most már látszik.

**Nem tényleges 2-klikk** — egy klikk után megtörténik a váltás, csak a vizuális visszajelzés (data refetch + popup eltűnés + cache váltás) annyira lassú, hogy a user másodjára kattint.

**Megerősítés:** a console log mutatja, hogy `RealtimeSync` egymás után CLOSED + SUBSCRIBED-et logol két cégID-vel — tehát a context **valóban átvált** az első kattintásra, de az UI nem ad azonnali visszajelzést.

---

## Javítási terv (3 fájl, sebészeti)

### 1. `src/App.tsx` — TENY preload minta eltávolítása

```tsx
// Régi (problémás):
const fixedAssetsImport = import("./pages/FixedAssetsPage");
const FixedAssetsPage = lazy(() => fixedAssetsImport);

// Új (egységes a többi lazy oldallal):
const FixedAssetsPage = lazy(() => import("./pages/FixedAssetsPage"));
```

A többi oldal sem használ preload-ot, mégis simán működnek. A preload itt többet árt, mint használ: gyorsabban resolved-é teszi a promise-t, ami miatt a Suspense fallback és a render közötti váltás vakuszerűen jelenik meg. Eltávolítva: normális `<ContentSkeleton/>` fallback, nincs villanás-jellegű perceived re-render.

### 2. `src/components/AppLayout.tsx` — `useUserRole` kiváltása stabil értékkel

A `useUserRole()` hívás minden React Query cache changekor újrarendereli az `AppLayout`-ot (és vele a `<GlobalDatePicker/>`-t). Mivel itt csak az `isEmployee` flag kell, és ez **soha nem változik egy munkamenet során** (a user szerepköre stabil), érdemes:

- **Memóizálni** az `isEmployee`-t lokálisan, vagy
- **Egyszerűbb fix:** `<AppLayout/>` body-t `React.memo`-ba csomagolni, és a `GlobalDatePicker` rendert `React.memo`-zott child-ba kiemelni, hogy a re-renderek ne propagálódjanak felfelé.

A legjobb megoldás: `AppLayout` szétválasztása `Shell` (statikus) + `ContentArea` komponensekre, ahol a `Shell` `React.memo`-zott és nem fogad role-függő propot; a role logika átkerül a `Sidebar`-ba (ami már megkapja).

### 3. `src/components/ScopedLayout.tsx` — query string megőrzése navigációkor + szinkron URL update

```tsx
// Context → URL sync — őrizzük meg a search/hash részt
const newPath = generateScopedPath(...) + location.search + location.hash;
navigate(newPath, { replace: true });
```

Ez megoldja: cégváltáskor a `?invoice=...` query string megmarad, az invoice popup nem zár be, a user azonnal látja, hogy a switch megtörtént (mert a popup tartalom B cég adataira vált át, a `keepPreviousData` mellett az adat fade-szerűen frissül).

**Plusz:** A `selectedCompany.id` change → `navigate` hívás `flushSync`-be csomagolása, hogy a URL update és a context update ugyanabban a commit-ban történjen — ezzel a vizuális visszajelzés azonnali (a Select bezáródás és az URL update szinkronban).

### Eredmény

- **TENY:** sima Suspense fallback → page render átmenet, mint a többi oldalon. Sidebar + navbar nem villan, mert az `AppLayout` re-render iránya megfordul (csak a content swap-ol).
- **Cégváltó:** 1 kattintás = azonnali váltás, query string megmarad, popup tartalom frissül. Nincs "2-klikk" perceived bug.

### Hatókör

- 3 fájl, ~10 sor összesen
- Nincs DB / RLS / Edge Function változás
- Nincs új hook, nincs új context

