# BRD Vizuális Diagramkészítési Irányelvek (baoyu-diagram Integráció)
## (Dedikált `<projekt>/docs/brd/diagramms/` alkönyvtár használata)

Ez az útmutató bemutatja, hogyan kell bármely szakterület BRD dokumentációjában azonosítani a vizuális ábrázolást igénylő logikai pontokat, megfeleltetni őket a **`baoyu-diagram`** diagramtípusoknak, és legenerálni a vektoros SVG és nagyfelbontású `@2x.png` képeket a dedikált **`diagramms/`** alkönyvtárba.

---

## 🎯 1. Diagramozási Alapelvek a BRD-ben

Egy üzleti döntéshozó vagy termékfejlesztő számára a vizuális folyamatábra vagy architektúra nagyságrendekkel gyorsabban értelmezhető, mint a hosszú szöveges leírás.
- **Minden moduláris BRD csomagnak tartalmaznia kell a döntésekhez és folyamatokhoz szükséges diagramokat.**
- **Minden diagram kötelezően a BRD dedikált diagram alkönyvtárában kap helyet:**
  `<projekt>/docs/brd/diagramms/` (vagy `<projekt>/brd/diagramms/`).
- **A diagramok stílusa mindig sötét téma:** `#0f172a` háttér, finom `#1e293b` rácsminta, `JetBrains Mono` betűtípus, harmonikus szemantikus színek, fedő maszkok a tiszta vonalvezetésért.

---

## 🗺️ 2. Üzleti Logikák Megfeleltetése Diagramtípusoknak

Bármilyen szakterületre (CRM, ERP, raktár, webshop, számlázás, HR, logisztika) készítesz BRD-t, az alábbi leképezést kövesd:

| Üzleti Terület | Mit Szemléltet? | Javasolt Típus | baoyu-diagram Stílus |
|:---|:---|:---:|:---|
| **Rendszer- és Portálarchitektúra** | Hogyan kapcsolódnak a különböző portálok, felhasználói felületek, a központi platform és a külső partnerek? | Architektúra | `architecture` (dobozok, zónák, határok, rétegek) |
| **Konceptuális Üzleti Adatmodell** | Melyek a fő üzleti entitások (pl. Ügyfél, Rendelés, Tétel, Bizonylat, Raktár) és hogyan kapcsolódnak (1..N, N..M)? | Strukturális / ER | `structural` (rekordok mezőkkel, kapcsolatvonalak) |
| **End-to-End Üzleti Életciklus** | Mi a folyamat teljes havi vagy eseményalapú fázis-sorrendje az előkészítéstől a zárásig és kimenetig? | Folyamatábra | `flowchart` (fázisos swimlane oszlopok + alsó idővonal) |
| **Kulcs Interakciók / Szekvencia** | Hogyan kommunikál egymással több szereplő (pl. Ügyfél, Operátor, Rendszermotor, Külső API) egy esemény során? | Szekvenciadiagram | `sequence` (életvonalak, számozott nyilak, aktivációs sávok) |
| **Fő Kezelőfelület / Tervezőrács** | Milyen logikai struktúrában, szűrőkkel és gyorsműveletekkel dolgozik a felhasználó a képernyőn? | Felületi Architektúra | `architecture` / UI Mockup (fejléc, szűrők, adatsorok, állapotok) |
| **Döntési Fa & Küszöb-automatizmus** | Ha egy számláló vagy feltétel átlép egy törvényi vagy üzleti küszöböt, hogyan válik szét a folyamat két ágra? | Döntési Folyamatábra | `flowchart` (döntési rombusz `#fbbf24`, automatikus kettéválasztás) |
| **Szabálymotor & Döntési Hierarchia** | Milyen hierarchiában írják felül egymást a szabályok (Globális → Helyi → Eseti), és melyek a súlyossági szintek? | Döntési Hierarchia | `architecture` / `flowchart` (öröklési rétegek + 4 súlyossági fokozat) |
| **Adatátadási Híd & Export Pipeline** | A lezárt adatok hogyan aggregálódnak és jutnak el a külső hatóságokhoz vagy partnerrendszerekhez? | Adatfolyam | `architecture` / `data-flow` (Forrás → Számítás → Célrendszerek) |
| **Roadmap & MVP Határvonal** | Milyen fázisokból áll a megvalósítás, hol húzódik az éles MVP határa, és mik a későbbi bővítések? | Ütemterv / Idővonal | `timeline` (vízszintes fázis-kártyák, MVP kiemelés, átmeneti nyíl) |

---

## ⚡ 3. Végrehajtás és PNG Konverzió (Bun CLI)

1. **Dedikált alkönyvtár biztosítása:**
   - Hozd létre a `<brd_gyoker>/diagramms/` könyvtárat.
2. **SVG létrehozása:**
   - Hozd létre az `.svg` fájlt közvetlenül a diagram alkönyvtárban (`<brd_gyoker>/diagramms/<nev>.svg`).
   - Kövesd a `baoyu-diagram` sötét témájú sablonját és színpalettáját.
3. **Nagyfelbontású PNG renderelés:**
   - Futtasd le a `baoyu-diagram` Bun konverterét:
     ```powershell
     npx -y bun "C:\Users\Morfi\.gemini\config\skills\baoyu-diagram\scripts\main.ts" "<brd_gyoker>\diagramms\<nev>.svg"
     ```
   - Ez automatikusan létrehozza a kristálytiszta `@2x.png` állományt a `diagramms/` mappában.
4. **Kettős beágyazás a Markdown döntési rekordokba:**
   ```markdown
   ![Ábra Neve](./diagramms/01_abra_neve.svg)
   *(Vektoros formátum: [01_abra_neve.svg](./diagramms/01_abra_neve.svg) · Nagyfelbontású kép: [01_abra_neve@2x.png](./diagramms/01_abra_neve@2x.png))*
   ```
5. **Index összesítés:**
   - Az `INDEX.md` fájlban vezess összefoglaló táblázatot az összes elkészült diagramról relatív linkekkel (`./diagramms/<nev>.svg`).
