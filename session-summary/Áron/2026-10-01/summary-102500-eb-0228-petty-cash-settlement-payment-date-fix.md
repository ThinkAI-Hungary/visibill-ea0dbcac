# Session Summary — 2026-10-01 10:25

```text
fix(petty-cash, rpc): EB-0228 házipénztári számlakiegyenlítés "fizetes_napja" oszlophiba javítása (VBV Vision Kft. — Kiss-Százi Emese)

- Ügyfél hibajegy kivizsgálása a `/visibill-ticket-support` protokoll szerint:
  - Ügyfél: Kiss-Százi Emese (szazi.emese@vaniroda.hu), VBV Vision Kft. (13739830-2-03)
  - Hibajegy: EB-0228 (Utalásos számla KP-ban rendezve)
  - Probléma: az SZZJ-2026-3 sz. szállítói számla (-160 000 Ft, Szanyi Zoltánné) Főpénztárba rögzítésekor a rendszer `column "fizetes_napja" does not exist` hibaüzenetet adott.

- Gyökérok:
  - A korábbi migrációkból örökölt `settle_invoices_via_petty_cash` tárolt eljárás 5. lépése a nem létező `fizetes_napja` oszlopot próbálta frissíteni az `invoices` táblán (`fizetes_napja = COALESCE(fizetes_napja, p_entry_date)`).
  - Az `invoices` táblában a manuális/készpénzes kiegyenlítéseket az ADR A-098 specifikáció szerint az `is_manual_payment = true`, `manual_payment_date = p_entry_date`, `manual_payment_type = 'petty_cash'`, `fizetve = true` mezők kezelik.

- Megvalósítás & Migráció:
  - `supabase/migrations/20261001101500_fix_settle_invoices_petty_cash_payment_date.sql`:
    * A tárolt eljárásban a hibás `fizetes_napja` oszlophivatkozás lecserélve a valid `is_manual_payment`, `manual_payment_date`, `manual_payment_type` és `manual_payment_note` mezőkre.
    * Kapcsolódó `nav_invoices` rekordok automatikus szinkronizálása a NAV OSA nézet konzisztenciájáért.
  - Élesítés: a migráció a távoli Supabase PostgreSQL adatbázisban sikeresen lefutott (`npx supabase db push --include-all`).

- Minőségbiztosítás & Evidence Gate:
  - Éles end-to-end teszt futtatva átmeneti tesztszámlával a távoli adatbázisban: `settle_invoices_via_petty_cash` sikeresen lefutott (`success: true`, pénztári tétel létrejött, számlastátusz `fizetve = true`, `is_manual_payment = true`, `manual_payment_date = '2026-04-09'`).
  - Unit tesztek: `src/test/pettyCashManualEntryValidation.test.ts` (11/11 passed).
  - Típusellenőrzés: `npx tsc --noEmit` hibátlan (code 0).
  - Dokumentáció: ADR A-155 (`docs/architecture/decisions/A-155-petty-cash-inbound-settlement-and-period-closing.md`) frissítve.
```
