# A-182: Részfizetés és Jutaléklevonás Számlapárosítás és Deduplikációs Architektúra

**Status:** Decided  
**Date:** 2026-09-30  
**Utoljára frissítve:** 2026-09-30  
**Category:** Database / Invoices / Matching / Bank Reconciliation / RPC  

## Context

A Visibill számla- és banki tranzakció párosítási alrendszerében a részfizetések és jutalékkal csökkentett utalások kezelése kapcsán kritikus inkonzisztencia merült fel:

1. **Tranzakció Összeg Duplázódás (Double-Counting) az RPC-kben:**
   Az `A-173` döntés (`20260928150000_invoice_chain_transaction_propagation.sql`) bevezette, hogy az elsődleges számlapárosítások nemcsak a `transactions.matched_invoice_id` mezőben, hanem a `transaction_invoice_matches` táblában is rögzítésre kerülnek a számlaláncolatok (díjbekérő ↔ végszámla) felé történő propagáció biztosítására.
   Ugyanakkor a számlalistát és KPI-okat kiszolgáló adatbázis RPC függvények (`get_filtered_nav_invoices`, `get_filtered_submitted_invoices`, `get_invoice_kpis`) egymástól függetlenül kapcsolták össze mindkét forrást:
   - `LEFT JOIN tx_matches tm ON tm.matched_invoice_id = ni.id` (`SELECT matched_invoice_id, SUM(ABS(amount)) as total_paid_amount FROM transactions...`)
   - `LEFT JOIN tim_matches tim ON tim.invoice_id = ni.id` (`SELECT invoice_id, SUM(ABS(amount)) as total_tim_amount FROM transaction_invoice_matches...`)
   és a kifizetett összeget összeadással számolták:
   `COALESCE(tm.total_paid_amount, 0) + COALESCE(tim.total_tim_amount, 0)`.
   Ennek következtében minden olyan tranzakció, amely mindkét helyen szerepelt, **kétszeresen adódott hozzá** a kifizetett összeghez! Például egy 16 315 Ft-os számlára érkező 10 575 Ft-os utalást a rendszer `10 575 + 10 575 = 21 150 Ft`-nak számolt, ami meghaladta a bruttó összeget, így a számla tévesen teljes mértékben kifizetettként (`matched`, `paid = true`) jelent meg, elfedve a nyitott 5 740 Ft tartozást.

2. **Korai Short-Circuit a `bf.paid = true` Flagon:**
   Az RPC-k státuszmeghatározó `CASE` kifejezésében a legelső feltétel `WHEN bf.paid = true THEN 'matched'` volt. Ha egy számlát a korábbi kliensoldali kód vagy hibás trigger `paid = true`-ra állított, az RPC azonnal zöld `matched` státuszt adott vissza, függetlenül attól, hogy a valós tranzakció fedezte-e a bruttó összeget.

3. **Kliensoldali Hibás Felülbírálás (`matchingService.ts`):**
   A manuális párosítás jóváhagyásakor az `applyMatch` frontend függvény explicite `.update({ paid: true, ... })` hívást intézett a számlatáblákhoz, megelőzve az adatbázis triggerek összegvizsgálatát.

4. **Közleményben Szereplő Számlaszám Figyelmen Kívül Hagyása Összegeltérés Esetén:**
   A `candidateFinder.ts` algoritmus szigorú ±30%-os bruttó összegeltérési szűrőt alkalmazott. Ha egy utalásnál jutalékot vontak le (pl. 10 575 Ft vs. 16 315 Ft, ami 35.2%-os eltérés), az algoritmus egyáltalán nem ajánlotta fel a számlát a tranzakció párosításakor, hiába szerepelt a közlemény rovatban pontosan a számla sorszáma.

---

## Decision

1. **Deduplikált Tranzakciós Halmaz (`all_tx_distinct`) SQL `UNION`-nal:**
   A `get_filtered_nav_invoices`, `get_filtered_submitted_invoices` és `get_invoice_kpis` RPC függvényekben a különálló `tx_matches` és `tim_matches` CTE-ket egyetlen deduplikált CTE-re cseréltük:
   ```sql
   all_tx_distinct AS (
     SELECT id as tx_id, matched_invoice_id as invoice_id, amount, fee_amount, company_id
     FROM transactions
     WHERE matched_invoice_id IS NOT NULL AND status = 'matched'
     UNION
     SELECT t.id as tx_id, tim.invoice_id, t.amount, t.fee_amount, t.company_id
     FROM transaction_invoice_matches tim
     JOIN transactions t ON t.id = tim.transaction_id
   )
   ```
   Az SQL `UNION` (szemben a `UNION ALL`-lal) kiszűri az azonos rekordokat, így ha egy tranzakció mind a `transactions.matched_invoice_id`, mind a `transaction_invoice_matches` struktúrában létezik, az aggregációban (`SUM(ABS(amount) + COALESCE(fee_amount, 0))`) pontosan **egyszer** vesz részt.

2. **Valós Tranzakciós Összeg Prioritása a `paid` Flag felett:**
   Az RPC-kben a státusz logikája megfordult:
   - Ha a kapcsolódó tranzakciók összege (`paid_amount`) eléri a bruttó összeget (`>= gross_amount - 0.5`) VAGY kézi készpénzes/banki jelölés van (`is_manual_payment = true`, `payment_method = 'CASH'`): `'matched'`.
   - Ha `paid_amount > 0` ÉS `paid_amount < gross_amount - 0.5`: szigorúan `'partially_paid'`, és a `paid` kimeneti mező értéke `false`.
   - A `bf.paid = true` feltétel csak akkor érvényesül, ha nincs kapcsolódó banki tranzakció (`paid_amount = 0`).

3. **Jutalékösszeg (`fee_amount`) Integrálása az Egyenlegbe:**
   A levont kártyás/közvetítői jutalék (`fee_amount`) a tranzakció összegéhez adódik a számla fedezetének vizsgálatakor (`ABS(amount) + COALESCE(fee_amount, 0)`), így jutalékos elszámolásnál a számla maradéktalanul kifizetetté válhat, ha a jóváírás és a levont jutalék együtt kiadja a számlaértéket.

4. **Kliensoldali Tisztítás és Trigger Autoritás:**
   A `src/lib/matching/matchingService.ts` fájlból eltávolításra került a hardkódolt `paid: true` beállítás. A kifizetettségi státuszt kizárólag az adatbázis trigger (`mark_nav_invoice_paid_on_transaction_match` / `mark_invoice_paid_on_multi_match`) jogosult `true`-ra állítani, ha az összeg fedezi a számlát.

5. **Közlemény-alapú Kiemelt Jelöltfelismerés (`candidateFinder.ts`):**
   Ha a tranzakció közleménye tartalmazza a számla sorszámát (`isInvoiceNumberInDescription`), a számla kiemelt (#1) jelöltként bekerül a javaslatok közé, felülbírálva a normál ±30%-os toleranciakorlátot.

---

## Consequences

**Pozitív:**
- **Nulla duplikáció:** Megszűnt a tranzakciós összegek többszörös aggregációja a számlalistában és a pénzügyi mutatókban (KPI).
- **Pontos részfizetési transzparencia:** A felhasználó azonnal látja a `Részben fizetve` badge-et, a tooltipben a kifizetett és nyitott összegeket.
- **Ergonómikus párosítás:** A bankkártyás/közvetítői csökkentett utalások sorszám alapján azonnal párosíthatók.

**Negatív / Költségek:**
- A `UNION` művelet minimális memóriahasználattal jár a PostgreSQL CTE végrehajtásakor, azonban a cég-szintű szűrés és a meglévő B-tree indexek miatt a lekérdezési idő változatlanul 10-30 ms között marad.

---

## Kapcsolódó
- [A-082: Partially Paid Invoices Status, Server-Side Amount Aggregation & Trigger Alignment](./A-082-partially-paid-invoices-status.md)
- [A-139: Tranzakciós jutalék (fee_amount) és kötegelt számlaszám-feloldás](./A-139-transaction-fee-amount-and-batch-invoice-resolution.md)
- [A-173: Számlalánc Tranzakció-örökítés, Díjbekérő-Végszámla Automatikus Párosítás és PostgreSQL Propagáció](./A-173-invoice-chain-transaction-propagation.md)
- [P-146: Részfizetett és Jutalékkal Csökkentett Számlák Státuszkijelzése és Felismerése UX](../../product/decisions/P-146-partial-payment-and-fee-deduction-match-ux.md)
- [P-145: Ügyféllista és Cégválasztók ABC Sorrendezése UX](../../product/decisions/P-145-company-selector-alphabetical-sorting-ux.md)
- [P-064: Partially Paid Invoice Status, Badge & Filter UX](../../product/decisions/P-064-partially-paid-invoice-status-ux.md)
