# A-029: Aszinkron URL és Lokális Dialógus Állapot Szinkronizáció

**Status:** Decided
**Date:** 2026-07-05
**Utoljára frissítve:** 2026-07-05

## Context
Az alkalmazásban több dialógus (pl. `InvoiceFilesDialog`) állapotát két forrás vezérli:
1. Lokális React state (`filesDialogOpen`).
2. URL query paraméterek (`?action=files`).

A dialógus bezárásakor race condition alakult ki: a felhasználó bezárja a dialógust (lokális state -> `false`), de az URL frissítése aszinkron módon történik. Egy `useEffect` figyeli az URL-t, és mivel ott még szerepelt az `action=files`, a dialógust azonnal újra kinyitotta ("visszaugrás" / villogás), mielőtt az URL paraméter törlődött volna.

## Decision
Bevezetünk egy gátló (lock) mechanizmust az aszinkron állapot-átmenetek kezelésére:

1.  **`dialogClosingRef` használata**: Egy `useRef(false)` változót használunk, amelyet a bezárási folyamat elején `true`-ra állítunk. Ez a ref gátolja az URL-figyelő `useEffect` számára az újra-nyitást.
2.  **Késleltetett URL frissítés**: A `setSearchParams` hívását 300ms-al késleltetjük. Ez két célt szolgál:
    *   Lehetővé teszi a Radix UI exit animációk (200ms) zavartalan lefutását.
    *   Időt ad a UI-nak az unmounting befejezésére, mielőtt a szülő komponens az URL változása miatt újra-renderelődne.
3.  **Ref felszabadítás delay**: A `dialogClosingRef` értékét csak az URL frissítése után, egy extra 50ms-os biztonsági ablakban állítjuk vissza `false`-ra, biztosítva, hogy a React state frissítések lefutottak.

## Consequences
**Pozitív:**
*   Megszűnik a UI villogás és a dialógusok "visszaugrása" bezáráskor.
*   Az exit animációk láthatóak és simák maradnak.
*   A megoldás mintaként szolgál más URL-vezérelt UI elemekhez.

**Negatív:**
*   Minimális (300ms) aszinkron késleltetés az URL és a UI állapota között (nem észrevehető a felhasználónak).
*   Imperatív `useRef` használata szükséges a deklaratív `useEffect` mellett.

## Rationale
A tiszta deklaratív megközelítés (csak URL paraméter figyelés) azért nem elegendő, mert a Radix UI `open` állapotát azonnal át kell váltani a bezáráshoz, de az URL-t csak az animáció végén szabad törölni, hogy elkerüljük a layout shift-et vagy a szülő komponens idő előtti újra-renderelését.

## Kapcsolódó
*   [A-013: Scoped URL routing](./A-013-scoped-routing.md)
*   [P-012: Számla szerkesztés (3 szintű dialógus)](../../product/decisions/P-012-invoice-editing.md)
*   [P-045: PDF Export UX & Banner viselkedés](../../product/decisions/P-045-pdf-export-ux.md)
