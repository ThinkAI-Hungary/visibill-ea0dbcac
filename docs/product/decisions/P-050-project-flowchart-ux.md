# P-050: Projekt Flowchart UX

**Status:** Decided
**Category:** UI / Workflow
**Question:** Hogyan vizualizáljuk egy projekt bizonylatait és pénzügyi folyamatait interaktív folyamatábra formájában?
**Decision:**
A projektek főoldalán a kártya fejlécére kattintva a kártyalista helyén egy dedikált, fókuszált folyamatábra (Flowchart) nézet jelenik meg (Option B).
A folyamatábra egy 3-oszlopos elrendezést használ:
1. **Bal oszlop (Költség források):** NAV Bejövő Számlák, Munkadíjak (bérköltség a rögzített munkaidők alapján), és Feltöltött manuális bizonylatok (NAV-ban nem szereplő költségek).
2. **Középső oszlop:** Központi Projekt kártya költségfelhasználási arány folyamatjelzővel és költség/keret adatokkal.
3. **Jobb oszlop (Bevétel és Eredmény):** Kimenő Számlák (bevételek) és a Projekt Eredmény (Profit + százalékos árrés).

A dobozok között SVG Bezier görbék mutatják a pénz áramlását, amelyeken folyamatosan futó fényanimációk jelzik az adatkapcsolatokat. A dobozokra kattintva az alsó táblázat automatikusan frissül a kiválasztott adatok konkrét részleteivel (bizonylatlisták, bérszámítási részletek).

**Többdevizás kezelés (MNB átszámítás):**
A folyamatábra összesítő dobozaiban minden devizás összeget átszámítunk HUF-ra a `daily_exchange_rates` legfrissebb napi árfolyamai alapján. A részletező táblázatokban az eredeti devizás összeget és a számított HUF értéket egyaránt megjelenítjük.

**Deduplikáció:**
A feltöltött bizonylatok közül kiszűrjük azokat a számlákat, amelyek bizonylatszáma megegyezik a szinkronizált NAV számlákkal, így kiküszöböljük a költségek duplázódását.

**Bérköltségek:**
A bérköltségeket a munkatársak rögzített időbejegyzéseinek és az `employee_rates` táblában megadott óradíjainak szorzatából képezzük. Ha egy munkatárshoz nincs rögzített óradíj, 0 Ft-tal számolunk, de a részletező táblázatban piros figyelmeztetéssel jelezzük ezt a felhasználónak.

**Rationale:**
A teljes nézetes elrendezés biztosítja a legjobb térkihasználást a komplex adatok és a vonal-animációk megjelenítéséhez. Az interaktív node-kattintás pedig gyors elérést biztosít a mögöttes számlákhoz anélkül, hogy a felhasználónak el kellene hagynia a projekt kontextust.

## UX Finomítások és Light Mode Optimalizáció (2026.08)

### 1. Kártyák interakciója és Jelzések (Navigation Hint)
- **Kattintható terület:** A projekt kártyán a korábbi teljes fejléc helyett kizárólag a **projekt neve** kattintható (cursor-pointer és hoverkor megjelenő `GitBranch` ikon jelzi a kattinthatóságot).
- **Hover tooltip:** A projekt nevére hoverelve nem jelenik meg felugró tooltip (a tisztább UI érdekében).
- **Leírás hint:** A Projektek oldal fejlécében lévő leírás kiegészült a kattinthatóságra utaló útmutatással: 
  > *"A projekt kártyán tabfülek választják szét az áttekintést és a számla-kezelést. A projektek nevére kattintva egy részletesebb nézetre lehet navigálni."*

### 2. Kártyák elrendezése és Szélessége
- A projektek listáját megjelenítő rács elrendezését 3-hasábosról **2-hasábosra** alakítottuk (`md:grid-cols-1 lg:grid-cols-2`), így a kártyák szélesebbek lettek.
- Ennek köszönhetően a projekt kódja és a dátumtartomány (ha van) **egyetlen sorban** elfér anélkül, hogy megtörne.

### 3. "Belső projekt" fallback eltávolítása
- A korábbi statikus `"Belső projekt"` feliratot eltávolítottuk a felületről.
- Az `Ügyfél:` felirat és a hozzá tartozó partner név most már **kizárólag akkor jelenik meg, ha a céghez van rendelve partner** az adatbázisban (feltételes renderelés).

### 4. Projekt kód zárolása szerkesztésnél
- Meglévő projekt szerkesztésekor a projekt kód beviteli mezője le van tiltva (`disabled`), megakadályozva az azonosító utólagos módosítását.
- Új projekt létrehozásakor a mező továbbra is kitölthető.

### 5. Flowchart Light/Dark Mode adaptáció
- A folyamatábra kártyái fix sötét háttér helyett a témafüggő `bg-card` osztályt használják (világos módban fehér, sötét módban sötétszürke).
- A középső node progress bar háttérszíne a rendszerszintű `bg-muted` változóra módosult.
- A táblázatok sorainak hover-effektje a szabványos `hover:bg-muted/50` hatást kapta meg.
- A Recharts diagram rácsvonalai (`className="stroke-border/40"`), a tengelyek feliratai (`stroke="hsl(var(--muted-foreground))"`) és a felugró tooltip (`hsl(var(--background))` és `hsl(var(--border))`) reszponzívan igazodnak a rendszerszintű világos/sötét módhoz.

## Kapcsolódó
- [P-042: Kategóriák és projektek dual-table szinkronizációja](./P-042-categories-projects-sync.md)
- [A-022: Kategóriák és projektek dual-table szinkronizációja](../../architecture/decisions/A-022-categories-projects-sync.md)

