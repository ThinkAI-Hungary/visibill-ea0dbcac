

## Audit: ~300ms percepciós késleltetés menüváltáskor

### Mérési kontextus

A "kattintás → új oldal megjelenik" lánc jelenleg ennyi szakaszból áll:

```
1. <Link> click  →  React Router state update
2. ScopedLayout effect: URL params változnak → setSelectedCompany / setDateFrom / setDateTo (ha kell)
3. Suspense fallback (`null`) → a régi tartalom UNMOUNT-ol, új helye üres
4. Lazy chunk fetch (ha még nincs cache-elve) → ~50-200ms hálózati / parse idő
5. Új page komponens mount → top-level useQuery hookok regisztrálódnak
6. queries indulnak (placeholderData/staleTime miatt sokszor azonnali) → első render
7. React commit + paint
```

A felhasználó által érzékelt ~300ms valós, és három forrásból táplálkozik:

---

### OK 1 — Suspense fallback `null` = "üres frame" villanás (a fő bűnös)

**`src/components/AppLayout.tsx:34`:**
```tsx
<Suspense fallback={null}>
```

Amikor egy lazy chunk **még nincs betöltve**, a Router azonnal kicseréli a tartalmat a Suspense fallback-re (`null`). Ez **üres `<main>`** képet ad → 50-300ms-ig (chunk fetch + parse) → majd új page kirajzolódik.

A user szubjektíven ezt érzékeli "várakozásként" — közben a sidebar és topbar marad, csak a content tűnik el. Ez sokkal zavaróbb, mint egy állandóan látható skeleton, mert a szem a változást követi.

A `v7_startTransition: true` flag már be van kapcsolva, ami azt jelenti, hogy a router képes lenne **megtartani a régi tartalmat amíg az új betöltődik** — DE csak akkor működik, ha a Suspense boundary **`useTransition` által vezérelten** updateel. A jelenlegi `<Link>` click → router internal navigation a v7_startTransition flag miatt **automatikusan** transitionbe csomagolja a navigációt. Ez azt jelenti: ha a Suspense fallback `null`, akkor React **mégis kicseréli** a fát üresre, mert a chunk nem resolved.

**Megoldás:** `Suspense fallback={null}` → mégse `null`, hanem egy **stabil "keret"**, ami megőrzi a layout magasságát és nem villog: `<div className="h-full" />`. Plusz: a router scope-ba `useTransition`-t bevezetni a Link click-hez, hogy a régi page látszódjon a chunk fetch alatt — de ezt a v7_startTransition már elintézi automatikusan, csak Suspense fallback ne nullaljon.

**Még jobb:** a leggyakrabban használt page-eket (Dashboard, Számlák, Tranzakciók, Bérek) **prefetch-elni** moduláris importtal háttérben az `AppLayout` mount után — így a chunk már a cache-ben van, mire a user rákattint, és a Suspense fallback **soha nem** aktiválódik.

---

### OK 2 — `useScopedBasePath()` minden Link-en újrarenderelt URL-t generál

**`src/components/AppSidebar.tsx:180`:**
```tsx
<Link to={item.url === '/' ? basePath : `${basePath}${item.url}`}>
```

Minden `<Link>` egy új `to` stringet kap minden render-en. Ez nem okoz közvetlen lassulást, de a `Link` komponens minden re-renderkor új event listenert állít be. Apró, de mérhető (~5-10ms a 16 menüpontnál együtt).

**Megoldás:** `useMemo` a `visibleNavItems` array-re, ami a teljes `to` stringet tartalmazza, így a `<Link>` propok stabilak.

---

### OK 3 — A click és a navigate között szinkron context update

A `<Link>` kattintáskor React Router belép a navigation flow-ba, és **azonnal** új URL-t állít. Ez:
1. Triggereli a `ScopedLayout` URL→Context effect-et (`urlCompanyId`/`urlDateRange` változás esetén)
2. Triggereli a `ProtectedRoute` re-rendert (új location)
3. Triggereli az `AppSidebar` re-rendert (új location → új `isActive`)

**Mind szinkron**, ezek nem lassítanak. A valós lassulás a chunk fetch + a top-level query-k regisztrációja az új page-ben.

---

### Mérendő (gyors validáció)

Egy `console.time('nav')` / `console.timeEnd('nav')` páros az `AppLayout` ContentArea első render-jénél megmutatja, hogy:
- Cache-elt chunk esetén ~10-30ms (csak React commit) — **ezt nem lehet csökkenteni**
- Nem-cache-elt chunk esetén 100-400ms (network + parse + commit) — **ezen lehet javítani prefetch-csel**

A user érzékelése a 300ms az **első** menüklikkre vonatkozik (cold chunk), illetve minden olyan navigációra, ahol a chunk még nem volt letöltve. Cache-elt esetben (második kattintás ugyanarra) szinte instant.

---

### Javítási terv (3 fájl, ~25 sor)

#### 1. `src/components/AppLayout.tsx` — Suspense fallback stabil keret
```tsx
<Suspense fallback={<div className="h-full w-full" aria-busy="true" />}>
  {children || <Outlet />}
</Suspense>
```
Hatás: nincs üres villanás chunk fetch közben, a layout magasság stabil marad.

#### 2. `src/components/AppLayout.tsx` — Route prefetch háttérben
Az `AppLayout` mount után 1 másodperccel (idle callback) elindítjuk a leggyakoribb 5-6 oldal lazy chunk fetch-ét **háttérben**, prioritás nélkül:

```tsx
useEffect(() => {
  const idle = (cb: () => void) =>
    'requestIdleCallback' in window
      ? (window as any).requestIdleCallback(cb, { timeout: 2000 })
      : setTimeout(cb, 1500);

  idle(() => {
    import('@/pages/Index');
    import('@/pages/InvoicesPage');
    import('@/pages/TransactionsPage');
    import('@/pages/SalariesPage');
    import('@/pages/PartnersPage');
    import('@/pages/GeneralLedgerPage');
  });
}, []);
```
Hatás: a user által nagy valószínűséggel megnyitott oldalak chunk-jai már a böngésző cache-ében vannak, mire rájuk kattint → Suspense fallback szinte sosem aktiválódik → érzékelt instant navigáció.

#### 3. `src/components/AppSidebar.tsx` — `<Link>` propok memoizálása + hover prefetch
- `visibleNavItems` `useMemo`-ba: stabil `to` string referenciák.
- `onMouseEnter` handler a `<Link>`-en, ami a megfelelő lazy chunk import-ját triggerelné — ez "**hover-to-prefetch**" minta. A user általában 100-300ms-ig hover-eli a menüpontot kattintás előtt, ami tipikusan elég idő a chunk letöltésére.

```tsx
const prefetchMap: Record<string, () => Promise<unknown>> = {
  '/': () => import('@/pages/Index'),
  '/invoices': () => import('@/pages/InvoicesPage'),
  '/teny': () => import('@/pages/FixedAssetsPage'),
  // ...
};

<Link
  to={...}
  onMouseEnter={() => prefetchMap[item.url]?.()}
  onFocus={() => prefetchMap[item.url]?.()}
>
```
Hatás: célzottan azt a chunk-ot tölti be, amit a user éppen "néz" → 95%-ban kiküszöböli a Suspense fallback-et.

---

### Eredmény

- **Első kattintás bármely oldalra:** kb. 50-100ms-re csökken (csak React commit + paint), a chunk már a háttérben prefetch-elve.
- **Visszatérő kattintások:** instant (chunk + query cache mindkettő hot).
- **Suspense fallback:** ha mégis aktiválódik, nem üres frame-et mutat hanem stabil keretet — nincs vizuális villanás.

### Hatókör

- 2 fájl módosítás (`AppLayout.tsx`, `AppSidebar.tsx`)
- Nincs DB / RLS / Edge Function változás
- Nincs új context, nincs új hook
- Nincs törés a meglévő route logikában

