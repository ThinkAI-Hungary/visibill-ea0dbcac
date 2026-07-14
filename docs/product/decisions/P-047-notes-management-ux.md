# P-047: Jegyzetek Kezelése (Notes Management) UX
**Status:** Decided
**Category:** Rendszer

**Question:** Hogyan jelenítsük meg a jegyzeteket és hogyan biztosítsuk a könnyű hozzáférést a felhasználóknak és könyvelőknek?

**Decision:**
Az **osztott kétpaneles (Split-Pane)** elrendezést használjuk a fő Jegyzetek oldalon:
1. **Bal oldali panel (szélesség: 320px):** Kereshető és szűrhető jegyzetlista. Itt gyorskeresővel és gyorsgombokkal (Összes, Saját, Közös, Számlához csatolt) lehet navigálni.
2. **Jobb oldali panel:** A kiválasztott jegyzet teljes részletes nézete. Megjeleníti a címet, tartalmat, láthatósági ikont, a rögzítő nevét és idejét, valamint a csatolt számlák interaktív kártyáit (több számla esetén egymás alatt listázva).
3. **Számla részletező popup integráció:** A számla részletes nézetében (InvoiceDetailPopup) egy dedikált alsó szekcióban kilistázzuk a számlához csatolt jegyzeteket (figyelembe véve a többszörös csatolás `.or` logikáját is).
4. **Többszörös számla tömeges csatolása (Bulk Selection):** A jegyzetek rögzítésekor megnyitható egy dedikált Számlakereső dialógus, ahol jelölőnégyzetek (checkboxok) segítségével egyszerre több számla is kijelölhető és tömegesen hozzáadható a jegyzethez, ahelyett, hogy egyesével kellene őket összekapcsolni.
5. **Layout Shift védelem & Fókusz kezelés:** 
   - A számlakereső modal belső listája fix `320px` magasságú, így a találatok betöltése vagy a keresési szűrők alkalmazása nem okoz ugrásokat és töréseket a dialógus elrendezésében.
   - A kijelölt elemek számlálója dinamikus minimális szélességet és dedikált konténert kapott a gombon belül, így a számok méretváltozása nem tolja el a gomb méretét vagy szövegét (nincs layout shift).
   - A duplán megjelenő fókuszkeretek elkerülése végett a kijelölt számláknál letiltottuk a felesleges Tailwind focus ringeket.
6. **Összes elem törlése (Unlink All):** A csatolt számlák listája alatt bal alul elhelyezésre került egy gyors "Összes elem törlése" gomb, amellyel a felhasználó egyetlen kattintással eltávolíthatja az összes kijelölt számlát a jegyzetből.
7. **Fejléc-konform Dátum Szűrő:** A számlakereső modalon belüli dátumválasztó felület dizájnja megegyezik a főoldali dátumszűrővel (egyéni popover, naptár választó, date-fns formázás, sötét mód támogatása), de a globális állapottól függetlenül működik.
8. **Elvetési megerősítés (Radix AlertDialog):** A nem mentett módosításokkal (akár szöveg, akár csatolt számla módosítások esetén) való kilépési kísérletet egy prémium Radix-alapú megerősítő felugró ablak (`AlertDialog`) védi a natív böngészős confirm helyett.
9. **Kereszt-linkelt Jegyzetmegjelenítés (Expanded Invoice Row):** 
   - A Számlák listáján a számlasor lenyitásakor egy dedikált `Kapcsolódó feljegyzések` szekció jelenik meg a tételek felett.
   - A lekérdezés figyelembe veszi a NAV és a beküldött számlák közötti párosítási kapcsolatokat is (ha a jegyzet a párosított pár bármelyik tagjához van csatolva, megjelenik a feljegyzés mindkét oldalon).
   - Ha nincs látható jegyzet, a rendszer egy letisztult default kártyát jelenít meg: *"Nincs kapcsolódó feljegyzés ehhez a számlához."*

**Current Implementation:**
Korábban nem létezett jegyzetelési funkció és a hozzá kapcsolódó megerősítő vagy kereszt-lekérdező logikák sem a rendszerben.

**Rationale:**
A könyvelők napi munkája során kritikus fontosságú, hogy gyorsan át tudják tekinteni a függőben lévő feladatokat vagy számlákhoz fűzött megjegyzéseket. A kétpaneles elrendezés minimalizálja a kattintások számát: a felhasználó a listában lefelé haladva azonnal látja a jegyzet tartalmát és a hozzá kapcsolt számla adatait, miközben egyetlen kattintással megnyithatja magát a számlát is. A tömeges számlacsatolás pedig jelentősen felgyorsítja a munkát, amikor egyetlen téma (pl. egy adott NAV-vizsgálat vagy hiánypótlás) több bizonylatot is érint. A megerősítő popupok és az egységes dátumszűrők megőrzik az alkalmazás prémium arculatát, míg a kereszt-lekérdezés feloldja a NAV-számla vs. beküldött számla közötti technikai különbségeket a végfelhasználó számára.
