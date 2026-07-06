# Decision 031: [eaisyBooks] Modul Scope (korábban: Accounty)

**Status:** Decided

**Category:** eaisyBooks & Integrált Modulok

**Question:** Mi a könyvelőiroda-specifikus modul (eaisyBooks) üzleti scope-ja, és hogyan különül el a fő eaisyBill alkalmazástól?

**Decision:**
- Az eaisyBooks egy **önálló modul** könyvelőirodák számára, saját layout-tal és navigációval (`/accounty/*`)
- Célközönség: könyvelőirodák, ahol egy könyvelő több ügyfélcéget kezel párhuzamosan
- Fő funkciók:
  - **Portfólió nézet:** Grid/lista/kanban az összes ügyfélcégről (státusz, határidő, progress)
  - **KPI dashboard (vezetői):** Irodai szintű mutatók (zárási %, kritikus ügyfelek, munkatárs statisztikák)
  - **Hiányzó számla tracking:** Automatikus detektálás + ügyfél értesítés
  - **Ügyfél részletes nézet:** Cégspecifikus számlák, tranzakciók, hiányzó tételek
  - **Adó naptár:** Határidő kezelés és emlékeztetők
  - **Riportok:** Iroda szintű és ügyfélszintű riport generálás
  - **Ügyfélportál:** Magic link-es hozzáférés az ügyfelek számára
  - **Jóváhagyási sor:** Batch approve/reject workflow
- DB: `accounty_assignments` (könyvelő → cég hozzárendelés), `accounty_missing_items`, `accounty_audit_log`, `accounty_messages`
- Role-ok: `admin` (irodavezető, teljes hozzáférés, KPI nézet) és `könyvelő` (saját portfólió)

**Rationale:** A könyvelőirodák igénye alapvetően különbözik az egyéni cégekétől: egy könyvelő 10-50+ céget kezel, szükség van portfólió áttekintésre, batch műveletekre és ügyfél-kommunikációra. Az önálló layout és sidebar biztosítja, hogy az eaisyBooks ne terhelje a fő app felhasználóit, miközben a közös infrastruktúra (Supabase, auth, adat) megosztott. A kódban és DB-ben a legacy `accounty_*` / `Accounty*` prefix továbbra is használatban van.
