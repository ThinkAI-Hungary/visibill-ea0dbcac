---
trigger: model_decision
description: Apply when designing, styling, or implementing user interfaces, forms, buttons, tables, dialogs, empty states, or user feedback in eaisybill-prod.
---

# UI & UX Guidelines (Visibill / eaisybill-prod)

## 🔄 1. A 4 Kötelező UI Állapot (The 4 States Rule)
Minden adatra támaszkodó nézetben (táblázat, kártya, lista, dashboard) kötelező expliciten kezelni mind a 4 állapotot:
1. **Loading állapot:**
   * Sose hagyj villódzó, üres területeket! Használj a tartalom körvonalát előrevetítő **Skeleton loadert** ([07-loading-patterns.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/design/07-loading-patterns.md)).
2. **Empty állapot:**
   * Ha egy lista vagy szűrés üres, **szigorúan tilos üres fehér/sötét dobozt vagy üres táblázatot hagyni**!
   * Kötelező: releváns ikon + érthető magyarázó szöveg + **CTA (Call-to-Action) gomb** (pl. *„Még nem töltöttél fel számlát. [Első számla feltöltése]”*).
3. **Error állapot:**
   * Kezeld lokálisan a hibát; ne hagyd összeomlani az egész oldalt! Jeleníts meg emberi nyelven megfogalmazott hibaüzenetet egy *„Újrapróbálkozás”* gombbal.
4. **Data állapot:**
   * A sikeresen betöltött adatok konzisztens, rendezett megjelenítése.

---

## ⚡ 2. Aszinkron Műveletek & Dupla-kattintás Védelem (Double-Submit Guard)
* **Azonnali `disabled` állapot:**
  * Bármilyen mentést, törlést, küldést vagy API hívást indító gombot a kattintás pillanatában **azonnal `disabled` állapotba kell helyezni**, és betöltés-jelző spinnert kell mutatni (`isSubmitting` / `isPending`). Ezzel kivédjük a véletlen többszöri elküldést.
* **Néma műveletek tiltása (Kötelező Toast):**
  * Minden aszinkron művelet végén kötelező visszajelzést adni a felhasználónak:
    * **Siker:** `toast({ title: "Sikeres mentés", description: "..." })`
    * **Hiba:** `toast({ variant: "destructive", title: "Nem sikerült a mentés", description: err.message })`
  * *Részletek:* [docs/design/09-error-handling-feedback.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/design/09-error-handling-feedback.md).

---

## 💰 3. Pénzügyi Szám- és Dátumformázási Fegyelem
* **Nyers számok szigorú tiltása:**
  * Pénzügyi rendszerben tilos formázatlan számot megjeleníteni (pl. `1500000` helyett: `1 500 000 Ft`).
  * Mindig a projekt meglévő lokalizációs segédfüggvényeit használd:
    * Összegek: magyar ezres tagolással, HUF esetén egészre kerekítve, devizáknál (EUR/USD) 2 tizedesjegy.
    * Szemantikus színek: Bevételek és jóváírások zöld (`text-emerald-500` / `text-primary`), költségek/kiadások egyértelmű negatív előjellel.
    * Dátumok: Egységes magyar formátum (`YYYY. MM. DD.`).
  * *Részletek:* [docs/design/02-design-tokens.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/design/02-design-tokens.md).

---

## ⚠️ 4. Destruktív Műveletek Megerősítése (Confirm Dialogs)
* **Tilos az egykattintásos törlés:**
  * Számla, partner, tranzakció, felhasználó vagy beállítás törlésekor **mindig kötelező megerősítő modálablakot** (`AlertDialog`) megjeleníteni.
  * A modálban egyértelműen tisztázni kell a művelet visszavonhatatlanságát és hatókörét (pl. [ADR A-099](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-099-invoice-and-upload-deletion-governance.md) szerint: csak a számlakép leválasztása vagy a számlatétel teljes törlése).

---

## 🎯 5. Interakciós Tisztaság és Villogásvédelem ([10-accessibility-ux.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/design/10-accessibility-ux.md))
* **`transition-colors duration-150` szabály:**
  * Gombokon, linkeken és dropdown/combobox triggereken **szigorúan tilos a `transition-all`**!
  * A `transition-all` az outline/ring színét is animálja, ami sötét témában a Chromium böngészőkben kattintáskor vagy elkattintáskor **fehér keret-felvillanást (glitch)** okoz. Helyette kizárólag a `transition-colors duration-150` használandó!
* **Combobox és Kereső Input Ring:**
  * Keresőmezőkön és combobox triggereken külső lebegő ring helyett a komponens saját szegélye (`border-primary/80`) és háttere jelzi az aktív fókuszt.
* **Zárt Viewport Élmény:**
  * A fő layoutban a fejléc és a navigáció maradjon fix; a görgetés mindig a belső tartalmi panelen történjen (`overflow-y-auto`).

---

## 🖥️ 6. Tabok, Master-Detail és Kijelzők Stabilitása (Zero-Jitter & ClearType Védelem)
* **GPU Transzformáció Zéró Tolerancia Tab Konténereken:**
  * Részletező vásznon és tab konténereken **szigorúan tilos az `animate-in`**, `slide-in`, `zoom-in` vagy bármilyen CSS 3D transzformáció (Chromium DirectWrite ClearType élsimítás-kikapcsolás és 1px ugrás miatt)!
* **Perzisztens DOM Renderelés (`block` / `hidden`):**
  * Tabok és Master-Detail panelek váltásakor tilos a feltételes unmountolás (`{activeTab === 'x' && <Component />}`).
  * Használj perzisztens DOM megjelenítést (`className={activeTab === id ? 'block' : 'hidden'}`). Ezzel elérhető a 0ms-os azonnali váltás, zéró Skeleton villódzás és a piszkozat-adatok (pl. űrlapok, fájlválasztások) megőrzése.
* **Skeleton kizárólag ELSŐ betöltésre:**
  * Tilos fülváltáskor Skeletonra visszaváltani! Háttérfrissítésnél a meglévő tartalom látható marad, és diszkrét spinner jelzi a lekérdezést.
  * *Részletek és minták:* [docs/design/08-interactions-animations.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/design/08-interactions-animations.md) és [docs/design/07-loading-patterns.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/design/07-loading-patterns.md).

---

## 🔄 7. Infinite Scroll & Lapozási UX Szabályzat
* **Kötelező Végső Lezárási Állapot (All Loaded State):**
  * Ha egy lista összes eleme betöltődött (`!hasMore`), a betöltő gombot/spinnert kötelező elrejteni, és egy diszkrét lezáró szöveget megjeleníteni:
    * Pl.: *„Mind a(z) {{count}} tétel betöltve”*
* **Sentinel és Hiba-védelem:**
  * Ha a háttérben futó lapozás hálózati hibába ütközik, a betöltő gomb nem villoghat és nem ragadhat végtelen spinner állapotban. A lapozást azonnal le kell állítani (`hasMore = false`), és egyértelmű hibaüzenetet kell mutatni manuális *„Újrapróbálkozás”* lehetőséggel.
  * *Részletek:* [docs/design/11-data-display-tables.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/design/11-data-display-tables.md).

---

## 🔍 8. Dialog & Popover Kereső Architektúra (The Standard Picker Pattern)
* **Standard `SearchInput` használata kötelező:**
  * Modálablakokban (Dialog) működő keresőknél (pl. NAV számlapár, tranzakciópárosítás, partnertörzs) **tilos ad-hoc mezőket vagy saját keresőlogikát építeni**.
  * Mindig a projekt standard komponensét használd: `import { SearchInput } from '@/components/ui/search-input';` a `PopoverContent` tetején `variant="borderless"` beállítással, automatikus darabszámlálóval (`rightElement={<span ...>{count} db</span>}`).
* **Egérgörgő & Touch Zárolás Feloldása (`e.stopPropagation()`):**
  * Mivel a Radix Dialog a háttérben `react-remove-scroll`-lal dokumentum-szinten tiltja a görgetést, a PopoverContent és a benne lévő görgethető lista **kötelezően meg kell kapja az `onWheel={(e) => e.stopPropagation()}` és `onTouchMove={(e) => e.stopPropagation()}` eseménykezelőt**, valamint az `overscroll-contain` osztályt!
  * Enélkül az asztali böngészőkben a lenyíló lista nem reagál az egérgörgőre.
* **Új / Egyedi elem azonnali felajánlása:**
  * Ha a beírt keresőszó nem szerepel a törzsadatok között, a lista legtetején mindig jelenjen meg egy kattintható akciógomb: *„Új [elem] használata: '{search}'”*, amivel a felhasználó azonnal rögzítheti az egyedi értéket.
  * *Részletek:* [docs/design/12-dialogs-modals.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/design/12-dialogs-modals.md).

---

## 🏢 9. Irányfüggő Pénzügyi Űrlapok & Cégzárolási Szabályzat
* **Aktív cég fix zárolása:**
  * Kétoldalú pénzügyi bizonylatoknál (bejövő és kimenő számlák) a kiválasztott céget képviselő oldal (bejövőnél a Vevő, kimenőnél az Eladó) **mindig zárolt, letiltott (`disabled`) mezőként renderelendő**.
  * Ezen a mezőn tilos az autocompletion, a kereső megnyitása és a törlő (`X`) gomb megjelenítése, megelőzve az elgépelést és a cégadatok felülírását.
* **Kötelező terminológia: `(Aktív cég)`:**
  * A zárolt mező felett a címke mellett kötelezően a diszkrét **`(Aktív cég)`** megnevezést használd (nem *(Saját vállalkozás)* vagy egyéb szinonimák).
  * *Részletek:* [ADR A-198](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-198-manual-submitted-invoice-creation-and-multi-pairing.md) és [PRD P-157](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/product/decisions/P-157-manual-submitted-invoice-creation-dialog-and-pairings-ux.md).

---

## 📋 10. Letisztult Űrlap Checkbox Konvenció
* **Kompakt státuszjelölők:**
  * Egyszerű státuszjelölő mezőknél (pl. *Kifizetett számla (kiegyenlítve)*) törekedj a kompakt, egyvonalas megjelenésre (`flex items-center space-x-2`).
  * Ne terheld a felületet hosszú, helyet foglaló magyarázó bekezdésekkel, kivéve ha az jogi vagy kritikus adatvesztési kockázatra hívja fel a figyelmet.
  * *Részletek:* [docs/design/04-component-library.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/design/04-component-library.md) és [docs/design/02-design-tokens.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/design/02-design-tokens.md).

---

## 🛑 11. Fals Üres Állapot Védelem & Sorszintű Hiba-Résiliencia
* **Fals Üres Állapot Zéró Tolerancia:**
  * Pénzügyi táblázatokban és kartonokban, ha egy aszinkron lekérdezés hibára fut (pl. 504 Gateway Timeout, PostgREST hiba, hálózati kiesés), **szigorúan tilos az üres állapotot ("Nincsenek adatok") megjeleníteni**!
  * Az üres állapot látványa azt a hamis látszatot kelti a könyvelőben, hogy az adott időszakban nem volt forgalom vagy kiegyenlítetlen számla.
* **Kötelező Hiba és Retry Minta:**
  * Minden táblázatnak, aggregáló nézetnek és expandálható kártyának kötelező külön `isError` állapotot kezelnie.
  * Ha a lekérdezés meghiúsul:
    1. Vizuális hibaüzenet (pl. piros/figyelmeztető sáv vagy diszkrét sorszintű hiba ikon).
    2. Közvetlen, helyi **„Újrapróbálkozás” (Retry CTA)** gomb, amellyel a felhasználó anélkül próbálkozhat újra, hogy a teljes oldalt újra kellene töltenie.
  * *Részletek és referencia implementáció:* [ADR A-232](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/architecture/decisions/A-232-gl-zero-as-value-multi-account-batching-and-partner-aging.md) és [docs/design/09-error-handling-feedback.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/docs/design/09-error-handling-feedback.md).
