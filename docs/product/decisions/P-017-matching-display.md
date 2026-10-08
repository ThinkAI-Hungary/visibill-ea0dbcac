# P-017: AI Párosítás & Kapcsolódó Tranzakciók Megjelenítése

**Status:** Decided  
**Category:** Tranzakció & Párosítás

**Question:** Hogyan jelenítjük meg az AI és manuális párosítás eredményét a tranzakciók és számlák felületén?

**Decision:** 
1. **Tranzakciók nézet:** Confidence score + match type + reason DB-ben tárolva, részletek a `TransactionDetailsDialog`-ban és az `ExpandedInvoiceRow`-ban.
2. **Számlák nézet (Lenyitott számlasor):** A számlák táblázatában (`InvoicesPage`) a sor lenyitásakor az `ExpandedInvoiceRow` azonnal (0ms) megjeleníti a párosított tranzakció kártyáját (összeg, dátum, leírás, AI párosítási indoklás, Jóváhagyás és Párosítás megszüntetése gombok).

3. **Futárriportok nézet (`MatchedCourierReportsCard`):** A banki tranzakció részletező dialógusában (`TransactionDetailsDialog`) a futárszolgálati elszámolásokhoz (GLS, DPD, MPL, stb.) kapcsolódó csomagok és utánvétek kiemelt kártyán jelennek meg:
   - **Összesítő fejléc szétválasztás:** A kötegelt riport összefoglaló sora (`row_type = 'total'`) a tételsorok felett, külön sávban látható (futárcég, összes csomag, végösszeg).
   - **NAV Számlaszám Kitűző:** Minden csomagtétel mellett explicit kék kitűző mutatja a párosított vevői NAV számlaszámot (`HU...`), azonnal ellenőrizhetővé téve az összerendelést.
   - **1-Kattintásos Kötegelt Jóváhagyás:** A kártya fejlécében elérhető `Mind jóváhagyása` gombbal a felhasználó egyetlen kattintással véglegesíti az összes riport-tételt a banki tranzakcióhoz.

4. **Többszörös Párosítás Jóváhagyási Kapu (`Approval Gate` — A-128):**
   - Amikor egy banki tranzakció közleménye több különálló számlaszámot hordoz, de a számlák bruttó végösszege nem egyezik a tranzakció összegével, a rendszer a megbízhatóságot fixen `0.85`-re korlátozza (< 0.90 automata küszöb).
   - A felületen a tranzakció és a számlasor a pontos eltérés indoklásával jelenik meg: `(összeg eltér: számlák X Ft != tranzakció Y Ft) (jóváhagyásra vár)`.
   - A tétel ellenőrizetlen (`is_verified = false`) marad, így a könyvelő a felületen egy kattintással áttekintheti és manuálisan hagyhatja jóvá az összerendelést.

5. **Beküldött számlák táblázat és sor (`SubmittedInvoiceTable` & `SubmittedInvoiceRow` — A-173):**
   - **Dedicált Státusz Kitűző:** A beküldött számlák táblázata a NAV számlákhoz hasonlóan különálló „Státusz” oszlopot kapott (`Kifizetve` zöld kitűző, `Részben fizetve` borostyán, `Nyitott` szürke), amelyet a szerveroldali `get_filtered_submitted_invoices` RPC `nav_matches` és `sub_matches` CTE-je határoz meg.
   - **Kétirányú Zöld Sorkiemelés:** Ha a számlához közvetlenül (pl. külföldi számlánál) vagy a párosított NAV számlán keresztül banki tranzakció kapcsolódik, a sor a NAV számlákhoz teljesen megegyezően zöld háttérkiemelést (`bg-emerald-500/5 hover:bg-emerald-500/10`) és zöld számlaszám színt kap.
   - **Fizetési mód fallback:** Ha a feltöltött számlánál a `fizetesi_mod` nincs közvetlenül kitöltve, a felület automatikusan átveszi a párosított NAV számla fizetési módját (`navMatches[0]?.payment_method`), megelőzve a hiányos „Nem megadott” címke megjelenését.

**Jelenlegi állapot:**
- `confidence_score` — DB-ben tárolva (transactions tábla)
- `match_type` — DB-ben tárolva (transactions tábla: `exact`, `amount_date`, `ai_suggested`, `manual`)
- `reason` / `gl_reasoning` — DB-ben tárolva, magyarázat a párosítás miértjére (összeg-eltérés esetén figyelmeztetéssel)
- `is_verified` — Manuális jóváhagyás flag
- **ExpandedInvoiceRow:** Mind a NAV, mind a feltöltött számlák lenyitásakor azonnal rendereli a párosított banki tranzakciókat és a feltöltött számlaképeket.
- **MatchedCourierReportsCard:** Részletes csomagszintű és NAV számlaszintű bontás, kötegelt jóváhagyási akcióval.
- **SubmittedInvoiceTable & SubmittedInvoiceRow:** Teljes vizuális és funkcionális paritás a NAV számlák táblázatával (Státusz kitűző, zöld sor, Fiz. mód fallback).
- Részletek dialógusban megtekinthetők (`TransactionDetailsDialog.tsx`).

## Kapcsolódó
- [A-173: Kétirányú Számlalánc és Tranzakció Propagáció](../../architecture/decisions/A-173-invoice-chain-transaction-propagation.md)
- [A-059: TransactionMatchingCore & Moduláris UI Architektúra](../../architecture/decisions/A-059-transaction-matching-core-and-modular-ui.md)
- [A-128: Szigorított Számlaszám Határ-illesztés és Multi-Match Jóváhagyási Kapu](../../architecture/decisions/A-128-strict-invoice-number-boundary-matching-and-subsumption-guard.md)
- [A-112: Futárszolgálati Kompenzációs Értesítők Kétirányú Automatikus Számlarendezése és Futárriport UI Párosítás](../../architecture/decisions/A-112-courier-compensation-inbound-invoice-auto-settlement.md)
- [P-054: Scalable Server-Side Invoice Pagination & Page-Level Batch Matching UX](./P-054-server-side-invoice-pagination-and-kpi-filters-ux.md)
- [A-014: React Query Cache Stratégia](../../architecture/decisions/A-014-react-query-cache.md)
- [P-018: Manuális párosítás felülírás](./P-018-manual-matching.md)
- [P-140: Számlázz.hu Saját Kimenő Számlaképek Lehívása és NAV Párosítás](./P-140-szamlazz-hu-outbound-invoice-image-sync-and-pairing.md)
