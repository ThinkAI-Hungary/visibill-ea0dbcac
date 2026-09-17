# P-089: Banki Tranzakciós Fájlok és Kivonatok Kezelő Dialógus (TransactionFilesDialog) UX

**Status:** Decided  
**Date:** 2026-09-16  
**Category:** UI / UX / Transactions / Banking / File Management  
**Érintett komponensek:** `src/components/transactions/TransactionFilesDialog.tsx`, `TransactionsPage.tsx`  
**Kapcsolódó döntések:** [P-016: Tranzakciólista UX](./P-016-transaction-list.md), [A-116: K&H Bankkivonatok Feldolgozása](../../architecture/decisions/A-116-kh-bank-statement-parsing-and-pipeline-routing-safeguards.md), [BRD 026: Banki Integráció](../../business/decisions/026-banking-integration.md)

---

## Question

Hogyan biztosítsunk átlátható, közvetlen felületet a felhasználók és könyvelők számára a bankszámlákhoz és tranzakciókhoz korábban feltöltött kivonatok (CAMT.053, MT940, CSV, XLS, PDF) megtekintésére, állapotuk ellenőrzésére, letöltésére és rendezésére?

---

## Decision

1. **Dedikált `TransactionFilesDialog` Modális Ablak:**
   - A Tranzakciók (`/transactions`) oldalon elérhetővé vált a banki állományok kezelő ablaka.
2. **Fájllista és Metaadat Megjelenítés:**
   - Eredeti fájlnév, feltöltés pontos ideje, fájlméret, feldolgozási státusz (`processed`, `pending`, `error`), és a tranzakciók darabszáma, amelyeket az adott állomány generált.
3. **Műveleti Lehetőségek:**
   - **Közvetlen letöltés:** Az eredeti banki kivonat biztonságos letöltése a Supabase Storage-ból.
   - **Törlés & Rendezés:** Duplikált vagy téves feltöltések kezelése megfelelő jogosultsági ellenőrzéssel.
   - **Hiba információs buborék:** Ha egy formátum (pl. K&H tabulátoros XLS vagy hibás kódolású CSV) nem olvasható, konkrét hibaüzenetet és teendőt mutat a felhasználónak.

---

## Current Implementation

- `src/components/transactions/TransactionFilesDialog.tsx` biztosítja a dialógust shadcn/ui és Lucide ikonok integrálásával.
- Integrálva van a bankszámla választó és a tranzakciós táblázat fejlécével.

---

## Rationale

A banki tranzakciók ellenőrzésekor a könyvelőknek gyakran szüksége van az eredeti forrásfájlra (pl. banki igazolás vagy audit céljából). A fájlok átlátható listázása megelőzi a bizonytalanságot, és egyértelmű auditálhatóságot ad.
