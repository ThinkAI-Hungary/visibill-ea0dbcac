---
name: create-prd
description: Transform any business requirements document (BRD), specification, design mockup notes, or feature brief into a comprehensive, modular Product Requirements Document (PRD) suite under <project>/docs/prd/ (or <project>/prd/). Runs autonomously with /goal execution mode until ALL extractable screens, views, form field specifications, UI state machines, and interactions are fully specified in atomic PRD records (PRD-01-<funkcio>.md). Follows strict product engineering guidelines: 100% Hungarian language, zero ADR, zero physical database schemas/DDL, zero backend implementation code, the 4 mandatory UI states (skeleton, empty, success, error), and professional dark-themed SVG diagrams and mockups placed in <project>/docs/prd/diagramms/ via baoyu-diagram. Use whenever the user asks for "/create-prd", "/goal /create-prd", "create PRD", "készíts PRD-t", "BRD-ből PRD", "PRD generálás", "generate PRD", "Product Requirements Document", "spec to prd", "PRD készítés", "PRD dokumentáció", or wants an exhaustive, autonomous product and screen-level specification with diagrams.
---

# Create PRD — Termékkövetelmény Dokumentáció Készítési Irányelvek

Ez a skill a jóváhagyott **Üzleti Követelmény Dokumentációkból (BRD)** vagy nyers specifikációkból való professzionális, moduláris **Termékkövetelmény Dokumentáció (PRD)** készítésének általános **módszertanát, felületi minőségi irányelveit és autonóm cél-vezérelt munkafolyamatát** rögzíti.

Bármilyen szakterületre (pénzügy, vállalatirányítás, CRM, raktár, e-kereskedelem, HR, logisztika, számlázás, stb.) alkalmazható.

---

## 🎯 Az 5 Nem-alkuképes Alapelv (Core Invariants)

1. **Pure Product & UI Focus (Zéró ADR, Zéró Fizikai Adatbázis Séma):**
   - A PRD a **HOGYAN MŰKÖDIK A TERMÉK ÉS A FELÜLET** kérdésére válaszol a felhasználó és a termékmenedzser szemszögéből.
   - Szigorúan tilos benne a fizikai adatbázis sémák, táblák, DDL, SQL parancsok (`CREATE TABLE`, `FOREIGN KEY`, `uuid`, `timestamptz`).
   - Szigorúan tilos benne a backend kód (`SECURITY DEFINER`, tárolt eljárások, RPC függvények). Ezek a fejlesztői **ADR (Architectural Decision Records)** fázisba tartoznak.
   - Helyettük képernyőtervek, elrendezések, UI komponensek, űrlapmezők pontos validációi, állapotgépek és interakciók specifikálandók.
2. **100% Tiszta Magyar Szaknyelv:**
   - A dokumentáció egységes, professzionális magyar szaknyelven íródik.
   - Tilos a hunglish és a zárójeles angol kódnevek halmozása a címekben.
3. **Tiszta Unicode Szimbólumok (Zéró LaTeX):**
   - Szigorúan tilos a LaTeX formázás (`$`, `\rightarrow`, `\approx`, `\le`).
   - Helyettük kizárólag szabványos Unicode karakterek használandók: `→`, `≤`, `≥`, `≠`, `≈`, `×`.
4. **Vizuális UI Mockupok Dedikált Alkönyvtárban (`diagramms/`):**
   - Minden kulcsfontosságú képernyőhöz, nézethez, modális ablakhoz és folyamathoz modern sötét témájú vektoros SVG diagramokat és nagyfelbontású `@2x.png` képeket kell készíteni közvetlenül a `<prd_gyoker>/diagramms/` (vagy `diagrams/`) alkönyvtárban.
5. **Cél-vezérelt Autonóm Végrehajtás (`/goal` Üzemmód):**
   - A PRD generálás **addig fut autonóm ciklusban, amíg az ÖSSZES előállítható PRD rekord el nem készült.**
   - Az AI ágens nem állhat meg félkész állapotban (pl. 1-2 képernyő után).
   - **Megállási feltétel:** Az AI ágensnek **CSAK AKKOR SZABAD MEGÁLLNIA**, ha lefedettségi leltárral és automatikus ellenőrzéssel (`verify_prd.py`) igazolta, hogy minden képernyő és funkció le van fedve, a diagramok a `diagramms/` mappában helyet kaptak, és zéró hiba áll fenn.

---

## 📁 A Moduláris Rekordstruktúra és Mappaszerkezet

A dokumentációt moduláris mappastruktúrában kell elhelyezni:
`<projekt_gyökér>/docs/prd/` vagy `<projekt_gyökér>/prd/` (illetve modul esetén `<projekt_gyökér>/docs/<modul>/prd/`).

### 📌 Dinamikus Döntési Rekordok (Nincs Merev Kötetszám!)

A PRD **NEM tartalmazhat előre kőbe vésett, merev kötetlistát vagy fix számú címet**. Ehelyett:
1. **Dinamikus Bontás:** Az AI ágens a beolvasott BRD vagy specifikáció funkcionális komplexitása alapján **dinamikusan dönti el**, hogy hány atomikus képernyő- és funkció-rekordra bontja a terméket.
2. **Rekordok Elnevezési Konvenciója:**
   Minden PRD rekord elnevezése kötelezően:
   `PRD-01-<funkcio>.md`, `PRD-02-<funkcio>.md`, `PRD-03-<funkcio>.md`, ...
   Ahol a `<funkcio>` egy rövid, beszédes, ékezetmentes magyar kifejezés (kebab-case), amely az adott képernyő vagy funkciócsoport fókuszát jelöli (pl. `PRD-01-navigacio-es-menustruktura.md`, `PRD-02-havi-naptarracs.md`, `PRD-03-muszakszerkeszto-drawer.md`, `PRD-04-tavollet-es-helyettesites.md`).
3. **Atomikus és Kimerítő Szemlélet:**
   Minden rekord részletesen leírja az adott képernyő elrendezését, mezőit, a 4 kötelező UI állapotot, az interakciókat és a hibakezelést.

### Mappastruktúra Minta:

```
<projekt>/docs/prd/  (vagy <projekt>/prd/)
├── INDEX.md                             # Központi navigáció, termékkoncepció, képernyőtérkép, diagramjegyzék
├── PRD-01-<funkcio_1>.md                # Első atomikus képernyő/funkció specifikáció
├── PRD-02-<funkcio_2>.md                # Második atomikus képernyő/funkció specifikáció
├── PRD-03-<funkcio_3>.md                # Harmadik atomikus képernyő/funkció specifikáció
├── ...                                  # Dinamikusan meghatározott összes további rekord
└── diagramms/                           # DEDIKÁLT DIAGRAM ALKÖNYVTÁR
    ├── 01_portal_navigacio.svg          # Vektoros sötét témájú diagram
    ├── 01_portal_navigacio@2x.png       # Bun CLI-vel generált nagyfelbontású kép
    ├── 02_naptarracs_mockup.svg
    ├── 02_naptarracs_mockup@2x.png
    └── ...
```

*Részletes rekordstruktúra és sablon:* Lásd [prd-structure-template.md](file:///C:/Users/Morfi/.gemini/config/skills/create-prd/references/prd-structure-template.md).

---

## 🛠️ Végrehajtási Munkafolyamat (`/goal` Üzemmód)

Amikor a felhasználó a `/create-prd` vagy `/goal /create-prd` parancsot adja ki:

### 1. Fázis: Bemenet Elemzése és Képernyőtérkép Leltár
- Olvasd be az alapul szolgáló BRD dokumentumokat (`docs/.../brd/`) vagy nyers specifikációt.
- Térképezd fel az összes szükséges képernyőt, nézetet, dialógust és munkafolyamatot.
- Határozd meg a szükséges `PRD-XX-<funkcio>.md` rekordok számát és fókuszát.

### 2. Fázis: Autonóm Rekordgenerálási Ciklus
- **Folyamatos autonóm végrehajtás:** Generáld le az összes tervezett `PRD-01-<funkcio>.md`, `PRD-02-...` rekordot egymás után.
- Minden rekordban kötelezően szerepelnie kell:
  - Képernyőelrendezési vázlat (ASCII / szöveges mockup);
  - Pontos mezőspecifikációs táblázat (Mezőnév, Típus, Validáció, Alapértelmezett, Hibaüzenet);
  - **A 4 kötelező UI állapot:**
    1. Betöltési állapot (Skeleton loader minták);
    2. Üres állapot (Empty state kártya CTA gombbal);
    3. Sikeres állapot (Azonnali optimista UI és toast);
    4. Hibaállapot (Inline piros hibaüzenet, retry gomb);
  - Interakciók, gyorsbillentyűk, double-submit védelem;
  - Fejléc navigációs sor: `[Előző rekord] · [Index](./INDEX.md) · [Következő rekord]`.

### 3. Fázis: Vizuális UI Diagramok Generálása a `diagramms/` Mappában
- Hozd létre a `<prd_gyoker>/diagramms/` könyvtárat.
- Készítsd el az SVG diagramokat (felületi mockup, navigáció, állapotgép, folyamat) a `baoyu-diagram` sötét témájú előírásai szerint (`#0f172a`, `JetBrains Mono`).
- Konvertáld őket nagyfelbontású `@2x.png` formátumra a Bun CLI-vel:
  ```powershell
  npx -y bun "C:\Users\Morfi\.gemini\config\skills\baoyu-diagram\scripts\main.ts" "<prd_gyoker>/diagramms/<abra_neve>.svg"
  ```
- Ágyazd be mindkét formátumban a vonatkozó markdown rekordokba a relatív `./diagramms/` útvonalon:
  ```markdown
  ![Ábra Címe](./diagramms/01_abra_neve.svg)
  *(Vektoros formátum: [01_abra_neve.svg](./diagramms/01_abra_neve.svg) · Nagyfelbontású kép: [01_abra_neve@2x.png](./diagramms/01_abra_neve@2x.png))*
  ```

### 4. Fázis: Tisztasági Szűrő és Csendes Audit (Zéró Fájlszemét)
- **Belső minőségi kapu:** Az auditot az ágens csendben, a háttérben futtatja le a `verify_prd.py` szkripttel.
- **Szigorúan tilos külön audit jelentés fájlt (`*_TISZTASAGI_AUDIT_JELENTES.md`) létrehozni a dokumentációs mappában!**
- Vizsgáld át az összes rekordot:
  - ❌ Zéró fizikai adatbázis DDL (`CREATE TABLE`, `ALTER TABLE`, idegen kulcsok).
  - ❌ Zéró backend kód (`SECURITY DEFINER`, SQL eljárások).
  - ❌ Zéró technikai szleng (*"egy cronnal lefut"*).
- Ha a vizsgálat bármilyen szivárgást vagy hibát jelez, csendben javítsd ki az érintett rekordban, amíg zöld nem lesz.

### 5. Fázis: Központi `INDEX.md` Összeállítása
- Állítsd össze a központi `INDEX.md` fájlt:
  - Termékkoncepció és működési célok;
  - Teljes navigációs mátrix az összes elkészült `PRD-XX-<funkcio>.md` rekordról;
  - A `diagramms/` mappában lévő összes vizuális ábra katalógusa;
  - Szerepkör-alapú olvasási útmutató.

### 6. Fázis: Lefedettségi és Integritási Minőségi Kapu (Kötelező Megállási Feltétel!)
Az AI ágens **CSAK ÉS KIZÁRÓLAG AKKOR ÁLLHAT MEG**, ha:
1. **Lefedettségi Önellenőrzés:** Minden képernyő, mező és üzleti folyamat specifikálva van.
2. **Automatizált Integritásellenőrzés:**
   ```powershell
   python "<skill_eleresi_ut>/scripts/verify_prd.py" "<prd_mappa_eleresi_ut>"
   ```
   Követelmény: **0 törött link (a `./diagramms/` képekre is), 0 LaTeX hiba, 0 technikai/SQL szivárgás.**

---

## 🚀 Példa Parancs a Felhasználótól

```
/goal /create-prd docs/beosztasom_hu/brd/
```
vagy:
```
/create-prd Készíts teljes körű PRD képernyőcsomagot az alábbi modulhoz: docs/szamlazas/
```
