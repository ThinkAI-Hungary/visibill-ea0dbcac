# Moduláris PRD Készítési Irányelvek és Rekordstruktúra Sablon
## (Product Requirements Document Guidelines & UI Specification Architecture)

Ez az útmutató rögzíti a **PRD (Termékkövetelmény Dokumentáció)** dinamikus rekordstruktúráját, felépítési elveit, az atomikus képernyőrekordok anatómiáját és a diagramkönyvtár szabványát. Bármilyen szakterületre (pénzügy, vállalatirányítás, CRM, raktár, e-kereskedelem, HR, logisztika, számlázás, stb.) alkalmazható.

---

## 🎯 1. A PRD Alapelvei és Szerepe

### Mi a PRD célja?
A PRD célja, hogy a jóváhagyott üzleti követelményekből (BRD) kiindulva pontosan definiálja:
- **HOGYAN NÉZ KI ÉS HOGYAN MŰKÖDIK A FELÜLET?**
  - Milyen képernyők, nézetek, táblázatok és modális ablakok alkotják a terméket?
  - Milyen mezők találhatók az űrlapokon, milyen típusokkal, alapértelmezésekkel és hibaüzenetekkel?
  - Milyen interakciók (kattintás, drag-and-drop, vágólap, gyorsbillentyűk) támogatottak?
  - Hogyan viselkedik a felület a 4 kötelező állapotban (betöltés, üres, sikeres, hiba)?

### Mi NEM a PRD feladata? (Szigorú elhatárolás!)
- ❌ **NEM ADR (Architectural Decision Record):** A PRD-ben tilos fizikai adatbázis táblákat, SQL parancsokat, DDL-t (`CREATE TABLE`, `FOREIGN KEY`, `uuid`), tárolt eljárásokat vagy backend implementációt (`SECURITY DEFINER`, RPC) írni.
- ❌ **NEM BRD (Business Requirements Document):** A PRD-ben nem a piaci problémák és elvont üzleti célok állnak a fókuszban, hanem a konkrét megvalósítandó képernyők és funkciók.

---

## 📁 2. A Dinamikus Rekordstruktúra és Mappaszerkezet

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
    └── ...
```

### 📌 Dinamikus Dekompozíció (Nincs Merev Kötetszám!)
Az AI ágens a specifikáció funkcionális határai alapján dinamikusan határozza meg a szükséges rekordok számát.
- **Névképzési szabály:** `PRD-01-<funkcio>.md`, `PRD-02-<funkcio>.md`...
- Ahol a `<funkcio>` beszédes magyar kifejezés kebab-case formátumban (pl. `PRD-01-navigacio-es-menustruktura.md`, `PRD-02-havi-naptarracs.md`, `PRD-03-muszakszerkeszto-drawer.md`).

---

## 📄 3. Egy Atomikus PRD Rekord Belső Anatómiája

Minden `PRD-XX-<funkcio>.md` fájl az alábbi professzionális struktúrát követi:

```markdown
# PRD-XX: [Képernyő / Funkció Beszédes Neve Magyarul]

[Előző rekord: PRD-YY-...](./PRD-YY-...) · [Vissza a PRD Indexhez](./INDEX.md) · [Következő rekord: PRD-ZZ-...](./PRD-ZZ-...)

---

## 1. Termék- és Felületcélkitűzés
- Mi a képernyő / modul célja?
- Milyen felhasználói problémát old meg a képernyőn?
- Kiemelt felületi értékajánlatok pontokba szedve.

## 2. Képernyőszerkezet és UI Elrendezés
- Szöveges vagy ASCII elrendezési vázlat (Fejléc, Szűrősáv, Munkaterület, Oldalsó sávok, Alsó összesítők).
- Zónák méretezése és reszponzív viselkedése.

## 3. Vizuális Felületi Mockup (baoyu-diagram)
![Ábra Címe](./diagramms/XX_abra_neve.svg)
*(Vektoros formátum: [XX_abra_neve.svg](./diagramms/XX_abra_neve.svg) · Nagyfelbontású kép: [XX_abra_neve@2x.png](./diagramms/XX_abra_neve@2x.png))*

## 4. Űrlap- és Mezőspecifikáció (Pontos Mezőtáblázat)
| Mező Neve | Típus | Validációs Szabályok és Korlátok | Alapértelmezett | Hibaüzenet | Követelmény ID |
|:---|:---:|:---|:---:|:---|:---:|
| ... | ... | ... | ... | ... | ... |

## 5. Felhasználói Interakciók és Gyorsbillentyűk
- Kattintások, duplakattintások, lebegő (hover) elemek és tooltipek.
- Gyorsbillentyűk (pl. Tab, Enter, Ctrl+C, Ctrl+V, Delete, Undo/Redo).
- Vágólap és tartománykijelölési interakciók.
- Double-submit védelem (gombok letiltása folyamatban lévő mentésnél).

## 6. A 4 Kötelező UI Állapot
1. **Betöltési Állapot (Skeleton Loader):** Hogyan néz ki a felület adatbetöltés közben? (szürke pulzáló kártyák/sorok).
2. **Üres Állapot (Empty State):** Hogyan néz ki a képernyő, ha még nincsenek adatok? (Illusztráció, magyarázat, elsődleges CTA gomb).
3. **Sikeres Állapot (Optimistic & Toast):** Azonnali UI visszajelzés és megerősítő zöld toast üzenet.
4. **Hibaállapot (Inline & Retry):** Mezőszintű piros validációs üzenetek és hálózati hiba esetén `Újrapróbálkozás` gomb.

## 7. Design System és Token Megfeleltetés
- Szemantikus osztályok (`bg-background`, `bg-card`, `border-border`, `text-primary`).
- Komponens elemek (`shadcn/ui`, `Lucide` ikonok, `StatusBadge`, `MetricCard`, `UnifiedPagination`).

## 8. Elfogadási Kritériumok (Definition of Done)
- Mikor tekinthető a felület és a funkció késznek fejlesztői és tesztelési szempontból?
```

---

## 🗺️ 4. A Központi `INDEX.md` Felépítése

Az `INDEX.md` fogja össze az összes dinamikusan létrehozott PRD rekordot:
1. **Termékkoncepció és Működési Célok:** Vezetői összefoglaló a termék működéséről.
2. **Képernyők és Funkciók Navigációs Mátrixa:** Táblázat az összes létező rekordról (Azonosító, Fájlnév, Fő Képernyők, Érintett Szereplők).
3. **Vizuális Diagramok Katalógusa:** Táblázat a `diagramms/` alkönyvtárban lévő összes SVG és `@2x.png` diagramról.
4. **Szerepkör-alapú Olvasási Útmutató:** Melyik szereplőnek mely rekordokat érdemes elolvasnia.
