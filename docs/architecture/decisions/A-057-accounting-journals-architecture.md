# A-057: Könyvelési Napló Rendszer Architektúra (Accounting Journals)

**Status:** Decided  
**Date:** 2026-08-27  
**Utoljára frissítve:** 2026-09-03  

---

## Context

A kettős könyvvitel szigorú jogszabályi és integritási követelményeket támaszt az adatbázissal szemben:
1. A könyvelt tételek nem módosíthatók és nem törölhetők (immutabilitás).
2. A tételek könyveléskor folyamatos, hiánytalan folyósorszámot kapnak naplónként és évenként.
3. Egy tétel csak akkor lehet érvényes, ha a tartozik (T) és követel (K) összegek pontosan megegyeznek.
4. Zárt könyvelési időszakba (pl. lezárt hónap/év) utólag nem lehet könyvelni.
5. A javítás csak sztornózással és új tétel könyvelésével lehetséges.

## Decision

A Postgres szintű adatintegritásra épülő, trigger- és RPC-vezérelt moduláris architektúra bevezetése:

### 1. Adatmodell (`acc_*` táblák)
- `public.acc_journals`: Céghez tartozó naplótörzs (kód, név, típus, kapcsolt főkönyvi számla, deviza).
- `public.acc_journal_headers`: Tétel fejadatok (bizonylatszám, dátumok, partner, deviza, árfolyam, státusz, hivatkozások).
- `public.acc_journal_lines`: Tétel soradatok (T/K típus, összeg, devizás összeg, főkönyvi szám FK, ÁFA kód, projekt FK).
- `public.acc_journal_counters`: Atomikus sorszámláló tábla naplónként és évenként (`(journal_id, accounting_year)` kulccsal).
- `public.acc_accounting_periods`: Zárt/nyitott könyvelési időszakok nyilvántartása.
- `public.acc_journal_audit_logs`: Eseményvezérelt audit napló az összes állapotváltozásról.

### 2. Sorszám Generálás és Konkurencia Kezelés
- Az `acc_get_next_journal_number(p_journal_id, p_year)` RPC `FOR UPDATE` sorszintű zárolást alkalmaz a `acc_journal_counters` táblán, így garantálja a rések és duplikációk nélküli folyósorszámot nagy terhelés mellett is.

### 3. Integritás és Triggerek
- **Egyensúly Ellenőrzés:** A `trg_check_journal_balance` `DEFERRABLE INITIALLY DEFERRED` constraint trigger a tranzakció commit pillanatában ellenőrzi, hogy `Debit - Credit = 0`.
- **Immutabilitás:** A `trg_acc_enforce_header_immutability` és `trg_acc_enforce_line_immutability` megakadályozza a `KONYVELT` vagy `SZTORNOZOTT` státuszú tételek és soraik UPDATE/DELETE műveleteit.
- **Audit Naplózás:** A `trg_acc_journal_audit` trigger automatikusan rögzíti az összes fejmódosítást és státuszváltást JSONB formátumban.

### 4. RPC Műveletek és Automatikus Kontírozás
- `acc_generate_drafts_from_ledger(p_company_id, p_preset_id)`: **3-lábú kettős könyvviteli kontírozás (EB-0045)**.
  - Számlák esetén a bruttó összeget a nettó alap és a levonható (466) / fizetendő (467) ÁFA összegeként bontja szét ($T\ Költség + T\ ÁFA = K\ Szállító$, illetve $T\ Vevő = K\ Árbevétel + K\ ÁFA$).
  - 0% vagy mentes ÁFA esetén 2-lábú tételként rögzül.
  - Tételszintű összeadás kizárja a filléres egyensúlytalanságot.
  - **Teljesítmény és Timeout védelem (2026-09-03):** A függvény explicit `SET statement_timeout = '60s'` direktívával rendelkezik. Ez garantálja, hogy még több ezer tétel egyidejű generálásakor sem fut timeoutra a Postgres függvény, megelőzve a kliensoldali HTTP 504 / REST fallback hurkot, amely korábban percenként több ezer kéréssel túlterhelte volna a `private.rate_limits` biztonsági mechanizmust.
  - **MNB Napi Devizaárfolyam Integráció (2026-09-03 — Migráció `20260903110000`):** Devizás tételeknél (pl. USD, EUR) a korábbi 1:1 kalkuláció helyett a bizonylat teljesítési dátumához (`posting_date`) tartozó hivatalos MNB devizaárfolyamot olvassa ki a `public.daily_exchange_rates` táblából. A fejen eltárolja az `exchange_rate` és `exchange_rate_date` mezőket, a sorokon pedig a devizaértékből (`foreign_amount`) szorzatként képezi a forintértéket (`amount`). Számlák esetén a nettó, áfa és bruttó értékek mind devizában, mind MNB árfolyammal forintosítva rögzülnek.
  - **Biztonsági jogosultságok:** Explicit `GRANT EXECUTE ON FUNCTION public.acc_generate_drafts_from_ledger TO authenticated, service_role`.
- `acc_post_journal_entry(p_header_id, p_user_id)`: Ellenőrzi a nyitott időszakot és egyensúlyt, majd kiosztja a folyósorszámot és `KONYVELT` státuszba lépteti a tételt.
- `acc_storno_journal_entry(p_header_id, p_user_id, p_reason, p_create_correction)`: Sztornózza az eredetit, létrehozza a lekönyvelt inverz tételt, és igény esetén előkészíti a módosítható javító piszkozatot.
- `acc_seed_default_journals(p_company_id)`: Új cég esetén inicializálja a 9 alapértelmezett naplót.

### 5. Frontend & Kliensoldali Architektúra (Decoupling)
- **Fallback Szerviz Leválasztása:** A `JournalsPage.tsx` kódméret csökkentése és a Single Responsibility Principle (SRP) betartása érdekében a tartalék generálási algoritmus egy önálló szervizbe (`src/features/journals/services/draftFallbackGenerator.ts`) és izolált unit tesztcsomagba (`src/features/journals/__tests__/draftFallbackGenerator.test.ts`) került kiszervezésre, teljes MNB napi árfolyam-támogatással.
- **Lekérdezési korlát emelése:** A `useQuery` alapértelmezett 1 000 soros PostgREST limitje `.limit(10000)` direktívára növelve, biztosítva az összes naplótétel hiánytalan elérését.
- **Kétlépcsős Deviza Árfolyam-feloldás:** A felület (`JournalsPage.tsx`) cache-elt `daily_exchange_rates` lekérdezést futtat; amennyiben a tétel fejadatában nincs eltárolt árfolyam vagy 1-es érték szerepel, a kliens azonnal az adott teljesítési nap hivatalos MNB árfolyamával kalkulálja és jeleníti meg a forintösszeget.

## Consequences

**Pozitív:**
- Teljes körű jogszabályi megfelelőség (Sztv.).
- Adatbázis szinten garantált egyensúly és változtathatatlanság (még közvetlen SQL injection vagy hiba esetén sem kerülhet be hibás tétel).
- Részletes audit trail minden könyvelési eseményhez.
- Nagy adathalmazok esetén is atomi, másodpercek alatt lefutó szerveroldali kontírozás timeout és rate limit kockázatok nélkül.

**Negatív / Kötöttségek:**
- A lekönyvelt tételeket a felhasználó közvetlenül nem írhatja felül; a javítás mindig 2-lépéses sztornó műveletet igényel.

## Kapcsolódó
- **BRD:** [043: Könyvelési Naplók](../../business/decisions/043-accounting-journals.md)
- **PRD:** [P-055: Könyvelési Napló UX](../../product/decisions/P-055-accounting-journals-ux.md)
- **DB Schema:** [22-accounting-journals.md](../database/22-accounting-journals.md)
- **Design:** [11-data-display-tables.md](../../design/11-data-display-tables.md)
- **RPC Katalógus:** [A-016: PostgreSQL Query Stratégia](./A-016-postgresql-query-strategy.md)
