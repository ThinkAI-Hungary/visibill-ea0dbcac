

# Számla feltöltési előzmények konzisztencia javítás

## Azonosított problémák

### 1. `refreshKey` megtöri az optimisztikus cache-t (FŐ BUG)
A feltöltés után két ellentétes művelet fut:
- `addToUploadHistoryCache()` — hozzáadja az új rekordot a `['uploadHistory', ...]` cache-hez
- `setUploadRefreshKey(k => k + 1)` — megváltoztatja a query key-t

Mivel a `refreshKey` a query key része (`['uploadHistory', companyId, activeTab, dateFrom, dateTo, refreshKey]`), a key változása:
1. Az optimisztikus rekordot tartalmazó régi cache-t elárvítja
2. Új query-t indít az új key-vel, ami üres/loading állapotot mutat
3. A friss fetch-ig "Még nincs feltöltési előzmény" villan be

### 2. `addToUploadHistoryCache` prefix match vs. pontos key
A `setQueriesData({ queryKey: ['uploadHistory'] })` az összes `uploadHistory` prefixű query-t frissíti — ez helyes. De a `refreshKey` változás miatt az éppen aktív query már egy másik key-en van, így az optimisztikus adat sosem jelenik meg az új query-ben.

## Javítási terv

### `UploadHistory.tsx`
- **Törölni a `refreshKey`-t a query key-ből**: A `queryKeys.uploadHistory()` hívásból eltávolítani a `refreshKey` paramétert
- A `refreshKey` prop megmarad, de nem a query key része lesz, hanem egy `useEffect`-ben figyeljük, és `refreshKey` változásakor `invalidateQueries`-t hívunk

### `src/lib/queryKeys.ts`
- Az `uploadHistory` factory-ból eltávolítani a `refreshKey` paramétert: `(companyId, activeTab, dateFrom, dateTo)` — 4 paraméter

### `ManualUpload.tsx`
- A `setUploadRefreshKey(k => k + 1)` hívásokat **eltávolítani** — feleslegesek, mert az `addToUploadHistoryCache` + `delayedUploadHistoryInvalidation` már biztosítja a frissítést
- A `delayedUploadHistoryInvalidation` marad biztonsági hálóként

### Érintett fájlok

| Fájl | Változás |
|---|---|
| `src/lib/queryKeys.ts` | `refreshKey` eltávolítása az `uploadHistory` key-ből |
| `src/components/UploadHistory.tsx` | `refreshKey` prop eltávolítása a query key-ből, `useEffect` alapú invalidáció hozzáadása |
| `src/pages/ManualUpload.tsx` | `uploadRefreshKey` state és `setUploadRefreshKey` hívások eltávolítása |

