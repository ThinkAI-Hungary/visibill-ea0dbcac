# P-163: Online Pénztárgép (OPG) Modul és Házipénztár Integráció UX

## Státusz
Elfogadva

## Dátum
2026-10-07 (Frissítve: hierarchikus Z-zárás nézet, automatikus AP felderítés és szinkron UX)

## Kontextus és Problémafelvetés
A kiskereskedelmi és vendéglátóipari ügyfelek jelentős része kötelezett NAV Online Pénztárgép (OPG) használatára. Korábban a pénztárgépi nyugták és napi Z-zárások adatai manuális rögzítést vagy papíralapú pénztárkönyvelést igényeltek, ami lassú, hibalehetőségekre nyitott és nehezen egyeztethető folyamat volt a házipénztár analitikával.

Szükségessé vált egy dedikált, automatizált Online Pénztárgép (OPG) modul bevezetése az eaisyBILL-ben, amely:
1. Lehetővé teszi több online pénztárgép (AP kód) kezelését cégenként.
2. Automatikusan lekérdezi és megjeleníti a pénztárgépi bizonylatokat (nyugták, egyszerűsített számlák, Z-zárások, sztornók, visszáruk).
3. Fizetési módok szerint bontja a forgalmat (Készpénz, Bankkártya, SZÉP kártya, Utalvány).
4. Közvetlenül átvezeti a készpénzes forgalmat a kijelölt házipénztárba.

## UX és Termékdöntések

### 1. Elhelyezés és Navigáció (Fejléc Címváltó)
- Az OPG funkció a **Házipénztár** (`/petty-cash`) oldal tetején, a fejléc címében kapott helyet interaktív címkapcsolóként (`Házipénztár / OPG`), elkerülve az oldalsáv duplikációját és a lenti gombsor túlterhelését.
- **Házipénztár állapot:** A "Házipénztár" szöveg aktív fehér (`text-foreground font-bold`), az "OPG" kapcsoló mellette kiszürkítve (`text-muted-foreground/40 font-bold`) jelenik meg, jelezve a függő bizonylatok darabszámát. Alatta az eredeti 5 házipénztári fül (`Tételek`, `Jóváhagyások`, `Pénztárjelentések`, `Pénztárak`, `Routing szabályok`) érhető el.
- **OPG állapot:** Az "OPG" szöveg aktív fehérre vált, a "Házipénztár" kiszürkül, és a teljes beágyazott OPG funkciócsalád jelenik meg.
- A közvetlen `/petty-cash/opg` vagy legacy `/opg` útvonalon keresztül a felület automatikusan OPG állapotban nyílik meg.
- A Házipénztár felületén egy kiemelt integrációs sáv és közvetlen váltógomb is segíti a könyvelőt, ha függő, még le nem könyvelt készpénzes OPG forgalom áll rendelkezésre.
- **Egységes szinkronizáció:** A fejléc jobb felső sarkában elhelyezett, minden fülön folyamatosan elérhető `OPG Szinkronizáció` gomb az egyetlen hivatalos indítóeszköz, megelőzve a felületi duplikációt.

### 2. Modul felépítés (Fülek)

- **Forgalmi áttekintés**:
  - KPI mutatókártyák (Összes OPG forgalom, Készpénzarány, Bankkártya arány, Pénztárgépek állapota).
  - Napi bontású forgalmi összesítő táblázat, amelynek kártyafejlécébe integráltuk az "Összes tranzakció megtekintése" és a mintaadat-generáló gyorsgombokat a letisztult, sallangmentes felépítés érdekében.

- **Bizonylatok & Nyugták (Hierarchikus Napi Z-zárás Nézet)**:
  - **Alapértelmezett csoportosított nézet:** A könyvelőnek nem kell több száz apró nyugta között keresgélnie; a táblázat fő sorai a **Napi Z-zárások** (dátum/időpont, zárásszám, tételszám jelvény pl. `6 tétel`, pénztárgép neve és AP kódja, napi forgalom, készpénz és bankkártya összeg, könyvelési státusz).
  - **Lenyitható (Accordion) tételek:** Bármely Z-zárás sorára kattintva azonnal lenyílik a záráshoz tartozó belső bizonylatlista (nyugtaszám, időpont, összeg, fizetési mód, házipénztári státusz és közvetlen könyvelés).
  - **Intelligens keresés:** Bizonylatszámra vagy tételre történő kereséskor a találatot tartalmazó szülő zárás automatikusan lenyílik és kiemeli a tételt.
  - **Összes lenyitása / Összes becsukása:** Egyetlen gombnyomással áttekinthető az összes nap összes tétele.
  - **Nézetváltó:** `[Napi zárások]` fa-struktúra és `[Lapos lista]` közötti azonnali váltás.

- **Pénztárgépek**:
  - Regisztrált kasszák listája (AP kód, telephely, állapot, hozzárendelt házipénztár, utolsó szinkronizáció).
  - **Pénztárgépek automatikus felderítése NAV-ból:** Egy kattintásos funkció, amely a meglévő NAV Online Számla technikai felhasználó segítségével lekérdezi és automatikusan rögzíti a vállalkozáshoz tartozó kasszákat AP kóddal és elérhető napló-tartományokkal, elkerülve a manuális adatrögzítést.

- **Szinkron napló**:
  - Audit napló az automatikus és manuális adatlehívások eredményeiről, új/duplikált bizonylatok statisztikájáról és hibákról.

### 3. Házipénztári könyvelési mód
- Pénztárgépenként konfigurálható:
  - **Napi Z-zárás összesítő alapján (Ajánlott)**: A nap végi összesített készpénzforgalom egyetlen bizonylatként könyvelődik le a házipénztárba, megkímélve a pénztárkönyvet a napi több száz apró tételtől.
  - **Tételes nyugtánként**: Minden egyes készpénzes nyugta külön-külön tételként kerül be a házipénztári analitikába.

## Kapcsolódó Architektúra Döntés
- [A-204: Online Pénztárgép (OPG) Modul Architektúra és Házipénztár Integráció](../architecture/decisions/A-204-online-cash-register-opg-architecture.md)
- [A-005: Supabase Edge Functions Katalógus](../architecture/decisions/A-005-edge-functions.md)
