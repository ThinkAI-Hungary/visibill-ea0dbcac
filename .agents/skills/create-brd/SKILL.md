---
name: create-brd
description: Transform any raw specification, Word document (.docx), PDF, meeting transcript, or fuzzy requirement notes into a complete, modular Business Requirements Document (BRD) suite under <project>/docs/brd/ (or <project>/brd/). Runs autonomously with /goal execution mode until ALL extractable atomic BRD records (BRD-01-<dontes>.md) are produced and verified. Follows strict guidelines: 100% Hungarian language, zero ADR, zero PRD, zero technical fuzzy text, with professional dark-themed SVG diagrams and flowcharts placed in <project>/docs/brd/diagramms/ via baoyu-diagram. Use whenever the user asks for "/create-brd", "/goal /create-brd", "create BRD", "készíts BRD-t", "specifikációból BRD", "BRD generálás", "generate BRD", "Business Requirements Document", "spec to brd", "BRD készítés", "BRD dokumentáció", or wants an exhaustive, autonomous generation of business requirements with diagrams.
---

# Create BRD — Üzleti Követelmény Dokumentáció Készítési Irányelvek

Ez a skill a nyers, homályos, technikai vagy rendezetlen projekt-specifikációkból (Word `.docx`, PDF, meeting leiratok, hanganyag-átiratok, roadmap jegyzetek) való **moduláris Üzleti Követelmény Dokumentáció (BRD)** készítésének általános **módszertanát, minőségi irányelveit és autonóm cél-vezérelt munkafolyamatát** rögzíti.

Bármilyen szakterületre (pénzügy, vállalatirányítás, CRM, raktár, e-kereskedelem, HR, logisztika, számlázás, stb.) alkalmazható.

---

## 🎯 Az 5 Nem-alkuképes Alapelv (Core Invariants)

1. **Pure Business Focus (Zéró ADR, Zéró PRD, Zéró Technikai Fuzzy Szöveg):**
   - A BRD kizárólag a **MIT** és a **MIÉRT** kérdésekre válaszol üzleti szempontból, sosem a technikai **HOGYAN**-ra.
   - Szigorúan tilos bármilyen ADR (adatbázis séma, DDL, SQL, táblanevek, kulcsok, backend nyelv, keretrendszer) vagy technikai PRD (REST API végpontok, HTTP státuszkódok, UI propok, kód-importok) szivárgás.
   - Tilos a fejlesztői "fuzzy" szleng használata (pl. *"majd egy aszinkron task lehúzza"*, *"a controllerben megoldjuk"*, *"egy cron jobbal elintézzük"*).
2. **100% Tiszta Magyar Szaknyelv:**
   - A dokumentáció egységes, igényes magyar szaknyelven íródik.
   - Tilos a hunglish ("generálja a shiftet", "validálja a requestet").
   - Tilos az angol kódnevek zárójeles halmozása a címekben és szövegekben (pl. `Munkahely (Workplace)` helyett `Munkahely`).
3. **Tiszta Unicode Szimbólumok (Zéró LaTeX):**
   - Szigorúan tilos a LaTeX matematikai formázás (`$`, `\rightarrow`, `\approx`, `\le`, `\times`).
   - Helyettük kizárólag a szabványos tiszta Unicode szimbólumok használandók: `→`, `≈`, `≤`, `≥`, `≠`, `×`.
4. **Vizuális Érthetőség Dedikált Diagram Alkönyvtárban (`diagramms/`):**
   - Minden kulcsfontosságú üzleti folyamathoz, entitásmodellhez és döntési fához modern sötét témájú vektoros SVG diagramokat és nagyfelbontású `@2x.png` képeket kell készíteni.
   - **Minden diagram kötelezően a BRD dedikált diagram alkönyvtárában jön létre:** `<brd_gyoker>/diagramms/` (vagy `diagrams/`).
5. **Cél-vezérelt Autonóm Végrehajtás (`/goal` Üzemmód):**
   - A BRD generálás **addig fut autonóm ciklusban, amíg a forrásdokumentumokból az ÖSSZES előállítható BRD rekord el nem készült.**
   - Az AI ágens nem állhat meg félig kész állapotban (pl. néhány fájl után).
   - **Megállási feltétel:** Az AI ágensnek **CSAK AKKOR SZABAD MEGÁLLNIA**, ha lefedettségi leltárral és automatikus ellenőrzéssel (`verify_brd.py`) igazolta, hogy a forrásanyag 100%-ban fel van dolgozva, minden rekord elkészült, a diagramok a `diagramms/` mappában helyet kaptak, és zéró hiba áll fenn.

---

## 📁 A Moduláris Rekordstruktúra és Mappaszerkezet

A dokumentációt moduláris mappastruktúrában kell elhelyezni:
`<projekt_gyökér>/docs/brd/` vagy `<projekt_gyökér>/brd/` (illetve almodul esetén `<projekt_gyökér>/docs/<modul>/brd/`).

### 📌 Dinamikus Döntési Rekordok (Nincs Merev Kötetszám!)

A BRD **NEM tartalmazhat előre kőbe vésett, merev kötetlistát vagy fix számú címet**. Ehelyett:
1. **Dinamikus Bontás:** Az AI ágens a beolvasott dokumentum(ok) tartalma, üzleti komplexitása és logikai összefüggései alapján **dinamikusan dönti el**, hogy hány atomikus, egymással logikailag egybefüggő döntési rekordra bontja a követelményeket.
2. **Rekordok Elnevezési Konvenciója:**
   A BRD rekordok elnevezése kötelezően a következő mintát követi:
   `BRD-01-<dontes>.md`, `BRD-02-<dontes>.md`, `BRD-03-<dontes>.md`, ...
   Ahol a `<dontes>` egy rövid, beszédes, ékezetmentes magyar kifejezés (kebab-case), amely az adott rekord üzleti döntési fókuszát jelöli (pl. `BRD-01-szervezeti-hierarchia.md`, `BRD-02-ugyfel-azonositas.md`, `BRD-03-munkaido-szabalyozas.md`, `BRD-04-fizetesi-folyamatok.md`).
3. **Atomikus és Kohezív Szemlélet:**
   Minden `BRD-XX-<dontes>.md` rekord egyetlen önálló, jól körülhatárolt üzleti döntési kört vagy képességet fed le (cél, szereplők, szabályok, folyamat, kivételek, elfogadási feltételek).

### Mappastruktúra Minta:

```
<projekt>/docs/brd/  (vagy <projekt>/brd/)
├── INDEX.md                             # Központi navigáció, vezetői összefoglaló, rekord- és diagramjegyzék
├── BRD-01-<dontes_tema_1>.md            # Első atomikus üzleti döntési rekord
├── BRD-02-<dontes_tema_2>.md            # Második atomikus üzleti döntési rekord
├── BRD-03-<dontes_tema_3>.md            # Harmadik atomikus üzleti döntési rekord
├── ...                                  # Dinamikusan meghatározott összes további rekord (BRD-04, BRD-05, ...)
└── diagramms/                           # DEDIKÁLT DIAGRAM ALKÖNYVTÁR
    ├── 01_rendszer_architektura.svg     # Vektoros sötét témájú diagram
    ├── 01_rendszer_architektura@2x.png  # Bun CLI-vel generált nagyfelbontású kép
    ├── 02_uzleti_folyamat_flowchart.svg
    ├── 02_uzleti_folyamat_flowchart@2x.png
    └── ...
```

*Részletes rekordstruktúra és sablon:* Lásd [brd-structure-template.md](file:///C:/Users/Morfi/.gemini/config/skills/create-brd/references/brd-structure-template.md).

---

## 🛠️ Végrehajtási Munkafolyamat (`/goal` Üzemmód)

Amikor a felhasználó a `/create-brd` vagy `/goal /create-brd` parancsot adja ki, a feladatot az alábbi cél-vezérelt fázisokon keresztül, **megszakítás nélkül** kell végrehajtani:

### 1. Fázis: Teljes Forráselemzés és Követelmény-Leltár
- Olvasd be a megadott forrásanyagokat (.docx, .pdf, markdown, leiratok).
- Térképezd fel a teljes üzleti hatókört: szereplők, folyamatok, szabályok, számítások, kimenetek.
- Készíts egy belső **Követelmény-Leltárt**: határozd meg, hogy az összes igény maradéktalan lefedéséhez pontosan hány és milyen témájú `BRD-XX-<dontes>.md` rekordra van szükség.

### 2. Fázis: Autonóm Rekordgenerálási Ciklus
- **Folyamatos autonóm végrehajtás:** Generáld le az összes tervezett `BRD-01-<dontes>.md`, `BRD-02-...` rekordot egymás után.
- Minden rekordban alkalmazz:
  - Sorszámozott üzleti szabályokat (`RULE-01`, `RULE-02`...).
  - Működő relatív fejléc navigációt:
    `[Előző rekord: ...] · [Vissza az Indexhez](./INDEX.md) · [Következő rekord: ...]`
  - Szigorúan 100% magyar terminológiát és tiszta Unicode szimbólumokat.

### 3. Fázis: Vizuális Illusztrációk Létrehozása a `diagramms/` Mappában
- Hozd létre a `<brd_gyoker>/diagramms/` könyvtárat.
- Azonosítsd a specifikáció legfontosabb logikai csomópontjait (architektúra, ER modell, folyamatok, döntési fák, szabálymotor hierarchia, integrációs hidak).
- Készítsd el az SVG fájlokat a `diagramms/` mappában a `baoyu-diagram` sötét témájú előírásai szerint (`#0f172a`, `JetBrains Mono`).
- Konvertáld őket nagyfelbontású `@2x.png` formátumra a Bun CLI-vel:
  ```powershell
  npx -y bun "C:\Users\Morfi\.gemini\config\skills\baoyu-diagram\scripts\main.ts" "<brd_gyoker>/diagramms/<abra_neve>.svg"
  ```
- Ágyazd be mindkét formátumban a vonatkozó markdown döntési rekordokba a relatív `./diagramms/` útvonalon:
  ```markdown
  ![Ábra Címe](./diagramms/01_abra_neve.svg)
  *(Vektoros formátum: [01_abra_neve.svg](./diagramms/01_abra_neve.svg) · Nagyfelbontású kép: [01_abra_neve@2x.png](./diagramms/01_abra_neve@2x.png))*
  ```

*Részletes diagramkészítési útmutató:* Lásd [diagram-mapping-guide.md](file:///C:/Users/Morfi/.gemini/config/skills/create-brd/references/diagram-mapping-guide.md).

### 4. Fázis: Tisztasági Szűrő és Csendes Audit (Zéró Fájlszemét)
- **Belső minőségi kapu:** Az auditot az ágens csendben, a háttérben futtatja le a `verify_brd.py` szkripttel.
- **Szigorúan tilos külön audit jelentés fájlt (`*_TISZTASAGI_AUDIT_JELENTES.md`) létrehozni a dokumentációs mappában!**
- Vizsgáld át az összes rekordot a szigorú tiltólista alapján:
  - ❌ Zéró ADR: Nincs SQL, DDL, táblák, kulcsok, backend keretrendszer.
  - ❌ Zéró PRD: Nincs API végpont (`GET /api/`), HTTP státuszkód, UI komponens kód.
  - ❌ Zéró technikai szleng: Nincs *"egy cronnal lefut"*, *"a queue intézi"*.
- Ha a vizsgálat hibát vagy szivárgást jelez, azt csendben javítsd ki az érintett rekordban, amíg zöld nem lesz.

*Részletes ellenőrző lista:* Lásd [purity-audit-checklist.md](file:///C:/Users/Morfi/.gemini/config/skills/create-brd/references/purity-audit-checklist.md).

### 5. Fázis: Központi `INDEX.md` Összeállítása
- Állítsd össze a központi `INDEX.md` fájlt:
  - Projekt neve, üzleti célkitűzése, vezetői összefoglaló;
  - Teljes navigációs táblázat az összes elkészült `BRD-XX-<dontes>.md` rekordról;
  - A `diagramms/` mappában lévő összes vizuális ábra összefoglaló katalógusa (`./diagramms/<abra_neve>.svg`);
  - Szerepkör-alapú olvasási útmutató.

### 6. Fázis: Lefedettségi és Integritási Minőségi Kapu (Kötelező Megállási Feltétel!)
Az AI ágens **CSAK ÉS KIZÁRÓLAG AKKOR ÁLLHAT MEG**, ha az alábbi két ellenőrzés sikeresen lefutott:

1. **Lefedettségi Önellenőrzés (Completeness Check):**
   - Vesse össze az elkészült `BRD-XX` fájlokat az eredeti forrásdokumentummal.
   - *Kérdés:* Létezik-e olyan üzleti szabály, entitás, szerepkör vagy folyamat a forrásban, amely nem került feldolgozásra?
   - **Ha maradt lefedetlen követelmény:** Az ágens NEM állhat meg, hanem automatikusan létrehozza a hiányzó döntési rekordokat!
2. **Automatizált Integritásellenőrzés:**
   - Futtasd le az ellenőrző szkriptet:
     ```powershell
     python "C:\Users\Morfi\.gemini\config\skills\create-brd\scripts\verify_brd.py" "<brd_mappa_eleresi_ut>"
     ```
   - Követelmény: **0 törött link (a `./diagramms/` fájlokra is), 0 LaTeX hiba, 0 technikai szivárgás.**

Csak akkor jelentsd készre a feladatot, ha a lefedettség teljes és az ellenőrző szkript zöld eredményt adott!

---

## 🚀 Példa Parancs a Felhasználótól

```
/goal /create-brd docs/logisztika/Flotta_Kezelo_Rendszer_Specifikacio.docx
```
vagy:
```
/goal Készíts komplett BRD csomagot az összes lehetséges rekorddal és diagrammal: scratch/meeting_notes.txt
```
