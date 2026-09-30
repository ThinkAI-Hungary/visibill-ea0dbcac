# A-184: Real-time AI Categorization Progress Streaming, Invalidation & Idempotency Safeguards

**Status:** Decided  
**Date:** 2026-09-30  
**Utoljára frissítve:** 2026-09-30  

---

## Context

A termelési hiba audit során (/visibill-error-hunter) két kritikus stabilitási kockázatot azonosítottunk a főkönyvi modulban és a banki tranzakció-párosításban:

1. **Adatbázis Statement Timeout & Csatlakozás-kimerülés a Főkönyvben:**  
   A `GeneralLedgerTable.tsx` korábban 3 másodperces agresszív frontend pollingot alkalmazott (`refetchInterval: isPolling ? 3000 : false`), miközben az AI tételbesorolási feladat futott. A lekérdezés a rendkívül számításigényes `get_gl_balances` SQL RPC függvényt futtatta újra és újra, ami több száz vagy ezer könyvelt tételnél pillanatok alatt kimerítette a Supabase Postgres connection pool-t, és HTTP 500 `canceling statement due to statement timeout` hibákat okozott.
2. **Hiányzó Query Invalidáció Tételes Nézetben:**  
   Az AI befejezésekor a rendszer invalidálta a `glBalances`, `glItems`, és `glJournalItems` query-ket, de a `glCategorizedItems` kulcs kimaradt, így Tételes (by_item) nézetben a felhasználó nem látta azonnal a frissen besorolt tételeket manuális oldalújratöltés nélkül.
3. **Beragadó UI Folyamat Worker Leálláskor:**  
   Ha a Python worker folyamat váratlanul leállt vagy a szerver újraindult egy futó besorolási feladat közben, a `gl_upload_notifications` táblában a rekord örökre `pending` vagy `processing` állapotban maradt. Emiatt az oldal betöltésekor a felület folyamatosan letiltotta az AI gombot és "AI Fut..." állapotot mutatott.
4. **Dupla Mentési / Idempotencia Hiba Tranzakció Párosításkor:**  
   Gyors egymásutáni kattintások (double-click) vagy konkurens események esetén a `matchingService.ts` közvetlen `insert`-et próbált végezni a `transaction_invoice_matches` táblába, ami `23505 duplicate key value violates unique constraint "uq_transaction_invoice_match"` hibához vezetett.

---

## Decision

Úgy döntöttünk, hogy a polling mechanizmust teljesen megszüntetjük, és eseményvezérelt, fojtott valós idejű telemetriára, szigorú kliensoldali érvényesség-vizsgálatra és idempotens adatbázis műveletekre állunk át.

### 1. Eseményvezérelt Realtime Progress Streaming Polling Helyett
* A `GeneralLedgerTable.tsx`-ben a `refetchInterval` értéke véglegesen `false` lett. A query `staleTime`-ja 30 másodpercre nőtt, és `placeholderData: (prev) => prev` védi a villogástól.
* A Python worker (`worker.py` / `db.py`) a besorolási ciklus során fojtott (throttled) telemetriát küld a `gl_upload_notifications` táblába (`items_processed`, `items_total`), minden 3. feldolgozott tétel után, vagy ha legalább 1.5 másodperc eltelt az előző frissítés óta, illetve az utolsó tételnél.
* A frontend (`GeneralLedgerPage.tsx`) egy Supabase Realtime csatornán (`ai_notifications`) hallgatja az `UPDATE` eseményeket, és azonnal frissíti a folyamatjelző komponenst anélkül, hogy akár egyetlen pénzügyi lekérdezést is indítana a háttérben.

### 2. Teljeskörű Query Invalidáció Befejezéskor
A feladat befejezésekor (`completed` esemény) a frontend automatikusan és atomian invalidálja az összes kapcsolódó nézetet:
```typescript
queryClient.invalidateQueries({ queryKey: ['glBalances'] });
queryClient.invalidateQueries({ queryKey: ['glItems'] });
queryClient.invalidateQueries({ queryKey: ['glJournalItems'] });
queryClient.invalidateQueries({ queryKey: ['glCategorizedItems'] });
```

### 3. 15 Perces Időkorlátos Érvényesség Vizsgálat (Stale Job Guard)
A betöltéskori (`useEffect`) állapotlekérdezés kizárólag a 15 percnél nem régebbi aktív feladatokat veszi figyelembe:
```typescript
const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
supabase
  .from('gl_upload_notifications')
  .select('processing_status, items_processed, items_total, created_at')
  .eq('company_id', selectedCompany.id)
  .in('processing_status', ['pending', 'processing'])
  .gte('created_at', fifteenMinutesAgo)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle()
```
Ez garantálja, hogy egy korábban összeomlott háttérfolyamat soha ne bénítsa meg a felhasználói felületet.

### 4. Idempotens Tranzakció-Számla Párosítás
A `matchingService.ts` `saveMatch` függvénye `upsert`-et használ az `onConflict: 'transaction_id,invoice_id'` és `ignoreDuplicates: true` direktívákkal:
```typescript
const { data, error } = await supabase
  .from('transaction_invoice_matches')
  .upsert(matchData, { onConflict: 'transaction_id,invoice_id', ignoreDuplicates: true })
  .select()
  .maybeSingle();
```
Ez elnyeli a hálózati retry-okból és a duplakattintásokból származó ütközéseket.

---

## Consequences

### Pozitív
* **Nulla felesleges adatbázis terhelés:** Megszűnt az 500-as statement timeout hiba a főkönyvben, a háttérben futó AI besorolás alatt a DB CPU és connection pool használata minimális marad.
* **Valós idejű felhasználói visszajelzés:** A könyvelő pontosan látja, hogy hány tétel van kész a teljes mennyiségből (pl. `51 / 307 tétel besorolva (17%)`), mind a felső sávban, mind az eszköztár gombján.
* **Azonnali adatszinkron Tételes nézetben is:** Nincs szükség manuális F5 frissítésre a besorolási eredmények megtekintéséhez.
* **Öngyógyító UI állapot:** Szerverhiba esetén a felület maximum 15 perc elteltével automatikusan feloldja a zárolást.
* **100%-os duplikáció-védelem:** A párosítási tranzakciók nem buknak el a felhasználói duplakattintások miatt.

### Negatív / Kockázatok
* A Realtime WebSocket kapcsolatra való támaszkodás miatt hálózati szakadás esetén az átmeneti progress számláló megállhat (de a befejező toast és az invalidáció a reconnect után beérkezik).

---

## Kapcsolódó
* [A-006: Python Worker architektúra](./A-006-python-worker.md)
* [A-014: React Query Cache Stratégia](./A-014-react-query-cache.md)
* [A-059: Tranzakció Párosítási Mag & Moduláris UI Architektúra](./A-059-transaction-matching-core-and-modular-ui.md)
* [A-182: Részfizetés Párosítás & Tranzakció Deduplikáció](./A-182-partial-payment-matching-and-transaction-deduplication.md)
* [A-183: Supabase Query Teljesítmény és Pénzügyi RPC Optimalizáció](./A-183-supabase-query-performance-and-financial-rpc-optimization.md)
* [P-147: Főkönyvi AI Tételbesorolás Valós Idejű Folyamatjelző UX](../../product/decisions/P-147-gl-ai-categorization-realtime-progress-banner-ux.md)
