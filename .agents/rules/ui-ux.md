---
trigger: model_decision
description: Apply when designing, styling, or implementing user interfaces, forms, buttons, tables, dialogs, empty states, or user feedback in eaisybill-prod.
---

# UI & UX Guidelines (Visibill / eaisybill-prod)

## 🔄 1. A 4 Kötelező UI Állapot (The 4 States Rule)
Minden adatra támaszkodó nézetben (táblázat, kártya, lista, dashboard) kötelező expliciten kezelni mind a 4 állapotot:
1. **Loading állapot:**
   * Sose hagyj villódzó, üres területeket! Használj a tartalom körvonalát előrevetítő **Skeleton loadert** ([07-loading-patterns.md](file:///d:/ThinkAI/visibill/eaisybill-prod/docs/design/07-loading-patterns.md)).
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

---

## 💰 3. Pénzügyi Szám- és Dátumformázási Fegyelem
* **Nyers számok szigorú tiltása:**
  * Pénzügyi rendszerben tilos formázatlan számot megjeleníteni (pl. `1500000` helyett: `1 500 000 Ft`).
  * Mindig a projekt meglévő lokalizációs segédfüggvényeit használd:
    * Összegek: magyar ezres tagolással, HUF esetén egészre kerekítve, devizáknál (EUR/USD) 2 tizedesjegy.
    * Szemantikus színek: Bevételek és jóváírások zöld (`text-emerald-500` / `text-primary`), költségek/kiadások egyértelmű negatív előjellel.
    * Dátumok: Egységes magyar formátum (`YYYY. MM. DD.`).

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
