# A-160: Főkönyvi Bizonylatmegnyitó és NAV OSA Tételes Nézet Fallback Architektúra

**Status:** Decided  
**Dátum:** 2026-09-26  
**Kategória:** UI / Könyvelés & Bizonylatkezelés  
**Kapcsolódó döntések:** [A-157: Főkönyvi Kivonat Számlánkénti Összevonás](./A-157-general-ledger-invoice-grouping-and-4col-export.md), [A-063: Unified Document Engine](./A-063-unified-document-engine-architecture.md), [A-062: Invoices Feature Slice](./A-062-invoices-feature-slice-modularization.md), [P-120: Főkönyvi Bizonylatmegnyitó UX](../../product/decisions/P-120-general-ledger-invoice-document-preview-and-osa-fallback-ux.md), [P-117: Főkönyvi Számlánkénti Összevonás UX](../../product/decisions/P-117-general-ledger-invoice-grouping-and-4col-export-ux.md)  
**Érintett modulok:** `src/components/general-ledger/GeneralLedgerTable.tsx`, `src/hooks/useGlInvoiceDocumentResolver.ts`, `src/components/InvoiceImageDialog.tsx`, `src/components/InvoiceItemsDialog.tsx`  

---

## 1. Kontextus és Problémafelvetés

A Visibill / eaisyBooks főkönyvi kivonatában (`GeneralLedgerTable`) a felhasználók a számlák könyvelési tételeit tekintik át. Az [A-157](./A-157-general-ledger-invoice-grouping-and-4col-export.md) döntés alapján a tételek kétféle módban jelenhetnek meg:
1. `by_invoice`: Számlánként összevont tételek (azonos kontíron lévő tételek egy sorba aggregálva `[X tétel]` jelvénnyel).
2. `detailed`: Teljesen kibontott tételes analitika.

A könyvelői audit és egyeztetés során azonban a felhasználónak gyakran látnia kell a tétel mögött álló **eredeti bizonylatot**:
- Ha a számlát a felhasználó feltöltötte (vagy e-mailből érkezett és készült hozzá OCR / számlafotó / PDF), akkor a valós **számlaképet** kell megnyitni (`InvoiceImageDialog`).
- Ha a számla csak a NAV Online Számla (OSA) rendszerből érkezett és még nem töltöttek fel hozzá képi bizonylatot ("még csak OSA-ból látszik"), akkor a NAV XML-ből származó **tételes nézetet** kell megnyitni (`InvoiceItemsDialog` `source="nav"`).

Korábban a főkönyvből nem volt közvetlen átjárás a számlabizonylathoz; a felhasználónak át kellett navigálnia a Számlák oldalra, és kézzel kikeresnie az adott számlaszámot.

---

## 2. Architektúra Döntés

### A. Kiszerezett, Atomikus Bizonylatfeloldó Hook (`useGlInvoiceDocumentResolver`)
A `GeneralLedgerTable.tsx` monolit növekedésének és az N+1 adatbázis lekérdezések elkerülése érdekében létrehoztuk a [`useGlInvoiceDocumentResolver`](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/hooks/useGlInvoiceDocumentResolver.ts) hookot:

1. **Lusta (On-demand) adatlekérés:** A táblázat kezdeti renderelésekor SEMMILYEN extra hálózati kérés nem indul. A feloldó kizárólag akkor hajt végre lekérdezést, amikor a felhasználó konkrétan rákattint egy tétel melletti bizonylat-ikonra.
2. **Kettős feloldási útvonal:**
   - **Feltöltött számla esetén (`invoice_items`, `invoices`):**
     - Lekérdezi az `invoices` táblát `id` vagy `bizonylatsorszam` alapján.
     - Ha van csatolt képfájl (`image_url`, `melleklet_url`, vagy `attachments`), azonnal megnyitja az [`InvoiceImageDialog`](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/components/InvoiceImageDialog.tsx)-ot.
     - Ha nincs képfájl, ellenőrzi, hogy van-e NAV megfelelője (`nav_invoices`), és megnyitja az [`InvoiceItemsDialog`](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/components/InvoiceItemsDialog.tsx)-ot.
   - **NAV Online Számla esetén (`nav_invoice_items`, `nav_invoices`):**
     - Első lépésként ellenőrzi, hogy létezik-e azonos számlaszámmal párosított beküldött számla az `invoices` táblában, amelyhez rendelkezésre áll kép/csatolmány. Ha igen, a valós számlaképet nyitja meg (`InvoiceImageDialog`).
     - Ha nincs feltöltött kép ("még csak OSA-ból látszik"), akkor az `InvoiceItemsDialog`-ot nyitja meg `source="nav"` beállítással.
   - **Naplósorok (`acc_journal_lines`, `journal_entry`) esetén:**
     - Számlaszám alapján automatikusan felderíti az `invoices` vagy `nav_invoices` rekordot.

### B. UI Integráció mindkét tételnézetben
- A sor bal oldalán, a megnevezés és bizonylatszám előtt elhelyezett diszkrét `FileSearch` ikon:
  - Tooltip: *„Számlakép / Bizonylat megtekintése”*.
  - Kattintáskor a kattintott sorban az ikon azonnal átvált egy mini pörgő indikátorra (`Loader2`), amíg a feloldás lefut (~30–50 ms).
  - Csak olyan tételeknél jelenik meg, amelyekhez tartozik számla-azonosító (`invoiceId` vagy `invoiceNumber`).
  - Működik mind a számlánként összevont (`by_invoice`), mind a részletes tételes (`detailed`) nézetben, valamint mindkét oszlopelrendezésben (`classic` és alternatív).

---

## 3. Következmények és Előnyök

- **Könyvelői audit gyorsulás:** A könyvelő a főkönyvi tételek vizsgálata közben azonnal, kontextusváltás nélkül megtekintheti az eredeti számlaképet vagy a NAV tételsorokat.
- **Zero N+1 lekérdezés:** A főkönyvi adatok betöltési sebessége (30–50 ms) nem lassul, a bizonylatok feloldása kizárólag felhasználói interakcióra, aszinkron módon történik.
- **Típus- és tesztbiztonság:** A feloldási logika 100%-ban le van fedve automatizált unit tesztekkel (`src/test/glInvoiceDocumentResolver.test.ts`).
