

# Feltöltési előzmény azonnali megjelenítése a toast-tal egyidőben

## Probléma
A `setUploadRefreshKey` megváltoztatja a query key-t, ami új fetch-et indít, de ez aszinkron — a toast azonnal megjelenik, a lista viszont csak a fetch visszatérése után frissül (néhány száz ms késéssel).

## Megoldás: Optimisztikus frissítés
A sikeres DB insert után az upload rekord adatai már rendelkezésre állnak lokálisan. Ahelyett, hogy megvárnánk a refetch-et, **optimisztikusan hozzáadjuk az új rekordot a meglévő query cache-hez** a `queryClient.setQueryData` segítségével — így a lista azonnal frissül a toast-tal egy időben.

## Érintett fájl
`src/pages/ManualUpload.tsx`

## Lépések

### 1. Segédfüggvény: optimisztikus upload cache frissítés
Létrehozunk egy `addToUploadHistoryCache` függvényt, ami:
- A `queryClient.getQueriesData` segítségével megkeresi az aktív `uploadHistory` query-t
- `queryClient.setQueryData`-val az új rekordot a `records` tömb elejére szúrja
- Ez **szinkron** — azonnal frissíti a UI-t

### 2. Minden handler-ben: toast + optimistic update egyszerre
A sikeres feltöltés után (ahol a DB insert már visszatért az `uploadRecord`-dal):
1. Összeállítjuk az `UploadRecord` objektumot a kapott adatokból
2. Meghívjuk `addToUploadHistoryCache(newRecord)`-ot
3. Megjelenítjük a toast-ot
4. A `setUploadRefreshKey` + `delayedUploadHistoryInvalidation` továbbra is megmarad háttér-biztonsági hálóként (a feldolgozási státusz frissüléséhez)

### Technikai részletek
```text
Jelenlegi folyamat:
  DB insert → toast (azonnali) → setRefreshKey → fetch (aszinkron, ~200-500ms) → UI frissül

Új folyamat:
  DB insert → setQueryData (szinkron) + toast (azonnali) → UI frissül AZONNAL
            → setRefreshKey + delayed invalidation (háttérben, státusz frissítéshez)
```

A `setQueryData` hívás formátuma:
```ts
queryClient.setQueriesData(
  { queryKey: ['uploadHistory'] },
  (old) => old ? { ...old, records: [newRecord, ...old.records] } : old
);
```

Ez mind a 4 handler-re (invoice, bank, salary, transaction) alkalmazandó.

