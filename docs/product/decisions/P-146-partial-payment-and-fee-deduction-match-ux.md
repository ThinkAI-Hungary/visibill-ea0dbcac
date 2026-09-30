# P-146: Részfizetett és Jutalékkal Csökkentett Számlák Státuszkijelzése és Felismerése UX

**Status:** Decided  
**Date:** 2026-09-30  
**Category:** Invoices / Matching / Bank Reconciliation / UX  
**Question:** Hogyan jelenjen meg a számlalistában és a tranzakció-párosítóban, ha egy számlára csak részösszeg érkezett be, vagy jutalékkal / kezelési díjjal csökkentett utalás történt?  
**Decision:** 
1. **Számlalista megjelenítés:** Ha a párosított tranzakció összege kisebb a számla bruttó végösszegénél (eltérés > 0.50 Ft), a számla státusza kötelezően `Részben fizetve` (`partially_paid`), és kék/amber státuszbadge jelenik meg. A badge tooltipje explicite megmutatja a már kifizetett összeget (`paid_amount`) és a még nyitott fennmaradó összeget (`remaining_amount`).
2. **Kézi párosítás prioritás:** Ha a banki tranzakció közleménye tartalmazza a számla sorszámát (akár prefixálva, pl. `Jutalék2026/SI/UK...`), a kézi párosítási fiókban (`ManualMatchSearchSection`) az adott számla automatikusan a legelső, kiemelt (#1) helyen jelenik meg, függetlenül attól, hogy a tranzakció összege kívül esik-e a normál ±30%-os tolerancián.
3. **Jutalékkezelés:** Ha a felhasználó a tranzakciónál rögzíti a levont jutalékot (`fee_amount`), a rendszer ezt automatikusan beleszámolja a számla fedezetébe (`tényleges jóváírás + jutalék = számla bruttó`).

**Current Implementation:**
- `src/features/invoices/components/table/NavInvoiceRow.tsx` és `SubmittedInvoiceRow.tsx`: a `partially_paid` státusz esetén tooltip mutatja a kifizetett és nyitott összeget.
- `src/lib/matching/candidateFinder.ts`: `isInvoiceNumberInDescription` révén a közleményben szereplő számlák prioritást élveznek.
- `src/hooks/useTransactionMatching.ts`: átadja a `transaction.description` értékét a jelöltkeresőnek.

**Rationale:** A könyvelőirodák partnerei gyakran utalnak jutalékkal vagy banki költséggel csökkentett összeget (pl. Fundamenta, SimplePay, Barion). Ha a rendszer ilyenkor a számlát tévesen 100%-ban kifizetettként jeleníti meg, a könyvelő nem látja a hiányt, és nem tudja elszámolni a levont jutalékköltséget.

## Kapcsolódó
- [A-182: Részfizetés és Jutaléklevonás Számlapárosítás és Deduplikációs Architektúra](../../architecture/decisions/A-182-partial-payment-matching-and-transaction-deduplication.md)
- [P-064: Partially Paid Invoice Status UX](./P-064-partially-paid-invoice-status-ux.md)
- [P-104: Transaction Fee and Invoice Number Export UX](./P-104-transaction-fee-and-invoice-number-export-ux.md)
- [A-139: Tranzakciós jutalék (fee_amount) és kötegelt számlaszám-feloldás](../../architecture/decisions/A-139-transaction-fee-amount-and-batch-invoice-resolution.md)
