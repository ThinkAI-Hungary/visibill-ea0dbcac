# P-055: Könyvelési Napló (Accounting Journals) UX

**Status:** Decided  
**Date:** 2026-08-27  
**Category:** UI / General Ledger / Workflow  

---

## Question

Hogyan jelenjen meg a Könyvelési Napló (Accounting Journals) felülete az eaisybill felületén, hogyan navigálhat a felhasználó a naplók között, és milyen interakciókkal kezelheti a kézi és automatikus tételeket, valamint a sztornózási műveleteket?

## Decision

1. **Oldal Elhelyezkedés és Navigáció:**
   - Útvonal: `/:companyId/:dateRange/journals`
   - A sidebar **Könyvelés** (`BookOpen` ikon) csoportjában kapott helyet „Napló” néven.
   - A modulhoz való hozzáférést a `useEaisybillPermissions` `journals` kulcsa szabályozza (csak megfelelő jogosultságú felhasználóknak elérhető).

2. **Nézet Felépítése (`JournalsPage.tsx`):**
   - **Fejléc & KPI Sáv:** Aktív könyvelési év és időszak kijelzése, egyensúly ellenőrző kártyák (Összes tétel, Könyvelt tételek összege, Piszkozatok, Zárt időszak jelző).
   - **Napló Választó (Journal Tabs / Dropdown):** Váltás a 9 napló (Vevő, Szállító, Bank HUF/EUR, Házipénztár, Vegyes, Bérfeladás, Nyitó, Záró) vagy az Összesített Napló nézet között.
   - **Kereső & Szűrősáv:** Bizonylatszám, leírás, partner, dátumtartomány, státusz (`PISZKOZAT`, `KONYVELT`, `SZTORNOZOTT`) és könyvelési év szűrők.

3. **Tétel Kezelés & Dialógusok:**
   - **Új tétel rögzítése:** Kétoldalú könyvelési tétel szerkesztő felület (`Debit` / `Credit` sorok dinamikus hozzáadása, automatikus egyenleg-különbözet kijelzés).
   - **Könyvelés gomb (`PostEntry`):** Validálja az egyensúlyt (`T = K`), ellenőrzi a zárt időszakot, és véglegesíti a tételt a következő folyósorszámmal.
   - **Sztornó művelet (`StornoDialog`):** Indoklás megadásával automatikusan elkészíti az ellentétes előjelű sztornó tételt és megnyitja a javító piszkozatot.
   - **Naplókivonat Export:** CSV és nyomtatható nézet a tételekről.

## Current Implementation

- Oldal: `src/pages/JournalsPage.tsx`
- Komponensek: `src/components/journals/*`
- Hook & State: `useQuery` a naplófejek és sorok lekérdezéséhez, optimista frissítések a könyvelési állapotokhoz.

## Rationale

- A könyvelők számára a naplózás a legfontosabb ellenőrzési felület: elengedhetetlen, hogy a bizonylatok sorszám szerint, naplónként rendezve és egyensúly-ellenőrzéssel legyenek elérhetők.
- Az automatikus egyensúly-figyelés megakadályozza a hibás könyvelési tételek mentését.

## Kapcsolódó
- **ADR:** [A-057: Könyvelési Napló Architektúra](../../architecture/decisions/A-057-accounting-journals-architecture.md)
- **BRD:** [043: Könyvelési Naplók](../../business/decisions/043-accounting-journals.md)
- **DB Schema:** [22-accounting-journals.md](../../architecture/database/22-accounting-journals.md)
