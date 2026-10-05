# P-159 — Tárgyi Eszközök és Nyitó Állomány Tömeges Import (Excel/CSV) Felhasználói Élmény (UX)

**Státusz:** ✅ Decided  
**Dátum:** 2026-10-05  
**Szerző:** Antigravity  
**Kapcsolódó döntések:** [P-052: Tárgyi Eszközök Projektekhez Rendelése](./P-052-fixed-assets-project-assignment-ux.md) · [P-141: Tárgyi Eszközök Időszaki ÉCS Elszámolás](./P-141-fixed-assets-periodic-depreciation-posting-wizard-ux.md) · [A-200: Tárgyi Eszközök Tömeges Import Architektúra](../../architecture/decisions/A-200-fixed-assets-bulk-excel-csv-import-and-opening-balances.md)

---

## 1. Felhasználói Igény és Cél

Az új vagy korábbi könyvelési szoftverekből (pl. RLB-60) átlépő cégek és könyvelők számára a korábbi években beszerzett tárgyi eszközök (akár 2000+ tétel) egyenkénti felvitele aránytalanul sok időt venne igénybe.
A cél egy olyan modern, kényelmes és megbízható importáló varázsló felület biztosítása a Tárgyi Eszköz Nyilvántartóban (`/teny`), amellyel:
* Bármilyen korábbi exportállomány (RLB-60 kartonlista, összesítő tábla, vagy egyedi Excel/CSV) egyetlen kattintással betölthető.
* A felhasználó részletes előnézetet kap az importálandó tételekről a végleges mentés előtt.
* Az esetlegesen hiányzó leltári számokat a rendszer automatikusan és intelligensen pótolja.
* A felhasználó választhat, hogy a már kivezetett eszközöket is importálja-e történeti célból.

---

## 2. UX Folyamat és Képernyők

### 2.1. Elérhetőség
* A Tárgyi Eszköz Nyilvántartó fejlécében az „Új eszköz felvétele” gomb mellett megjelenik a letisztult „Eszközök importálása” gomb (Upload ikonnal).
* Amennyiben a nyilvántartás teljesen üres, az üres állapot paneljén közvetlenül megjelenik az „Eszközök importálása” gomb.

### 2.2. Varázsló lépései
1. **Feltöltés (Dropzone):**
   * Drag-and-drop és hagyományos tallózás.
   * Fejlécben „Minta sablon letöltése” gomb.
   * Információs kártyák a formátumfelismerésről és nyitó állomány védelemről.
2. **Előnézet & Beállítások:**
   * Statisztikai mérőszámok: Összes sor, Érvényes eszközök, Kivezetett eszközök, Auto-generált leltári számok, Összesített bekerülési érték.
   * Jelölőnégyzetek:
     * *„Kivezetett / selejtezett eszközök importálása (történeti megőrzéssel)”*
     * *„Hiányzó leltári számok automatikus generálása (TE-ÉV-XXXX)”*
     * *„Létező leltári számok automatikus feloldása (-IMP utótaggal)”* (ütközésvédelem meglévő adatbázis rekordok esetén)
   * Főkönyvi számla fallback választó az 1xx számlákhoz.
   * Kereshető, lapozható előnézeti táblázat leltári számmal, megnevezéssel, bekerülési értékkel, aktiválási dátummal, leírási kulccsal (0% nem amortizálódó telek/műkincs támogatással), főkönyvvel és státusszal.
   * Vizuális státuszjelvények az előnézetben: `Auto` (rendszer által adott azonosító), `Létezik` (sárga figyelmeztetés adatbázis ütközésnél) és `Rögzítve` (zöld jelvény sikeres részimport után).
3. **Mentés, Haladás és Biztonságos Újrapróbálás (Safe Resume):**
   * 100-as csomagokban történő adatbázis-mentés, valós idejű százalékos folyamatjelzővel.
   * Hálózati vagy mentési megszakadás esetén a rendszer megőrzi a sikeresen rögzített tételeket, és az előnézetben figyelmeztető banner mellett a műveleti gomb átvált: *„Importálás folytatása ({N} hátralévő)”*. Az újraindítás duplikációmentesen kizárólag a kimaradt eszközöket rögzíti.
4. **Sikeres Befejezés:**
   * Visszajelző kártya a rögzített eszközök darabszámáról és összegéről.
   * A lista automatikusan frissül az újonnan importált tételekkel.
