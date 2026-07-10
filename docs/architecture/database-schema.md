# eaisybill-prod — Adatbázis Séma Áttekintés

> **Utoljára frissítve:** 2026-06-28
> **Összesen:** ~153 tábla | **RLS:** mind engedélyezve | **Supabase PostgreSQL**

Ez a dokumentáció az eaisybill-prod Supabase projekt teljes adatbázis sémáját tartalmazza. Célja, hogy bármely AI agent azonnal megértse a táblastruktúrát, kapcsolatokat és felhasználási kontextust.

---

## Tartalomjegyzék

- [🔐 Auth & Felhasználók](./database/01-auth-users.md) — 6 tábla, ~187 sor
- [🏢 Cégek & Tagság](./database/02-companies.md) — 5 tábla, ~87 sor
- [🔑 Jogosultságok & Hozzáférés](./database/03-permissions.md) — 3 tábla, ~128 sor
- [📄 Számlák](./database/04-invoices.md) — 7 tábla, ~6194 sor
- [🏛️ NAV Integráció](./database/05-nav.md) — 3 tábla, ~53816 sor
- [💳 Tranzakciók & Bank](./database/06-transactions-bank.md) — 8 tábla, ~3407 sor
- [📊 Főkönyv (General Ledger)](./database/07-general-ledger.md) — 9 tábla, ~80459 sor
- [💰 Bér & Munkaidő](./database/08-salary-hr.md) — 5 tábla, ~202 sor
- [🏦 Házipénztár](./database/09-petty-cash.md) — 5 tábla, ~40 sor
- [📦 Tárgyi Eszközök](./database/10-assets.md) — 3 tábla, ~76 sor
- [🚚 Szállítmányozás](./database/11-shipping.md) — 4 tábla, ~91 sor
- [📋 Éves Beszámoló & ÁFA](./database/12-annual-reports.md) — 11 tábla, ~1357 sor
- [📘 eaisyBooks — Alap](./database/13-eaisybooks-core.md) — 13 tábla, ~21664 sor
- [📘 eaisyBooks — Bérszámfejtés](./database/14-eaisybooks-payroll.md) — 13 tábla, ~47 sor
- [📘 eaisyBooks — Adó & Jogi](./database/15-eaisybooks-tax-legal.md) — 10 tábla, ~170 sor
- [📘 eaisyBooks — Szervezet](./database/16-eaisybooks-org.md) — 6 tábla, ~5 sor
- [📘 eaisyBooks — EV (Egyéni Vállalkozó)](./database/17-eaisybooks-ev.md) — 21 tábla, ~0 sor
- [📘 eaisyBooks — AI Chat](./database/18-eaisybooks-ai.md) — 2 tábla, ~6 sor
- [🛠️ Platform & Üzemeltetés](./database/19-platform-ops.md) — 9 tábla, ~11993 sor
- [🎫 Hibajegy Rendszer](./database/20-tickets.md) — 3 tábla, ~31 sor
- [🏷️ Törzsadatok](./database/21-master-data.md) — 7 tábla, ~1248 sor

---

## Összes Tábla (ABC rendben)

| Tábla | Csoport | Sorok | Leírás |
|-------|---------|-------|--------|
| `accounty_ai_chat_messages` | 📘 eaisyBooks — AI Chat | 4 | Individual messages within an AI chat session. Ordered by created_at. |
| `accounty_ai_chat_sessions` | 📘 eaisyBooks — AI Chat | 2 | AI Assistant chat sessions per user. Each session is a separate conversation ... |
| `accounty_assignments` | 📘 eaisyBooks — Alap | 61 | Könyvelő-felhasználó ↔ ügyfélcég hozzárendelés. Senior = teljes rálátás, Juni... |
| `accounty_audit_log` | 📘 eaisyBooks — Alap | 0 |  |
| `accounty_cafeteria` | 📘 eaisyBooks — Bérszámfejtés | 0 | Cafeteria-elszámolás: SZÉP-kártya, lakhatás, csekély értékű ajándék. A közteh... |
| `accounty_cegkapu_settings` | 📘 eaisyBooks — Adó & Jogi | 0 |  |
| `accounty_communication_preferences` | 📘 eaisyBooks — Alap | 1 | Ügyfélcég kommunikációs beállításai: értesítési csatornák, gyakoriság, GDPR o... |
| `accounty_cost_centers` | 📘 eaisyBooks — Szervezet | 0 |  |
| `accounty_data_contracts` | 📘 eaisyBooks — Adó & Jogi | 0 |  |
| `accounty_deadlines` | 📘 eaisyBooks — Alap | 692 | Könyvelési és adóügyi határidők cégenként. Automatikusan generálódnak az acco... |
| `accounty_declarations` | 📘 eaisyBooks — Bérszámfejtés | 1 | Adóelőleg-nyilatkozatok: 9 különböző kedvezmény-típus, foglalkoztatottanként. |
| `accounty_departments` | 📘 eaisyBooks — Szervezet | 1 |  |
| `accounty_documents` | 📘 eaisyBooks — Alap | 8 |  |
| `accounty_employee_jobs` | 📘 eaisyBooks — Bérszámfejtés | 0 |  |
| `accounty_employees` | 📘 eaisyBooks — Bérszámfejtés | 6 | Bérszámfejtési modul foglalkoztatottak törzstáblája. Egy céghez (companies) N... |
| `accounty_employments` | 📘 eaisyBooks — Bérszámfejtés | 6 | Jogviszonyok. Egy foglalkoztatotthoz (accounty_employees) N jogviszony tartoz... |
| `accounty_ev_audit_log` | 📘 eaisyBooks — EV (Egyéni Vállalkozó) | 0 |  |
| `accounty_ev_client_settings` | 📘 eaisyBooks — EV (Egyéni Vállalkozó) | 0 |  |
| `accounty_ev_contribution_calc` | 📘 eaisyBooks — EV (Egyéni Vállalkozó) | 0 |  |
| `accounty_ev_hipa_calc` | 📘 eaisyBooks — EV (Egyéni Vállalkozó) | 0 |  |
| `accounty_ev_lifecycle_events` | 📘 eaisyBooks — EV (Egyéni Vállalkozó) | 0 |  |
| `accounty_ev_records_consignment` | 📘 eaisyBooks — EV (Egyéni Vállalkozó) | 0 |  |
| `accounty_ev_records_fixed_assets` | 📘 eaisyBooks — EV (Egyéni Vállalkozó) | 0 |  |
| `accounty_ev_records_inventory` | 📘 eaisyBooks — EV (Egyéni Vállalkozó) | 0 |  |
| `accounty_ev_records_investments` | 📘 eaisyBooks — EV (Egyéni Vállalkozó) | 0 |  |
| `accounty_ev_records_other_claims` | 📘 eaisyBooks — EV (Egyéni Vállalkozó) | 0 |  |
| `accounty_ev_records_payables` | 📘 eaisyBooks — EV (Egyéni Vállalkozó) | 0 |  |
| `accounty_ev_records_receivables` | 📘 eaisyBooks — EV (Egyéni Vállalkozó) | 0 |  |
| `accounty_ev_records_scrapping` | 📘 eaisyBooks — EV (Egyéni Vállalkozó) | 0 |  |
| `accounty_ev_records_securities` | 📘 eaisyBooks — EV (Egyéni Vállalkozó) | 0 |  |
| `accounty_ev_records_strict_forms` | 📘 eaisyBooks — EV (Egyéni Vállalkozó) | 0 |  |
| `accounty_ev_records_subcontractors` | 📘 eaisyBooks — EV (Egyéni Vállalkozó) | 0 |  |
| `accounty_ev_records_vehicle_log` | 📘 eaisyBooks — EV (Egyéni Vállalkozó) | 0 |  |
| `accounty_ev_records_wages` | 📘 eaisyBooks — EV (Egyéni Vállalkozó) | 0 |  |
| `accounty_ev_tax_returns` | 📘 eaisyBooks — EV (Egyéni Vállalkozó) | 0 |  |
| `accounty_filings` | 📘 eaisyBooks — Adó & Jogi | 5 | NAV bevallások és bejelentések. filing_type a NAV űrlap típusa, channel a bek... |
| `accounty_garnishments` | 📘 eaisyBooks — Bérszámfejtés | 0 | Bér-letiltások (Vht. 65.§): tartásdíj, közjogi, magánjogi. A sorrend és maxim... |
| `accounty_gdpr_requests` | 📘 eaisyBooks — Alap | 0 |  |
| `accounty_global_tax_params` | 📘 eaisyBooks — Adó & Jogi | 48 |  |
| `accounty_job_codes` | 📘 eaisyBooks — Bérszámfejtés | 19 | NAV jogviszonykódok master táblája. Az 1115-ös kód 2026.01.01-től automatikus... |
| `accounty_job_modifications` | 📘 eaisyBooks — Bérszámfejtés | 9 |  |
| `accounty_leaves` | 📘 eaisyBooks — Bérszámfejtés | 0 | Szabadság/távollét nyilvántartás foglalkoztatottanként. Támogatja a betegszab... |
| `accounty_legal_updates` | 📘 eaisyBooks — Adó & Jogi | 17 |  |
| `accounty_messages` | 📘 eaisyBooks — Alap | 3 |  |
| `accounty_missing_items` | 📘 eaisyBooks — Alap | 5893 | Az Accounty modul központi entitása: detektált hiányzó dokumentumok és tétele... |
| `accounty_module_permissions` | 🔑 Jogosultságok & Hozzáférés | 2 | Modulonkénti testreszabható jogosultságok. Az iroda admin állítja be, hogy me... |
| `accounty_nav_representations` | 📘 eaisyBooks — Adó & Jogi | 1 |  |
| `accounty_office_settings` | 📘 eaisyBooks — Szervezet | 0 |  |
| `accounty_payroll_calculations` | 📘 eaisyBooks — Bérszámfejtés | 1 | Számfejtett eredmények: a futtatott adómotor kimenete jogviszonyonként. |
| `accounty_payroll_cycles` | 📘 eaisyBooks — Bérszámfejtés | 5 | Havi bérszámfejtési ciklus. Egy céghez havonta max. egy ciklus tartozik. 8 lé... |
| `accounty_payroll_items` | 📘 eaisyBooks — Bérszámfejtés | 0 | Bérelemek: a havi ciklus jogviszonyonkénti tételei (alapbér, pótlékok, juttat... |
| `accounty_penztarkonyv_period_close` | 📘 eaisyBooks — EV (Egyéni Vállalkozó) | 0 |  |
| `accounty_penztarkonyv_tetel` | 📘 eaisyBooks — EV (Egyéni Vállalkozó) | 0 |  |
| `accounty_portal_tokens` | 📘 eaisyBooks — Alap | 84 | Magic Link tokenek az ügyfélportálhoz. Bejelentkezés nélküli hozzáférés a hiá... |
| `accounty_retention_rules` | 📘 eaisyBooks — Adó & Jogi | 8 |  |
| `accounty_sites` | 📘 eaisyBooks — Szervezet | 1 |  |
| `accounty_tao_yearly` | 📘 eaisyBooks — Adó & Jogi | 1 | TAO modul éves adókalkuláció. 11 lépéses wizard állapot és minden számított m... |
| `accounty_tax_parameters` | 📘 eaisyBooks — Adó & Jogi | 72 | Központi adómérték és küszöb paraméterek: évente frissítendő, a taxEngine.ts ... |
| `accounty_tax_params_global` | 📘 eaisyBooks — Adó & Jogi | 18 |  |
| `accounty_tax_profiles` | 📘 eaisyBooks — Alap | 28 | Cég adózási profil: ÁFA gyakoriság, járulék gyakoriság, KATA/KIVA státusz. 1:... |
| `accounty_template_versions` | 📘 eaisyBooks — Alap | 0 |  |
| `accounty_templates` | 📘 eaisyBooks — Alap | 0 |  |
| `accounty_timesheets` | 📘 eaisyBooks — Bérszámfejtés | 0 | Jelenléti ívek feldolgozása OCR/AI-val. A kinyert adatok a payroll_items-be k... |
| `accounty_transfers` | 📘 eaisyBooks — Szervezet | 3 |  |
| `accounty_uploads` | 📘 eaisyBooks — Alap | 3 |  |
| `accounty_year_end_tasks` | 📘 eaisyBooks — Szervezet | 0 |  |
| `annual_report_notes_templates` | 📋 Éves Beszámoló & ÁFA | 19 |  |
| `annual_reports` | 📋 Éves Beszámoló & ÁFA | 4 |  |
| `api_keys` | 🛠️ Platform & Üzemeltetés | 1 | API kulcsok külső integrációkhoz (OpenClaw). A nyers kulcs soha nem tárolódik... |
| `app_error_logs` | 🛠️ Platform & Üzemeltetés | 0 |  |
| `asset_events` | 📦 Tárgyi Eszközök | 35 |  |
| `audit_logs` | 🛠️ Platform & Üzemeltetés | 5956 |  |
| `bank_statement_uploads` | 💳 Tranzakciók & Bank | 0 |  |
| `bank_statements` | 💳 Tranzakciók & Bank | 0 |  |
| `bank_transactions` | 💳 Tranzakciók & Bank | 0 |  |
| `bs_mapping` | 📋 Éves Beszámoló & ÁFA | 586 |  |
| `bs_prior_year` | 📋 Éves Beszámoló & ÁFA | 0 |  |
| `bs_structure` | 📋 Éves Beszámoló & ÁFA | 94 |  |
| `categories` | 🏷️ Törzsadatok | 24 |  |
| `chart_of_accounts_presets` | 📊 Főkönyv (General Ledger) | 5 |  |
| `cmr_documents` | ❓ Uncategorized | ? |  |
| `companies` | 🏢 Cégek & Tagság | 31 |  |
| `company_fx_settings` | 🏢 Cégek & Tagság | 0 |  |
| `company_locations` | 🏢 Cégek & Tagság | 6 |  |
| `company_members` | 🏢 Cégek & Tagság | 49 |  |
| `company_settings` | 🏢 Cégek & Tagság | 1 |  |
| `courier_reports` | 🏷️ Törzsadatok | 44 |  |
| `daily_exchange_rates` | 🛠️ Platform & Üzemeltetés | 4706 |  |
| `dunning_sends` | 🛠️ Platform & Üzemeltetés | 7 |  |
| `eaisybill_module_permissions` | 🔑 Jogosultságok & Hozzáférés | 15 | Per-user, per-company module access overrides for eaisybill. Managed by compa... |
| `egyszerusitett_szamla_backup` | 📄 Számlák | 0 |  |
| `email_aliases` | 🛠️ Platform & Üzemeltetés | 12 |  |
| `employee_rates` | 💰 Bér & Munkaidő | 14 |  |
| `feedback` | 🛠️ Platform & Üzemeltetés | 15 |  |
| `fixed_assets` | 📦 Tárgyi Eszközök | 30 |  |
| `gl_accounts` | 📊 Főkönyv (General Ledger) | 3921 |  |
| `gl_audit_accounts` | 📊 Főkönyv (General Ledger) | 661 |  |
| `gl_audit_imports` | 📊 Főkönyv (General Ledger) | 1 |  |
| `gl_audit_partners` | 📊 Főkönyv (General Ledger) | 3784 |  |
| `gl_journal_entries` | 📊 Főkönyv (General Ledger) | 71261 |  |
| `gl_overrides_log` | 📊 Főkönyv (General Ledger) | 76 |  |
| `gl_upload_notifications` | 📊 Főkönyv (General Ledger) | 705 |  |
| `hp_settings` | 🏦 Házipénztár | 2 |  |
| `invoice_items` | 📄 Számlák | 3024 |  |
| `invoice_uploads` | 📄 Számlák | 2055 |  |
| `invoices` | 📄 Számlák | 1115 |  |
| `leave_requests` | 💰 Bér & Munkaidő | 0 |  |
| `llm_koltsegek` | 🛠️ Platform & Üzemeltetés | 1275 | LLM token-használat és költségek nyomonkövetése fájl-feldolgozásonként |
| `match_transaction_overrides_log` | 💳 Tranzakciók & Bank | 0 |  |
| `nav_invoice_items` | 🏛️ NAV Integráció | 42696 |  |
| `nav_invoices` | 🏛️ NAV Integráció | 9229 |  |
| `nav_sync_logs` | 🏛️ NAV Integráció | 1891 |  |
| `nylas_tokens` | 🔐 Auth & Felhasználók | 0 |  |
| `outgoing_emails` | 🛠️ Platform & Üzemeltetés | 21 |  |
| `partners` | 🏷️ Törzsadatok | 1151 |  |
| `petty_cash_entries` | 🏦 Házipénztár | 34 |  |
| `petty_cash_opening_balances` | 🏦 Házipénztár | 2 |  |
| `petty_cash_registers` | 🏦 Házipénztár | 2 |  |
| `petty_cash_routing_rules` | 🏦 Házipénztár | 0 |  |
| `pnl_mapping` | 📋 Éves Beszámoló & ÁFA | 240 |  |
| `pnl_structure` | 📋 Éves Beszámoló & ÁFA | 14 |  |
| `profiles` | 🔐 Auth & Felhasználók | 56 |  |
| `proforma_backup` | 📄 Számlák | 0 |  |
| `project_labor_costs` | ❓ Uncategorized | ? |  |
| `projects` | 🏷️ Törzsadatok | 22 |  |
| `report_uploads` | 🏷️ Törzsadatok | 6 |  |
| `reverse_charge_entries` | 🏷️ Törzsadatok | 0 |  |
| `salary` | 💰 Bér & Munkaidő | 99 |  |
| `salary_files` | 💰 Bér & Munkaidő | 7 |  |
| `settings` | 🔐 Auth & Felhasználók | 10 |  |
| `shipment_import_batches` | 🚚 Szállítmányozás | 1 |  |
| `shipment_matches` | 🚚 Szállítmányozás | 1 |  |
| `shipments` | 🚚 Szállítmányozás | 80 |  |
| `sima_szamla_backup` | 📄 Számlák | 0 |  |
| `szep_card_transactions` | 💳 Tranzakciók & Bank | 57 |  |
| `tao_depreciation_templates` | 📦 Tárgyi Eszközök | 11 |  |
| `tax` | 🏷️ Törzsadatok | 1 |  |
| `ticket_comments` | 🎫 Hibajegy Rendszer | 8 |  |
| `ticket_events` | 🎫 Hibajegy Rendszer | 20 |  |
| `ticket_reads` | 🎫 Hibajegy Rendszer | 3 |  |
| `time_entries` | 💰 Bér & Munkaidő | 82 |  |
| `transaction_invoice_matches` | 💳 Tranzakciók & Bank | 3 |  |
| `transaction_uploads` | 💳 Tranzakciók & Bank | 291 |  |
| `transactions` | 💳 Tranzakciók & Bank | 3056 |  |
| `transport_documents` | 🚚 Szállítmányozás | 9 |  |
| `user_company_access_cache` | 🔑 Jogosultságok & Hozzáférés | 111 | Unified access cache: combines company_members and accounty_assignments into ... |
| `user_email_preferences` | 🔐 Auth & Felhasználók | 54 |  |
| `user_nav_credentials` | 🔐 Auth & Felhasználók | 11 |  |
| `user_subscriptions` | 🔐 Auth & Felhasználók | 56 |  |
| `vat_codes` | 📊 Főkönyv (General Ledger) | 45 |  |
| `vat_form_rows` | 📋 Éves Beszámoló & ÁFA | 90 |  |
| `vat_return_lines` | 📋 Éves Beszámoló & ÁFA | 219 |  |
| `vat_return_m_lines` | 📋 Éves Beszámoló & ÁFA | 69 |  |
| `vat_returns` | 📋 Éves Beszámoló & ÁFA | 22 |  |
| `vegszamla_backup` | 📄 Számlák | 0 |  |

---

## Kapcsolódó Dokumentáció

- [A-019: Management Dashboard](./decisions/A-019-management-dashboard.md) — Adatforrás referencia
- [A-003: Multi-tenancy RLS](./decisions/A-003-multi-tenancy-rls.md) — RLS policy-k
- [A-016: PostgreSQL Query Strategy](./decisions/A-016-postgresql-query-strategy.md) — RPC function-ök
