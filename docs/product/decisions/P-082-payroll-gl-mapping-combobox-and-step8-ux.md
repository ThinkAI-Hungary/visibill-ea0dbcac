# P-082: Bérszámfejtési Főkönyvi Feladás Kontírozás (Step 8), Kereshető Választó és Magyarázó Szövegezés UX

**Status:** Decided  
**Category:** eaisyBooks / Bérszámfejtés  
**Question:** Hogyan tehető a havi bérszámfejtési feladás 8. lépése (főkönyvi kontírozás ellenőrzése) ergonomikussá, gyorsan kereshetővé és a nem-technikai könyvelők számára közérthetővé?

## Context
A havi bérszámfejtési varázsló záró, 8. lépésében (`PayrollStep8.tsx`) a könyvelő a havi számfejtési tételek (Munkabér költség, SZOCHO, SZJA, TB, letiltások, nettó munkabér) főkönyvi számlakiosztását tekinti át és hagyja jóvá a cikluszárás előtt.
A korábbi implementáció több ergonómiai és vizuális hiányossággal küzdött:
- A megnevezés és a kiválasztó egyetlen szűk mezőbe volt sűrítve, a hosszú számlanevek elvágták egymást.
- Nem volt keresőmező: a több mint ezer számlát tartalmazó listát csak görgetve lehetett böngészni.
- A táblázat sötét (`bg-slate-900`) stílust használt a globális design tokenek (`bg-card`, `border-border`) helyett.
- A táblázat alatti magyarázó szöveg nyers adatbázis-táblaneveket (`acc_journal_headers`, `acc_journal_lines`) és technikai URL-eket (`/journals`) tartalmazott.

## Decision
1. **5-Oszlopos Tiszta Kontírozó Struktúra:**
   - A táblázat elrendezése különválasztja az esemény megnevezését és a számlaválasztót:
     `Gazdasági esemény | Főkönyvi számla (Kereshető combobox) | T / K | Tartozik összeg | Követel összeg`
   - A fejléc és az összesítő sor teljes mértékben a globális design tokeneket követi (`bg-muted/40`, `text-foreground`, `border-border`).

2. **Kereshető Combobox Komponens (`PayrollGlAccountSelector`):**
   - **Autofókuszos gyorskereső:** A választó megnyitásakor azonnal aktív keresőmező jelenik meg.
   - **Ékezetfüggetlen és számlaszám-intelligens szűrés:** Akár számlaszámra (pl. `541`), akár elnevezésre (pl. `ber`, `szocho`) gépel a könyvelő, a releváns tételek azonnal megjelennek. A pontos számlaszám- és előtag-egyezések a lista elejére sorolódnak.
   - **Számlaosztály Badge-ek és Csoportosítás:** Keresés nélkül a releváns számlaosztályok (5-ös költségek, 4-es kötelezettségek) diszkrét vizuális badge-ekkel (kék / lila) csoportosítva jelennek meg.
   - **Zéró Fekete Aktivációs Keret:** Letisztult 1px-es fintech teal keret (`border-primary`), nincs kattintási fekete outline.

3. **Szakmai, Közérthető Lábléc Szövegezés:**
   - A táblázat alatti magyarázó szöveg nem tartalmaz technikai adatbázis-neveket és belső útvonalakat.
   - Hivatalos szöveg:
     > *\* A főkönyvi számlaszámok a fenti választókból szabadon módosíthatók a cikluszárás előtt. A ciklus lezárásakor a tételek a kiválasztott főkönyvi számlákkal automatikusan bekerülnek a könyvelésbe, és közvetlenül megtekinthetők a Napló menüpont alatt.*

## Current Implementation
- `src/components/accounty/payroll/PayrollStep8.tsx`: 5-oszlopos kontírozó táblázat, automatikus mentés számlaválasztáskor (`saveCompanyPayrollGlMapping`), könyvelési egyensúly ellenőrző lábléc (`T = K`).
- `src/components/accounty/payroll/PayrollGlAccountSelector.tsx`: Teljes Popover Combobox keresővel, csoportosítással, lapozó gombbal és outline védelemmel.

## Rationale
A bérszámfejtési modul felhasználói könyvelők és bérszámfejtők. Számukra a gyors számlaszám-beírás, a tiszta T/K elrendezés és a szakmai terminológia az alapvető elvárás, az adatbázis oszlopnevek pedig rontják a bizalmat és a használhatóságot.

## Kapcsolódó
- [A-110: Bérszámfejtési Főkönyvi Számlatükör Pagináció és Kontírozás Perzisztencia](../../architecture/decisions/A-110-payroll-gl-preset-pagination-and-mapping-persistence.md)
- [P-033: Bérszámfejtési Ciklus Workflow](./P-033-payroll-cycle.md)
- [P-072: Bérszámfejtési Ciklus Jelenlét Kézi Rögzítés és Cafeteria UX Stabilitás](./P-072-payroll-cycle-attendance-manual-entry-and-cafeteria-ux.md)
