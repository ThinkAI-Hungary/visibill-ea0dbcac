# P-059: eaisyBooks Kliens Regisztráció és Iroda Hozzárendelés UX

**Status:** Decided  
**Date:** 2026-08-31  
**Category:** eaisyBooks & Klienskezelés  
**Related Decisions:** [P-031](./P-031-accounty-layout.md), [A-072](../../architecture/decisions/A-072-accounting-assignments-insert-rls.md)

---

## 1. Context

A könyvelőirodák munkatársai kétféle módon vehetnek fel új ügyfelet az eaisyBooks rendszerbe:
1. **Partner kód (Share Token) beváltásával:** amikor az ügyfél már létezik a Visibillben és meghívja a könyvelőt.
2. **Közvetlen / Manuális regisztrációval (`/eaisybooks/new-client`):** amikor a könyvelő maga hozza létre a kezelt cég adatait (Cégnév, Adószám, kapcsolattartási preferenciák, integrációk).

A manuális regisztráció során elengedhetetlen, hogy az újonnan létrehozott ügyfél automatikusan és zökkenőmentesen a könyvelőiroda alá kerüljön, anélkül hogy a felhasználónak kézzel kellene firm azonosítókat választania.

---

## 2. Decision

1. **Automatikus Iroda Kijelölés:**
   - A `NewClientPage` 3 lépéses varázslója a 2. lépés jóváhagyásakor a háttérben feloldja a bejelentkezett könyvelő saját könyvelőirodáját (`accounting_firm_id`).
   - A létrehozott ügyfélcég azonnal megjelenik a könyvelőiroda klienslistájában, KPI kártyáin és a portfólió nézetben.
2. **Szerepkör Megőrzés:**
   - A kliens hozzárendelés a könyvelő tényleges irodai jogosultsági szintjével (`iroda_admin`, `senior_könyvelő`, `könyvelő`) jön létre.
3. **Kommunikációs és Értesítési Beállítások:**
   - A varázslóban rögzített értesítési csatornák (Email, Viber, SMS) és kapcsolattartói adatok automatikusan bekerülnek a cég `accounty_communication_preferences` rekordjába.

---

## 3. Consequences

### Pozitív:
- A könyvelők azonnal, hibamentesen tudnak új ügyfeleket rögzíteni.
- Nincs szükség külön manuális cég-összerendelésre vagy admin jóváhagyási körökre.
