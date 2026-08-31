# ADR A-059: TransactionMatchingCore & Moduláris UI Architektúra

## Státusz
Elfogadva (Decided) — 2026-08-31

## Kontextus és Probléma
A korábbi implementációban a [`TransactionDetailsDialog.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/TransactionDetailsDialog.tsx) (2173 sor) és az [`ExpandedInvoiceRow.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ExpandedInvoiceRow.tsx) (1611 sor) közvetlenül tartalmazta a teljes tranzakció- és számlapárosítási logikát, 10 különböző adatbázis-tábla lekérdezését, a deviza- és toleranciaszűrést, valamint 17+ ad-hoc `queryClient.invalidateQueries` hívást. Ez a mély logika a UI rétegbe szivárgott, mikrolagokat okozott a görgetéskor és megakadályozta az automatizált headless tesztelhetőséget.

## Döntés
1. **Mély Modul (`TransactionMatchingCore`):**
   - Létrehoztunk egy tiszta TypeScript domain réteget a `src/lib/matching/` alatt:
     - `types.ts`: Domain típusdefiníciók (`MatchCandidate`, `MatchOverridePayload`, `TransactionItem`, stb.)
     - `candidateFinder.ts`: Toleranciaszámítások (±30% azonos deviza, ±50% cross-currency), devizakonverzió (HUF approx rates), minimum 10 tétel garancia, keresési rangsorolás.
     - `matchingKeys.ts`: Egységesített query kulcsok és koordinált `invalidateMatchingQueries(queryClient, companyId)` segédfüggvény (15 kulcs atomi érvénytelenítése).
     - `matchingService.ts`: Koncentrált DB műveletek (`applyMatch`, `unmatchTransaction`, `verifyMatch`, `markNoInvoice`, `markInvoiceMissing`, `revertStatus`, `addExtraMatch`, `removeExtraMatch`, `bookTransactionDirect`, `unbookTransactionDirect`, `logMatchOverride`).
2. **React Query Állapotkezelő Hook (`useTransactionMatching`):**
   - A `src/hooks/useTransactionMatching.ts` hook biztosítja a React Query cache integrációt, a debounced szerver-keresést, az optimista visszajelzéseket és a hibakezelést.
3. **UI Dekompozíció:**
   - A `TransactionDetailsDialog.tsx` vékony orchestrator komponenssé (<220 sor) alakult, amely 8 fókuszált subkomponensre támaszkodik (`TransactionHeader`, `TransactionCard`, `MatchedCourierReportsCard`, `MatchedEntityCard`, `TransactionMultiMatchesList`, `ManualMatchSearchSection`, `TransactionGlAccountSelector`, `TransactionNotesSection`).
4. **Kettőzés Felszámolása:**
   - Az `ExpandedInvoiceRow.tsx` és a `useTransactionMatcher.ts` átállt a központi `matchingService` és `matchingKeys` használatára.

## Következmények & Előnyök
- **Tesztelhetőség:** A teljes párosítási, keresési és unmatch logika headless környezetben, DOM nélkül tesztelhető Vitest-tel (100%-os lefedettség).
- **Teljesítmény:** Megszűntek a felesleges re-renderek és a koordinálatlan lekérdezés-viharok.
- **Karbantarthatóság:** A 2173 soros monolit felbontásával a komponensek könnyen átláthatók, módosíthatók és bővíthetők.
