# P-056: Banki Utalások és Csomagkészítés (Bank Transfers) UX

**Status:** Decided  
**Date:** 2026-07-23  
**Category:** UI / Payments / Workflow  

---

## Question

Hogyan nézzen ki a kifizetésre váró szállítói számlák kiválasztása, a bankszámlaszámok inline ellenőrzése és javítása, valamint a banki utalási állományok letöltési felülete?

## Decision

1. **Oldal Elhelyezkedés & Navigáció:**
   - Útvonal: `/:companyId/:dateRange/transfers`
   - A sidebar **Pénzügyek** (`Landmark` ikon) csoportjában kapott helyet „Utalások” néven (`CreditCard` ikon).
   - Scoped routing alatt működik a cég és dátumtartomány kontextusában.

2. **Képernyő Felépítése (`TransfersPage.tsx`):**
   - **Szűrőfülek:** Összes (`all`), Lejárt (`overdue`), Ma esedékes (`due_today`).
   - **Csoportosítási Kapcsoló (Switch):** „Összevonás partnerenként” toggle – összeadja az azonos partnerhez tartozó összegeket.
   - **Interaktív Táblázat:** Checkbox-os többszörös kijelölés, forrás (`NAV` / `Kézi`), számlaszám, partner, esedékesség, összeg, deviza, bankszámlaszám.
   - **Inline Számlaszám Szerkesztés & Hibajelzés:** Piros figyelmeztetés jelenik meg érvénytelen CDV vagy IBAN formátum esetén, a cellában közvetlenül javítható a számlaszám.

3. **Export Varázsló Dialógus (`ExportDialog`):**
   - Indító bankszámla kiválasztása (`company_bank_accounts`).
   - Formátum kiválasztása (OTP Electra, GIRO standard, SEPA XML, CSV).
   - Összesítő statisztika (kijelölt tételek darabszáma, végösszeg).
   - Letöltés gomb: generálja a fájlt, és létrehozza a `payment_transfers` rekordot.

4. **Előzmények Fül (History Tab):**
   - Korábban generált utalási csomagok megtekintése, státuszuk (`pending`, `sent`, `matched`), és kapcsolódó banki tranzakcióik áttekintése.

## Current Implementation

- Fájl: `src/pages/TransfersPage.tsx`
- Komponensek: `CopyableCell`, `UnifiedPagination`, `TableSkeleton`, `Dialog`, `Select`, `Switch`
- Adatforrás: `invoices`, `nav_invoices`, `partners`, `company_bank_accounts`, `payment_transfers`

## Rationale

- Egyértelmű vizuális visszajelzés a hiányzó bankszámlaszámokról az utalási csomag összeállítása előtt.
- Megkönnyíti a cégvezetőknek a banki feladást anélkül, hogy manuálisan kellene adatokat másolniuk a számlákról.

## Kapcsolódó
- **ADR:** [A-058: Banki Utalások Architektúra](../../architecture/decisions/A-058-bank-transfers-architecture.md)
- **BRD:** [044: Banki Utalások](../../business/decisions/044-bank-transfers.md)
- **DB Schema:** [06-transactions-bank.md](../../architecture/database/06-transactions-bank.md)
