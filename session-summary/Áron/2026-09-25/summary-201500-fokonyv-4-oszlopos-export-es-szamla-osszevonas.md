# Session Summary — 2026-09-25 20:15

```text
feat(gl, export, invoices, docs): Főkönyvi Kivonat 4-oszlopos Excel/CSV export, számlánkénti összevonás (by_invoice) szűrőkapcsolóval, sorfókusz és státuszszín védelem, fantomtétel javítás és doc-sync

- Főkönyvi Kivonat 4-Oszlopos Statisztikai és Analitikus Export (src/lib/glExport.ts, A-157, P-117)
  - Könyvvizsgálói és számviteli szabványnak megfelelő 4 pénzügyi oszlop implementálása:
    - Forgalom Tartozik és Forgalom Követel
    - Egyenleg Tartozik és Egyenleg Követel
  - Kétszintes ExcelJS fejléc (Tier 1: Forgalom C1:D1 és Egyenleg E1:F1 merge; Tier 2: Tartozik, Követel, Tartozik, Követel) sötétkék elegáns dizájnnal
  - Előjelhelyes könyvelési egyenlegképzés (Tartozik: balance > 0; Követel: balance < 0 abszolút értékkel)
  - Dinamikus Excel összegző zárósor (SUM képletek mind a 4 oszlopra)
  - CSV export szinkronizálása a 6 oszlopos (Kód, Megnevezés, Forgalom T, Forgalom K, Egyenleg T, Egyenleg K) formátumra

- Főkönyvi Kivonat Számlánkénti Tétel-összevonás és Szűrőkapcsoló (src/lib/glInvoiceGrouping.ts, GeneralLedgerTable.tsx, GeneralLedgerPage.tsx)
  - Alapértelmezett számlánkénti tétel-összevonás (itemGrouping: 'by_invoice'): azonos számlán és kontíron lévő tételek 1 sorba vonódnak össze az összegek szummázásával
  - Partneri számlák elkülönítése: ugyanazon partnertől érkező több számla diszkrét, különálló sorban marad
  - Dedikált 2-Tier eszköztári kapcsoló: [ Receipt ] Számlánként (alapértelmezett) vs [ ListFilter ] Tételes nézet, magyarázó tooltipekkel
  - Kliensoldali in-memory metaadat-gazdagító gyorsítótár (enrichGlItemsWithInvoiceMeta) 6 forrástáblán át (invoice_items, nav_invoice_items, acc_journal_lines, invoices, nav_invoices, gl_journal_entries), N+1 lekérdezési lavina megelőzésével
  - Azonnali 0 ms nézetváltás: kliensoldali előre memoizált Map-ek közötti váltás felesleges hálózati kérések nélkül
  - Kétirányú állapotmegőrzés: URL mélylinkelés (?item_grouping=by_invoice|itemized) és localStorage szinkronizáció
  - Összevont sor jelvény ([ {count} tétel ]) és részletező tooltip a tételek eredeti megnevezésével és összegeivel
  - Tömeges átkontírozás és kijelölés támogatás: az összevont sor kijelölésekor az összes mögöttes egyedi tétel (groupedItemIds) automatikusan bekerül a műveletsávba

- Számlatáblázat Sorfókusz, Kijelölési Késleltetés és Státuszszín-megőrzés
  - Felhasználói hiba elhárítása: sor kijelölésekor a párosítási státusz színe korábban elveszett (telibe kékre színeződött a sor, eltüntetve az unmatched sárga/piros állapotát)
  - Megoldás: szelektív fókusz-kiemelés (ring-inset, diszkrét háttér-transzparencia), így az összes státuszszín aktív kijelölés mellett is jól látható és azonosítható marad
  - Kattintásos sorkijelölés: a fókuszban lévő sor és kijelölés közvetlen sorkattintásra is azonnal változik, nemcsak számlakép megnyitásakor
  - Teljesítményjavítás: a korábbi ~1 másodperces késleltetés megszüntetése, azonnali reaktív fókuszváltás

- Főkönyvi Kivonat Becsukott Fastruktúra és Fantomtétel Hibajavítás
  - Hiba: összecsukott kontíroknál fantomtételek jelentek meg a táblázatban
  - Gyökérok: a fa bejárása és az expandedRowIds szűrés közötti szinkronizációs hézag
  - Megoldás: szigorú hierarchikus szülő-összecsukás validáció a traverseTree logikában, garantálva, hogy zárt kontír alatt semmilyen tétel nem renderelődik

- Számla Szerkesztő Dialog Szövegtördelés Hardening (src/components/InvoiceItemsDialog.tsx)
  - Partner korábbi kontírszám választó gombrácsának responzívvá alakítása (grid-cols-1 sm:grid-cols-2, h-auto min-h-[38px], whitespace-normal, break-words)
  - Hosszú megnevezések és kontírszámok levágásmentes, több soros tördelése

- Dokumentáció Szinkronizáció és Tudásbázis Frissítés (/visibill-doc-sync)
  - Új ADR: docs/architecture/decisions/A-157-general-ledger-invoice-grouping-and-4col-export.md
  - Új PRD: docs/product/decisions/P-117-general-ledger-invoice-grouping-and-4col-export-ux.md
  - ADR Index frissítve: docs/architecture/decisions/index.md (166 döntés, A-157 bejegyezve)
  - PRD Index frissítve: docs/product/decisions/index.md (112 döntés, P-105, P-113, P-117 bejegyezve)
  - Információs Architektúra frissítve: docs/product/information-architecture.md (Főkönyvi Kivonat szekció)
  - Tudásgráf frissítés: python -m graphify update . sikeresen lefutva (code 0)

- Minőségbiztosítás, Build és Tesztek
  - Új unit tesztek:
    - src/test/glExport4Cols.test.ts (4-oszlopos Excel/CSV export validáció)
    - src/test/glInvoiceGrouping.test.ts (számlaösszevonás, több számla szétválasztása, összegzések)
    - src/test/glItemGroupingView.test.ts (0 ms kliensoldali nézetváltás szimuláció)
    - src/test/generalLedgerTreeCollapse.test.ts (becsukott fa tétel-elrejtés)
  - Teszteredmény: mind a 9 főkönyvi tesztcsomag (25 teszt) és a 3 új tesztcsomag (6 teszt) 100%-ban passed
  - TypeScript fordítási ellenőrzés: npx tsc --noEmit hibamentes (code 0)
  - Production Vite build: npm run build sikeresen lefutva (code 0)
```
