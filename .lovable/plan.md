

# Diagnosztika és javítási terv: Real-time szinkron + Sonner értesítések

## Feltárt problémák

### 1. KRITIKUS: Query key inkonzisztencia — a fő ok, amiért a listák nem frissülnek

**Két párhuzamos invalidációs rendszer fut, eltérő key formátumokkal:**

| Rendszer | Invalidáció formátuma | Példa |
|---|---|---|
| `useRealtimeInvalidation` | `[key, companyId]` | `['salaries', 'abc-123']` |
| `LiveNotificationProvider` | `[key]` (companyId NÉLKÜL) | `['salaries']` |
| Tényleges query key (queryKeys factory) | `['salaries', companyId, dateFrom, dateTo]` | `['salaries', 'abc-123', '2026-01-01', '2026-03-21']` |

**Probléma:** A `useRealtimeInvalidation` hook `queryClient.invalidateQueries({ queryKey: [key, companyId] })` formátumot használ, ami prefix-match-ként működik, tehát **elvileg eltalálja** a `['salaries', companyId, dateFrom, dateTo]` kulcsot. Viszont a `LiveNotificationProvider` `invalidate` függvénye `queryKey: [key]` formátumot használ — companyId nélkül — ami **szintén prefix-match**, de **túl széles**: minden company adatát invalidálja.

**Ráadásul a `LiveNotificationProvider` nem invalidálja a következő kulcsokat**, amiket a `useRealtimeInvalidation` igen:
- `dashboardData`, `dashboardAnalytics`, `dashboardPettyCash`
- `submittedInvoices`, `linkedInvoices`, `invoiceTransactions`
- `kintlevo-nav`, `kintlevo-manual`
- `invoiceStatusPayable`, `invoiceStatusMissing`
- `analyticsRaw`, `analyticsVat`
- `projects`, `projectsList`
- `partners`, `recentInvoices`, `uploadHistory`
- `filteredNavInvoices`, `filteredSubmittedInvoices`

**A dupla csatorna (11 `.on()` listener a `useRealtimeInvalidation`-ben + 5 a `LiveNotificationProvider`-ben = 16 listener) közel kerülhet a Supabase Realtime limitjéhez.**

### 2. `useRealtimeInvalidation` szerver-oldali filter problémája

A hook `filter: \`company_id=eq.${companyId}\`` szűrőt használ. Supabase Realtime esetén az UPDATE és DELETE események **csak FULL replica identity** mellett működnek szűrővel. Ha a táblák alapértelmezett replica identity-vel rendelkeznek (ami valószínű), az UPDATE/DELETE események **nem érkeznek meg** erre a csatornára.

### 3. Sonner stacking: nincs CSS konfliktus

Nem találtam `[data-sonner-toast]` felülíró CSS-t. A `sonner.tsx`-ben az `expand={true}` beállítás helyes. A probléma valószínűleg a **két Toaster komponens együttélése**: a shadcn `<Toaster />` (radix-based) és a `<SonnerToaster />` egyszerre van mountolva az App.tsx-ben. Bár különböző toast rendszerek, a pozícionálásuk ütközhet (mindkettő a viewport szélére pozícionál).

A feldolgozás-értesítés `duration: 8000` — ez még nem lett frissítve 5000-re a legutóbbi kérés alapján (a catch-ágban igen, de a sikeres ágban nem).

### 4. `LiveNotificationProvider` batch insert kezelése

A `notifiedUploads` Set logika helyes: az első INSERT-nél hozzáadja az upload ID-t, és a további INSERT-eket (ugyanazon batch-ből) elnémítja. Ez jól működik.

---

## Javítási terv

### Fájl 1: `src/hooks/useRealtimeInvalidation.ts` — TÖRLÉS

Ez a hook redundáns a `LiveNotificationProvider` mellett, és problémás a szerver-oldali filter miatt. Minden oldalról el kell távolítani a használatát (9 fájl).

### Fájl 2: `src/components/LiveNotificationProvider.tsx` — TELJES INVALIDÁCIÓ

Kibővítés az összes hiányzó query key invalidálásával, companyId-vel:

```
invalidate('salaries', 'salary_files', 'dashboardData', 'dashboardAnalytics', 'uploadHistory', ...)
```

Az `invalidate` függvény módosítása, hogy `[key, companyId]` formátumot használjon (prefix match) a szélesebb `[key]` helyett.

Hiányzó táblák hozzáadása: `nav_invoices`, `partners`.

A `duration` javítása 8000 → 5000.

### Fájl 3: 9 oldal/hook — `useRealtimeInvalidation` import eltávolítása

Érintett fájlok:
- `src/pages/Index.tsx`
- `src/pages/InvoicesPage.tsx`
- `src/pages/TransactionsPage.tsx`
- `src/pages/Analytics.tsx`
- `src/pages/PartnersPage.tsx`
- `src/pages/Projects.tsx`
- `src/hooks/useSalaryData.ts`
- `src/hooks/useKintlevoData.ts`
- `src/components/UploadHistory.tsx`

### Fájl 4: `src/components/ui/sonner.tsx` — Stacking megerősítés

Az `expand` és `gap` beállítások helyesek. Nincs módosítás szükséges.

### Összefoglaló

| Módosítás | Fájlok száma | Sor ~  |
|---|---|---|
| `useRealtimeInvalidation` törlés + import eltávolítás | 10 | -150 |
| `LiveNotificationProvider` kibővítés | 1 | +40 |
| Duration fix (8000→5000) | 1 | 1 |
| **Összesen** | **11** | **~-110** |

Adatbázis-módosítás nem szükséges — a Realtime a meglévő beállításokkal működik, ha nem használunk szerver-oldali filtert.

