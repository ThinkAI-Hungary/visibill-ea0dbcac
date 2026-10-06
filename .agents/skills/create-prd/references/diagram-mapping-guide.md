# PRD Vizuális UI Diagram- és Mockupkészítési Irányelvek (baoyu-diagram)
## (Dedikált `<projekt>/docs/prd/diagramms/` alkönyvtár használata)

Ez az útmutató bemutatja, hogyan kell bármely szakterület PRD dokumentációjában azonosítani a vizuális felületi ábrázolást igénylő képernyőket, nézeteket és állapotgépeket, megfeleltetni őket a **`baoyu-diagram`** diagramtípusoknak, és legenerálni a vektoros SVG és nagyfelbontású `@2x.png` képeket a dedikált **`diagramms/`** alkönyvtárba.

---

## 🎯 1. Diagramozási Alapelvek a PRD-ben

A termékmenedzserek, UI/UX tervezők és frontend fejlesztők számára a vizuális képernyőterv és állapotgép nagyságrendekkel egyértelműbbé teszi az elvárásokat:
- **Minden kulcsfontosságú felülethez, nézethez vagy interakcióhoz készüljön vizuális ábra.**
- **Minden diagram kötelezően a PRD dedikált diagram alkönyvtárában kap helyet:**
  `<projekt>/docs/prd/diagramms/` (vagy `<projekt>/prd/diagramms/`).
- **A diagramok stílusa mindig sötét téma:** `#0f172a` háttér, finom `#1e293b` keretek és rácsok, `JetBrains Mono` betűtípus, harmonikus szemantikus színek, kártya-alapú UI dobozok.

---

## 🗺️ 2. Felületi Logikák Megfeleltetése Diagramtípusoknak

Bármilyen szakterületre (pénzügy, vállalatirányítás, CRM, raktár, e-kereskedelem, HR, logisztika, számlázás) készítesz PRD-t, az alábbi leképezést kövesd:

| Felületi Terület | Mit Szemléltet? | Javasolt Típus | baoyu-diagram Stílus |
|:---|:---|:---:|:---|
| **Portál- és Menüstruktúra** | Hogyan épül fel a főnavigáció, az oldalsáv és az almenük modulok szerint? | Navigációs Architektúra | `architecture` (hierarchikus menüfák, aktív útvonalak) |
| **Fő Munkafelület / Táblázat / Rács** | Hogyan néz ki a fő munkaképernyő (fejléc, szűrősáv, naptárrács/adattábla, oldalsáv, lábléc)? | Felületi Mockup (UI) | `architecture` / UI Layout (fejléc, szűrőkártyák, adatsorok, statisztikák) |
| **Részletező Panel / Drawer / Modál** | Hogyan épül fel az adatszerkesztő vagy beállító felugró ablak, űrlapmezőkkel és gombokkal? | Modális UI Mockup | `architecture` (dialog keret, mezők, gombcsoportok) |
| **UI Állapotgép (4 Kötelező Állapot)** | Hogyan vált át a komponens a Betöltés → Üres / Adat → Mentés → Siker / Hiba állapotok között? | Állapotátmenet / Flowchart | `flowchart` (állapot-kártyák, esemény-nyilak, toast visszajelzés) |
| **Többlépéses Varázsló (Wizard)** | Milyen lépésekből áll az összetett munkafolyamat, és milyen validációk kellenek a lépések között? | Lépéssorozat / Folyamat | `flowchart` (számozott lépések, feltételes elágazások) |
| **Interaktív Folyamat (Drag & Drop, Kijelölés)** | Milyen lépésekben történik a felületi interakció (fogás, húzás, célterület kiemelése, elengedés, megerősítés)? | Interakciós Szekvencia | `sequence` / `flowchart` (interakciós szakaszok, vizuális állapotok) |
| **Összesítő Kártyák & KPI Dashboard** | Hogyan helyezkednek el a felső mutatószámok, grafikonok és riasztási sávok a képernyőn? | Dashboard Mockup | `architecture` (metrikakártyák, haladási sávok, küszöbszínek) |
| **Kimeneti Előnézet és Export Dialógus** | Hogyan jelenik meg az exportálási beállítások ablaka, a formátumválasztó és az adatösszesítő előnézet? | Előnézeti Panel | `architecture` (opcióválasztó kártyák, letöltési gombok) |

---

## ⚡ 3. Végrehajtás és PNG Konverzió (Bun CLI)

1. **Dedikált alkönyvtár biztosítása:**
   - Hozd létre a `<prd_gyoker>/diagramms/` könyvtárat.
2. **SVG létrehozása:**
   - Hozd létre az `.svg` fájlt közvetlenül a diagram alkönyvtárban (`<prd_gyoker>/diagramms/<nev>.svg`).
   - Kövesd a modern sötét felületi mockup stílust (sötét háttér, lekerekített kártyák, státuszjelzők).
3. **Nagyfelbontású PNG renderelés:**
   - Futtasd le a `baoyu-diagram` Bun konverterét:
     ```powershell
     npx -y bun "C:\Users\Morfi\.gemini\config\skills\baoyu-diagram\scripts\main.ts" "<prd_gyoker>\diagramms\<nev>.svg"
     ```
   - Ez automatikusan létrehozza a kristálytiszta `@2x.png` állományt a `diagramms/` mappában.
4. **Kettős beágyazás a Markdown PRD rekordokba:**
   ```markdown
   ![Ábra Neve](./diagramms/01_abra_neve.svg)
   *(Vektoros formátum: [01_abra_neve.svg](./diagramms/01_abra_neve.svg) · Nagyfelbontású kép: [01_abra_neve@2x.png](./diagramms/01_abra_neve@2x.png))*
   ```
5. **Index összesítés:**
   - Az `INDEX.md` fájlban vezess összefoglaló táblázatot az összes elkészült képernyődiagramról és mockupról relatív linkekkel (`./diagramms/<nev>.svg`).
