# Moduláris BRD Készítési Irányelvek és Rekordstruktúra Sablon
## (Business Requirements Document Guidelines & Dynamic Record Architecture)

Ez az útmutató rögzíti a **BRD (Üzleti Követelmény Dokumentáció)** dinamikus rekordstruktúráját, felépítési elveit, a döntési rekordok anatómiáját és a diagramkönyvtár szabványát. Bármilyen szakterületre (pénzügy, vállalatirányítás, CRM, raktár, e-kereskedelem, HR, logisztika, számlázás, stb.) alkalmazható.

---

## 🎯 1. A BRD Alapelvei és Szerepe

### Mi a BRD célja?
A BRD célja, hogy **kizárólag az üzleti igényeket, célokat, szabályokat, folyamatokat és felhasználói elvárásokat** rögzítse.
- **A BRD válaszol:**
  - *MIÉRT* jön létre a rendszer/modul? (Üzleti cél, piaci probléma, értékajánlat)
  - *KI* fogja használni? (Szereplők, felhasználói típusok, felelősségek)
  - *MIT* kell tudnia a rendszernek üzleti szempontból? (Munkafolyamatok, jogosultságok, adatkörök)
  - *MILYEN SZABÁLYOK* mentén kell működnie? (Jogszabályok, üzleti korlátok, számítások, döntések)
  - *MIKOR ÉS MILYEN FORMÁBAN* kell átadni az adatokat? (Kimenetek, bizonylatok, feladások)

### Mi NEM a BRD feladata? (Szigorú elhatárolás!)
- ❌ **NEM ADR (Architectural Decision Record):** A BRD-ben tilos technológiai döntéseket hozni (adatbázis motor, táblaszerkezet, SQL, DDL, backend keretrendszer, tárolt eljárások, ORM, infrastruktúra).
- ❌ **NEM PRD (Product Requirements Document) technikai része:** A BRD-ben tilos REST API végpontokat, HTTP metódusokat (`GET`/`POST`), UI komponens-könyvtárakat vagy kódszintű állapotkezelést definiálni.
- ❌ **NEM Technikai Fuzzy Szöveg:** Tilos a fejlesztői "majd egy cronnal megoldjuk", "a controller kezeli", "egy async worker lehúzza a queue-ból" típusú homályos fél-technikai szövegek használata.

---

## 📁 2. A Dinamikus Rekordstruktúra és Mappaszerkezet

A BRD-t tilos egyetlen átláthatatlan monolit fájlba zsúfolni. Mindig fókuszált, logikailag elkülönülő `.md` rekordokba kell szervezni a projekt dedikált dokumentációs mappájában:
`<projekt_gyökér>/docs/brd/` vagy `<projekt_gyökér>/brd/` (illetve almodul esetén `<projekt_gyökér>/docs/<modul>/brd/`).

```
<projekt>/docs/brd/  (vagy <projekt>/brd/)
├── INDEX.md                             # Központi navigáció, vezetői összefoglaló, rekord- és diagramjegyzék
├── BRD-01-<dontes_tema_1>.md            # Első atomikus üzleti döntési rekord
├── BRD-02-<dontes_tema_2>.md            # Második atomikus üzleti döntési rekord
├── BRD-03-<dontes_tema_3>.md            # Harmadik atomikus üzleti döntési rekord
├── ...                                  # Dinamikusan meghatározott összes további rekord (BRD-04, ...)
└── diagramms/                           # DEDIKÁLT DIAGRAM ALKÖNYVTÁR
    ├── 01_rendszer_architektura.svg     # Vektoros sötét témájú diagram
    ├── 01_rendszer_architektura@2x.png  # Bun CLI-vel generált nagyfelbontású kép
    ├── 02_uzleti_folyamat_flowchart.svg
    ├── 02_uzleti_folyamat_flowchart@2x.png
    └── ...
```

### 📌 Dinamikus Dekompozíció (Nincs Merev Kötetszám!)

A BRD-készítés során **tilos merev, előre rögzített kötetlistához ragaszkodni**. Az AI ágens a specifikációból dinamikusan határozza meg a szükséges rekordok számát és fókuszát az alábbi elvek szerint:

1. **Az Atomicitás és Koherencia Elve:**
   - Minden rekord egyetlen, logikailag szorosan összefüggő üzleti döntést, témakört vagy képességcsoportot tárgyal.
   - Olyan határok mentén bontunk, ahol a felelősség, a folyamat vagy a szabályrendszer önmagában is koherens egészet alkot.
2. **Névképzési Szabvány:**
   `BRD-01-<dontes>.md`, `BRD-02-<dontes>.md`, `BRD-03-<dontes>.md`, ...
   Ahol a `<dontes>` egy rövid, beszédes, ékezetmentes magyar kifejezés (kebab-case), pl.:
   - `BRD-01-szervezeti-hierarchia.md` (cégek, telephelyek, munkakörök)
   - `BRD-02-ugyfel-azonositas-es-profilok.md` (ügyféltörzs, jogosultságok)
   - `BRD-03-munkaido-szabalyozas.md` (munkaidő-keret, pihenőidők)
   - `BRD-04-kalkulacios-es-dijszamitas.md` (árazás, göngyölítés)
   - `BRD-05-bizonylat-feladas-es-export.md` (kimenetek, adathíd)
3. **Dinamikus Méret és Terjedelem:**
   - Egy kisebb integrációhoz vagy egyszerű modulhoz elegendő lehet 3–4 rekord.
   - Egy komplex vállalatirányítási vagy bérszámfejtési rendszerhez 8–12 fókuszált rekord indokolt.

---

## 📄 3. Egy Atomikus BRD Döntési Rekord Belső Anatómiája

Minden `BRD-XX-<dontes>.md` fájl az alábbi egységes és professzionális szerkezetet követi:

```markdown
# BRD-XX: [Beszédes Üzleti Cím Magyarul]

[Előző rekord: BRD-YY-...](./BRD-YY-...) · [Vissza az Indexhez](./INDEX.md) · [Következő rekord: BRD-ZZ-...](./BRD-ZZ-...)

---

## 1. Üzleti Cél és Döntési Háttér
- Miért van szükség erre az üzleti képességre? Milyen problémát old meg?
- Milyen üzleti előnyt vagy megtérülést biztosít a szervezet számára?

## 2. Érintett Szereplők és Felelősségek
- Kik a folyamat aktorai (pl. Rendszergazda, Vezető, Dolgozó, Könyvelő)?
- Milyen üzleti jogosultsági és felelősségi határok érvényesek rájuk?

## 3. Üzleti Szabályok és Feltételrendszer
- Szigorúan számozott üzleti szabályok (`RULE-01`, `RULE-02`...).
- Számítási logikák, küszöbértékek, jogszabályi vagy vállalati korlátok tiszta Unicode szimbólumokkal (`→`, `≤`, `≥`, `≈`, `×`).

## 4. Munkafolyamat és Felhasználói Út
- A folyamat lépésről lépésre üzleti események formájában (pl. Igénylés → Ellenőrzés → Jóváhagyás → Véglegesítés).
- Interakciós pontok és döntési elágazások.

## 5. Vizuális Szemléltetés (baoyu-diagram)
- Ha a folyamat, entitáskapcsolat vagy döntési fa megkívánja, a `diagramms/` alkönyvtárban lévő diagram közvetlen beágyazása:
![Ábra neve](./diagramms/XX_abra_neve.svg)
*(Vektoros formátum: [XX_abra_neve.svg](./diagramms/XX_abra_neve.svg) · Nagyfelbontású kép: [XX_abra_neve@2x.png](./diagramms/XX_abra_neve@2x.png))*

## 6. Kivételkezelés és Érvénytelenség
- Mi történik hiányos adatok, határidő-túllépés vagy szabályütközés esetén?
- Vészhelyzeti / manuális beavatkozási utak.

## 7. Elfogadási Kritériumok (Üzleti Definition of Done)
- Mikor tekinthető a követelmény üzletileg teljesítettnek és elfogadhatónak?
```

---

## 🗺️ 4. A Központi `INDEX.md` Felépítése

Az `INDEX.md` fogja össze az összes dinamikusan létrehozott rekordot:
1. **Projekt Fejléc & Üzleti Célkitűzés:** 1-2 mondatos vezetői összefoglaló a rendszer céljáról.
2. **Vezetői Összefoglaló & Értékajánlat:** Piaci háttér és KPI-k.
3. **Döntési Rekordok Térképe:** Táblázat az összes létező rekordról:
   | Rekord Azonosító | Fájlnév | Döntési Fókusz & Terület | Érintett Szereplők |
   |:---|:---|:---|:---|
   | **BRD-01** | [BRD-01-szervezeti-hierarchia.md](./BRD-01-szervezeti-hierarchia.md) | Szervezeti egységek, telephelyek, munkakörök | Cégvezető, HR |
   | **BRD-02** | [BRD-02-...](./BRD-02-...) | ... | ... |
4. **Vizuális Diagramok Jegyzéke:** Táblázat a `diagramms/` alkönyvtárban lévő összes SVG és `@2x.png` diagramról, azok típusáról és céljáról (`./diagramms/<abra_neve>.svg`).
5. **Szerepkör-alapú Olvasási Útmutató:** Melyik szereplőnek mely rekordokat érdemes elolvasnia.

---

## 🎨 5. A Dedikált Diagram Alkönyvtár Szabványa (`diagramms/`)

- **Helyszín:** Minden ábra a BRD dedikált diagram alkönyvtárában jön létre: `<projekt>/docs/brd/diagramms/` (vagy `<projekt>/brd/diagramms/`).
- **Formátum:** Mindig önálló vektoros `.svg` és abból Bun CLI-vel legenerált nagyfelbontású `@2x.png` kép.
- **Stílus:** Sötét téma (`#0f172a` háttér, finom rács, `JetBrains Mono` betűtípus, harmonikus szemantikus színek).
- **Beágyazás:** A markdown rekordokban relatív `./diagramms/` útvonalon kell hivatkozni rájuk:
  `![Ábra Neve](./diagramms/XX_abra_neve.svg)`
  `*(Vektoros formátum: [XX_abra_neve.svg](./diagramms/XX_abra_neve.svg) · Nagyfelbontású kép: [XX_abra_neve@2x.png](./diagramms/XX_abra_neve@2x.png))*`

---

## 🔄 6. A `/goal` Teljességi és Megállási Feltétel (Completeness Gate)

A BRD generálási folyamat addig fut autonóm módon, amíg a forrásanyagokból az összes előállítható BRD rekord és diagram el nem készült.

**Az AI ágens CSAK AKKOR állhat meg, ha:**
1. **Teljes Lefedettség:** Minden fejezet, szabály, szereplő és folyamat le van képezve egy-egy `BRD-XX` döntési rekordba.
2. **Diagramok Generálva:** Minden kulcsdiagram elkészült és megtalálható a `diagramms/` mappában.
3. **Index Frissítve:** Az `INDEX.md` tartalmazza az összes rekordot és ábrát.
4. **Zöld Verifikáció:** A `verify_brd.py` lefutott 0 hibával és 0 figyelmeztetéssel.
