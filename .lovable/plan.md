

# Feltöltési előzmények frissítési probléma javítása

## Feltárt problémák

### 1. Hiányzó `refreshKey` növelés két upload handler-ben
- **`handleSalaryUpload`**: sikeres feltöltés után NEM hívja a `setUploadRefreshKey(k => k + 1)`-et — a query key nem változik, így a lista nem frissül.
- **`handleBankStatementUpload`**: szintén hiányzik a `setUploadRefreshKey` hívás.
- Az `handleInvoiceUpload` és `handleTransactionUpload` viszont helyesen hívják.

### 2. Realtime versenyhelyzet (race condition)
A Supabase Realtime értesítés a DB INSERT után azonnal kiváltódik, de gyakran *hamarabb* érkezik meg, mint hogy a kliens-oldali `await` visszatérne. Ilyenkor:
1. Realtime esemény → query invalidáció → újra-fetch → **régi adat** (mert az INSERT még nem commitálódott a kliens szemszögéből)
2. Kliens `await` visszatér → de már nincs újabb invalidáció → **elavult lista marad**

## Javítási terv

### 1. lépés — `setUploadRefreshKey` hozzáadása a hiányzó handler-ekhez
**Fájl:** `src/pages/ManualUpload.tsx`
- `handleSalaryUpload`: a `setSelectedSalaryFiles([])` után (sor ~536) hozzáadni `setUploadRefreshKey(k => k + 1)`
- `handleBankStatementUpload`: a `setSelectedBankFiles([])` után (sor ~440) hozzáadni `setUploadRefreshKey(k => k + 1)`

### 2. lépés — Explicit query invalidáció a realtime mellett
**Fájl:** `src/pages/ManualUpload.tsx`
- Importálni `useQueryClient`-et a `@tanstack/react-query`-ből
- Minden sikeres upload handler végén (invoice, salary, transaction, bank) explicit invalidálni:
  ```
  queryClient.invalidateQueries({ queryKey: ['uploadHistory'] })
  ```
- Ezt egy rövid `setTimeout(..., 800)` késleltetéssel meghívni, hogy a DB commit biztosan megtörténjen mire a refetch indul. Ez a „biztonsági háló" a realtime race condition ellen.

### Érintett fájl
- `src/pages/ManualUpload.tsx` — 2 hiányzó `setUploadRefreshKey` + delayed invalidation minden handler-ben

