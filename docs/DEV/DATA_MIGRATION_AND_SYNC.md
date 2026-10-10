# Adatmigráció és Napi Szinkronizáció (Data Migration & Daily Sync)

Ez a dokumentum a VisiBill fejlesztői adatbázisába (`qhvcdqkqpgpdxogqqvyr`) átemelt adatok, sémák, funkciók, PGMQ sorok, cron jobok és a napi szinkronizáció teljes körű leírását rögzíti.

---

## 🏢 1. Az Átemelt Cégek

A fejlesztési és tesztelési célokra a termelési adatbázisból 3 kiemelt cég és teljes relációs adathalmaza került átemelésre:

| Cég Név | Cég UUID | Adószám | Megjegyzés |
| :--- | :--- | :--- | :--- |
| **Think Ai Kft** | `ecf31039-b539-4e04-bbea-70ea48c701bb` | `32478620-2-43` | Elsődleges fejlesztési és adminisztrátori cég |
| **Teszt Kft** | `377d28cb-edc9-48a7-b261-bcd9c91d81a1` | `11111111-1-11` | Funkcionális tesztcég nagy naplótételszámmal |
| **Taxology Kft.** | `acc22ca9-e9ff-4f9f-9495-ca7612b2e5e2` | `32142279-2-41` | Éles könyvelési és számla-adatbázis tesztek |

---

## 🏛️ 2. Teljes Architektúra és Séma Paritás (100% Egyezés)

A Dev adatbázis és a Prod adatbázis architektúrája teljesen paritásba került:

| Architektúrális Elem | Prod DB | Dev DB | Paritási Státusz |
| :--- | :---: | :---: | :---: |
| **Publikus táblák (`public`)** | 224 tábla | 224 tábla | **100% Egyezés ✓** |
| **Egyedi Enum típusok** | 18 enum | 18 enum | **100% Egyezés ✓** |
| **Tárolt eljárások (RPC)** | 301 RPC | 301 RPC | **100% Egyezés ✓** |
| **RLS Biztonsági Szabályok** | 744 policy | 744 policy | **100% Egyezés ✓** |
| **Adatbázis Triggerek** | 210 trigger | 210 trigger | **100% Egyezés ✓** |
| **Storage Vödrök (Buckets)** | 15 vödör | 15 vödör | **100% Egyezés ✓** |
| **Edge Functions** | 48 funkció | 48 funkció | **100% Egyezés ✓** |
| **PGMQ Üzenetsorok** | 7 sor | 7 sor | **100% Egyezés ✓** |
| **pg_cron Feladatok** | 6 karbantartó | 6 karbantartó | **100% Egyezés ✓** |
| **Privát séma és táblák** | `private.rate_limits` | `private.rate_limits` | **100% Egyezés ✓** |

---

## 📬 3. Üzemeltetési Elemek: PGMQ Sorok és Karbantartó Cron Jobok

### A. PGMQ Sorok (`pgmq.list_queues()`)
A Dev adatbázisban a következő 7 PGMQ üzenetsor aktív, biztosítva a triggerek és aszinkron feldolgozók hibátlan lefutását:
1. `invoice_jobs` (Számlafeldolgozási feladatok)
2. `transaction_jobs` (Banki tranzakció-feldolgozási feladatok)
3. `gl_classification_jobs` (Főkönyvi AI osztályozási feladatok)
4. `report_jobs` (Riport és kimutatás-feldolgozási feladatok)
5. `shipment_matching_jobs` (Szállítmány-párosítási feladatok)
6. `pdf_export_jobs` (PDF exportálási munkák)
7. `nav_item_jobs` (NAV tétel-feldolgozási feladatok)

### B. Dev Adatbázis pg_cron Feladatai
Kizárólag a helyi adatbázis integritását és tisztaságát őrző karbantartó feladatok futnak a Dev DB-n:
1. `cleanup_stale_impersonations` (`*/15 * * * *`)
2. `cleanup_pdf_exports` (`0 3 * * *`)
3. `refresh_company_counts_cache` (`*/10 * * * *`)
4. `cleanup-rate-limits` (`*/10 * * * *`)
5. `cleanup-app-error-logs` (`0 3 * * 0`)
6. `cleanup-pdf-export-jobs` (`0 3 * * *`)

*(Külső szinkronizáló cronok, mint a NAV auto-sync vagy az Aggreg8 banki lekérdezés szigorúan tiltottak a Dev DB-n!)*

### C. Külső Integrációk és Webhook Védelem (Mailgun)
A Dev környezetben a külső bejövő webhookok és route módosítások szigorúan le vannak választva:
1. **`process-mailgun-webhook`:** A Dev Supabase-en a webhook azonnali csendes jóváhagyással (`HTTP 200 { disabled: true, environment: 'DEV' }`) leáll, nem hoz létre rekordokat és nem fogyaszt erőforrást. Minden bejövő számla és email az éles (Prod) rendszeren fut le, és a napi 06:00-s szinkronizációval kerül át a Dev DB-be.
2. **`create-email-alias` & `delete-email-alias`:** Dev környezetben az alias műveletek csak a helyi Dev adatbázist kezelik (`mailgun_route_id: 'dev_mock_route'`), és nem hívják meg a Mailgun EU API-t, így a fejlesztői tesztek soha nem tudják felülírni vagy törölni az éles Mailgun továbbítási útvonalakat.

---

## 📊 4. Átemelt Adathalmazok Részletes Bontása

### A. Globális Törzsadatok és Mesterdefiníciók (100% Prod Másolat)
* `bs_structure` (94 sor), `bs_mapping` (2 715 sor) – Mérlegstruktúra és leképezések
* `pnl_structure` (14 sor), `pnl_mapping` (1 091 sor) – Eredménykimutatás-struktúra és leképezések
* `vat_form_rows` (153 sor) – 65A ÁFA bevallás hivatalos rubrikadefiníciói
* `knowledge_base_categories` (10 sor), `knowledge_base_articles` (114 sor) – Tudásbázis
* `changelog_entries` (45 sor) – Változási naplóbejegyzések
* `accounty_tax_parameters` (105 sor), `accounty_tax_params_global` (18 sor), `accounty_global_tax_params` (54 sor) – Globális adóparaméterek
* `accounty_retention_rules` (48 sor) – Megőrzési szabályzatok
* `annual_report_notes_templates` (19 sor) – Kiegészítő melléklet sablonok
* `tao_depreciation_templates` (11 sor) – TAO amortizációs sablonok
* `accounty_legal_updates` (17 sor) – Jogszabályi hírek és változások
* `accounty_job_codes` (19 sor) – FEOR kódok és munkakörök
* `chart_of_accounts_presets` (3 sor) – Globális és teszt számlatükör sablonok
* `settings` (40 sor), `tax` (16 sor) – Globális konfigurációk és adókulcsok

### B. Cég- és Működési Adatok (A 3 Kiemelt Cégre)
* **Számlázás és NAV:**
  * `invoices`: 1 034 sor
  * `invoice_items`: 839 sor
  * `invoice_uploads`: 1 639 sor
  * `nav_invoices`: 1 315 sor
  * `nav_invoice_items`: 2 623 sor
* **Bank és Pénzforgalom:**
  * `transactions`: 1 843 sor
  * `bank_transactions`: 686 sor
  * `transaction_invoice_matches`: 1 201 sor
  * `acc_open_item_matches`: 174 sor
  * `aggreg8_consents`: 3 sor, `aggreg8_accounts`: 3 sor
  * `petty_cash_registers`: 4 sor, `petty_cash_entries`: 43 sor, `petty_cash_opening_balances`: 1 sor, `cash_reports`: 1 sor
* **Főkönyv és Könyvelés:**
  * `gl_accounts`: 3 097 sor
  * `acc_journals`: 28 sor, `acc_journal_headers`: 2 754 sor, `acc_journal_lines`: 6 752 sor, `acc_journal_counters`: 6 sor
  * `gl_overrides_log`: 124 sor, `gl_upload_notifications`: 643 sor
  * `vat_code_overrides_log`: 5 sor, `vat_codes`: 103 sor
* **ÁFA Bevallás (65A, A60, M lapok):**
  * `vat_returns`: 36 sor
  * `vat_return_lines`: 352 sor
  * `vat_return_m_lines`: 428 sor
  * `vat_return_a60_lines`: 22 sor
* **Bérszámfejtés és HR (Accounty):**
  * `accounty_employees`: 8 sor, `accounty_employments`: 8 sor, `employee_rates`: 14 sor
  * `accounty_payroll_cycles`: 10 sor, `accounty_payroll_calculations`: 12 sor, `accounty_payroll_items`: 5 sor
  * `accounty_cafeteria`: 11 sor
  * `accounty_declarations`: 1 sor, `accounty_timesheets`: 1 sor, `accounty_efo_entries`: 4 sor, `accounty_dependents`: 1 sor
  * `accounty_job_modifications`: 1 sor, `accounty_garnishments`: 1 sor, `accounty_transfers`: 2 sor, `accounty_dividends`: 1 sor
  * `salary`: 187 sor, `salary_files`: 12 sor
* **Egyéni Vállalkozók (EV):**
  * `accounty_ev_client_settings`: 1 sor, `accounty_ev_lifecycle_events`: 2 sor, `accounty_penztarkonyv_tetel`: 3 sor
* **Ügyfélkapu, Portál és Hiánypótlás:**
  * `accounty_portal_tokens`: 109 sor
  * `accounty_missing_items`: 763 sor
  * `accounty_uploads`: 1 sor, `bank_statement_uploads`: 1 sor, `report_uploads`: 10 sor
  * `accounty_upo_credentials`: 2 sor, `user_nav_credentials`: 3 sor
* **Ügyfélszolgálat és Hibajegyek (Tickets):**
  * `feedback`: 9 sor
  * `ticket_comments`: 18 sor
  * `ticket_events`: 84 sor
  * `ticket_reads`: 35 sor
  * `accounty_ai_chat_sessions`: 8 sor, `accounty_ai_chat_messages`: 47 sor
* **Társasági Adó és Éves Beszámolók:**
  * `annual_reports`: 4 sor (fagyasztott mérleggel, eredménykimutatással és ellenőrzési eredményekkel)
  * `accounty_tao_yearly`: 3 sor, `fixed_assets`: 35 sor, `asset_events`: 65 sor

---

## ⏰ 5. Napi 06:00-s Automatikus Szinkronizáció (Cron Job) és Teljes Ökoszisztéma Szinkron

A **mind a 87 cég és 113 felhasználó** teljes adatállománya (felhasználói fiókok, cégtagságok, számlák, NAV tételek, banki tranzakciók, főkönyvi naplók, hiánypótlások, bérszámfejtés és ÁFA bevallások) minden nap reggel **06:00-kor (Budapest idő)** automatikusan átszinkronizálódik az éles rendszerről a dev környezetbe.

* **Futtató szerver:** DigitalOcean droplet (`64.226.83.137`)
* **Szkript:** `/home/jani/dev-cron/sync_daily_prod_to_dev.mjs`
* **Indító wrapper:** `/home/jani/dev-cron/run_sync.sh`
* **Naplófájl:** `/home/jani/dev-cron/sync.log`
* **Crontab bejegyzés:**
  ```bash
  CRON_TZ=Europe/Budapest
  # Visibill Dev: Sync all 87 companies and 113 users from Prod daily at 06:00 AM
  0 6 * * * /home/jani/dev-cron/run_sync.sh
  ```

### 🚀 Teljes Ökoszisztéma Szinkronizáció Eredményei (2026. 10. 10.)

A napi szinkronizáló motor teljes körű skálázási bővítésen esett át, kiterjesztve a teljes éles adatbázisra:

1. **Felhasználói és Autentikációs Tükrözés (`auth.users`, `auth.identities`, `public.profiles`):**
   * Mind a **113 felhasználói fiók** jelszavas hash-ekkel, identitásokkal és jogosultságokkal átkerül a dev környezetbe, lehetővé téve a valós ügyfélfiókokkal történő tesztelést.
2. **Cégstruktúra és Jogosultságok (`public.companies`, `public.company_members`):**
   * Mind a **87 cég és 162 cégtagság** azonnal elérhető a dev felület cégváltójában és a management dashboardon.
3. **Minden Cég Tranzakciós és Pénzügyi Adatbázisa:**
   * A szűrők korlátjai feloldásra kerültek: a számlák, NAV tételek, banki tranzakciók és főkönyvi naplók mind a 87 cégre kiterjedően átkerülnek.
4. **Dinamikus Futásidejű Séma- és Típusvizsgálat (`information_schema.columns`):**
   * A szinkronizáló szkript feltérképezi a Dev adatbázis sémáját, és pontosan megkülönbözteti a natív PostgreSQL tömb típusokat a JSONB tömböktől, megelőzve az array formázási hibákat.
5. **Nagy Sebességű Replikációs Mód (`SET session_replication_role = 'replica'`):**
   * A feltöltés idejére a dev adatbázison a triggerek és idegenkulcs-függőségek felfüggesztésre kerülnek, garantálva a villámgyors kötegelt betöltést.

#### 📈 Teljes Ökoszisztéma Statisztika (Éles Droplet Futtatás):
* **Összes szinkronizált rekord:** **606 289 / 606 305 sor (99.997%)**
* **Főbb tábla mennyiségek:**
  * `companies`: **87 / 87 (100%)**
  * `company_members`: **162 / 162 (100%)**
  * `auth.users`: **113 / 113 (100%)**
  * `invoices`: **11 821 / 11 821 (100%)**
  * `nav_invoices`: **50 572 / 50 572 (100%)**
  * `nav_invoice_items`: **216 385 / 216 385 (100%)**
  * `transactions`: **24 666 / 24 666 (100%)**
  * `acc_journal_headers`: **11 696 / 11 696 (100%)**
  * `acc_journal_lines`: **29 284 / 29 284 (100%)**
  * `accounty_missing_items`: **122 523 / 122 523 (100%)**
  * `gl_upload_notifications`: **6 342 / 6 342 (100%)**
  * `accounty_deadlines`: **3 964 / 3 964 (100%)**
* **Hibák száma:** **0 hiba**.

---

## 🌙 6. Éjszakai és Hajnali pg_cron Jobok Állapota (Prod DB)

A termelési adatbázisban beállított hajnali pg_cron feladatok működése és a kapcsolódó Edge Function-ök lefutása szintén ellenőrizve lett (`cron.job_run_details` lekérdezéssel):

| Job Név | Időzítés (UTC) | Hívott Funkció / Parancs | Legutóbbi Státusz |
| :--- | :--- | :--- | :---: |
| `nav-daily-sync` | `0 1,2,3,4 * * *` | `nav-auto-sync` Edge Function | **succeeded ✓** |
| `accounty-generate-deadlines` | `0 2 * * *` | `accounty-generate-deadlines` | **succeeded ✓** |
| `accounty-detect-missing` | `0 3 * * *` | `accounty-detect-missing` | **succeeded ✓** |
| `accounty-detect-bank` | `0 4 * * *` | `accounty-detect-bank` | **succeeded ✓** |
| `nav-m2m-daily-efo-sync` | `0 4 * * *` | `nav-m2m-proxy` (cron_sync_all) | **succeeded ✓** |
| `accounty-check-deadlines-daily` | `0 5 * * *` | `accounty-check-deadlines` | **succeeded ✓** |
| `aggreg8-token-keepalive` | `0 */2 * * *` | `aggreg8-api` (get-banks) | **succeeded ✓** |
| `refresh-company-counts-cache` | `*/10 * * * *` | `public.refresh_company_counts_cache()` | **succeeded ✓** |
| `cleanup-rate-limits` | `*/10 * * * *` | `DELETE FROM private.rate_limits` | **succeeded ✓** |
| `cleanup-pdf-exports` | `0 3 * * *` | `public.cleanup_pdf_exports()` | **succeeded ✓** |
| `cleanup-stale-impersonations` | `*/15 * * * *` | `public.cleanup_stale_impersonations()` | **succeeded ✓** |
