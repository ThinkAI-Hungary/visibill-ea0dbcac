# P-117: Főkönyvi Kivonat Számlánkénti Összevonás és 4-Oszlopos Export UX

**Status:** Decided  
**Dátum:** 2026-09-25  
**Kategória:** UI / Főkönyv & Riportok  
**Érintett modulok:** `GeneralLedgerPage.tsx`, `GeneralLedgerTable.tsx`, `src/lib/glExport.ts`, `src/lib/glInvoiceGrouping.ts`, `src/components/InvoiceItemsDialog.tsx`  

---

## 1. Kontextus és Problémafelvetés

A könyvelők és pénzügyi vezetők a főkönyvi kivonat napi auditálása és hivatalos ellenőrzése során két konkrét fejlesztési igényt fogalmaztak meg:

1. **Főkönyvi Kivonat Export (4 Oszlopos Szabvány):**
   - A korábbi kivonat exportban a forgalom és egyenleg adatok 3 oszlopban jelentek meg (Forgalom Tartozik, Forgalom Követel, és egyetlen közös Egyenleg oszlop).
   - A könyvvizsgálói és hazai számviteli szabványok szerint azonban a főkönyvi kivonatban a forgalom mellett az egyenlegnek is **két különálló oszlopban (Tartozik és Követel)** kell szerepelnie, világos kétszintes fejléccel:
     ```
     ┌──────────────────────────────────────────────────────────────┐
     │ Kód │ Megnevezés │      Forgalom       │       Egyenleg      │
     │     │            │ Tartozik │ Követel  │  Tartozik │ Követel │
     └──────────────────────────────────────────────────────────────┘
     ```

2. **Számlánkénti Összevont Tételek Alapértelmezett Nézete:**
   - Amikor a felhasználó megtekinti a főkönyvben egy adott kontír (vagy a teljes kivonat) tételeit, a számlák sokszor több (akár 10-20) egyedi tételsorból állnak.
   - Ha egy számla összes tétele ugyanarra a kontírszámra került, a tételek soronkénti kilistázása redundáns és nehezen olvashatóvá teszi a főkönyvet.
   - **Felhasználói elvárás:**
     - Az alapértelmezett állapot az legyen, hogy az **azonos számlán és azonos kontíron** lévő tételek **egyetlen sorként**, a tételek összegzett szummájával jelenjenek meg.
     - Ha egy partnertől több számla is van a kivonatban, minden számla **különálló sor** maradjon (ne olvadjanak egybe a partnertől érkező különböző számlák).
     - Legyen elérhető egy jól látható, kényelmes **szűrőkapcsoló**, amellyel a könyvelő igény szerint bármikor visszaválthat a teljesen részletes, tételes nézetre.

3. **Számla Szerkesztő Dialog Szövegtördelési Nehézség:**
   - A számlatételek szerkesztőjében (`InvoiceItemsDialog`) a partner korábbi kontírszámait kínáló gyorsgombokban a hosszú partnernevek és kontírmegnevezések nem fértek el a dobozokban és levágódtak.

---

## 2. Termékdöntés és Megoldás

### 1. 4-Oszlopos Statisztikai és Analitikus Excel Export
- Az **Excel export** (`exportGlExcel`) átalakításra került:
  - 2 szintes, sötétkék hátterű, fehér feliratos elegáns fejléccel rendelkezik.
  - A Forgalom alatt `Tartozik` és `Követel`, az Egyenleg alatt `Tartozik` és `Követel` oszlopok találhatók.
  - A pozitív egyenlegek az Egyenleg Tartozik oszlopba, a negatív egyenlegek abszolút értéke az Egyenleg Követel oszlopba kerül.
  - Az exportált táblázat végén automatikus Excel összegző képletek (`SUM`) számolják ki az oszlopösszegeket.
- A **CSV export** (`exportGlCsv`) szintén a 6-oszlopos (Kód, Megnevezés, Forgalom T, Forgalom K, Egyenleg T, Egyenleg K) formátumot követi.

### 2. Alapértelmezett Számlánkénti Tétel-összevonás (`by_invoice`)
- A főkönyvi táblázatban a tételek alapértelmezésben számlánként összevonva jelennek meg:
  - Az azonos számlához és azonos kontírhoz tartozó sorok egyetlen reprezentatív sorrá olvadnak össze.
  - A sorban a tételek összeadott Tartozik és Követel forgalma, valamint egyenlege látható.
  - A sor mellett egy jól látható, diszkrét kék jelvény (Badge) tájékoztat az összevont tételek számáról:  
    `[ 3 tétel ]`
  - A megnevezésre húzva az egeret egy részletes leíró buborék (Tooltip) mutatja be az összevont tételek eredeti megnevezését és összegeit.
- **Partner szintű elkülönülés:** Ha egy adott partnernek több számlája van a kontíron, mindegyik számla külön-különálló sorban jelenik meg.

### 3. Dedikált Nézetváltó Kapcsoló az Eszköztárban (Row 2 Filter Bar)
- A `GeneralLedgerPage` felső szűrősávjában (2. sor) elhelyezésre került egy új, intuitív nézetváltó szegmentált kapcsoló:
  - **`[ Receipt ] Számlánként`** *(Alapértelmezett)*: Tiszta, konszolidált számlaszintű nézet.
  - **`[ ListFilter ] Tételes`**: Részletes, tételenkénti analitikus lista.
- Mindkét gombhoz tartozik magyarázó felugró súgó (Tooltip).

### 4. Állapotmegőrzés és URL Szinkronizáció
- A választott nézet azonnal bekerül a böngésző címsorába query paraméterként:  
  `?item_grouping=by_invoice` vagy `?item_grouping=itemized`.
- Ezen felül a rendszer a `localStorage`-ba is elmenti a beállítást, így a felhasználó preferenciája az oldal újratöltésekor vagy visszatéréskor is megmarad.
- A nézetváltás **azonnali (0 ms)**: a kliensoldali memóriaindexelés miatt a kapcsolgatás nem indít új hálózati kéréseket, a váltás folyamatos és akadásmentes.

### 5. Tömeges Átkontírozás Összevont Soroknál
- Ha a felhasználó egy összevont számlasort jelöl ki átkontírozásra a lebegő műveletsávban, a rendszer felismeri a mögöttes egyedi tételeket (`groupedItemIds`), és mindegyik tételt megfelelően átkontírozza.

### 6. Partner Kontírszám Választó Gombok Tördelése (`InvoiceItemsDialog`)
- A gyorsválasztó gombok elrendezése és stílusa módosult (`grid-cols-1 sm:grid-cols-2`, automatikus magasság és sortörés), így a hosszú partner- és kontírszövegek nem takaródnak ki és nem csonkulnak le.

---

## 3. Minőségbiztosítás és Verifikáció

- **Unit tesztek:**
  - `src/test/glInvoiceGrouping.test.ts`: Számlaösszevonás, több számla szétválasztása, összegek helyes kalkulációja.
  - `src/test/glItemGroupingView.test.ts`: Kliensoldali nézetváltás szimulációja és 0 ms reakcióidő.
  - `src/test/glExport4Cols.test.ts`: 4-oszlopos Excel/CSV export tartalom és struktúra ellenőrzése.
- **Lefuttatott tesztkészlet:** 9 General Ledger tesztcsomag, 25 teszt maradéktalanul sikeres.
- **Típusellenőrzés és Build:** `npx tsc --noEmit` 0 hiba, `npm run build` sikeres lefutás.

---

## 4. Kapcsolódó Dokumentumok
- [A-157: Főkönyvi Kivonat Számlánkénti Összevonás és 4-Oszlopos Export Architektúra](../../architecture/decisions/A-157-general-ledger-invoice-grouping-and-4col-export.md)
- [P-113: Főkönyvi Kivonat Kontírok vs. Tételes Nézetváltó UX](./P-113-general-ledger-granularity-kontirok-teteles-view.md)
- [P-105: Főkönyvi Kivonat 2-Tier Eszköztár és Fastruktúra Kibontás/Összecsukás UX](./P-105-general-ledger-toolbar-and-expand-collapse-ux.md)
