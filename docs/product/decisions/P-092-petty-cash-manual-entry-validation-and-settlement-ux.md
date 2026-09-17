# P-092: Házipénztár Bizonylat Validáció és Számlakiegyenlítés UX

**Status:** Decided  
**Date:** 2026-09-18  
**Category:** UI / Workflow / Error Prevention  

## Question

Hogyan védjük ki a házipénztári bizonylatok rögzítésekor a hiányzó kasszaválasztásból eredő mentési hibákat, hogyan kezeljük a 0-kasszás cégeket, és hogyan biztosítsuk a nyitott kimenő számlák megbízható készpénzes rendezését a felületen?

## Decision

1. **Üres Házipénztár Állapot Kezelése (0 Kassza):**
   - Amennyiben egy céghez még egyetlen pénztár sem került létrehozásra (`registers.length === 0`), a `ManualEntryDialog` fejléce alatt egy borostyánsárga figyelmeztető doboz jelenik meg: *"Nincs elérhető házipénztár. Először hozz létre egy pénztárat a Pénztárak lapfülön."*.
   - A Mentés gomb (`DialogFooter`) és a `Ctrl+Enter` billentyűparancs automatikusan le van tiltva (`disabled`), amíg nem létezik vagy nincs kiválasztva érvényes pénztár.

2. **Reaktív Pénztárválasztás Aszinkron Betöltéskor:**
   - A dialógus megnyitásakor az állapot nem rögzül véglegesen üresként, ha a pénztárak listája még betöltés alatt áll. Amint a `registers` lista megérkezik a háttérből, a rendszer automatikusan kiválasztja az alapértelmezett (vagy első aktív) pénztárat.

3. **Vizuális Érvényességi Jelzés:**
   - Amennyiben a pénztárválasztó Select értéke nincs kitöltve, a vezérlő finom piros kiemelést kap (`border-destructive/60`), és megjelenik a választásra ösztönző placeholder: *"Válassz pénztárat..."*.

4. **Számlakiegyenlítés Zökkenőmentes Munkafolyamata:**
   - A nyitott kimenő számlák kiegyenlítésekor a felhasználó egyetlen kattintással véglegesíti a bizonylatot és a számlák lezárását.
   - Mentés után a felület azonnal frissíti mind a pénztárbizonylatokat, mind a nyitott számlák listáját és a fő számlatáblázatot (`invoices` cache invalidáció).

## Current Implementation

- [EntriesTab.tsx](../../../src/components/petty-cash/EntriesTab.tsx): Reaktív kasszabeállítás, figyelmeztető banner és gombvédelem.
- [types.ts](../../../src/components/petty-cash/types.ts): `validatePettyCashEntryPayload` és `sanitizePartnerId` szanitizáló logikák.

## Rationale

A felhasználók számára világos és azonnali visszajelzést kell adni arról, ha a művelethez szükséges alapvető feltétel (létező kassza) nem teljesül, megelőzve az érthetetlen adatbázis hibákat és a frusztrációt.

## Kapcsolódó
- [A-125: Atomi Házipénztári Számlakiegyenlítés és Auth Életciklus Védelmek](../../architecture/decisions/A-125-atomic-petty-cash-invoice-settlement-and-auth-resilience.md)
- [P-046: Pénztárbizonylatok Feltöltési Fül UX](./P-046-penztarbizonylat-upload-ux.md)
- [P-045: PDF Export UX és Banner Viselkedés](./P-045-pdf-export-ux.md)
