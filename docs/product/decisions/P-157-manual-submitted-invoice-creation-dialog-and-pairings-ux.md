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
  * **2-hasábos űrlap:** Bal oldalon a sorszám, a kibocsátási és teljesítési dátumválasztók, a partnerek neve (`PartnerInputWithAutocomplete` az ellenoldalon, zárolt mező a saját oldalon) és a bizonylattípus; jobb oldalon az összegek (nettó, áfa, bruttó), a deviza és a fizetési mód.
  * **Közvetlen kifizetettség jelölő („Kifizetett számla (kiegyenlítve)"):** Kompakt, magyarázó segédszöveg nélküli egysoros jelölőnégyzet az összegek alatt. Bejelölése esetén a számla közvetlenül kiegyenlítettként és feldolgozottként jön létre (`fizetve: true`, `is_manual_payment: true`, `manual_payment_date`, `statusz: 'feldolgozva'`), anélkül, hogy banki tranzakció párosítására lenne szükség (pl. nyitó számlák, készpénzes vagy historikus tételek esetén).
  * **Számlakép / PDF drag-and-drop feltöltő:** Kompakt zóna PDF, PNG, JPG vagy WebP számlakép közvetlen hozzáadásához és előnézetéhez (`InvoiceDocumentDropzone`), mentési hiba esetén automatikus Storage visszagörgetéssel (árva fájlok törlése).
  * **Kiegyenlítő banki tranzakció(k) csatolása:** Többes választó (`TransactionMultiPicker`) zsetonos (chip) megjelenítéssel és valós idejű fedezetszámítással.
* **2. Tab: „Számlatételek":**
  * Tételes rögzítési táblázat dinamikus tétel-hozzáadással (megnevezés, mennyiség, mennyiségi egység, nettó egységár, áfakulcs, nettó és bruttó érték).
  * **„Újraszámolás a tételekből" CTA gomb:** Szinkronizálja az 1. fül összesítő mezőit a rögzített tételek matematikai szummájával.

### 2.3. Zero-Jitter Kereshető Popover & Combobox Standard (`PartnerInputWithAutocomplete.tsx`)
* **Radix Dialog scroll-lock és esemény-blokkolás kivédése:** A dialóguson belüli lebegő listák konténerén kötelező az `onWheel={(e) => e.stopPropagation()}` és `onTouchMove={(e) => e.stopPropagation()}` eseményleállítás, valamint az `overscroll-contain` CSS osztály alkalmazása. Ezzel megelőzhető, hogy a Radix Dialog mögöttes `react-remove-scroll` zárolása megfagyassza a partnerlista egérgörgős görgetését.
* **Fix magasságú Popover konténer (`max-h-60 overflow-y-auto`):** A kereső mezőbe gépeléskor a popover stabil marad, elkerülve a lebegő menü pozíciójának átfordulását és vibrálását.
* **Középre zárt üres állapot:** Nincs egyező partner esetén diszkrét üzenet jelenik meg, kiegészítve a szabad szöveges partnerképzéssel.
* **DOM szeletelés és számláló badge:** A kereső fejlécben a `SearchInput` beépített számláló jelvénye (`badge`) jelzi a fellelt partnerek pontos darabszámát (`{count} db`).

### 2.4. Globális `SearchInput` és Gyors Új Partner Választás
* A partnerkereső egységesen a projektstandard `@/components/ui/search-input` komponenst használja `variant="borderless"` kivitelben, automatikus fókusszal (`autoFocus`), beépített „X" törlés gombbal és Escape billentyű támogatással.
* **Új partner használata egyetlen kattintással:** Ha a begépelt partnernév még nem szerepel a cég partnertörzsében, a popover lista legfelső elemeként megjelenik a `Új partner használata: "[név]"` gomb, így a felhasználó azonnal rögzíthet tetszőleges új partnert modálok közötti váltás nélkül.

### 2.5. Kontextuális Partner Előtöltés, Irányfüggő Zárolás és Adószám Auto-Kitöltés
* **Irányfüggő aktív cég zárolás (Direction-Aware Active Company Lock):**
  * **Bejövő (szállítói) számla rögzítésekor (`INBOUND`):** A vevő mező automatikusan a kiválasztott saját cég nevére áll be, és egy inaktív, szürke háttérrel ellátott letiltott `<Input disabled>` mezőként jelenik meg `(Aktív cég)` felirattal. Nem jelenik meg felette kereső és nincs törlés (X) gomb sem. A külső szállító mezőjében pedig a `PartnerInputWithAutocomplete` válik aktívvá.
  * **Kimenő számla rögzítésekor (`OUTBOUND`):** Az eladó mező záródik le az aktív cég nevével `(Aktív cég)` jelzéssel, míg a vevő mezőben választható ki vagy kereshető meg a külső partner.
* **Automatikus partner adószám kitöltés:**
  * Amikor a felhasználó kiválaszt egy partnert a `PartnerInputWithAutocomplete` listájából, a rendszer automatikusan kiolvassa és beírja a partnerhez korábban rögzített adószámot az űrlap megfelelő adószám mezőjébe (`elado_adoszam` vagy `vevo_adoszam`), megelőzve az ismételt kézi gépelést.
* **Garantált NOT NULL adatbázis-integritás:**
  * Mivel a PostgreSQL `invoices` táblájában mind az `elado_nev`, mind a `vevo_nev` oszlop szigorúan `NOT NULL` megkötésű, a felület garantált nem-üres értékkel (`companyName || 'Saját cég'`) látja el az ellenoldali partnernevet, kizárva az üres mentési hibákat.

### 2.6. Tranzakció Elrablás Megelőzése (Transaction Stealing Guard & Visual State)
* **Kettős párosítás elleni védelem:** A `TransactionMultiPicker` komponensben a már korábban egy másik számlához párosított tranzakciók (`matched_invoice_id`) inaktívvá és védetté válnak:
  * **Letiltott interakció:** A jelölőnégyzet és a sor letiltott állapotba kerül (`disabled`, `opacity-60 pointer-events-none`).
  * **Vizuális figyelmeztetés:** Sárga/borostyán jelvény (`badge`) mutatja: „Másik számlához kötve".
  * **Részletes tooltip:** Rámutatáskor tooltip tájékoztatja a könyvelőt, hogy a tranzakció már egy másik számlát egyenlít ki, megelőzve az akaratlan elcsatolást és pénzügyi anomáliákat.

### 2.7. Toast Visszajelzések és Nemzetközi (HR) Lokalizáció
* **Standardizált Toast értesítések:** Az elavult böngészős `alert(...)` felugrók helyett a felület a modern, egységes `toast(...)` rendszert használja (pl. `InvoiceDocumentDropzone` érvénytelen fájlformátum vagy méretkorlát esetén destructiv toasttal figyelmeztet).
* **Horvát lokalizáció (`/hr/...`):**
  * Dinamikus pénznem és adókulcs alapértelmezések: horvát route esetén az alapértelmezett pénznem `EUR`, az elérhető áfakulcsok pedig a horvát jogszabályokhoz igazodnak (`25%`, `13%`, `5%`, `PDV`).
  * Teljes kétnyelvű fedettség: a dialógus összes szövege, címkéje, placeholderje és gombja az `invoices:manual_create.*` névtérből fordul mind magyar, mind horvát nyelven.

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
