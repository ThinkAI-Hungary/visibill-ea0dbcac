# PostgreSQL RPC Tesztelési Stratégia és Blueprint

> **Státusz:** Jóváhagyva & Hatályos  
> **Készült:** 2026-10-01  
> **Alkalmazási terület:** `eaisybill-prod`, `eaisyBooks`, Supabase PostgreSQL `public` séma  
> **Kapcsolódó dokumentumok:** [RPC Katalógus](./rpc-catalog.md) | [Adatbázis Séma](./database-schema.md) | [A-016: PostgreSQL Query Stratégia](./decisions/A-016-postgresql-query-strategy.md) | [visibill-db-checklist](../../.agents/skills/visibill-db-checklist/SKILL.md)

---

## 1. Vezetői Összefoglaló és Célkitűzés

A Visibill és eaisyBooks rendszerekben a kritikus pénzügyi számítások, adóbevallási motorok (NAV 2665), kettős könyvviteli naplókönyvelések (`acc_*`), folyószámla-párosítások és jogosultság-ellenőrzések jelentős része **közvetlenül a PostgreSQL adatbázisban, tárolt eljárásokként (RPC)** fut.

A múltbéli tapasztalatok (például 57014 statement timeout hibák nagy adathalmazokon, vagy téves kerekítések a bevallásokban) rávilágítottak arra, hogy **az RPC függvényeket nem elegendő pusztán a TypeScript kliens felől manuálisan tesztelni**. Az adatbázis-szintű üzleti logika integritását automatizált, regressziómentes **pgTAP adatbázis egységtesztekkel** kell garantálni.

Ez a blueprint szisztematikusan osztályozza a kódbázis összes RPC függvényét (141 db) kockázati és tesztelési szintekbe, rögzíti a tesztelési kötelezettségeket, és kijelöli az automatizált tesztcsomagok felépítését.

---

## 2. A 4 Kockázati és Tesztelési Szint (RPC Tiers)

Minden létező és jövőbeli RPC függvényt a pénzügyi hatás, az adatvesztési kockázat és a komplexitás alapján 4 kategóriába sorolunk:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ TIER 1: Kritikus Pénzügyi Számítások & Könyvelés                        │
│ • Kötelező: Dedikált pgTAP egységteszt fájl (supabase/tests/database/) │
│ • Fókusz: Matematikai helyesség, T=K egyensúly, immutabilitás, RLS     │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────┐
│ TIER 2: Állapotmódosítások, Jóváhagyások & Folyószámla                 │
│ • Kötelező: Integrációs teszt (pgTAP vagy Vitest DB mock/tranzakció)   │
│ • Fókusz: Állapotgép átmenetek, idempotencia, audit naplózás           │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────┐
│ TIER 3: Szerveroldali Szűrt Listák & Vezérlőpult KPI-k                  │
│ • Kötelező: Füstteszt (Smoke test) & Null-safety ellenőrzés             │
│ • Fókusz: 57014 timeout védelem, üres cég null-kezelés, indexhasználat  │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────┐
│ TIER 4: Worker Várakozási Sorok (PGMQ) & Belső Segédfüggvények          │
│ • Kötelező: Worker Pytest / Pipeline szintű tesztelés                  │
│ • Fókusz: Aszinkron sorolvasás, újrapróbálkozás, cron takarítás        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Tier 1: Kritikus Pénzügyi Számítások & Könyvelés (MANDATORY pgTAP)

### Miért kötelező a pgTAP teszt?
- **Pénzügyi és jogi felelősség:** Egy hibás ÁFA sor (pl. 2665 66-os vagy 07-es sor) vagy egy hibás mérlegegyezőség közvetlen adóbírságot vagy rossz üzleti döntést von maga után.
- **Kettős könyvviteli garancia:** A Tartozik = Követel egyensúlytalanság soha, semmilyen körülmények között nem juthat el `KONYVELT` állapotba.
- **Szigorú számadás és immutabilitás:** A könyvelt bizonylatok sorszáma nem ugrálhat, a könyvelt rekordok pedig sosem módosíthatók vagy törölhetők közvetlenül, kizárólag sztornó tételeken keresztül.

### Érintett RPC-k és Követelmények

| RPC Neve | Szerep | Kötelező pgTAP Tesztesetek |
|---|---|---|
| `calculate_vat_return` / `calculate_hungarian_vat_return` | NAV 2665 ÁFA bevallás kalkulátor | 1. Sémadefiníció és paraméterek.<br>2. Üres cég zero-state (nem crashel).<br>3. Mentes, 5%, 18%, 27% adókulcsok helyes sorra aggregálása.<br>4. DRS és betétdíjak automatikus kizárása (Áfa tv. 71. §).<br>5. 65M belföldi partnerösszesítő generálás.<br>6. Előző időszaki göngyölt követelés (82-es sor) átvétele.<br>7. Anon szerepkör kitiltása (`42501`). |
| `get_gl_balances` | Főkönyvi kivonat és karton aggregáció (A-189) | 1. Sémadefiníció (`setof record`).<br>2. Üres cég lekérdezése.<br>3. Dátumszűrés (`kibocsatas` vs `teljesites`).<br>4. Multi-valuta árfolyamkonverzió.<br>5. Anon futtatás megtagadása. *(Elkészült: `supabase/tests/database/get_gl_balances.test.sql`)* |
| `get_pnl_report` | Eredménykimutatás (P&L) | 1. Sémadefiníció és struktúra sorok.<br>2. Üres cég zero-state.<br>3. Előjel-szorzó (`multiplier`: bevételek vs költségek).<br>4. Számlatükör öröklés és leghosszabb prefix illesztés.<br>5. Anon jogosultság megtagadása. |
| `get_bs_report` | Mérlegkimutatás (Balance Sheet) | 1. Sémadefiníció és struktúra sorok.<br>2. P&L Bridge egyezőség (adózott eredmény átvitele a saját tőkébe).<br>3. Auto-bank és folyószámla automatikus beépülése.<br>4. Előző évi adatok (`bs_prior_year`) feloldása.<br>5. Anon futtatás megtagadása. |
| `acc_get_next_journal_number` | Ugrásmentes naplósorszám generálás | 1. Adott év és napló szerinti szigorú növekmény (+1).<br>2. Párhuzamos zárolás és idempotencia (`FOR UPDATE`). |
| `acc_post_journal_entry` | Bizonylat végleges könyvelése | 1. Nem létező fej hiba dobása.<br>2. Zárt időszak (`acc_accounting_periods.is_closed`) blokkolása.<br>3. **Egyensúlytalansági védelem:** T $\neq$ K esetén kötelező kivétel dobása (`throws_ok`).<br>4. **Partner védelem:** partner-jellegű számlán kötelező `partner_id` megléte.<br>5. Sikeres lekönyveléskor `KONYVELT` státusz és sorszám kiosztás. |
| `acc_storno_journal_entry` | Szigorú könyvviteli sztornózás | 1. Nem könyvelt tétel sztornózásának megakadályozása.<br>2. Eredeti fej `SZTORNOZOTT`-ra állítása.<br>3. Sztornó fej automatikus létrehozása és ellentétes előjelű (T $\leftrightarrow$ K) sorok beszúrása.<br>4. Opcionális korrekciós bizonylat (`KEZI_PISZKOZAT`) generálása. |
| `settle_open_items` / `unsettle_open_items` | Folyószámla nyitott tétel párosítás | 1. Részleges kiegyenlítés és hátralévő összeg (`remaining_amount`) csökkentése.<br>2. Teljes kiegyenlítéskor `is_settled = true`.<br>3. Párosítás bontásakor nyitott összeg hiánytalan visszaállítása. |
| `write_off_subledger_difference` | Kerekítési és árfolyamkülönbözet leírás | 1. Kerekítési határ ($\le 10$ Ft) ellenőrzése (8755/9779).<br>2. Automatikus kiegyenlítő vegyes naplótétel generálása. |
| `recalculate_partner_skonto` | Partneri skontó kalkuláció | 1. Kedvezmény atomi frissítése nyitott számlákon.<br>2. Szállítási és egyéb mellékköltségek helyes levonása.<br>3. Skontó kikapcsolásakor mezők törlése. |
| `get_partner_monthly_cash_total` | Készpénzfizetési korlát (1.5M Ft) | 1. Partner adott havi készpénzes kifizetéseinek pontos összegzése.<br>2. Időintervallum szigorú izolációja. |
| `get_portfolio_kata_partner_totals` | KATA 3M Ft partnerlimit figyelés | 1. Partnerenkénti göngyölt összegzés kiszámítása.<br>2. Több cég együttes vizsgálata. |

---

## 4. Tier 2: Állapotmódosítások, Jóváhagyások & Folyószámla (Integration / pgTAP)

### Miért szükséges az integrációs teszt?
A Tier 2-be tartozó eljárások adatbázis-állapotokat módosítanak, státuszokat állítanak, vagy külső entitásokhoz rendelnek szabályokat. Hibájuk nem feltétlenül vezet adóeltéréshez, de működésképtelenné teheti a számlajóváhagyási vagy párosítási folyamatokat.

### Érintett RPC-k:
- `approve_invoice_for_accounting` (számlajóváhagyás jóváhagyási megjegyzéssel)
- `link_and_verify_submitted_invoice` (beküldött számla összerendelése NAV számlával)
- `mark_storno_group_settled` / `unmark_storno_group_settled` (sztornó csoportok lezárása)
- `book_accrual_entry` / `reverse_accrual_entry` (időszaki elhatárolások könyvelése és feloldása)
- `override_gl_classification` / `override_gl_classifications_batch` (kézi főkönyvi átkódolás audit naplózással)
- `override_vat_code_batch` (ÁFA kód átírás gépi tanulási szabállyal)
- `save_bs_mappings` / `save_pnl_mappings` (mérleg és eredménykimutatás térképezés UUID validációval)
- `record_manual_invoice_payment` (kézi fizetés rögzítése)
- `sync_petty_cash_entries` (készpénzes számlák pénztárnaplóba másolása)
- `toggle_invoice_continuous` (folyamatos teljesítésű időszak és TI átállítás)
- `delete_upload_with_data` (kaszkádolt feltöltés-törlés adatbázis integritásvédelemmel)
- `authenticate_customer_api_key` (REST API kulcs hitelesítés és jogosultság-feloldás)
- `has_company_module_access` / `has_company_access_via_cache` (bérlői RLS védelmi függvények)

### Tesztelési követelmények:
- Idempotencia: Ugyanazzal a bemenettel többször lefutva nem hoz létre duplikációt.
- Tranzakcionális atomitás: Hiba esetén minden részfolyamat visszagördül.
- Jogosultság: Más cég bizonylata nem módosítható (bérlői szeparáció).

---

## 5. Tier 3: Szűrt Listák & Dashboard KPI-k (Smoke & Null-Safety Tests)

### Miért elégséges a füstteszt és null-safety teszt?
Ezek az eljárások **csak olvasási (read-only) műveleteket** végeznek. Nem módosítanak adatot, és nem közvetlen könyvelési bizonylatokat generálnak.
A fő kockázat itt a **teljesítményromlás** (rossz végrehajtási terv, full table scan miatti 57014 timeout), valamint a **null értékek miatti crashelés** (pl. ha a cégnek nincs egyetlen számlája vagy beállítása sem).

### Érintett RPC-k:
- `get_filtered_nav_invoices` (szerveroldali szűrt és lapozott NAV lista)
- `get_filtered_submitted_invoices` (beküldött számlák lapozott listája)
- `get_invoice_aggregates` / `get_invoice_kpis` (számla fejléc összesítők)
- `get_vat_breakdown` (ÁFA analitika kulcsonként)
- `get_accounty_dashboard_kpis` / `get_accounty_company_summary` (irodai KPI-k)
- `get_petty_cash_balance` / `get_petty_cash_summary` (pénztáregyenleg lekérdezés)
- `get_partner_ranking` (partner rangsor elemzés)
- `search_gl_entities` (főkönyvi globális kereső)

### Tesztelési követelmények:
- **Zero-state teszt:** Null vagy üres paraméterekkel lefutva nem dob hibát, üres eredményhalmazzal tér vissza.
- **Index- és teljesítményvédelem:** A végrehajtási idő nagy cégeken sem haladhatja meg a 2000 ms-ot.

---

## 6. Tier 4: Queue (PGMQ), Worker & Rendszer-üzemeltetés (Worker Pipeline Tests)

### Miért nem a pgTAP feladata?
Ezek az eljárások (`pgmq_read`, `claim_invoice_jobs`, `claim_gl_jobs`, `worker_pipeline_stats`, `cleanup_pdf_exports`) a háttérben futó Python aszinkron workerhez és pg_cron ütemezésekhez tartoznak.
Ezek helyességét a Python worker tesztcsomagja (`pytest`, `/wunit`) ellenőrzi valódi aszinkron környezetben.

---

## 7. A pgTAP Tesztek Kötelező Struktúrája (Standard Pattern)

Minden adatbázis tesztfájlnak (`supabase/tests/database/*.test.sql`) a következő standard felépítést kell követnie:

```sql
-- ==============================================================================
-- pgTAP Test: <rpc_name>
-- Description: Automated unit and regression tests for <function_description>
-- ==============================================================================

BEGIN;

-- 1. extensions és public sémák beállítása
SET search_path TO 'public', 'extensions';

-- 2. Tervezett tesztek deklarálása
SELECT plan(<N>);

-- 3. Létezés és szignatúra ellenőrzése
SELECT has_function('public', '<rpc_name>', ARRAY['<param1>', '<param2>'], '<description>');

-- 4. Visszatérési típus ellenőrzése
SELECT function_returns('public', '<rpc_name>', ARRAY['<param1>', '<param2>'], '<expected_type>', '<description>');

-- 5. Zero-state ellenőrzés (Üres vagy nem létező adatok kezelése)
SELECT lives_ok(
  'SELECT * FROM public.<rpc_name>(...)',
  'RPC must handle empty state without runtime exceptions'
);

-- 6. Üzleti logika és kivételkezelés (throws_ok ha érvénytelen)
SELECT throws_ok(
  'SELECT * FROM public.<rpc_name>(...)',
  '<expected_error_or_sqlstate>',
  NULL,
  'Invalid business condition must raise expected exception'
);

-- 7. Biztonsági környezet (Anonim szerepkör kitiltása)
SELECT throws_ok(
  'SET ROLE anon; SELECT * FROM public.<rpc_name>(...)',
  '42501',
  NULL,
  'Anonymous role must be denied execute permissions'
);

-- 8. Teszt lezárása
SELECT * FROM finish();

-- 9. TRANZAKCIÓ VISSZAGÖRDÍTÉSE (KÖTELEZŐ: Tilos tesztadatot éles DB-be hagyni!)
ROLLBACK;
```

---

## 8. Prioritási Mátrix és Bevezetési Ütemterv

| Fázis | Prioritás | Célterület | Státusz |
|---|:---:|---|:---:|
| **Fázis 1** | 🔥 P0 | `get_gl_balances.test.sql` (A-189 Főkönyvi kivonat) | **KÉSZ (6/6 PASS)** |
| **Fázis 2** | 🔥 P0 | `calculate_vat_return.test.sql` (NAV 2665 ÁFA bevallás & 65M) | **Azonnali megvalósítás** |
| **Fázis 3** | 🔥 P0 | `get_pnl_report.test.sql` & `get_bs_report.test.sql` (P&L és Mérlegkimutatás) | **Azonnali megvalósítás** |
| **Fázis 4** | 🔥 P0 | `acc_journal_lifecycle.test.sql` (`acc_post_journal_entry` T=K védelem & sztornó) | **Azonnali megvalósítás** |
| **Fázis 5** | ⚡ P1 | `subledger_settlement.test.sql` (`settle_open_items` és kerekítés) | Következő sprint |
| **Fázis 6** | ⚡ P1 | `partner_skonto_and_limits.test.sql` (`recalculate_partner_skonto`, 1.5M limit) | Következő sprint |
| **Fázis 7** | 📋 P2 | Tier 2 állapotgép és jóváhagyási tesztek | Tervezve |
