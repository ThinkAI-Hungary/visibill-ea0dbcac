# P-176: Könyvelési Napló RLB-Mintájú Szűkítés Modál, Pozitív Unió Irányszűrés és Reszponzív Panel UX

**Status:** Decided  
**Category:** UI / Workflow / Accounting Journals  
**Date:** 2026-10-09  

---

## Question

Hogyan alakítsuk ki a Könyvelési Napló (`/journals`) szűrési felületét és munkafolyamatát úgy, hogy:
1. Kielégítse a tradicionális könyvelői szoftverek (különösen az RLB-60) felhasználóinak elvárásait a többdimenziós szűkítés terén?
2. Megszüntesse a szűrési logikai hibát (ahol a "Szállító számlák" egyedüli kiválasztásakor üres lista jelent meg)?
3. Megszüntesse az előző dialógus UI/UX anomáliáit:
   - Ne kelljen oldalirányba görgetni a dialógust (`overflow-x-hidden`),
   - A mezőcímkék (labelek) ne lógjanak bele a dátumválasztó mezőkbe,
   - Az input mezők ne essenek ki a kijelölt konténerkeretből,
   - Törölje a redundáns és felesleges "RLB minta" jelvényt a fejlécből?

---

## Decision

A Napló szűrő dialógusa és logikája egy modern, reszponzív és felhasználóbarát modális komponensbe (`JournalFilterModal.tsx`) és tiszta segédfüggvény-modulba (`journalFilterUtils.ts`) szerveződött:

### 1. Reszponzív és Zsúfoltságmentes Elrendezés (`JournalFilterModal.tsx`)
- **Vízszintes görgetés megszüntetése:** A dialógus belső törzse `overflow-x-hidden` és `max-h-[85vh]` osztályokkal lett ellátva, garantálva a tiszta függőleges görgetést.
- **Függőleges Címke-Input Hierarchia:** A korábbi egymás mellé zsúfolt dátumsorok helyett vertikális elrendezés (`space-y-1.5`) biztosítja, hogy a "Dátum -tól", "Dátum -ig" címkék tisztán, átfedésmentesen a beviteli mezők felett helyezkedjenek el.
- **Méretkorlátok és Rugalmas Szélességek:** Az összeg, bizonylatszám és dátum inputok `min-w-0 flex-1` és rögzített `w-32 shrink-0` méretezést kaptak, így kisebb képernyőméret vagy átméretezett ablak esetén sem csúsznak ki a szülő dobozból.
- **Fejléc Tisztítás:** A félrevezető "RLB minta" kitűző eltávolításra került; helyette az egységes "Napló tételek szűkítése" cím és a megfogalmazott szűkítési kategóriák szerepelnek.

### 2. Szűkítési Kategóriák és Pozitív Unió Irányszűrés
A modál 5 funkcionális szekcióra tagolódik:

| Szekció | Mezők és Opciók | Működés |
|---------|-----------------|---------|
| **Napló Típusok** | Szállító (454), Vevő (311), Pénztár (381), Bank (384), Vegyes (5-9/1-4) | Pozitív unió: a kiválasztott típusok bármelyikének megfelelő bizonylatok megjelennek. A szállító szűrő a naplókódokat (`SZ`, `K`), neveket, 45-ös főkönyvi számokat, `AUTO_SZAMLA` típust és explicit `INBOUND` irányokat is figyelembe veszi. |
| **Dátum Intervallumok** | Könyvelési dátum, Esedékesség, Bizonylat kelte | Dátum-tól és Dátum-ig naptári választókkal, automatikus formátum-validációval. |
| **Bizonylat és Partner** | Bizonylatszám kereső, Pontos/Részleges egyezés, Számlaszám | Keresés számlaszámra, partnerre vagy generált könyvelési naplósorszámra. |
| **Összeghatár** | Minimum és Maximum forintösszeg | Numerikus szűrés a bizonylat bruttó főösszegére. |
| **Státusz** | Könyvelt, Piszkozat, Sztornózott tételek | Szelektív státusz-szűrés; mindkettő bepipálása vagy üresen hagyása unconstrained aktív bizonylatokat jelenít meg. |

### 3. Főoldali Gomb és Aktív Szűrők Kijelzése (`JournalsPage.tsx`)
- A Napló fejlécében elhelyezett **"Szűkítés"** gomb (`Filter` ikonnal) egy diszkrét számláló jelvényt (badge) kapott.
- A jelvény dinamikusan mutatja az aktív szűrési feltételek darabszámát (pl. `[2]` ha szállító és könyvelt van bekapcsolva).
- A dialógusban egy kattintással elérhető a **"Szűrők alaphelyzetbe"** gomb.

---

## Current Implementation

- Komponens: [`src/components/journals/JournalFilterModal.tsx`](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/components/journals/JournalFilterModal.tsx)
- Szűrőmotor: [`src/components/journals/journalFilterUtils.ts`](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/components/journals/journalFilterUtils.ts)
- Főoldali integráció: [`src/pages/JournalsPage.tsx`](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/pages/JournalsPage.tsx)
- Automatizált tesztek: [`JournalFilterModal.test.tsx`](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/components/journals/__tests__/JournalFilterModal.test.tsx) (13 teszt) és [`journalFilterUtils.test.ts`](file:///c:/Users/adetw/.antigravity/visibill/visibill-709fffdf/src/components/journals/__tests__/journalFilterUtils.test.ts) (6 teszt).

---

## Rationale

A könyvelési naplók böngészése az egyik leggyakoribb feladat a havi és éves zárások során. Az RLB-60 logikát követő, de a modern web ergonómiájához igazított modális szűrő lehetővé teszi, hogy a könyvelő pillanatok alatt izolálja a szállítói kötelezettségeket vagy a nyitott banki bizonylatokat anélkül, hogy a felület szétesne vagy rejtélyes 0 találatos hibákba ütközne.

---

## Kapcsolódó
- [A-238: Könyvelési Napló Bizonylatszintű Tételegyesítés és RLB-Mintájú Szűrési Architektúra](../../architecture/decisions/A-238-accounting-journals-document-grouping-and-rlb-filter-architecture.md)
- [A-057: Könyvelési Napló Rendszer Architektúra](../../architecture/decisions/A-057-accounting-journals-architecture.md)
- [P-055: Könyvelési Naplók Felhasználói Élmény (UX)](./P-055-accounting-journals-ux.md)
