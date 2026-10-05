# P-157: Manuális Számlarögzítés, Dokumentum-Feltöltés és Többes Párosítás Felületi Élmény (UX)

**Státusz:** Decided  
**Dátum:** 2026-10-05  
**Kategória:** UI / Workflow / Invoicing  
**Kapcsolódó ADR:** [A-198](../../architecture/decisions/A-198-manual-submitted-invoice-creation-and-multi-pairing.md)  
**Kapcsolódó Design Patternek:** [12-dialogs-modals.md](../../design/12-dialogs-modals.md), [04-component-library.md](../../design/04-component-library.md)  

---

## 1. Kérdés és Célkitűzés

Hogyan biztosítsunk a felhasználóknak és könyvelőknek közvetlen, kézi számlarögzítést a számlák főoldalán (`/invoices`) anélkül, hogy a felület túlbonyolódna, biztosítva:
1. Az azonnali számlakép / PDF melléklet feltöltését és csatolását.
2. A NAV számlapár intelligens kiválasztását és az űrlapadatok automatikus előtöltését (zero re-typing).
3. A banki tranzakció(k) azonnali többes összerendelését és a kifizetettségi fedezet valós idejű visszajelzését.
4. A kereshető comboboxok és modális lebegő dobozok vibráció- és ugrásmentes (`zero-jitter`) működését.

---

## 2. Felületi Döntések

### 2.1. Elsődleges Akciógomb az Eszköztárban (`InvoiceHeader.tsx`)
* A számlalista fejlécében a meglévő műveletek (pl. Feltöltés, Export) mellett egy kiemelt elsődleges gomb kapott helyet:
  * `[+ Új számla rögzítése]` (`actions.new_invoice`).
  * A gombra kattintva megnyílik a `ManualInvoiceCreateDialog`.

### 2.2. Kétfüles Modál Elrendezés (`ManualInvoiceCreateDialog.tsx`)
A dialógus maximális ergonómiát nyújtva szétválasztja az alapadatokat és a tételsorokat:
* **1. Tab: „Számla adatok":**
  * **NAV számlapár választó szekció:** Kiemelt adatelőtöltési kártya (`NavInvoicePicker`), amellyel a partner, a bizonylatszám, a dátumok és a végösszegek 1 kattintással beemelhetők. Szétkapcsolás gombbal bármikor visszavonható.
  * **2-hasábos űrlap:** Bal oldalon a sorszám, a kibocsátási és teljesítési dátumválasztók, a partnerek neve és a bizonylattípus; jobb oldalon az összegek (nettó, áfa, bruttó), a deviza és a fizetési mód.
  * **Számlakép / PDF drag-and-drop feltöltő:** Kompakt zóna PDF, PNG, JPG vagy WebP számlakép közvetlen hozzáadásához és előnézetéhez (`InvoiceDocumentDropzone`).
  * **Kiegyenlítő banki tranzakció(k) csatolása:** Többes választó (`TransactionMultiPicker`) zsetonos (chip) megjelenítéssel és valós idejű fedezetszámítással.
* **2. Tab: „Számlatételek":**
  * Tételes rögzítési táblázat dinamikus tétel-hozzáadással (megnevezés, mennyiség, mennyiségi egység, nettó egységár, áfakulcs, nettó és bruttó érték).
  * **„Újraszámolás a tételekből" CTA gomb:** Szinkronizálja az 1. fül összesítő mezőit a rögzített tételek matematikai szummájával.

### 2.3. Zero-Jitter Kereshető Popover & Combobox Standard
* **Dialog scroll-lock védelem:** A dialóguson belüli popoverek kötelezően `<Popover modal={true}>` beállítást és `overscroll-contain` védelmet kapnak, így a háttér dialógus nem fagyasztja le az egérgörgős görgetést.
* **Fix magasságú Popover konténer (`h-[350px]`):** A kereső mezőbe gépeléskor a popover nem zsugorodik össze (még 1 vagy 0 találatnál sem), elkerülve a lebegő menü pozíciójának átfordulását és vibrálását.
* **Középre zárt üres állapot:** Nincs találat esetén a lista helyén függőlegesen középre igazított ikon és barátságos szöveg tájékoztatja a felhasználót.
* **DOM szeletelés:** Egyszerre legfeljebb 20 elem jelenik meg a DOM-ban, számláló jelzi a teljes találati darabszámot, és diszkrét lábléc segít a kereső használatában.

### 2.4. Globális `SearchInput` és Semleges Form Placeholderek
* A popoverek és űrlapok egységesen a `SearchInput` komponenst használják `variant="borderless"` kivitelben, beépített „X" törlés gombbal és Escape billentyű támogatással.
* Az űrlapok beviteli mezőiben a specifikus cégnevek helyett szakmailag semleges minták szerepelnek (`pl. Partner Kft.`, `pl. Ügyfél Kft.`, `pl. SZLA-2026-001`).

---

## 3. Racionálé és Előnyök

* **Gyorsaság:** Nem szükséges külső fájlfeltöltő szoftverekre vagy NAV szinkronra várni; ha a számla fizikailag a könyvelő kezében van, azonnal rögzíthető.
* **Adatkonzisztencia:** A NAV számlapár választásakor az adatok automatikusan átemelődnek, így az analitika és a NAV tétel garantáltan fedésben marad.
* **Azonnali Pénzügyi Státusz:** A tranzakciók egyidejű kiválasztásával a számla azonnal kifizetettként vagy részben kifizetettként jelenik meg a könyvelési listákban.

---

## 4. Kapcsolódó Referenciák

* **Architektúra:** [A-198: Manuális Beküldött Számlarögzítés, Dokumentum Csatolás és Többes Párosítás](../../architecture/decisions/A-198-manual-submitted-invoice-creation-and-multi-pairing.md)
* **Design Minták:** [12 — Dialógusok & Felugró Ablakok](../../design/12-dialogs-modals.md)
* **Komponens Könyvtár:** [04 — Komponens Könyvtár](../../design/04-component-library.md)
