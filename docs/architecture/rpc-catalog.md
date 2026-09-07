# PostgreSQL RPC és Függvény Katalógus

> **Utoljára frissítve:** 2026-09-07  
> **Összesen:** 132 hívható RPC függvény | 72 PostgreSQL trigger függvény | `public` séma | **Supabase PostgreSQL**

Ez a dokumentáció az eaisybill-prod és eaisyBooks rendszerekben használt összes PostgreSQL tárolt eljárást és RPC (Remote Procedure Call) függvényt tartalmazza. Részletezi a függvény szignatúráját, biztonsági környezetét (`SECURITY DEFINER` vs `INVOKER`), hívó komponensét és funkcionális szerepét.
A kapcsolódó adatbázis sémát az [Adatbázis Séma Áttekintés](./database-schema.md), a szervermentes funkciókat az [Edge Functions Katalógus](./edge-functions.md), a lekérdezési stratégiát pedig az [A-016: PostgreSQL Query Stratégia](./decisions/A-016-postgresql-query-strategy.md) mutatja be.

---

## Tartalomjegyzék

1. [📊 Frontend Lekérdező és Aggregációs RPC-k (29 db)](#1--frontend-lekérdező-és-aggregációs-rpc-k)
2. [✏️ Frontend Állapotmódosító és Üzleti RPC-k (30 db)](#2-️-frontend-állapotmódosító-és-üzleti-rpc-k)
3. [📄 Kettős Könyvviteli Naplók (acc_*) RPC-k (8 db)](#3--kettős-könyvviteli-naplók-acc_-rpc-k)
4. [📘 eaisyBooks és EV Modul RPC-k (8 db)](#4--eaisybooks-és-ev-modul-rpc-k)
5. [🔐 Jogosultságkezelés és RLS Segédfüggvények (15 db)](#5--jogosultságkezelés-és-rls-segédfüggvények)
6. [⚡ Queue, Worker és Job Management (PGMQ) RPC-k (14 db)](#6-️-queue-worker-és-job-management-pgmq-rpc-k)
7. [🛠️ Platform és Management Üzemeltetési RPC-k (13 db)](#7-️-platform-és-management-üzemeltetési-rpc-k)
8. [📧 Email Fiókok, Vault és Hitelesítő Adatok (15 db)](#8--email-fiókok-vault-és-hitelesítő-adatok)
9. [⚙️ PostgreSQL Trigger Függvények (72 db)](#9-️-postgresql-trigger-függvények)

---

## 1. 📊 Frontend Lekérdező és Aggregációs RPC-k

| RPC Függvény és Paraméterek | Biztonság | Visszatérési érték | Hívó | Cél és Működés |
|---|:---:|---|---|---|
| `get_active_imap_accounts(—)` | `DEFINER` | `TABLE(account_id uuid, company_id uuid, user_id uuid, name text, imap_host text, imap_port integer, imap_username text, imap_password text, imap_encryption text, imap_status text)` | Worker / IMAP Listener | Aktív IMAP fiókok lekérdezése a háttérben futó email-feldolgozó számára. |
| `get_audit_gl_balances(p_import_id uuid, p_date_from date, p_date_to date)` | `INVOKER` | `TABLE(account_code text, account_name text, debit_total numeric, credit_total numeric, balance numeric)` | Belső / PostgREST | Adatbázis eljárás. |
| `get_bs_report(p_company_id uuid, p_preset_id uuid, p_date_to date, p_fiscal_year integer, p_exchange_rates jsonb)` | `DEFINER` | `TABLE(bs_structure_id uuid, row_code text, name text, section text, type text, order_num integer, parent_id uuid, is_pnl_bridge boolean, current_balance numeric, prior_year_balance numeric, prior_year_adjustment numeric, gl_accounts jsonb)` | BalanceSheet.tsx | Mérleg aggregáció (eszközök, források, saját tőke) bázis- és tárgyévi adatokkal, devizakonverzióval. |
| `get_colleague_efficiency_stats(p_accounting_firm_id uuid)` | `DEFINER` | `TABLE(accountant_id uuid, accountant_name text, assigned_companies_count bigint, missing_count bigint, resolved_count bigint, closed_deadlines_count bigint, in_progress_deadlines_count bigint)` | Accounty / Management | Könyvelőirodai kollégák hatékonysági mutatói (kiosztott cégek, hiányok, lezárt határidők). |
| `get_courier_reports_counts_by_upload(p_upload_ids uuid[])` | `INVOKER` | `TABLE(upload_id uuid, total_count bigint, matched_count bigint)` | CourierReportUploadModal | Futárjelentések összes és sikeresen párosított sorainak száma feltöltésenként. |
| `get_default_company_smtp(p_company_id uuid)` | `DEFINER` | `TABLE(id uuid, company_id uuid, name text, smtp_host text, smtp_port integer, smtp_username text, smtp_password text, smtp_encryption text, smtp_status text)` | Belső / PostgREST | Adatbázis eljárás. |
| `get_filtered_nav_invoices(p_company_id uuid, p_date_from date, p_date_to date, p_direction text, p_search text, p_currency text, p_paid text, p_submitted text, p_project_id text, p_category_id text, p_payment_method text, p_amount_min numeric, p_amount_max numeric, p_sort_field text, p_sort_dir text, p_page integer, p_page_size integer, p_issue_date_from date, p_issue_date_to date, p_preset_id uuid, p_continuous text, p_kpi_filter text)` | `DEFINER` | `TABLE(id uuid, invoice_number text, invoice_direction text, invoice_issue_date date, invoice_delivery_date date, supplier_tax_number text, supplier_name text, supplier_address text, customer_tax_number text, customer_name text, customer_address text, invoice_net_amount numeric, invoice_gross_amount numeric, invoice_vat_amount numeric, currency text, payment_method text, invoice_operation text, payment_date date, paid boolean, submitted boolean, details_fetched boolean, company_id uuid, user_id uuid, created_at timestamp with time zone, fetched_at timestamp with time zone, project_id uuid, category_id uuid, transaction_id uuid, exclude_from_accounting boolean, gl_numbers text, is_continuous boolean, service_period_start date, service_period_end date, calculated_ti date, ti_override date, ti_calculation_method text, is_manual_payment boolean, manual_payment_type text, match_status text, paid_amount numeric, remaining_amount numeric, total_count bigint)` | InvoicesPage.tsx / NavInvoicesTable | Szerveroldali lapozott, szűrt és rendezett NAV számla lista kereséssel, státuszokkal, KPI-kkal és teljesítési időpontokkal. |
| `get_filtered_submitted_invoices(p_company_id uuid, p_date_from date, p_date_to date, p_direction text, p_search text, p_currency text, p_category_id text, p_project_id text, p_payment_method text, p_amount_min numeric, p_amount_max numeric, p_sort_field text, p_sort_dir text, p_page integer, p_page_size integer, p_issue_date_from date, p_issue_date_to date, p_kpi_filter text, p_nav_status text)` | `DEFINER` | `TABLE(id uuid, bizonylatsorszam text, kibocsatas_datuma date, teljesites_datuma date, elado_nev text, vevo_nev text, adoalap_osszesen numeric, brutto_vegosszeg numeric, afa_osszeg_osszesen numeric, penznem text, category_id uuid, project_id uuid, image_url text, melleklet_url text, invoice_direction text, reference_number text, exclude_from_accounting boolean, fizetesi_mod text, match_status text, paid_amount numeric, remaining_amount numeric, statusz text, nav_status text, approval_note text, approved_at timestamp with time zone, total_count bigint)` | InvoicesPage.tsx / SubmittedInvoicesTable | Szerveroldali lapozott és szűrt beküldött számlák listája (kép- és melléklet URL-ekkel, jóváhagyási státusszal). |
| `get_fx_differences(p_company_id uuid, p_date_from date, p_date_to date)` | `DEFINER` | `TABLE(invoice_id uuid, invoice_source text, invoice_number text, partner_name text, invoice_direction text, currency text, foreign_amount numeric, delivery_date date, delivery_rate numeric, delivery_huf numeric, settlement_date date, settlement_rate numeric, settlement_huf numeric, fx_difference numeric, settlement_month text)` | FxDifferencesSection.tsx | Árfolyamkülönbözet analitika: számla teljesítéskori vs. kiegyenlítéskori devizaárfolyamok eltérése és realizált nyereség/veszteség. |
| `get_gl_balances(p_company_id uuid, p_preset_id uuid, p_date_from date, p_date_to date, p_exchange_rates jsonb, p_posting_status text, p_date_basis text)` | `DEFINER` | `TABLE(gl_account_id uuid, gl_number text, short_name text, total_balance numeric, final_balance numeric, temp_balance numeric, item_count bigint)` | GeneralLedgerTable.tsx | Főkönyvi kivonat és karton egyenlegek (számlaszámok, megnevezés, végleges és ideiglenes egyenlegek). |
| `get_gl_categorized_items(p_company_id uuid, p_preset_id uuid, p_date_from date, p_date_to date, p_exchange_rates jsonb, p_date_basis text, p_posting_status text, p_gl_account_id uuid, p_limit integer, p_offset integer)` | `DEFINER` | `TABLE(item_id uuid, gl_account_id uuid, source_table text, item_type text, partner text, description text, amount numeric, original_amount numeric, original_currency text, item_date text, is_temporary boolean)` | GeneralLedgerTable.tsx / ItemDetailModal | Lapozható tételszintű főkönyvi lista egy adott főkönyvi számhoz vagy időszakhoz. |
| `get_gl_number_from_classifications(classifications jsonb)` | `DEFINER` | `text` | Főkönyvi motor / UI | Kinyeri az elsődleges főkönyvi számot egy JSONB klasszifikációs objektumból. |
| `get_invoice_aggregates(p_company_id uuid, p_date_from date, p_date_to date)` | `DEFINER` | `TABLE(currency text, total_gross numeric, processing_count bigint, completed_count bigint, total_count bigint)` | InvoicesHeader.tsx | Számlák devizánkénti bruttó összegző és feldolgozottsági KPI aggregációi. |
| `get_invoice_kpis(p_company_id uuid, p_date_from date, p_date_to date, p_direction text, p_source text, p_search text, p_currency text, p_project_id text, p_category_id text, p_payment_method text, p_amount_min numeric, p_amount_max numeric, p_issue_date_from date, p_issue_date_to date, p_continuous text, p_submitted text)` | `DEFINER` | `TABLE(total bigint, matched bigint, suggested bigint, unmatched bigint)` | InvoicesHeader.tsx / QuickKPIFilter | Számla KPI szűrőkártyák számlálói (összes, párosított, javasolt, párosítatlan). |
| `get_linked_invoices(p_company_id uuid, p_seed_bizonylat text[], p_seed_reference text[], p_exclude_ids uuid[])` | `DEFINER` | `TABLE(id uuid, bizonylatsorszam text, kibocsatas_datuma date, teljesites_datuma date, elado_nev text, vevo_nev text, adoalap_osszesen numeric, brutto_vegosszeg numeric, afa_osszeg_osszesen numeric, penznem text, category_id uuid, project_id uuid, image_url text, melleklet_url text, invoice_direction text, reference_number text)` | InvoiceDetailModal / Relations | Kapcsolódó számlák (előleg-, végszámla, díjbekérő, jóváírás) felderítése bizonylatszám és referenciaszám alapján. |
| `get_missing_counts_by_company(p_company_ids uuid[])` | `DEFINER` | `TABLE(company_id uuid, missing_count bigint)` | Accounty / Portfolio | Hiányzó tételek száma cégek listájára szűrve. |
| `get_monthly_trend_stats(p_company_ids uuid[], p_months_count integer)` | `DEFINER` | `TABLE(month_start date, invoice_count bigint, nav_invoice_count bigint, missing_item_count bigint)` | Dashboard / Analytics | Havi trendstatisztikák (számlaszám, NAV számlák, hiányzó dokumentumok száma). |
| `get_nav_invoice_aggregates(p_company_id uuid, p_date_from date, p_date_to date)` | `DEFINER` | `TABLE(invoice_direction text, currency text, total_net numeric, total_gross numeric, total_vat numeric, paid_net numeric, paid_gross numeric, unpaid_net numeric, unpaid_gross numeric, invoice_count bigint)` | InvoicesHeader.tsx / NavSummary | NAV számlák devizánkénti és irányonkénti nettó, bruttó, ÁFA, fizetett és fizetetlen aggregációi. |
| `get_partner_monthly_cash_total(p_company_id uuid, p_partner_id uuid, p_partner_name text, p_date date)` | `DEFINER` | `numeric` | PettyCashModal.tsx / Pénztár | Egy partner adott havi összes készpénzes kifizetésének lekérdezése (1.5M Ft-os készpénzfizetési korlát ellenőrzés). |
| `get_partner_ranking(p_company_id uuid, p_date_from date, p_date_to date)` | `DEFINER` | `TABLE(partner_tax_number text, partner_name text, direction text, invoice_count numeric, total_gross numeric)` | PartnerRankingTreemap.tsx | Partnerek rangsora számlaszám és bruttó forgalom szerint (Treemap vizualizációhoz). |
| `get_petty_cash_balance(p_company_id uuid)` | `DEFINER` | `TABLE(balance numeric, has_settings boolean)` | PettyCashSection.tsx | Házipénztár aktuális egyenlege és beállítási státusza cégenként. |
| `get_petty_cash_summary(p_company_id uuid)` | `DEFINER` | `TABLE(register_id uuid, register_name text, is_default boolean, currency text, opening_balance numeric, start_date date, total_income numeric, total_expense numeric, current_balance numeric)` | PettyCashSection.tsx | Pénztárösszesítő kasszánként (nyitó egyenleg, bevételek, kiadások, záró egyenleg). |
| `get_pnl_report(p_company_id uuid, p_preset_id uuid, p_date_from date, p_date_to date, p_exchange_rates jsonb)` | `DEFINER` | `TABLE(pnl_structure_id uuid, row_code text, name text, type text, order_num integer, multiplier integer, balance numeric, gl_accounts jsonb)` | ProfitAndLoss.tsx | Eredménykimutatás aggregáció (bevételek, költségek, EBITDA, adózás előtti eredmény) megadott időszakra és számlatükör sablonra. |
| `get_reconciliation_status(p_company_id uuid, p_preset_id uuid, p_date_to date)` | `INVOKER` | `TABLE(account_type text, account_name text, currency text, system_balance numeric, ledger_balance numeric, difference numeric)` | ReconciliationTab.tsx | Főkönyvi és analitikus egyeztetés státusza és differenciái számlatípusonként. |
| `get_transaction_filter_options(p_company_id uuid)` | `DEFINER` | `TABLE(currencies text[], types text[])` | TransactionsPage.tsx | Elérhető devizák és tranzakciótípusok listája a tranzakciószűrőhöz. |
| `get_unread_ticket_count(p_user_id uuid)` | `DEFINER` | `integer` | AppSidebar.tsx / TicketsBadge | Felhasználó olvasatlan hibajegyeinek és válaszainak száma. |
| `get_vat_breakdown(p_company_id uuid, p_date_from date, p_date_to date)` | `DEFINER` | `TABLE(vat_rate text, invoice_direction text, currency text, net_sum numeric, vat_sum numeric)` | VatSummarySection.tsx | ÁFA analitika adómértékenként és irányonként (nettó alap, ÁFA összeg). |
| `search_gl_entities(p_company_id uuid, p_preset_id uuid, p_query text, p_limit integer)` | `DEFINER` | `TABLE(entity_type text, entity_id text, gl_number text, title text, subtitle text, account_id uuid, target_gl_number text, amount numeric)` | GlobalSearch / GLSelect | Intelligens entitás és számlaszám kereső a főkönyvi modulhoz (partnerek, bizonylatok, főkönyvi számok). |
| `suggest_gl_mappings(p_company_id uuid, p_preset_id uuid)` | `INVOKER` | `TABLE(gl_account_id uuid, gl_number text, short_name text, pnl_structure_id uuid, pnl_row_code text, pnl_row_name text, bs_structure_id uuid, bs_row_code text, bs_row_name text, reasoning text)` | ChartOfAccountsMapping.tsx | AI/heurisztikus főkönyvi szám hozzárendelési javaslatok a mérleg és eredménykimutatás soraihoz. |

---

## 2. ✏️ Frontend Állapotmódosító és Üzleti RPC-k

| RPC Függvény és Paraméterek | Biztonság | Visszatérési érték | Hívó | Cél és Működés |
|---|:---:|---|---|---|
| `approve_invoice_for_accounting(p_invoice_id uuid, p_approval_note text)` | `DEFINER` | `jsonb` | InvoiceApprovalModal | Számla könyvelésre való jóváhagyása megjegyzéssel és időbélyeggel. |
| `assign_supplier_default_projects(p_company_id uuid)` | `DEFINER` | `integer` | Projects / SupplierRules | Szállítóhoz rendelt alapértelmezett projektek automatikus kiosztása a korábbi számlákra. |
| `book_accrual_entry(p_accrual_id uuid)` | `DEFINER` | `json` | AccrualsTab.tsx | Időszaki elhatárolás automatikus lekönyvelése a vegyes naplóba. |
| `calculate_hourly_cost(p_base_salary numeric, p_monthly_hours numeric)` | `INVOKER` | `numeric` | Salary / CostCalc | Óradíj és bérköltség számítás alapbér és havi óraszám alapján. |
| `calculate_invoice_ti(p_invoice_id uuid)` | `DEFINER` | `json` | InvoiceDetail / TaxDate | Számla teljesítési időpont (TI) automatikus kalkulációja a számla dátumai és folyamatos teljesítés szabályai alapján. |
| `calculate_vat_return(p_company_id uuid, p_year integer, p_month integer, p_frequency text)` | `DEFINER` | `uuid` | VatReturnDetail.tsx | ÁFA bevallás automatikus legenerálása és sorainak kalkulációja adott évre, hónapra/negyedévre. |
| `check_chart_of_accounts_preset_usage(p_preset_id uuid)` | `DEFINER` | `jsonb` | ChartOfAccountsSettings | Ellenőrzi, hogy egy számlatükör sablon használatban van-e cégek vagy tételek által. |
| `delete_audit_import(p_import_id uuid)` | `DEFINER` | `void` | GlAuditImportsTab | Korábbi XML főkönyvi import és a kapcsolódó naplótételek visszavonása/törlése. |
| `delete_chart_of_accounts_preset(p_preset_id uuid, p_target_preset_id uuid)` | `DEFINER` | `jsonb` | ChartOfAccountsSettings | Biztonságos számlatükör sablon törlés, a meglévő tételek cél-sablonra való átmozgatásával. |
| `enqueue_auto_gl_classification(p_company_id uuid)` | `DEFINER` | `void` | Worker Trigger | PGMQ üzenetet küld az automatikus GL osztályozási feladat elindításához. |
| `freeze_annual_data(p_report_id uuid, p_company_id uuid, p_preset_id uuid, p_fiscal_year integer, p_exchange_rates jsonb)` | `DEFINER` | `jsonb` | AnnualReportDetail.tsx | Beszámoló adatok véglegesítése és befagyasztása az audit záráshoz. |
| `generate_accrual_proposals(p_company_id uuid, p_preset_id uuid, p_period_year integer, p_period_month integer)` | `DEFINER` | `json` | AccrualsTab.tsx | Automatikus időszaki elhatárolás javaslatok generálása időszak és számlatükör alapján. |
| `link_and_verify_submitted_invoice(p_submitted_invoice_id uuid, p_nav_invoice_id uuid, p_approval_note text)` | `DEFINER` | `jsonb` | SubmittedInvoiceMatchModal | Beküldött számla és NAV számla összekapcsolása, jóváhagyása és hitelesítése. |
| `mark_storno_group_settled(p_storno_nav_id uuid)` | `DEFINER` | `jsonb` | StornoGroupDetailModal | Sztornó és helyesbítő számlacsoport kézi vagy automatikus lezárása és rendezetté nyilvánítása. |
| `normalize_partner_name_for_match(p_name text)` | `INVOKER` | `text` | Matcher Engine | Partnernév normalizálása (jogformák, írásjelek, kis-/nagybetűk tisztítása) párosításhoz. |
| `override_gl_classification(p_item_id uuid, p_source_table text, p_new_gl_account_id uuid, p_original_gl_account_id uuid, p_company_id uuid, p_user_id uuid, p_preset_id uuid, p_new_gl_number text)` | `DEFINER` | `boolean` | GlClassificationSelect | Egyedi főkönyvi szám felülbírálása és audit naplózása. |
| `override_gl_classifications_batch(p_items jsonb, p_new_gl_account_id uuid, p_company_id uuid, p_user_id uuid, p_preset_id uuid, p_new_gl_number text)` | `DEFINER` | `boolean` | GlBatchOverrideModal | Tömeges főkönyvi szám módosítás kijelölt tételekre. |
| `record_manual_invoice_payment(p_invoice_id uuid, p_payment_date date, p_payment_type text, p_note text)` | `DEFINER` | `void` | ManualPaymentModal.tsx | Számla kézi kiegyenlítésének rögzítése (készpénz, kompenzáció, egyéb) megjegyzéssel. |
| `rematch_courier_report(p_report_id uuid)` | `DEFINER` | `jsonb` | CourierReportsTab.tsx | Futárjelentés sorainak újrafuttatása a párosító motorral. |
| `reverse_accrual_entry(p_accrual_id uuid)` | `DEFINER` | `json` | AccrualsTab.tsx | Időszaki elhatárolás feloldása (stornózása) a következő időszakban. |
| `save_bs_mappings(p_company_id uuid, p_preset_id uuid, p_mappings jsonb)` | `DEFINER` | `void` | BalanceSheetMapping.tsx | Mérleg sorok és főkönyvi számok összerendelésének mentése. |
| `save_bs_prior_year(p_company_id uuid, p_fiscal_year integer, p_data jsonb)` | `DEFINER` | `void` | BalanceSheetPriorYear.tsx | Mérleg előző évi adatainak manuális felülírása és mentése. |
| `save_item_project_rule_and_retroactive(p_company_id uuid, p_line_description text, p_gl_number text, p_project_id uuid, p_user_id uuid)` | `DEFINER` | `boolean` | ItemProjectRuleDialog | Tételszintű automatikus projektszabály mentése és retroaktív érvényesítése a meglévő számlákra. |
| `save_pnl_mappings(p_company_id uuid, p_preset_id uuid, p_mappings jsonb)` | `DEFINER` | `void` | ProfitAndLossMapping.tsx | Eredménykimutatás sorok és főkönyvi számok összerendelésének mentése. |
| `seed_default_vat_codes(p_company_id uuid)` | `INVOKER` | `void` | Settings / MasterData | Alapértelmezett NAV ÁFA kódok feltöltése egy céghez. |
| `seed_fad_vat_codes(p_company_id uuid)` | `INVOKER` | `void` | Settings / MasterData | Fordított adózású (FAD) ÁFA kódok inicializálása. |
| `sync_petty_cash_entries(p_company_id uuid)` | `DEFINER` | `TABLE(inserted_count integer, skipped_count integer)` | PettyCashTab.tsx | Készpénzes számlák automatikus szinkronizálása a házipénztár naplóba. |
| `toggle_invoice_continuous(p_invoice_id uuid, p_is_continuous boolean, p_service_period_start date, p_service_period_end date, p_ti_override date)` | `DEFINER` | `json` | ContinuousServiceToggle | Folyamatos teljesítésű státusz és elszámolási időszak állítása a számlán. |
| `unmark_storno_group_settled(p_storno_nav_id uuid)` | `DEFINER` | `jsonb` | StornoGroupDetailModal | Sztornó csoport lezárásának feloldása. |
| `validate_annual_report(p_report_id uuid)` | `DEFINER` | `jsonb` | AnnualReportDetail.tsx | Beszámoló és mérleg egyezőség ellenőrzése, logikai validáció. |

---

## 3. 📄 Kettős Könyvviteli Naplók (acc_*) RPC-k

| RPC Függvény és Paraméterek | Biztonság | Visszatérési érték | Hívó | Cél és Működés |
|---|:---:|---|---|---|
| `acc_check_opening_subledger_reconciliation(p_company_id uuid, p_year smallint)` | `DEFINER` | `jsonb` | Nyitó Napló / Analitika | Nyitó mérlegtételek és folyószámla analitikák (vevő/szállító) egyezőségének ellenőrzése. |
| `acc_generate_drafts_from_ledger(p_company_id uuid, p_preset_id uuid)` | `DEFINER` | `integer` | Napló Generátor | Könyvelési bizonylat tervezetek generálása a meglévő operatív és NAV számlákból. |
| `acc_generate_post_opening_reconciliations(p_company_id uuid, p_user_id uuid, p_year smallint)` | `DEFINER` | `jsonb` | Nyitó Napló | Nyitó bizonylat könyvelése utáni analitikus egyeztető kimutatás generálása. |
| `acc_get_next_journal_number(p_journal_id uuid, p_year smallint)` | `DEFINER` | `integer` | Naplófej Létrehozás | Ugrásmentes, szigorú számadású folyósorszám generálása adott naplóhoz és üzleti évhez. |
| `acc_post_journal_entry(p_header_id uuid, p_user_id uuid)` | `DEFINER` | `boolean` | JournalEntryDetail.tsx | Könyvelési bizonylat végleges lekönyvelése (könyvelt státusz, immutabilitási zár bekapcsolása). |
| `acc_seed_default_journals(p_company_id uuid)` | `DEFINER` | `boolean` | Cég Inicializálás / Beállítások | Alapértelmezett 8 könyvelési napló (Vevő, Szállító, Bank, Pénztár, Vegyes, Bér, Nyitó, Záró) inicializálása. |
| `acc_storno_journal_entry(p_header_id uuid, p_user_id uuid, p_reason text, p_create_correction boolean)` | `DEFINER` | `uuid` | JournalEntryDetail / Sztornó | Könyvelt bizonylat szigorú sztornózása ellentétes előjelű korrekciós tétel automatikus generálásával. |
| `acc_validate_and_post_opening_entry(p_header_id uuid, p_user_id uuid)` | `DEFINER` | `jsonb` | Nyitó Napló Véglegesítés | Nyitó naplóbizonylat mérlegegyezőségének validálása és végleges könyvelése. |

---

## 4. 📘 eaisyBooks és EV Modul RPC-k

| RPC Függvény és Paraméterek | Biztonság | Visszatérési érték | Hívó | Cél és Működés |
|---|:---:|---|---|---|
| `get_accounty_company_names(p_company_ids uuid[])` | `DEFINER` | `TABLE(id uuid, name text, tax_number text)` | Accounty / Portfolio | Irodához rendelt cégek neveinek és adószámainak biztonságos tömeges lekérdezése. |
| `get_accounty_company_summary(p_user_id uuid)` | `DEFINER` | `TABLE(company_id uuid, company_name text, company_tax_number text, missing_count bigint, critical_count bigint, last_notified_at timestamp with time zone, max_notification_count integer, total_notified bigint)` | Accounty / Dashboard | Könyvelői cégösszesítő: hiányzó dokumentumok, kritikus határidők, értesítési státuszok. |
| `get_accounty_dashboard_kpis(p_company_ids uuid[], p_now_date date, p_week_date date)` | `DEFINER` | `TABLE(missing_items bigint, upcoming_deadlines bigint, critical_clients bigint, today_deadlines bigint)` | Accounty / Dashboard | Accounty dashboard felső KPI kártyák (hiányzó tételek, közelgő határidők, ma esedékes adók). |
| `get_accounty_missing_item_counts(p_company_ids uuid[], p_date_from date, p_date_to date)` | `DEFINER` | `TABLE(company_id uuid, count bigint, critical_count bigint, last_notified_at timestamp with time zone, max_notification_count integer, total_notified bigint)` | Accounty / Deadlines | Hiányzó tételek darabszámai és határidői adott időintervallumban. |
| `get_ev_record_counts(p_company_id uuid, p_tax_year integer)` | `DEFINER` | `jsonb` | Accounty EV / Áttekintés | Egyéni vállalkozó modul 21 nyilvántartásának tételszámai adóévenként. |
| `get_ev_ytd_revenue_by_company(p_tax_year integer)` | `DEFINER` | `TABLE(company_id uuid, ytd_revenue bigint)` | Accounty EV / Portfólió | EV ügyfelek göngyölt éves bevétele (alanyi adómentesség és KATA keret figyeléshez). |
| `get_ev_ytd_totals(p_company_ids uuid[], p_tax_year integer)` | `DEFINER` | `TABLE(company_id uuid, revenue numeric, expense numeric)` | Accounty EV / Költség-Bevétel | EV cégek göngyölt éves bevételeinek és elszámolható költségeinek összesítése. |
| `get_portfolio_kata_partner_totals(p_company_ids uuid[], p_year integer)` | `DEFINER` | `TABLE(company_id uuid, customer_name text, total numeric)` | Accounty EV / KATA Riport | KATA partnerek 3M Ft-os értékhatár figyelése a 40%-os különadó megelőzésére. |

---

## 5. 🔐 Jogosultságkezelés és RLS Segédfüggvények

| RPC Függvény és Paraméterek | Biztonság | Visszatérési érték | Hívó | Cél és Működés |
|---|:---:|---|---|---|
| `get_user_id_by_email(p_email text)` | `DEFINER` | `uuid` | User Management | Felhasználó UUID azonosítójának lekérdezése email cím alapján. |
| `get_user_role(p_company_id uuid)` | `DEFINER` | `text` | AuthContext / UI | Visszaadja a felhasználó aktuális szerepkörét az adott cégnél. |
| `has_accounty_company_access(p_company_id uuid)` | `DEFINER` | `boolean` | RLS / Security Policies | Ellenőrzi, hogy a bejelentkezett felhasználónak van-e eaisyBooks hozzáférése a céghez. |
| `has_company_access_via_cache(p_company_id uuid, p_source text)` | `DEFINER` | `boolean` | RLS / Security Policies | Gyorsítótárazott hozzáférés-ellenőrzés a `user_company_access_cache` tábla alapján (InitPlan optimalizált). |
| `has_company_module_access(p_company_id uuid, p_module text)` | `DEFINER` | `boolean` | RLS / Module Guard | Finomhangolt moduljogosultság-ellenőrzés cégenként és modulonként (A-092, employee/viewer izoláció). |
| `increment_invoice_usage(user_uuid uuid)` | `DEFINER` | `boolean` | Upload / Quota Check | Előfizetési számlafeldolgozási kvóta növelése sikeres feltöltéskor. |
| `is_company_admin(p_company_id uuid)` | `DEFINER` | `boolean` | RLS / UI Jogosultság | Ellenőrzi, hogy a felhasználó Admin szerepkörrel rendelkezik-e a cégnél. |
| `is_company_member_or_above(p_company_id uuid)` | `DEFINER` | `boolean` | RLS / UI Jogosultság | Ellenőrzi, hogy a felhasználó legalább Tag jogosultsággal rendelkezik-e a cégnél. |
| `is_iroda_admin_for_firm(p_firm_id uuid)` | `DEFINER` | `boolean` | RLS / Accounty Jogosultság | Ellenőrzi, hogy a felhasználó irodavezető-e a könyvelőirodánál. |
| `is_member_of_firm(p_firm_id uuid)` | `DEFINER` | `boolean` | RLS / Accounty Jogosultság | Ellenőrzi, hogy a felhasználó tagja-e a könyvelőirodának. |
| `is_support_admin(—)` | `DEFINER` | `boolean` | RLS / Support Impersonation | Rendszer adminisztrátori és support impersonation jogosultság ellenőrzése. |
| `lookup_user_by_email(p_email text)` | `DEFINER` | `TABLE(user_id uuid, email text, name text)` | InviteUserDialog | Felhasználó keresése meghívás előtt (id, név, email). |
| `reset_monthly_usage(—)` | `DEFINER` | `integer` | Cron / Quota Reset | Havi felhasználási kvóták nullázása az új előfizetési ciklus kezdetén. |
| `user_has_company_access(p_company_id uuid)` | `DEFINER` | `boolean` | RLS / Security Policies | Alapvető felhasználói cég-hozzáférés ellenőrzése. |
| `user_is_company_member(p_company_id uuid)` | `DEFINER` | `boolean` | RLS / Security Policies | Ellenőrzi, hogy a felhasználó aktív tagja-e a cégnek. |

---

## 6. ⚡ Queue, Worker és Job Management (PGMQ) RPC-k

| RPC Függvény és Paraméterek | Biztonság | Visszatérési érték | Hívó | Cél és Működés |
|---|:---:|---|---|---|
| `claim_gl_jobs(p_batch_size integer)` | `INVOKER` | `SETOF gl_upload_notifications` | Python Worker (GL Pipeline) | Zárol és feldolgozásra kiad N db XML főkönyvi import értesítést. |
| `claim_invoice_jobs(p_batch_size integer)` | `DEFINER` | `SETOF invoice_uploads` | Python Worker (Invoice Pipeline) | Zárol és feldolgozásra kiad N db feltöltött számlafájlt (pesszimista lock). |
| `claim_transaction_jobs(p_batch_size integer)` | `INVOKER` | `SETOF transaction_uploads` | Python Worker (Tx Pipeline) | Zárol és feldolgozásra kiad N db bankkivonat feltöltést. |
| `debug_llm_costs_count(—)` | `DEFINER` | `jsonb` | Belső / PostgREST | Adatbázis eljárás. |
| `get_unclassified_gl_items(p_company_id uuid, p_preset_id text)` | `DEFINER` | `TABLE(id uuid, source_table text, direction text, partner_name text, document_number text, document_date text, description text, product_code text, amount numeric, quantity numeric, unit text, vat_rate text, is_reverse_charge boolean)` | Python Worker (GL Classifier) | Optimalizált kötegelt tétel-lekérdező az AI főkönyvi automatikus osztályozáshoz. |
| `peek_queue_items(queue_name text, max_items integer)` | `DEFINER` | `TABLE(msg_id bigint, enqueued_at timestamp with time zone, read_ct integer, file_name text, company_name text, company_id uuid, source text, document_category text)` | Management Dashboard | Betekintés a PGMQ várakozási sor tetején lévő üzenetekbe zárolás nélkül. |
| `pgmq_archive(queue_name text, msg_id bigint)` | `DEFINER` | `boolean` | Worker PGMQ | Feldolgozott üzenet archiválása a PGMQ archívumba. |
| `pgmq_delete(queue_name text, msg_id bigint)` | `DEFINER` | `boolean` | Worker PGMQ | Üzenet végleges törlése a PGMQ sorból. |
| `pgmq_metrics(queue_name text)` | `DEFINER` | `SETOF jsonb` | Management Dashboard | Egy adott PGMQ sor mérőszámai (sorhossz, legöregebb üzenet). |
| `pgmq_metrics_all(—)` | `DEFINER` | `TABLE(queue_name text, queue_length bigint, newest_msg_age_sec integer, oldest_msg_age_sec integer, total_messages bigint)` | Management Dashboard | Az összes aktív PGMQ üzenetsor aggregált metrikái (hossz, késleltetés). |
| `pgmq_read(queue_name text, vt integer, qty integer, max_poll_seconds integer, poll_interval_ms integer)` | `DEFINER` | `SETOF jsonb` | Worker / EF PGMQ | Üzenetek olvasása a megadott PGMQ sorból láthatósági időkorláttal (VT). |
| `pgmq_send_retry(queue_name text, msg jsonb)` | `DEFINER` | `bigint` | management-stats EF | RPC wrapper sikertelenül futott PGMQ üzenetek újrapróbálására. |
| `worker_daily_counts(days_back integer)` | `DEFINER` | `TABLE(pipeline text, day_key date, cnt bigint)` | Worker Health Dashboard | Napi feldolgozott munkák száma pipeline-onként. |
| `worker_pipeline_stats(since_ts timestamp with time zone)` | `DEFINER` | `TABLE(pipeline text, worker_id text, jobs bigint, total_duration_ms bigint, total_cost numeric, avg_duration_ms numeric)` | Worker Health Dashboard | Worker pipeline teljesítmény-statisztikák (átlagos futási idő, költség, job szám). |

---

## 7. 🛠️ Platform és Management Üzemeltetési RPC-k

| RPC Függvény és Paraméterek | Biztonság | Visszatérési érték | Hívó | Cél és Működés |
|---|:---:|---|---|---|
| `check_request(—)` | `DEFINER` | `void` | Belső / PostgREST | Adatbázis eljárás. |
| `cleanup_pdf_exports(—)` | `DEFINER` | `void` | pg_cron / Cleanup | 24 óránál régebbi, lejárt PDF export jobok és ideiglenes fájlok törlése. |
| `cleanup_stale_impersonations(—)` | `DEFINER` | `void` | pg_cron / Security | Lejárt vagy beragadt support admin megszemélyesítések érvénytelenítése. |
| `delete_upload_with_data(p_upload_id uuid, p_upload_type text)` | `DEFINER` | `jsonb` | Upload History / Actions | Feltöltött fájl és a belőle generált összes rekord tranzakcionális törlése. |
| `generate_api_key(p_company_id uuid, p_name text)` | `DEFINER` | `jsonb` | Settings / API Keys | Új titkosított API kulcs generálása külső integrációkhoz (OpenClaw). |
| `get_company_counts(—)` | `DEFINER` | `json` | Management Overview | Rendszerszintű összesítő: regisztrált cégek, aktív előfizetések és profilok száma. |
| `get_company_record_counts(—)` | `DEFINER` | `TABLE(company_id uuid, invoice_count bigint, nav_invoice_count bigint, transaction_count bigint, salary_count bigint)` | Management Companies | Cégenkénti rekord-számlálók (számlák, NAV számlák, tranzakciók, bérek). |
| `get_llm_cost_full_agg(since_date timestamp with time zone)` | `DEFINER` | `jsonb` | Management LLM Tab | Teljes LLM költség és token-felhasználás aggregáció modellenként és feladatonként. |
| `get_llm_cost_summary(period_start timestamp with time zone)` | `DEFINER` | `jsonb` | Management LLM Tab | Időszaki LLM költségösszesítő (bemeneti/kimeneti tokenek, költség USD-ben). |
| `get_management_files(p_page integer, p_page_size integer, p_sort_by text, p_sort_dir text, p_search text, p_company_id uuid, p_user_id uuid, p_file_type text, p_status text, p_date_from timestamp with time zone, p_date_to timestamp with time zone)` | `DEFINER` | `json` | Management Files Tab | Szerveroldali lapozott, szűrt és rendezett fájlkezelő a feltöltött állományokhoz. |
| `get_monthly_llm_by_company(month_start timestamp with time zone)` | `DEFINER` | `jsonb` | Management LLM Tab | Havi LLM költség-megoszlás cégek szerint. |
| `revoke_api_key(p_key_id uuid)` | `DEFINER` | `jsonb` | Settings / API Keys | Meglévő API kulcs azonnali visszavonása. |
| `sync_sandbox_from_taxology(—)` | `DEFINER` | `void` | Belső / PostgREST | Adatbázis eljárás. |

---

## 8. 📧 Email Fiókok, Vault és Hitelesítő Adatok

| RPC Függvény és Paraméterek | Biztonság | Visszatérési érték | Hívó | Cél és Működés |
|---|:---:|---|---|---|
| `delete_company_email_account(p_account_id uuid)` | `DEFINER` | `jsonb` | EmailSettings.tsx | Levelezőfiók és a hozzá tartozó Vault titkok törlése. |
| `delete_company_email_settings(p_company_id uuid)` | `DEFINER` | `jsonb` | Legacy Email Settings | Korábbi egyfiókos email beállítások törlése. |
| `delete_szamlazz_agent_key(p_company_id uuid)` | `DEFINER` | `jsonb` | Számlázz.hu Integráció | Számlázz.hu agent kulcs törlése a Vaultból. |
| `get_auth_emails(—)` | `DEFINER` | `TABLE(id uuid, email text)` | Management Admin | Felhasználói fiókok email címeinek biztonságos listázása adminisztrációhoz. |
| `get_company_email_accounts(p_company_id uuid)` | `DEFINER` | `TABLE(id uuid, company_id uuid, user_id uuid, name text, is_active boolean, is_default_smtp boolean, is_default_imap boolean, is_imap_enabled boolean, imap_host text, imap_port integer, imap_username text, imap_password text, imap_encryption text, imap_status text, imap_last_synced_at timestamp with time zone, imap_last_validated_at timestamp with time zone, imap_validation_error text, is_smtp_enabled boolean, smtp_host text, smtp_port integer, smtp_username text, smtp_password text, smtp_encryption text, smtp_status text, smtp_last_validated_at timestamp with time zone, smtp_validation_error text, created_at timestamp with time zone, updated_at timestamp with time zone)` | EmailSettings.tsx | Céghez konfigurált IMAP/SMTP levelezőfiókok listája és állapotai. |
| `get_company_email_settings(p_company_id uuid)` | `DEFINER` | `TABLE(company_id uuid, imap_host text, imap_port integer, imap_username text, imap_password text, imap_encryption text, imap_status text, smtp_host text, smtp_port integer, smtp_username text, smtp_password text, smtp_encryption text, smtp_status text)` | Legacy Email Settings | Korábbi egyfiókos email beállítások lekérdezése. |
| `get_nav_credentials(p_user_id uuid, p_company_id uuid)` | `DEFINER` | `json` | NavSettings.tsx | NAV API kapcsolat hitelesítő adatainak lekérdezése a Vaultból. |
| `get_single_email_account(p_account_id uuid)` | `DEFINER` | `TABLE(id uuid, company_id uuid, user_id uuid, name text, is_active boolean, is_default_smtp boolean, is_default_imap boolean, is_imap_enabled boolean, imap_host text, imap_port integer, imap_username text, imap_password text, imap_encryption text, imap_status text, imap_last_synced_at timestamp with time zone, imap_last_validated_at timestamp with time zone, imap_validation_error text, is_smtp_enabled boolean, smtp_host text, smtp_port integer, smtp_username text, smtp_password text, smtp_encryption text, smtp_status text, smtp_last_validated_at timestamp with time zone, smtp_validation_error text, created_at timestamp with time zone, updated_at timestamp with time zone)` | EmailAccountModal.tsx | Egy adott levelezőfiók konfigurációjának betöltése. |
| `get_szamlazz_agent_key(p_company_id uuid)` | `DEFINER` | `text` | Számlázz.hu Integráció | Számlázz.hu számlaértesítő agent kulcsának feloldása a Vaultból. |
| `get_user_emails_for_management(user_ids uuid[])` | `DEFINER` | `TABLE(id uuid, email text)` | Management Admin | Több megadott felhasználó email címének feloldása. |
| `save_company_email_account(p_company_id uuid, p_name text, p_is_active boolean, p_is_default_smtp boolean, p_is_default_imap boolean, p_is_imap_enabled boolean, p_imap_host text, p_imap_port integer, p_imap_username text, p_imap_password text, p_imap_encryption text, p_is_smtp_enabled boolean, p_smtp_host text, p_smtp_port integer, p_smtp_username text, p_smtp_password text, p_smtp_encryption text, p_id uuid)` | `DEFINER` | `jsonb` | EmailAccountModal.tsx | Levelezőfiók (IMAP/SMTP) mentése a jelszó Supabase Vault titkosításával. |
| `save_company_email_settings(p_company_id uuid, p_imap_host text, p_imap_port integer, p_imap_username text, p_imap_password text, p_imap_encryption text, p_smtp_host text, p_smtp_port integer, p_smtp_username text, p_smtp_password text, p_smtp_encryption text)` | `DEFINER` | `jsonb` | Legacy Email Settings | Korábbi egyfiókos email beállítások mentése. |
| `save_nav_credentials(p_nav_username text, p_nav_password text, p_nav_tax_number text, p_nav_sign_key text, p_nav_exchange_key text, p_software_dev_name text, p_software_dev_contact text, p_is_test_environment boolean, p_company_id uuid)` | `DEFINER` | `json` | NavSettings.tsx / EF | NAV technikai felhasználói adatok és aláírókulcsok titkosított mentése a Vaultba. |
| `save_szamlazz_agent_key(p_company_id uuid, p_agent_key text)` | `DEFINER` | `jsonb` | Számlázz.hu Integráció | Számlázz.hu számlaértesítő agent kulcsának titkosított mentése a Vaultba. |
| `set_default_company_email_account(p_account_id uuid, p_type text)` | `DEFINER` | `jsonb` | EmailSettings.tsx | Alapértelmezett kimenő (SMTP) vagy bejövő (IMAP) fiók beállítása. |

---

## 9. ⚙️ PostgreSQL Trigger Függvények

> A PostgreSQL triggerek biztosítják az adatintegritást, a kettős könyvviteli immutabilitást, a hibabiztos cache szinkronizációt és a teljeskörű audit naplózást közvetlenül az adatbázis magjában.

| Trigger Függvény | Biztonság | Visszatérési Típus | Fő Szerepkör |
|---|:---:|---|---|
| `acc_check_journal_balance()` | `INVOKER` | `trigger` | Kettős könyvviteli napló mérlegegyezőség és automatikus audit naplózás. |
| `acc_enforce_header_immutability()` | `INVOKER` | `trigger` | Könyvelési bizonylat / tételsor lezárás utáni megváltoztathatatlanság (immutabilitás) kikényszerítése. |
| `acc_enforce_line_immutability()` | `INVOKER` | `trigger` | Könyvelési bizonylat / tételsor lezárás utáni megváltoztathatatlanság (immutabilitás) kikényszerítése. |
| `acc_log_journal_audit()` | `DEFINER` | `trigger` | Kettős könyvviteli napló mérlegegyezőség és automatikus audit naplózás. |
| `accounty_ai_session_touch()` | `INVOKER` | `trigger` | Integritás és automatikus üzleti szabály trigger. |
| `accounty_set_updated_at()` | `INVOKER` | `trigger` | Rekord módosításakor az `updated_at` időbélyeg automatikus frissítése `now()`-ra. |
| `apply_item_project_rules()` | `DEFINER` | `trigger` | Integritás és automatikus üzleti szabály trigger. |
| `audit_insert_delete_func()` | `DEFINER` | `trigger` | Műveletek automatikus audit naplózása a központi `audit_logs` táblába. |
| `auto_approve_high_confidence()` | `DEFINER` | `trigger` | Integritás és automatikus üzleti szabály trigger. |
| `auto_detect_continuous_service()` | `DEFINER` | `trigger` | Integritás és automatikus üzleti szabály trigger. |
| `auto_detect_reverse_charge()` | `INVOKER` | `trigger` | Integritás és automatikus üzleti szabály trigger. |
| `auto_mark_cash_paid()` | `INVOKER` | `trigger` | Számla, fizetés vagy feltöltés státuszának tranzakcionális állapotgép kezelése. |
| `auto_match_salary_transaction()` | `DEFINER` | `trigger` | Táblák közötti automatikus státusz, párosítás vagy FK szinkronizáció. |
| `clear_transaction_match_on_invoice_delete()` | `DEFINER` | `trigger` | Táblák közötti automatikus státusz, párosítás vagy FK szinkronizáció. |
| `create_comment_event()` | `DEFINER` | `trigger` | Integritás és automatikus üzleti szabály trigger. |
| `create_ticket_created_event()` | `DEFINER` | `trigger` | Integritás és automatikus üzleti szabály trigger. |
| `create_ticket_status_event()` | `DEFINER` | `trigger` | Integritás és automatikus üzleti szabály trigger. |
| `enforce_invoice_single_project()` | `DEFINER` | `trigger` | Integritás és automatikus üzleti szabály trigger. |
| `enqueue_report_job()` | `DEFINER` | `trigger` | PGMQ üzenet automatikus sorba állítása feltöltés vagy számla beszúrásakor. |
| `fn_accounty_check_period_closed()` | `INVOKER` | `trigger` | Integritás és automatikus üzleti szabály trigger. |
| `fn_accounty_prevent_closed_update()` | `INVOKER` | `trigger` | Integritás és automatikus üzleti szabály trigger. |
| `generate_project_code()` | `DEFINER` | `trigger` | Integritás és automatikus üzleti szabály trigger. |
| `generate_ticket_number()` | `DEFINER` | `trigger` | Integritás és automatikus üzleti szabály trigger. |
| `global_audit_trigger_func()` | `DEFINER` | `trigger` | Műveletek automatikus audit naplózása a központi `audit_logs` táblába. |
| `handle_new_user()` | `DEFINER` | `trigger` | Új Auth felhasználó regisztrációjakor profil és előfizetés rekord automatikus inicializálása. |
| `handle_updated_at()` | `INVOKER` | `trigger` | Rekord módosításakor az `updated_at` időbélyeg automatikus frissítése `now()`-ra. |
| `initialize_email_preferences()` | `DEFINER` | `trigger` | Integritás és automatikus üzleti szabály trigger. |
| `initialize_user_subscription()` | `DEFINER` | `trigger` | Integritás és automatikus üzleti szabály trigger. |
| `mark_invoice_paid_on_multi_match()` | `DEFINER` | `trigger` | Táblák közötti automatikus státusz, párosítás vagy FK szinkronizáció. |
| `mark_invoice_upload_completed_on_invoice_insert()` | `DEFINER` | `trigger` | Számla, fizetés vagy feltöltés státuszának tranzakcionális állapotgép kezelése. |
| `mark_nav_invoice_as_submitted()` | `DEFINER` | `trigger` | Számla, fizetés vagy feltöltés státuszának tranzakcionális állapotgép kezelése. |
| `mark_nav_invoice_paid_on_transaction_match()` | `DEFINER` | `trigger` | Táblák közötti automatikus státusz, párosítás vagy FK szinkronizáció. |
| `mark_salary_file_completed_on_salary_insert()` | `DEFINER` | `trigger` | Számla, fizetés vagy feltöltés státuszának tranzakcionális állapotgép kezelése. |
| `mark_transaction_upload_completed_on_transaction_insert()` | `DEFINER` | `trigger` | Számla, fizetés vagy feltöltés státuszának tranzakcionális állapotgép kezelése. |
| `match_nav_invoice_on_insert()` | `DEFINER` | `trigger` | Táblák közötti automatikus státusz, párosítás vagy FK szinkronizáció. |
| `match_payment_transfers_on_invoice_match()` | `DEFINER` | `trigger` | Táblák közötti automatikus státusz, párosítás vagy FK szinkronizáció. |
| `on_company_created()` | `DEFINER` | `trigger` | Integritás és automatikus üzleti szabály trigger. |
| `reset_nav_submitted_on_invoice_delete()` | `DEFINER` | `trigger` | Számla, fizetés vagy feltöltés státuszának tranzakcionális állapotgép kezelése. |
| `reset_paid_on_transaction_delete()` | `DEFINER` | `trigger` | Számla, fizetés vagy feltöltés státuszának tranzakcionális állapotgép kezelése. |
| `reset_paid_on_transaction_unmatch()` | `DEFINER` | `trigger` | Táblák közötti automatikus státusz, párosítás vagy FK szinkronizáció. |
| `rls_auto_enable()` | `DEFINER` | `event_trigger` | Integritás és automatikus üzleti szabály trigger. |
| `set_invoice_feldolgozva_on_upload_link()` | `DEFINER` | `trigger` | Számla, fizetés vagy feltöltés státuszának tranzakcionális állapotgép kezelése. |
| `set_nav_invoice_items_company_id()` | `DEFINER` | `trigger` | Számla, fizetés vagy feltöltés státuszának tranzakcionális állapotgép kezelése. |
| `sync_accounty_assignment_to_cache()` | `DEFINER` | `trigger` | Táblák közötti automatikus státusz, párosítás vagy FK szinkronizáció. |
| `sync_accounty_employee_to_rates()` | `DEFINER` | `trigger` | Táblák közötti automatikus státusz, párosítás vagy FK szinkronizáció. |
| `sync_accounty_employment_to_rates()` | `DEFINER` | `trigger` | Táblák közötti automatikus státusz, párosítás vagy FK szinkronizáció. |
| `sync_company_member_to_cache()` | `DEFINER` | `trigger` | Táblák közötti automatikus státusz, párosítás vagy FK szinkronizáció. |
| `sync_eaisybill_accountant_removal()` | `DEFINER` | `trigger` | Táblák közötti automatikus státusz, párosítás vagy FK szinkronizáció. |
| `sync_ev_fixed_assets()` | `DEFINER` | `trigger` | Táblák közötti automatikus státusz, párosítás vagy FK szinkronizáció. |
| `sync_nav_invoice_items_company_id()` | `DEFINER` | `trigger` | Táblák közötti automatikus státusz, párosítás vagy FK szinkronizáció. |
| `sync_petty_cash_on_invoice_change()` | `DEFINER` | `trigger` | Táblák közötti automatikus státusz, párosítás vagy FK szinkronizáció. |
| `sync_salary_to_employee_rates()` | `DEFINER` | `trigger` | Táblák közötti automatikus státusz, párosítás vagy FK szinkronizáció. |
| `sync_submitted_invoice_on_bizonylatsorszam_change()` | `DEFINER` | `trigger` | Táblák közötti automatikus státusz, párosítás vagy FK szinkronizáció. |
| `sync_submitted_invoice_on_nav_insert()` | `DEFINER` | `trigger` | Táblák közötti automatikus státusz, párosítás vagy FK szinkronizáció. |
| `trg_invoice_items_inserted()` | `DEFINER` | `trigger` | Integritás és automatikus üzleti szabály trigger. |
| `trg_nav_invoice_items_inserted()` | `DEFINER` | `trigger` | Integritás és automatikus üzleti szabály trigger. |
| `trg_transactions_inserted()` | `DEFINER` | `trigger` | Integritás és automatikus üzleti szabály trigger. |
| `trigger_enqueue_gl_job()` | `DEFINER` | `trigger` | PGMQ üzenet automatikus sorba állítása feltöltés vagy számla beszúrásakor. |
| `trigger_enqueue_invoice_job()` | `DEFINER` | `trigger` | PGMQ üzenet automatikus sorba állítása feltöltés vagy számla beszúrásakor. |
| `trigger_enqueue_transaction_job()` | `DEFINER` | `trigger` | PGMQ üzenet automatikus sorba állítása feltöltés vagy számla beszúrásakor. |
| `update_accounty_push_prefs_updated_at()` | `INVOKER` | `trigger` | Rekord módosításakor az `updated_at` időbélyeg automatikus frissítése `now()`-ra. |
| `update_accounty_push_subs_updated_at()` | `INVOKER` | `trigger` | Rekord módosításakor az `updated_at` időbélyeg automatikus frissítése `now()`-ra. |
| `update_annual_reports_updated_at()` | `INVOKER` | `trigger` | Rekord módosításakor az `updated_at` időbélyeg automatikus frissítése `now()`-ra. |
| `update_feedback_updated_at()` | `INVOKER` | `trigger` | Rekord módosításakor az `updated_at` időbélyeg automatikus frissítése `now()`-ra. |
| `update_frissitve_column()` | `INVOKER` | `trigger` | Rekord módosításakor az `updated_at` időbélyeg automatikus frissítése `now()`-ra. |
| `update_pdf_export_jobs_updated_at()` | `INVOKER` | `trigger` | Rekord módosításakor az `updated_at` időbélyeg automatikus frissítése `now()`-ra. |
| `update_settings_updated_at()` | `INVOKER` | `trigger` | Rekord módosításakor az `updated_at` időbélyeg automatikus frissítése `now()`-ra. |
| `update_updated_at()` | `INVOKER` | `trigger` | Rekord módosításakor az `updated_at` időbélyeg automatikus frissítése `now()`-ra. |
| `update_updated_at_column()` | `INVOKER` | `trigger` | Rekord módosításakor az `updated_at` időbélyeg automatikus frissítése `now()`-ra. |
| `update_user_subscriptions_updated_at()` | `INVOKER` | `trigger` | Rekord módosításakor az `updated_at` időbélyeg automatikus frissítése `now()`-ra. |
| `update_vat_updated_at()` | `INVOKER` | `trigger` | Rekord módosításakor az `updated_at` időbélyeg automatikus frissítése `now()`-ra. |
| `upgrade_foreign_partner_on_nav_invoice()` | `DEFINER` | `trigger` | Integritás és automatikus üzleti szabály trigger. |

---

> ℹ️ *A katalógus a PostgreSQL adatbázis élő `pg_proc` és `pg_namespace` rendszerkatalógusának közvetlen lekérdezése alapján készült. Bármilyen új tárolt eljárás vagy trigger létrehozásakor kövesse a [visibill-db-checklist](../../.agents/skills/visibill-db-checklist/SKILL.md) előírásait.*