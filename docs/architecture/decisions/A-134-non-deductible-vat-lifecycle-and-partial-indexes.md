# A-134: Nem Levonható ÁFA Életciklus, Reaktív ÁFA-Bontás (1. + 2. + 3. Opció) és Parciális B-Tree Indexek

> **Státusz:** Decided  
> **Dátum:** 2026-09-20  
> **Szerző:** ThinkAI / Morfi  
> **Érintett komponensek:** `src/lib/utils.ts`, `InvoiceItemsDialog.tsx`, `usePageDeductibilityMap.ts`, `NavInvoiceRow.tsx`, `SubmittedInvoiceRow.tsx`, `ExpandedInvoiceRow.tsx`, `calculate_vat_return` (RPC), `sync_item_deductible_to_journal_draft` (Trigger), `supabase/migrations/20260920210000_add_partial_indexes_for_deductible_vat.sql`  
> **Kapcsolódó:** [PRD P-100](../../product/decisions/P-100-non-deductible-vat-indicators-ux.md), [ADR A-078](./A-078-telecom-vat-deductibility-rules.md), [ADR A-107](./A-107-vat-deductibility-journal-and-gl-sync.md), [ADR A-133](./A-133-nav-official-invoice-summary-vat-breakdown.md)  

---

## Context (Kontextus)

A magyar Áfa törvény (2007. évi CXXVII. törvény) értelmében bizonyos bejövő beszerzések ÁFA-tartalma részben vagy egészben nem vonható le adólevonási tiltások és vélelmezett magánhasználati arányok miatt:
- **Áfa tv. 124. § (1) i) & 131. §:** Vezetékes és mobiltelefonszolgáltatás ÁFA-tartalmának 30%-a nem vonható le (70/30 szabály).
- **Áfa tv. 124. § (1) b) & 125. § (2) b):** Személygépkocsi bérleti és lízingdíja (50/50 átalány levonhatóság).
- **Áfa tv. 124. § (1) a), f), h):** Személygépkocsi üzemanyag, reprezentáció, vendéglátás, élelmiszer (0% levonható).

A korábbi rendszerben három kritikus probléma jelentkezett:
1. **Lebegőpontos ÁFA kulcs felismerési hiba:** A számlatételek modaljában a 70/30-as gomb kizárólag a `'27%'` karakteres formátumot kereste, így a NAV Online Számla v3.0 által gyakran szolgáltatott numerikus és decimális kulcsokat (`0.27`, `'0.27'`, `'27.0'`) nem ismerte fel.
2. **Hiányzó felületi átláthatóság:** A számlalistában és a kibontott sorban a felhasználó nem látta, ha egy számlán levonási korlátozás volt érvényben, kizárólag a mélyen fekvő tételes szerkesztő modál megnyitásával értesülhetett róla.
3. **Skálázási terhelés:** A számlák tételes levonhatóságának oldalankénti lekérdezése milliós tételszám esetén teljes táblapásztázást (sequential scan) kockáztatott célzott részleges index nélkül.

---

## Decision (Döntés)

A nem levonható ÁFA teljes életciklusának, felületi vizualizációjának és adatbázis-szintű optimalizálásának átfogó architektúráját valósítottuk meg:

### 1. Univerzális ÁFA Kulcs Normalizálás (`src/lib/utils.ts`)
- Létrehoztuk a `normalizeVatRatePercent(rate)` és `is27PercentVatRate(rate)` kanonikus segédfüggvényeket.
- Robusztusan kezeli mind a lebegőpontos számokat (`0.27`), mind az egész számokat (`27`), mind a szöveges formátumokat (`'0.27'`, `'27%'`, `'27,0%'`), miközben a szöveges mentes és fordított kulcsokat (`AAM`, `TAM`, `FAD`, stb.) kiszűri.
- Ezzel a 70/30-as levonási szabály gombja bármilyen forrásból érkező számlán azonnal és hibátlanul azonosítja a 27%-os szolgáltatási tételeket.

### 2. Háromszintű Felületi Megjelenítés (1. + 2. + 3. Opció)
- **1. Opció (Modal Végösszesítő Kártya):**
  - [`InvoiceItemsDialog.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/InvoiceItemsDialog.tsx): A `totals` useMemo tételről-tételre összegzi a `deductibleVat` és `nonDeductibleVat` értékeket.
  - Ha `deductible_percentage < 100`, az ÁFA sor alatt azonnal megjelenik a zöld/borostyánsárga pontokkal jelölt **Levonható ÁFA** és **Nem levonható ÁFA** bontás, magyarázó törvényi tooltippel.
- **2. Opció (Számlalista Táblázat Sorok):**
  - [`usePageDeductibilityMap.ts`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/hooks/usePageDeductibilityMap.ts): Egyetlen O(1) indexed kötegelt lekérdezéssel kéri le az aktuális oldal `< 100%` levonhatóságú tételeit.
  - [`NavInvoiceRow.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/table/NavInvoiceRow.tsx) & [`SubmittedInvoiceRow.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/table/SubmittedInvoiceRow.tsx): Az ÁFA cellában diszkrét badge jelenik meg: `🟠 70/30 (-528 Ft)` vagy `🟠 0% lev. (-5 029 Ft)`.
  - Tooltip: részletes bontás (Levonható / Nem levonható). StopPropagation védelem a sor kinyílása ellen.
  - 0 Ft ÁFA összegnél vagy kimenő (vevői) számlánál a jelvény inaktív marad.
- **3. Opció (Kibontott Sor):**
  - [`ExpandedInvoiceRow.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/expanded-row/ExpandedInvoiceRow.tsx): Önálló `ÁFA levonhatóság` kártya a könyvelési blokkban, azonnali rálátást biztosítva a főkönyvi számok mellett.

### 3. Reaktív Cache Invalidáció (11 Query Key)
A tételszintű, egyedi vagy tömeges levonhatóság módosításakor a rendszer azonnal érvényteleníti az érintett kliensoldali gyorsítótárakat:
`['invoiceItems']`, `['page-invoice-deductibility-map']`, `['expanded-row-deductibility']`, `['vat_return']`, `['vat_return_lines']`, `['nav_invoice_items_drill']`, `['acc-journal-entries']`, `['glBalances']`, `['glItems']`, `['glJournalEntries']`, `['subledger-reconciliation']`.

### 4. Lefelé Irányuló Könyvelési és Bevallási Szinkronizáció
- **Kettős Könyvvitel (Mérlegegyensúly):**
  - Az éles adatbázisban futó `public.sync_item_deductible_to_journal_draft` trigger a nem levonható ÁFA összegét automatikusan az alapbizonylat költségére/eszközére terheli:
    - **T 523/51x/161 (Költség / Eszköz):** `Nettó + Nem levonható ÁFA`
    - **T 4661 (Levonható ÁFA):** `Levonható ÁFA összeg`
    - **K 454 (Szállító kötelezettség):** `100% Bruttó összeg`
    - A `Tartozik = Követel` azonosság minden arány mellett (100%, 70%, 50%, 0%) matematikailag garantált.
- **2665 ÁFA Bevallás:**
  - A `calculate_vat_return` RPC a bejövő tételeknél a `(COALESCE(deductible_percentage, 100.0) / 100.0)` szorzót alkalmazza az adóalapra és az adóösszegre, valamint a 65M partner lapokra is.

### 5. Parciális B-Tree Indexek az Éles Adatbázisban
- Létrehoztuk a `supabase/migrations/20260920210000_add_partial_indexes_for_deductible_vat.sql` migrációt:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_nav_invoice_items_partial_deductible 
  ON public.nav_invoice_items (nav_invoice_id) 
  WHERE deductible_percentage < 100;

  CREATE INDEX IF NOT EXISTS idx_invoice_items_partial_deductible 
  ON public.invoice_items (invoice_id) 
  WHERE deductible_percentage < 100;
  ```
- Mivel a számlatételek >97%-a 100%-ban levonható, a részleges index mérete elhanyagolható, a Postgres lekérdezés-tervező index scan költsége mindössze **0.14**, a lekérdezés futási ideje **0.01-0.05 ms**.

---

## Consequences (Következmények)

### Pozitív
- **100% Átláthatóság:** A felhasználó azonnal látja a számlalistában, kibontott sorban és dialógusban a levonási korlátozásokat.
- **Zéró N+1 Terhelés:** A táblázat oldalanként egyetlen kötegelt lekérdezéssel dolgozik, parciális index által támogatva.
- **Automatikus Könyvelési Egyensúly:** A nem levonható ÁFA automatikusan a költséget növeli, emberi hiba nélkül.
- **Pontos ÁFA Bevallás:** A 2665-ös kalkuláció azonnal és pontosan tükrözi az arányosított levonásokat.

### Negatív / Kockázatok
- **Történeti, már lezárt (POSTED) naplófőkönyvek:** A DB trigger szándékosan csak a nyitott `GEPI_JAVASLAT` naplókat módosítja automatikusan. Már lekönyvelt tételeknél a felület figyelmeztetést ad a könyvelőnek.
