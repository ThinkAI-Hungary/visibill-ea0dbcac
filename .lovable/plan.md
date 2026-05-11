# Probléma — mit jelez a console

```
Warning: Cannot update a component (`BrowserRouter`) while rendering
a different component (`InvoicesPage`).
```

A stack utolsó lépései:

```
replace2 (react-router-dom: history.replace)
  ← startTransition
  ← dispatchSetState  (BrowserRouter belső state-je)
  ← ... InvoicesPage render
```

Ez nem fatal hiba — React fejlesztői figyelmeztetés. Akkor lép fel, ha render közben (nem `useEffect`-ben, nem callback-ben) történik egy `navigate(..., { replace: true })` vagy `setSearchParams(..., { replace: true })` hívás, amit a BrowserRouter saját state-jének frissítése követ. Mivel a router komponensfája MAGASABBAN van mint az InvoicesPage, React panaszkodik, hogy másik komponens renderje közben próbálunk parent-t frissíteni.

## Honnan jöhet az InvoicesPage-ben

A renderben hívott navigate/setSearchParams gyanúsítottak (mind `{ replace: true }`-szal):

1. **`useUrlTab` (src/lib/navigation.ts:140)** — a `setTab` callback `navigate(..., { replace: true })`. Önmagában render közben nem fut, DE:
   - Ha a `Tabs` (Radix) controlled value-ja (`activeTab`) nem egyezik egyik `TabsTrigger`-rel sem (pl. URL slug eltérés miatt rövid ideig), Radix bizonyos verziói render fázisban hívják az `onValueChange`-t.
   - Az `onValueChange={(v) => setActiveTab(v as InvoiceTab)}` (InvoicesPage.tsx:606) ekkor render közben hívná a `navigate`-et.

2. **`setInvoiceParam` / `setSearchParams(..., { replace: true })`** (InvoicesPage.tsx:99, 261, 271, 466) — mind callback-ben futnak, render fázisban nem. Valószínűleg nem ezek.

3. **`ScopedLayout` Context→URL effect** (ScopedLayout.tsx:86-106) — `useEffect`-ben fut, de ha egy gyermek (InvoicesPage) render közben módosítja a context-et (CompanyContext / DateRangeContext), az re-rendert vált ki, ami az effect következő commit-ban navigate-et hív, és a stack visszamutathat az aktuális render-re.

A legvalószínűbb gyökér tehát: az **`useUrlTab` által visszaadott `setTab`/`setTabSlug` render közben fut le** (Radix Tabs sync `onValueChange` egy edge-case-ben), vagy a `Tabs` komponens nem szinkronizált value-ja triggereli.

## Javítási terv

### 1. lépés — Bizonyíték gyűjtése
- Beteszek egy `console.trace('[invoice-page] navigate during render?')` hívást a `useUrlTab` `setTab` callback-jébe + a `setInvoiceParam`-ba, hogy lássuk pontosan melyik fut a render fázisban.
- A user megnyitja az `/invoices` route-ot → console-ból kiderül az igazi forrás.

### 2. lépés — Védőháló (független a forrástól)
A `useUrlTab.setTab` belsejében késleltetjük a router írást egy mikrotaszkba, így soha nem futhat render fázisban:

```ts
// src/lib/navigation.ts (useUrlTab)
const setTab = useCallback((newTab: T) => {
  queueMicrotask(() => {
    navigate(
      { pathname: `${basePath}/${pagePath}/${newTab}`, search: location.search },
      { replace: true },
    );
  });
}, [navigate, basePath, pagePath, location.search]);
```

Ugyanezt a pattern-t alkalmazzuk a `setInvoiceParam`, `handleOpenFiles`, `handleCloseFiles`, `handleRowClick` URL-író ágaiban is, ha az 1. lépésben kiderül, hogy bármelyikük render alatt fut.

### 3. lépés — Tab slug normalizálás
Ha a probléma a `Tabs` value mismatch (URL slug ↔ TabsTrigger value), egységesítjük: a `TabsTrigger`-ek `value`-ját átírjuk a slug-okra (`outbound_nav`, `inbound_nav`, …) — így `activeTab` és `value` mindig 1:1, nincs mapping, nincs render-time onValueChange tűz.

### 4. lépés — Verifikáció
- Reload `/invoices` — warning eltűnik.
- Tab váltás — URL helyesen frissül, nincs warning.
- `?invoice=…` deep link továbbra is működik (dialog megnyílik).
- Browser back/forward — tab státusz konzisztens.

## Technikai részletek (érintett fájlok)
- `src/lib/navigation.ts` — `useUrlTab` setter mikrotaszkba tétele.
- `src/pages/InvoicesPage.tsx` — opcionálisan `TabsTrigger` value-k slug-ra cserélése; `setInvoiceParam` & társai szükség esetén `queueMicrotask`-be.
- Egyéb fájlt nem érint.

A fix kifejezetten kicsi (két fájl, ~10 sor), és csak a navigációs réteget érinti — üzleti logikához nem nyúl.
