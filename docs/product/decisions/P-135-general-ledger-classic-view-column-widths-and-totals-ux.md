# P-135: Főkönyvi Kivonat Klasszikus Nézet Oszlopszélességek és Összesítő Sáv UX

**Status:** Decided  
**Category:** eaisyBooks / Főkönyv  
**Ticket Reference:** Lendvai Ádám (Kolos Transport Kft. / Sümegi és Társa Kft. — 2026. szept. 28.)  
**Question:** Hogyan biztosítható, hogy a Főkönyvi Kivonat 4-oszlopos „Klasszikus” nézetében a százmilliós és többmilliárdos összegek, valamint a lábléc összesítő sorai soha ne csússzanak egymásba?

## Context
A Főkönyvi Kivonat rendelkezik egy „Klasszikus” 4-oszlopos nézettel (`viewLayout === 'classic'`), amely a hagyományos könyvelői elvárásoknak megfelelően külön oszlopokban jeleníti meg a Tartozik forgalmat, Követel forgalmat, Tartozik egyenleget és Követel egyenleget.
Korábban a CSS Grid layoutban a 4 numerikus oszlop fixen `120px` szélességűre volt korlátozva:
- A `p-3` (24px) cellapadding miatt a számok számára rendelkezésre álló hasznos szélesség mindössze 96px volt.
- A 2 tizedesjeggyel formázott magyar számok (pl. `395 750 318,91`) 14 karakter hosszúak (~118px szélesek), ami túlcsordult a 96px-es kereten.
- Az alsó összesítő sávban a 6. oszlopban (Egyenleg K) az összeg mellett egy frissítőgomb (`RefreshCw`, 24px) és térköz (`gap-2`, 8px) is elhelyezkedett, ami miatt a 4 összeg teljesen egymásra csúszott (`395 750 318,91406 420 136,58395 750 318,9106 420 136,58`), olvashatatlanná téve az összesítőket.
- Milliárdos vagy tízmilliárdos forgalmak esetén a torzulás a táblázat törzsében is jelentkezett.

## Decision
1. **Oszlopméretek bővítése (165px / 190px):**
   - A CSS Grid rácsot a klasszikus nézetben kibővítettük:
     `grid-cols-[90px_minmax(220px,1fr)_165px_165px_165px_190px]`
   - A Fők. szám 90px-re optimalizálva (3-4 jegyű számok kényelmesen elférnek).
   - A 3 numerikus oszlop (Forgalom T/K, Egyenleg T) `165px` fix szélességet kapott, ami 14-17 karakteres (akár 100 milliárd Ft feletti) összegeknek is kényelmes helyet ad.
   - Az Egyenleg K oszlop `190px` szélességet kapott, így a milliárdos szám és a mellette lévő frissítő/módosító gomb tágasan elférnek egymás mellett.
2. **Padding és tördelésvédelem (`whitespace-nowrap` & `overflow-hidden`):**
   - A numerikus oszlopok vízszintes paddingjét `px-2.5`-re finomhangoltuk, extra 8-10px hasznos helyet biztosítva a számoknak.
   - Minden összeg `whitespace-nowrap` védelmet kapott, megakadályozva a sortörést.
   - A cellákra `overflow-hidden` került, kizárva a szomszédos oszlopokba való átfedést.
3. **Konténer minimális szélesség (`min-w-[1020px]`):**
   - A táblázat minimális szélességét `840px`-ről `1020px`-re emeltük klasszikus nézetben. Kisebb kijelzőkön kulturált vízszintes görgetés jelenik meg, megvédve az oszlopok arányait.

## Current Implementation
- `src/components/general-ledger/GeneralLedgerTable.tsx`:
  - `gridColsClass` kibővítve `165px` és `190px` oszlopokkal.
  - Fejléc és csontváz fejléc celláiban `px-2.5` és `whitespace-nowrap`.
  - Törzssorok numerikus celláiban `whitespace-nowrap` és `overflow-hidden`.
  - Lábléc (`Sticky Footer`) elrendezés tágas paddinggel és átfedés-mentes gombpozicionálással.

## Rationale
A professzionális könyvelőirodák és vállalkozások számára elengedhetetlen, hogy a nagy forgalmú cégek milliárdos egyenlegei is hiba- és átfedésmentesen, tisztán jelenjenek meg a klasszikus főkönyvi kimutatásokban.

## Kapcsolódó
- [P-105: Főkönyvi Kivonat 2-Tier Eszköztár és Fastruktúra Kibontás/Összecsukás UX](./P-105-general-ledger-toolbar-and-expand-collapse-ux.md)
- [P-122: Főkönyv Felhasználói Élmény (UX), Letisztult Könyvelői Ergonómia és Zsúfoltság-Megszüntetés](./P-122-general-ledger-ui-ux-restructuring-and-clutter-reduction.md)
