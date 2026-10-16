# P-186: TENY Raktár és Felelős Kezelés, Kétnyelvű Átadási Bizonylat, Címkenyomtatás, Leltárív és Pályázati Projektlap UX

**Status:** Decided  
**Date:** 2026-10-13  
**Utoljára frissítve:** 2026-10-13  

## Context

A vállalkozások és könyvelőirodák számára a tárgyi eszközök nem csupán elméleti könyvelési számok, hanem fizikai valóságban mozgó, leltározandó vagyontárgyak és szigorú elszámolású pályázati projektek elemei. A felhasználók számára elengedhetetlen volt:
1. Gyors, áttekinthető kezelőfelület a telephelyen belüli tárolóhelyek és felelősök módosítására.
2. Egykattintásos címkenyomtatás közvetlenül az eszközkartonról (ipari címkenyomtatóra vagy A4 ívre).
3. Mobilbarát felület a raktári/irodai fizikai leltározáshoz kamerás beolvasással és azonnali eltérés-korrekcióval.
4. Dedikált „Pályázatok” vezérlőpult, ahol a könyvelő azonnal látja a négyoldalú egyezőséget és egyetlen gombbal feladhatja a havi/éves támogatási PIE feloldást.

## Decision

### 1. Tárolóhely & Felelős Kezelés és Áthelyezési Folyamat
- Az eszközkartonon (`AssetDetailPanel.tsx`) közvetlenül látható a telephely, al-tárolóhely (fa struktúrában megjelenítve) és a felelős személy neve.
- Az **„Áthelyezés”** gombra kattintva felugró modálban a felhasználó egyszerre módosíthatja a helyet, a felelőst és a költséghelyet.
- Sikeres mentés után azonnal letölthető a kétnyelvű (magyar / angol) **Átadás-átvételi jegyzőkönyv (Mt. 179. §)** PDF formátumban.

### 2. Címkenyomtatás Dialógus (`QrLabelDialog.tsx`)
- Az eszközkartonról és az eszközlistából indítható.
- Előnézeti képen mutatja a generált Code 128B vonalkódot, QR kódot, eszközkódot, megnevezést és a cég nevét.
- Választható méretek: 50×30 mm (kompakt polccímke), 70×36 mm (standard eszközcímke), valamint A4-es íves lapozott nézet (24 db/lap) kötegelt nyomtatáshoz.
- Lehetőség SVG vektorgrafika letöltésére és közvetlen `@media print` böngészős nyomtatásra.

### 3. Mobilbarát Leltározó & Év Végi Leltárív (`InventoryCheckDialog.tsx`, `inventoryReportExport.ts`)
- Kamerás vonalkód-olvasó panel, amely azonnal beazonosítja az eszközt a leltári száma alapján.
- Egyérintéses fizikai állapot kiválasztó: *Ép*, *Sérült*, *Selejt / Hiányzik*.
- Szöveges megjegyzés rögzítése és azonnali tárolóhely-módosítás, ha az eszköz nem a nyilvántartott helyén található.
- A Leltározás fülről letölthető az Sztv. 69. § szerinti hivatalos analitikus leltárív Excel és fekvő tájolású PDF formátumban, 3 fős leltározási bizottsági aláírási záradékkal.

### 4. Pályázati Projektek és Négyoldalú Rekonciliáció Fül (`GrantProjectsTab.tsx`)
- A `FixedAssetsPage.tsx` 5. fülén helyezkedik el (`tab=grant_projects`).
- **Négyoldalú Rekonciliációs Banner:** Zöld egyezőségi státusz, ha a 4 pillér (Pályázati keret ↔ TÉNY analitika ↔ Főkönyv 964 ↔ Elhatárolás 483) egyezik; sárga/piros riasztás diszkrepancia vagy kerettúllépés esetén.
- **KPI Kártyák:** Összes pályázati keret, Lehívott támogatás, TÉNY eszközökben lekötött támogatás, Feloldásra váró PIE egyenleg.
- **Projekt Kártyák:** Szerződés adatok, intenzitás progress bar, fenntartási időszak visszaszámláló.
- **PIE Feloldás Gomb és Dialógus:**
  - Megnyitja az automatikus könyvelő modált, amely a kalkulált egyéb bevétel mellett dinamikus számlaválasztókat kínál: **Tartozik: 483 (Passzív elhatárolás)** és **Követel: 964 (Egyéb támogatási bevétel)**, intelligens automatikus kontó-feloldással.
  - Ha a cég számlatükrében nem található megfelelő számla, sárga figyelmeztető sáv tájékoztat, és a könyvelési gomb inaktívvá válik a hibás feladások megelőzésére.
  - Azonnali szinkron mutex védi a gombot a gyors dupla kattintások ellen.
  - A könyvelés lefutása után azonnal frissül a 4-oldalú rekonciliáció és a főkönyvi egyenleg.
- **Adatintegritási Törlésvédelem:** A projekt törlés megerősítő felugró ablaka ellenőrzi a kapcsolt eszközöket és komponenseket. Ha van aktív kapcsolat, a törlés gomb letiltásra kerül, és egyértelmű magyarázat kéri a kapcsolatok feloldását a főkartonokon.

### 5. Eszköz-komponensek és Forrásmegosztás Sáv (`AssetComponentsView.tsx`)
- Az eszközkarton dedikált tabjaként jelenik meg.
- Vizuális stacked bar chart: Támogatott forrásarány (%) vs. Saját erő arány (%).
- Komponensek táblázat eltérő aktiválási dátummal, hasznos élettartammal és könyv szerinti értékkel.
- **Életciklus-zárolás:** Amennyiben a főkarton eszköz nem aktív (`disposed`, `sold`, `missing`), a komponens fülön sárga tájékoztató sáv jelenik meg, az *„Új komponens hozzáadása”* gomb letiltódik, és a meglévő komponensek táblázatában a szerkesztés/törlés gombok helyett *„Zárolva”* jelvény jelenik meg, megvédve a már lezárt eszközök analitikáját.

## Consequences

**Előnyök:**
- Az eszközgazdálkodás teljesen papírmentessé válik a mobil leltározó és az automatikus PDF jegyzőkönyvek révén.
- Pályázati auditok során azonnal bemutatható a hibátlan 4-oldalú egyezőség és a komponens-szintű nyilvántartás.
- A könyvelőnek nem kell manuálisan kalkulálnia az időszaki támogatási PIE feloldási összegeket.

## Kapcsolódó
- [A-252: TENY Phase 2 & Phase 3 Architektúra](../../architecture/decisions/A-252-fixed-assets-phase2-and-phase3-inventory-grants-components-pie.md)
- [P-185: TENY Rekonciliáció és Kivezetés UX](./P-185-fixed-assets-reconciliation-disposal-approval-and-reserve-alerts-ux.md)
