# A-238: Könyvelési Napló Bizonylatszintű Tételegyesítés és RLB-Mintájú Szűrési Architektúra

**Status:** Decided  
**Date:** 2026-10-09  
**Utoljára frissítve:** 2026-10-09  

---

## Context

A Visibill kettős könyvviteli napló modulja (`/journals`) két alapvető működési és adatintegritási kihívással szembesült:

### 1. Többtételes Számlák Fragmentációja a Piszkozatokban
Amikor a rendszer az `acc_generate_drafts_from_ledger` tárolt eljárással vagy a kliensoldali `draftFallbackGenerator.ts` szervizzel piszkozat bizonylatokat hozott létre a főkönyvi adatokból, a többtételes számlákat tételenként különálló naplófejekbe (`acc_journal_headers`) darabolta.
Ez a gyakorlatban azt jelentette, hogy egy 20 tételes közmű- vagy áruszámla 20 különálló bizonylatszámot és egyensúlyozott naplófejet kapott ahelyett, hogy a számviteli törvénynek (Sztv.) megfelelően egyetlen bizonylatfej alá csoportosítva, több tételsorként (`acc_journal_lines`) jelent volna meg.

### 2. A Napló Szűrési Rendszer Inkonzisztenciája és Hibái
A könyvelők a napi munkájuk során a tradicionális könyvelőprogramokban (különösen az RLB-60 rendszerben) megszokott többdimenziós szűkítést igénylik:
- **Típusok szerinti szűkítés:** Szállító (454), Vevő (311), Pénztár (381), Bank (384), Vegyes (5-9/1-4).
- **Szűrési logikai hiba (Zero-Results Bug):** A korábbi szűrés kizárólagos metszet-alapú vizsgálatot végzett. Ha a felhasználó egyedül a "Szállító számlák" szűrőt jelölte be, a szűrő motor a bizonylatok eltérő metaadat-struktúrája miatt 0 találatot adott vissza valós szállítói tételekre is.
- **Státuszkezelési anomália:** A lekönyvelt (`KONYVELT`) és piszkozat (`PISZKOZAT`) jelölőnégyzetek állapota nem kezelte az aktív állapotok szimmetrikus lekérdezését és a különálló sztornó (`SZTORNO`) szűrést.

---

## Decision

A naplómodul adatbázis- és kliensoldalon is átfogó, bizonylatközpontú refaktoráláson esett át:

### 1. Bizonylatszintű Tételegyesítés az Adatbázisban (`20261009220000_group_invoice_drafts_by_document.sql`)
Az `acc_generate_drafts_from_ledger` PostgreSQL tárolt eljárás belső logikája átalakult:
- A számlatételek feldolgozása előtt bizonylatszám (`document_number`) és forrásszámla alapján csoportosítja a sorokat.
- Egy számlához **pontosan egyetlen `acc_journal_headers` rekord** jön létre.
- A számla valamennyi nettó költség/árbevétel és ÁFA tétele egyetlen bizonylatfej alá, szekvenciális sorszámozással (`acc_journal_lines`) kerül beillesztésre.
- A szállítói/vevői ellenszámla (454 / 311) sora a teljes bizonylat bruttó összegével egyensúlyozza a bizonylatot.
- Ugyanez a konszolidált aggregáció érvényesült a kliensoldali `draftFallbackGenerator.ts` szervizben is.

### 2. Pozitív Unió Iránymegfeleltetés (`journalFilterUtils.ts`)
A kizárólagos metszet helyett pozitív unió logikát (`OR`) és robusztus típus-detektálást vezettünk be:
- **Szállító felismerés (`isSzallito`):** 
  - Naplókód ellenőrzése: `entry.journalCode === 'SZ'` vagy `'K'`
  - Naplónév ellenőrzése: `journalName.includes('szállító')`
  - Főkönyvi szám vizsgálat: `glNumber.startsWith('45')` (Szállítók)
  - Automatikus számla típus: `entry.entryType === 'AUTO_SZAMLA'`
  - Explicit irány: `invoice_direction === 'INBOUND'` vagy `direction === 'INBOUND'`
- **Vevő felismerés (`isVevo`):**
  - Naplókód ellenőrzése: `entry.journalCode === 'V'`
  - Naplónév ellenőrzése: `journalName.includes('vevő')`
  - Főkönyvi szám vizsgálat: `glNumber.startsWith('31')` (Vevők)
  - Explicit irány: `invoice_direction === 'OUTBOUND'` vagy `direction === 'OUTBOUND'`
- **Pénztár (`isPenztar`):** `journalCode === 'P'` vagy GL `381`
- **Bank (`isBank`):** `journalCode === 'B'` vagy GL `384`
- **Vegyes (`isVegyes`):** `journalCode === 'VE'` vagy egyéb vegyes ágak

### 3. Státusz Szűrési Állapotgép
- Ha a felhasználó mindkét alapvető státuszt bejelöli (`statusKonyvelt: true && statusPiszkozat: true`), vagy egyiket sem jelöli be (`!statusKonyvelt && !statusPiszkozat`), a rendszer korlátozás nélkül minden aktív státuszú bizonylatot megjelenít.
- Ha csak a lekönyvelteket kéri: `status === 'KONYVELT'`.
- Ha csak a piszkozatokat kéri: `status === 'PISZKOZAT'`.
- A `statusSztorno` önálló jelzőként szabályozza a sztornírozott tételek megjelenítését.

### 4. Moduláris Felületi Integráció (`JournalFilterModal.tsx` & `JournalsPage.tsx`)
A szűrési paraméterek egy önálló dialógusba rendeződtek, megszüntetve a fő naplófelület zsúfoltságát. Az aktív szűrők számát egy kis jelvény (badge) jelzi a gomb mellett.

---

## Consequences

### Pozitív
- **Számviteli Hűség:** A könyvelési bizonylatok megegyeznek a valós számlákkal: 1 számla = 1 bizonylat = N tételsor.
- **Megbízható Keresés és Szűkítés:** A könyvelő azonnal megtalálja a szállítói, vevői vagy pénztári tételeket anélkül, hogy a metaadatok belső eltérései miatt a szűrő kiüresedne.
- **Alacsonyabb Bizonylatszám Túlterhelés:** Nem jönnek létre felesleges bizonylatfejek az adatbázisban, csökken az indexméret és a hálózati adatforgalom.

### Negatív / Kockázatok
- **Kliensoldali Szűrési Erőforrás:** Nagyszámú naplótétel (több ezer sor) esetén a szűrőfüggvény kliensoldali futtatása CPU ciklusokat igényel, amit a memoizált selectorok (`useMemo`) optimalizálnak.

---

## Kapcsolódó
- [A-057: Könyvelési Napló Rendszer Architektúra](./A-057-accounting-journals-architecture.md)
- [P-055: Könyvelési Naplók Felhasználói Élmény (UX)](../../product/decisions/P-055-accounting-journals-ux.md)
- [P-176: Könyvelési Napló RLB-Mintájú Szűkítés Modál UX](../../product/decisions/P-176-accounting-journals-rlb-pattern-filter-modal-and-direction-matching-ux.md)
- [043: Könyvelési Naplók Üzleti Szabályzata](../../business/decisions/043-accounting-journals.md)
