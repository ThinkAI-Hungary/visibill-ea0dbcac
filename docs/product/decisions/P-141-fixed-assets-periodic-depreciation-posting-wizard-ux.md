# P-141: Tárgyi Eszközök Időszaki Értékcsökkenés (ÉCS) Elszámolás és Vegyes Napló Feladási Varázsló UX

**Status:** Decided  
**Category:** Accounting / Fixed Assets / Workflow  
**Question:** Hogyan biztosíthatjuk, hogy a könyvelő kényelmesen, hibamentesen és átláthatóan tudja elvégezni a havi, negyedéves vagy év végi amortizáció feladását a Vegyes naplóba közvetlenül a Tárgyi Eszközök felületéről?  
**Decision:** Kifejlesztettünk egy interaktív, előnézeti validációval és tételes könyvelési áttekintővel ellátott modális varázslót (`DepreciationRunDialog.tsx`), amely közvetlenül elérhető a TENY fejlécében elhelyezett `[ 🧮 ÉCS elszámolás ]` gombbal.  
**Current Implementation:** `src/components/fixed-assets/DepreciationRunDialog.tsx`, `src/pages/FixedAssetsPage.tsx`, `src/lib/fixed-assets/depreciationPostingService.ts`.  
**Rationale:** A könyvelők számára a zárási folyamatok egyik legidőigényesebb és legkönnyebben elhibázható része a tárgyi eszköz amortizáció feladása. A rendszer korábban kiszámolta az értékcsökkenést az analitikában, de a feladást kézzel kellett megtenni. Az új felület egyetlen gombnyomással vizualizálja az összes elszámolandó eszközt, feloldja a főkönyvi számlaszámokat, figyelmeztet az esetleges hibákra (hiányzó számla, már lekönyvelt időszak), és automatikusan lekönyveli a kiegyensúlyozott bizonylatot a Vegyes naplóba.  

---

## 1. Felületi Elhelyezés és Megjelenés

A `FixedAssetsPage` (Tárgyi Eszköz Nyilvántartás) fejlécében, az „Új eszköz felvétele” és „Számlából aktiválás” akciógombok mellett kapott helyet az új:
```text
[ 🧮 ÉCS elszámolás ]
```
gomb. A gombra kattintva felugrik a `DepreciationRunDialog` modál.

---

## 2. A Varázsló Működési Logikája

### 2.1 Időszak Választó Fejléc
A felhasználó 4 időszaki fül (tab) közül választhat:
1. **Havi:** Kiválasztható az év és a hónap (Január – December).
2. **Negyedéves:** Kiválasztható az év és a negyedév (I., II., III., IV. negyedév).
3. **Éves zárás:** Kiválasztható a lezárni kívánt naptári év (01.01 – 12.31).
4. **Egyedi:** Tetszőleges kezdő és záró naptári nap megadása.

A választott időszak alapján a rendszer automatikusan képezi a könyvelési bizonylatszámot (`ECS-2026-08`, `ECS-2026-Q3`, `ECS-2026-EVES`).

### 2.2 Valós Idejű KPI Összesítő Kártyák
A modál felső sávjában 4 kiemelt KPI kártya jelenik meg:
- **Érintett eszközök:** Az elszámolásra alkalmas aktív eszközök száma (pl. `27 eszköz`).
- **Könyvelhető összeg:** A kiválasztott időszakra eső összesített terv szerinti ÉCS (pl. `845 200 Ft`).
- **Hibás / hiányzó kontír:** Ha bármelyik eszközhöz nem található a számlatükörben 5711 vagy halmozott ÉCS számla, piros számláló figyelmeztet.
- **Nettó könyv szerinti érték:** Az eszközök összesített könyv szerinti értéke az elszámolás után.

### 2.3 Tételes Eszköz-Táblázat és Vizuális Státuszok
A dialógus listázza a cég összes eszközét a következő oszlopokkal:
- **Eszköz adatok:** Eszköz megnevezése, leltári száma, aktiválási dátuma.
- **Bruttó érték:** Bekerülési érték forintban.
- **Időszaki ÉCS:** A pontosan kiszámított időszaki amortizáció.
- **T / K Kontírok:** A Tartozik költségszámla (pl. `5711`) és a Követel halmozott ÉCS számla (pl. `13941`).
- **Státusz jelvények:**
  - 🟢 **Könyvelhető (ready):** Zöld badge, elszámolható tétel.
  - 🟡 **Már könyvelve:** Sárga badge, ha az adott időszakra már létezik lezárt bizonylat.
  - ⚪ **Nincs ÉCS (zero / fully_depreciated):** Szürke badge (pl. maradványértékre leíródott vagy még nem aktivált eszköz).
  - 🔴 **Hiányzó számla (missing_gl):** Piros badge, ha a számlatükörből hiányzik a szükséges kontírszám.

### 2.4 Részletes T/K Bontás Lenézete
Minden sor jobb szélén egy kis nyíllal lenyitható az adott eszköz könyvelési tételeinek részletes kibontása, ahol a könyvelő ellenőrizheti a pontos Tartozik és Követel szöveges megnevezéseket és összegeket.

### 2.5 Duplikációvédelem és Tiszta Könyvelői Visszajelzés
- Amennyiben az adott bizonylatszámmal már létezik bejegyzés a Vegyes naplóban, a modál tetején sárga figyelmeztető sáv (`Alert`) tájékoztatja a könyvelőt a meglévő bizonylat sorszámáról.
- A véglegesítés gomb felirata egyértelmű: `Könyvelés a Vegyes naplóba (X db eszköz — Y Ft)`.
- A felületről szigorúan eltávolítottuk a fejlesztői belső kódokat (pl. `acc_post_journal_entry` hívásnevet), a felhasználó csak professzionális, tiszta számviteli üzeneteket lát.
- Sikeres könyveléskor zöld Toast értesítés jelenik meg a generált naplósorszámmal, a TENY lista és a Főkönyv pedig automatikusan frissül.

---

## Kapcsolódó
- [A-180: Tárgyi Eszköz Időszaki Értékcsökkenés Elszámolás és Vegyes Napló Feladási Architektúra](../../architecture/decisions/A-180-fixed-assets-periodic-depreciation-posting-service.md)
- [P-123: Fejlesztési Tartalék és TENY Összekapcsolása UX](./P-123-development-reserve-teny-ux.md)
- [P-055: Könyvelési Napló UX és Sorszámvédelem](./P-055-accounting-journals-ux.md)
