

## Számlák oldal automatikus frissítése cégváltáskor

### Probléma

A `fetchData()` függvény (sor 493) **nem állítja vissza a `loading` state-et `true`-ra** az adatlekérés elején. Az `useEffect` (sor 297) ugyan figyeli a `selectedCompany` változást és meghívja a `fetchData()`-t, de:

1. A `loading` state csak egyszer `true` (inicializáláskor, sor 175)
2. Cégváltáskor a régi adatok maradnak a táblában amíg az újak betöltődnek -- nincs vizuális visszajelzés
3. A pagination state (oldalszám) nem resetelődik cégváltáskor

### Megoldás

**`src/pages/InvoicesPage.tsx`** -- 3 módosítás:

1. **`fetchData` elején `setLoading(true)`** hozzáadása (sor ~496): Ez biztosítja, hogy minden adatlekérésnél megjelenjen a loading state, beleértve a cégváltást is.

2. **Új `useEffect` a `selectedCompany` változásra** -- reseteli a pagination-t és a filtereket:
   - `setNavCurrentPage(1)`
   - `setSubmittedCurrentPage(1)` 
   - `setSelectedInvoiceIds(new Set())`
   - `setSelectedSubmittedIds(new Set())`
   - `setExpandedRowId(null)`

3. **Loading állapotban `TableSkeleton` megjelenítése** a tábla body-ban a jelenlegi `LoadingSpinner` helyett (ami már importálva van, sor 31). Ez biztosítja a pre-loader animációt a táblázaton belül, amíg az új cég adatai betöltenek. A meglévő teljes oldal `LoadingSpinner`-t lecseréljük a tábla-szintű skeleton-ra.

### Eredmény
- Cégváltáskor azonnal megjelenik a skeleton animáció a táblában
- Az adatok betöltése után automatikusan frissül a tartalom
- A pagination és szűrők resetelődnek

