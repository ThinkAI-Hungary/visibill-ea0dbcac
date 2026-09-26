# P-120: Főkönyvi Bizonylatmegnyitó és NAV OSA Tételes Nézet UX

**Status:** Decided  
**Dátum:** 2026-09-26  
**Kategória:** UI / UX / Főkönyv  
**Kapcsolódó architektúra döntés:** [A-160: Főkönyvi Bizonylatmegnyitó és NAV OSA Tételes Nézet Fallback Architektúra](../../architecture/decisions/A-160-general-ledger-invoice-document-preview-and-osa-fallback.md)  
**Érintett modulok:** `GeneralLedgerTable.tsx`, `useGlInvoiceDocumentResolver.ts`, `InvoiceImageDialog.tsx`, `InvoiceItemsDialog.tsx`  

---

## 1. Termékkérdés és Célkitűzés

A főkönyvi kivonatban a könyvelők a számlák könyvelési tételeit ellenőrzik. A tételek a felhasználó választása szerint vagy számlánként összevonva (`by_invoice`), vagy részletesen kibontva (`detailed`) szerepelnek.

A napi munka során gyakran felmerül az igény:
*„Miért erre a főkönyvi számra került ez a tétel? Látni akarom a számlát!”*

A felhasználói cél:
1. Közvetlenül a főkönyvi számlatétel sorából egyetlen kattintással elérni az eredeti bizonylatot.
2. Ha a számlához rendelkezésre áll feltöltött számlafotó vagy PDF dokumentum, akkor a vizuális számlaképet megnyitni.
3. Ha a tétel még csak NAV Online Számlából (OSA) érkezett és nincs hozzá feltöltött bizonylat, akkor a hivatalos NAV OSA tételes adatokat megnyitni.

---

## 2. Termékdöntés

### A. Kattintható Bizonylat-Ikon a Tétel Megnevezése Előtt
- A főkönyvi táblázat minden olyan tételsorában, amely számlához köthető (`invoiceId` vagy `invoiceNumber` rendelkezésre áll), megjelenik egy diszkrét `FileSearch` (nagyítós dokumentum) ikon gomb.
- **Elhelyezés:** A sor bal oldalán, a behúzás és a megnevezés/partneradatok előtt.
- **Tooltip súgó:** *„Számlakép / Bizonylat megtekintése”*.
- **Vizuális visszajelzés:** Kattintáskor a sorban az ikon mini pörgő indikátorra (`Loader2`) vált az adatbetöltés idejére (~30–50 ms), megelőzve a képernyő villanását.
- **Tiszta felület:** Olyan tételeknél, amelyek nem számlához tartoznak (pl. banki kamat, vegyes napló számlaszám nélkül), nem jelenik meg felesleges ikon.

### B. Intelligens Kétutas Megnyitás (Smart Resolver)
1. **Számlakép prioritás:** Ha a bizonylathoz létezik feltöltött kép vagy csatolt fájl (`invoices`), a rendszer azonnal az `InvoiceImageDialog` felületet nyitja meg, ahol a könyvelő nagyíthatja, forgathatja a számlaképet és lapozhatja a csatolmányokat.
2. **NAV OSA tételes fallback:** Ha a számla csak az Online Számla rendszerből érkezett és nincs hozzá feltöltött bizonylat, a rendszer az `InvoiceItemsDialog` felületet nyitja meg `source="nav"` beállítással, megjelenítve a NAV XML-ből származó hivatalos tételeket és áfakulcsokat.

### C. Teljes Támogatás Mindkét Tételcsoportosításban
- **Számlánként összevont nézet (`by_invoice`):** Az összevont sorban lévő ikonra kattintva a mögöttes számla bizonylata nyílik meg.
- **Kibontott tételes nézet (`detailed`):** Minden egyedi tételsor saját ikonnal rendelkezik, amely közvetlenül az adott tételhez tartozó számlát nyitja meg.

---

## 3. Minőségbiztosítás és Eredmények

- **Unit tesztek:** `src/test/glInvoiceDocumentResolver.test.ts` (5/5 passed).
- **TypeScript:** 100%-os típusbiztonság, `tsc --noEmit` 0 hiba.
- **Építés:** `npm run build` sikeres.
