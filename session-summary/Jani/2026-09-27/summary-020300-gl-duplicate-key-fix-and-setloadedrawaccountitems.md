# Session Summary — 2026-09-27 02:03

```text
fix(general-ledger): React duplikált kulcs hiba ('item_UUID') elhárítása egyedi és stabil rowKey/pseudoCid bevezetésével, setLoadedRawAccountItems setter javítás

- Főkönyvi Táblázat Duplikált React Kulcs Figyelmeztetések Megszüntetése (`GeneralLedgerTable.tsx`)
  - Felhasználói hibajelentés: a Főkönyv modulban (`/general-ledger`) számlák kinyitásakor és tételes nézetben tömeges figyelmeztetés jelent meg a böngésző konzoljában:
    `Warning: Encountered two children with the same key, 'item_380d0050-e5cd-4186-8781-b8a5ab5b2897'. Keys should be unique so that components maintain their identity across updates... at GeneralLedgerTableBase`
  - Gyökérok: a kettős könyvelés logikája miatt egyetlen számla vagy bizonylat (`item_id`) több különböző főkönyvi számlán is megjelenik (pl. vevőkövetelés 311, fizetendő áfa 467, árbevétel 911). A korábbi kódban a tételek `id`-ja mindenhol `item_${item.item_id}` volt, és a lapos `processedRows.map()` közvetlenül a `key={row.id}` attribútumot adta át a Reactnak. Több számla kinyitásakor az azonos számlalábak testvérként (`sibling`) renderelődtek ütköző kulcsokkal.
  - Architektúrális megoldás:
    - `LedgerItem` típusbővítés `rowKey?: string` mezővel
    - `processedRows` memoizációban számlához és forrástáblához kötött stabil `baseKey` generálás (`acc_${row.cid || row.id}`, `loading_...`, `loadmore_...`, `item_${row.cid}`), valamint `seenKeys` készlettel támogatott index-alapú ütközésvédelem
    - `pseudoCid` generálás kiterjesztése a forrástáblára és lokális előfordulási indexre (`${parentCid}_${item.source_table}_${item.item_id}_${occ}`) a `rawBatchItemsByGL`, `fetchAccountItemsOnDemand` és `fetchMoreAccountItems` eljárásokban
    - Keresési eredmények közvetlen beszúrásánál (`matchingSearchResults`) az `existingIds` halmaz azonnali frissítése a ciklusban, megelőzve az azonos azonosítójú entitások duplikált injektálását
    - JSX render ciklusban a `key={row.id}` cseréje `key={row.rowKey || row.id}` kulcsra a loading, loadmore és adatsoroknál
    - Index-alapú kulcsvédelem beépítése az `excludedItems` (nem könyvelt tételek) és dialógus-listák (`CommandItem`, `journalEntries`) renderelésébe

- `handleSelectSearchResult` Típus- és Setter-javítás (`GeneralLedgerTable.tsx`)
  - A keresési találatra kattintáskor futó `setLoadedAccountItems` hívás (amely nem létező azonosító volt, mivel a `loadedAccountItems` egy memoizált Map) kijavítása a valós `setLoadedRawAccountItems` állapotfrissítő setter-re
  - A beszúrt elem `pseudoCid` generálásának igazítása a forrástábla-alapú formátumhoz

- Minőségbiztosítás és Verifikáció
  - Új dedikált egységteszt: `src/components/general-ledger/__tests__/GeneralLedgerUniqueKeys.test.tsx` (konzol warning elkapó spy-jal, kiterjesztett számlalábak szimulációjával és duplikált tétel-ellenőrzéssel)
  - Vitest tesztcsomag: a `src/components/general-ledger` összes tesztje hibátlanul lefutott (11 tesztfájl, 37 teszt sikeres, 3.67s)
  - TypeScript fordítási ellenőrzés: `npx tsc --noEmit` 0 hibával lefutott
  - Production Vite build: `npm run build` sikeresen lefutott (22.55s)
  - Tudásgráf szinkronizáció: `graphify update .` lefutott (21638 csomópont, 37201 él)
```
