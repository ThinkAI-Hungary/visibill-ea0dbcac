# P-064: Partially Paid Invoice Status, Badge & Filter UX

**Status:** Decided  
**Date:** 2026-09-02  
**Category:** UI / Invoices / UX  

## Context

A felhasználók számára elengedhetetlen, hogy a számlalistában azonnal megkülönböztethető legyen a teljesen kifizetett számla a részben teljesített bizonylatoktól. Részfizetés esetén a felhasználónak látnia kell a már kifizetett és a még hátralévő összeget anélkül, hogy külön meg kellene nyitnia a számla részleteit.

## Decision

1. **Vizuális Megjelenítés (Badge & Színek):**
   - **Teljesen kifizetett számlák:** Zöld `Kifizetve` badge (`bg-success/10 text-success`).
   - **Részben fizetett számlák:** Kék `Részben fizetve` badge (`bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30`), a táblázatsor finom kék háttérrel (`bg-blue-500/[0.06]`).
   - **Nyitott számlák:** Piros `Nyitott` badge (`bg-destructive/10 text-destructive`).

2. **Interaktív Tooltip:**
   - A `Részben fizetve` badge fölé víve a kurzort a rendszer tooltipben megjeleníti:
     - Kifizetve: *összeg és pénznem* (pl. 156 323 Ft zöld színnel)
     - Fennmaradó: *összeg és pénznem* (pl. 22 950 Ft piros színnel)

3. **Szűrési Funkció:**
   - A Számlák fejlécében lévő Állapot lenyíló menüben a felhasználó közvetlenül kiválaszthatja a `Részben fizetve` opciót, amellyel azonnal kilistázhatók a függőben lévő részletfizetéses számlák.

4. **Jelmagyarázat (Legend):**
   - A táblázatok feletti jelmagyarázatban a fekete keretes *„Nincs párosítás”* helyett a kék *„Részben fizetve”* (`bg-blue-500/15 border-l-blue-500`) jelölő szerepel.

## Kapcsolódó
- [A-082: Partially Paid Invoices Status, Server-Side Amount Aggregation & Trigger Alignment](../../architecture/decisions/A-082-partially-paid-invoices-status.md)
- [P-010: Invoice List View & Filters](./P-010-invoice-list.md)
- [P-054: Scalable Server-Side Invoice Pagination & KPI Card Filtering UX](./P-054-server-side-invoice-pagination-and-kpi-filters-ux.md)
