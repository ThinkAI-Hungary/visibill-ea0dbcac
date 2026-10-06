# P-163: Online Pénztárgép (OPG) Modul és Házipénztár Integráció UX

## Státusz
Elfogadva

## Dátum
2026-10-06

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

### 2. Modul felépítés (Fülek)
- **Forgalmi áttekintés**: KPI mutatókártyák (Összes OPG forgalom, Készpénzarány, Bankkártya arány, Pénztárgépek állapota), napi bontású forgalmi összesítő tábla, gyors szinkronizáció és kötegelt házipénztárba könyvelés.
- **Bizonylatok & Nyugták**: Kereshető és szűrhető tételes bizonylatlista (dátum, bizonylatszám, AP kód, típus, készpénz, bankkártya, könyvelési állapot). Oldalsó részletező lap (Sheet) ÁFA gyűjtőkkel és nyers NAV OPG audit adatokkal.
- **Pénztárgépek**: Regisztrált kasszák listája (AP kód, telephely, állapot, hozzárendelt házipénztár, utolsó szinkronizáció). Kapcsolat tesztelése és kassza-konfiguráció modal.
- **Szinkron napló**: Audit napló az automatikus és manuális adatlehívások eredményeiről, új/duplikált bizonylatok statisztikájáról és hibákról.

### 3. Házipénztári könyvelési mód
- Pénztárgépenként konfigurálható:
  - **Napi Z-zárás összesítő alapján (Ajánlott)**: A nap végi összesített készpénzforgalom egyetlen bizonylatként könyvelődik le a házipénztárba, megkímélve a pénztárkönyvet a napi több száz apró tételtől.
  - **Tételes nyugtánként**: Minden egyes készpénzes nyugta külön-külön tételként kerül be a házipénztári analitikába.

## Kapcsolódó Architektúra Döntés
- [A-204: Online Pénztárgép (OPG) Modul Architektúra és Házipénztár Integráció](../architecture/decisions/A-204-online-cash-register-opg-architecture.md)
