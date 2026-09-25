# A-157: Főkönyvi Kivonat Számlánkénti Összevonás (by_invoice) és 4-Oszlopos Excel Export Architektúra

**Status:** Decided  
**Date:** 2026-09-25  
**Érintett modulok:** `src/lib/glInvoiceGrouping.ts`, `src/lib/glExport.ts`, `src/components/general-ledger/GeneralLedgerTable.tsx`, `src/pages/GeneralLedgerPage.tsx`, `src/components/InvoiceItemsDialog.tsx`, `src/test/glInvoiceGrouping.test.ts`, `src/test/glItemGroupingView.test.ts`, `src/test/glExport4Cols.test.ts`  

---

## 1. Context

A Visibill / eaisyBooks főkönyvi kivonata (`GeneralLedgerPage` és `GeneralLedgerTable`) két kritikus számviteli követelménnyel bővült:

1. **Főkönyvi Kivonat 4-oszlopos Pénzügyi Export:**
   - A klasszikus számviteli gyakorlatban és a hivatalos könyvvizsgálói ellenőrzések során a főkönyvi kivonatot elengedhetetlenül 4 elkülönülő oszloppal kell exportálni:
     - **Forgalom Tartozik** és **Forgalom Követel**
     - **Egyenleg Tartozik** és **Egyenleg Követel**
   - A korábbi implementáció mindössze 3 oszlopot exportált (Forgalom Tartozik, Forgalom Követel, és egyetlen aláírt Egyenleg oszlop), ami nem felelt meg a könyvelők és könyvvizsgálók elvárásainak és a hazai főkönyvi szabványoknak.

2. **Számlánkénti Tétel-összevonás (`by_invoice`):**
   - Amikor a könyvelő megnyitja egy analitikus főkönyvi számla tételes bontását (vagy a globális `Tételes` nézetet aktiválja), egyetlen vevői vagy szállítói számla akár 10-20 apróbb tételsort (termékeket, szolgáltatási sorokat) is tartalmazhat.
   - Ha ezek a tételek mind ugyanarra a kontírszámra (pl. 511 Anyagköltség vagy 311 Vevők) könyvelődnek, a tételek egyenkénti felsorolása feleslegesen szétnyújtja a képernyőt és nehezíti az áttekintést.
   - **Könyvelői követelmény:** Az alapértelmezett állapot az legyen, hogy az azonos számlán szereplő és azonos kontíron lévő tételek egyetlen sorként jelenjenek meg a szummázott összeggel. Ugyanakkor ha egy partnertől több számla van a periódusban, minden számla különálló sor maradjon. Továbbá a könyvelőnek lehetősége legyen egyetlen gombnyomással visszaváltani a részletes, soronkénti `Tételes` nézetre.

3. **Technikai Korlátok és Kockázatok:**
   - A meglévő `get_gl_categorized_items` PostgreSQL RPC közvetlen sémamódosítása magas kockázattal járt volna, mivel az RPC visszatérési típusára más modulok is támaszkodnak.
   - A felületi kapcsolgatásnak azonnalinak (0 ms reakcióidő), kliensoldali késleltetés és N+1 HTTP kérések nélkülinek kell lennie.

---

## 2. Decision

### 1. 4-Oszlopos Statisztikai és Analitikus Excel/CSV Export Motor (`src/lib/glExport.ts`)
- **ExcelJS Kétszintes Fejléc (Two-Tier Merged Headers):**
  - **1. Sor (Tier 1):** `A1` (Kód), `B1` (Megnevezés), `C1:D1` összevonva: **Forgalom**, `E1:F1` összevonva: **Egyenleg**.
  - **2. Sor (Tier 2):** `C2` (Tartozik), `D2` (Követel), `E2` (Tartozik), `F2` (Követel).
  - Vizuális formázás: Sötétkék márkaháttér (`#1e293b`), fehér félkövér betűk, vékony szegélyek.
- **Tartozik / Követel Egyenleg Szétbontási Logika:**
  - `egyenlegTartozik = balance > 0 ? balance : 0`
  - `egyenlegKovetel = balance < 0 ? Math.abs(balance) : 0`
  - Nulla egyenleg esetén mindkét oszlop 0 értéket kap.
- **Automatikus Összesítő Zárósor (Footer Formulas):**
  - A táblázat zárásaként dinamikus Excel képletek (`SUM(C3:C...)`, `SUM(D3:D...)`, `SUM(E3:E...)`, `SUM(F3:F...)`) összegzik a forgalmi és egyenleg oszlopokat.
- **CSV Export Párhuzam:**
  - A CSV exportáló motor szintén a 6 oszlopos struktúrára frissült: `Kód;Megnevezés;Forgalom Tartozik;Forgalom Követel;Egyenleg Tartozik;Egyenleg Követel`.

### 2. Kliensoldali In-Memory Metaadat-Gazdagító Pipeline (`src/lib/glInvoiceGrouping.ts`)
A `get_gl_categorized_items` RPC által visszaadott rekordokhoz in-memory feloldó és gyorsítótárazó szolgáltatás készült (`enrichGlItemsWithInvoiceMeta`):
- **Forrástáblák bevonása egyetlen kötegelt lépésben:**
  - `invoice_items` és `nav_invoice_items` (számlatétel kapcsolatok)
  - `invoices` és `nav_invoices` (számla fejlécek, bizonylatszámok)
  - `acc_journal_lines` és `gl_journal_entries` (napló és kézi főkönyvi hivatkozások)
- **Gyorsítótárazás:** `Map<string, GlInvoiceMeta>` memóriatároló, amely deduplikált UUID és sorszám alapján azonnal visszaadja a számla azonosítóját, partner nevét és bizonylatszámát, elkerülve a felesleges ismételt adatbázis lekérdezéseket.

### 3. Determinisztikus Számla- és Kontírszintű Aggregáció (`groupLedgerItemsByInvoice`)
A `groupLedgerItemsByInvoice(items)` tiszta függvény végzi a tételek összevonását:
- **Csoportosítási Kulcs:** `invoiceKey = meta.invoiceId || item.bizonylatszam || item.partner || item.id`
- **Invariáns Szabály:**
  - Kizárólag az **azonos kontíron lévő és azonos számlához tartozó** tételek vonódnak össze.
  - Az azonos partnerhez tartozó, de eltérő bizonylatszámú vagy azonosítójú számlák **külön sorként** maradnak meg.
  - A banki tranzakciók, pénztári tételek vagy azonosító nélküli vegyes tételek nem vonódnak össze tévesen.
- **Mező-összegzések:**
  - `debit_turnover = sum(debit_turnover)`
  - `credit_turnover = sum(credit_turnover)`
  - `balance = sum(balance)`
  - `original_amount = sum(original_amount)`
- **Csoportosított Rekord Tulajdonságai:**
  - `isGrouped: true`
  - `groupedCount: N`
  - `groupedItemIds: string[]` (az összes mögöttes egyedi tétel ID listája)
  - `description`: Többsoros leíró összefoglaló, amely tartalmazza az összevont tételek leírását és egyedi összegeit tooltip megjelenítéshez.

### 4. Kliensoldali 0 ms Nézetváltás és Állapotkezelés
- **Állapotperzisztencia:**
  - `itemGrouping` állapot: `'by_invoice' | 'itemized'`.
  - Alapértelmezett érték: `'by_invoice'`.
  - Szinkronizáció: URL query paraméter (`?item_grouping=by_invoice` vagy `?item_grouping=itemized`) és `localStorage` tárolás.
- **Kettős Eszköztár Váltógomb:**
  - A `GeneralLedgerPage` 2. sorában (Tier 2 Filter Bar) kapott helyet a dedikált szegmentált kapcsoló:
    - `[ Receipt ] Számlánként (Alapértelmezett)`
    - `[ ListFilter ] Tételes`
- **Memoizált Renderelés (`GeneralLedgerTable.tsx`):**
  - A nyers tételekből a `useMemo` előre elkészíti a `rawBatchItemsByGL` és `groupedBatchItemsByGL` map-eket, valamint a számlaszinten lenyitott `loadedRawAccountItems` és `loadedGroupedAccountItems` indexeket.
  - A két nézet közötti váltás 0 ms alatt, közvetlenül a memóriából renderel, zéró hálózati kéréssel.
- **Tömeges Műveletek és Átkontírozás Támogatás:**
  - Amikor a könyvelő egy összevont számlasort jelöl ki átkontírozásra vagy tömeges műveletre, a kijelölési motor a `row.groupedItemIds` alapján az összes mögöttes egyedi tételt kijelöli, garantálva a tranzakciós konzisztenciát.

### 5. Responzív Partner Kontírválasztó Gombrács (`InvoiceItemsDialog.tsx`)
A számlaszerkesztő felületen a partner korábbi kontírszámainak gyorsválasztó gombjai a rácsos elrendezésben korábban levágták a szövegeket. A rács `grid-cols-1 sm:grid-cols-2`, `h-auto min-h-[38px]`, `whitespace-normal` és `break-words` osztályokat kapott, biztosítva, hogy a leírások és kódok minden kijelzőméreten olvashatóan kiférjenek.

---

## 3. Consequences

### Pozitív
- **Számviteli Szabvány:** A 4-oszlopos kivonat export (Forgalom T/K, Egyenleg T/K) tökéletesen illeszkedik a hazai és nemzetközi könyvelési elvárásokhoz.
- **Kompakt, Olvasható Főkönyv:** A többtételes számlák nem nyújtják el a főkönyvet; egy számla = egy sor a kontíron.
- **Partneri Bizonylat-integritás:** Az egy partnertől érkező több számla diszkrét sorokban marad.
- **Azonnali Felületi Válaszidő:** 0 ms váltás a Számlánként és a Tételes módok között a memóriaindex-alapú memoizációnak köszönhetően.
- **Biztonságos Kijelölés és Átkontírozás:** Az összevont sor átkontírozása atomi módon érinti a mögöttes tételeket.
- **Adatbázis Védelme:** Nulla DB migráció és nulla RPC törés.

### Trade-off / Kockázat
- Az aggregált nézetben a tétel szintű leírások egy többsoros összefoglalóba fűződnek össze, ami tooltip-ben jelenik meg a táblázat oszlopszélességének megtartása érdekében.

---

## 4. Kapcsolódó Dokumentumok
- [P-117: Főkönyvi Kivonat Számlánkénti Összevonás és 4-Oszlopos Export UX](../../product/decisions/P-117-general-ledger-invoice-grouping-and-4col-export-ux.md)
- [P-113: Főkönyvi Kivonat Kontírok vs. Tételes Nézetváltó UX](../../product/decisions/P-113-general-ledger-granularity-kontirok-teteles-view.md)
- [A-153: Főkönyvi Kivonat Kötegelt Tételes Adatbetöltés és Fastruktúra Renderelés](./A-153-general-ledger-batch-itemized-view-architecture.md)
