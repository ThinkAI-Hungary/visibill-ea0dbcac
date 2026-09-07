# eaisybill-prod — Adatbázis Séma Áttekintés

> **Utoljára frissítve:** 2026-09-07  
> **Összesen:** 180 aktív alkalmazás-tábla (181 sémában) | **RLS:** mind engedélyezve (100% InitPlan & Single-Permissive optimalizált) | **FK Indexek:** 100% lefedettség | **Supabase PostgreSQL**

Ez a dokumentáció az eaisybill-prod Supabase projekt teljes adatbázis sémáját tartalmazza. Célja, hogy bármely fejlesztő és AI agent azonnal megértse a táblastruktúrát, kapcsolatokat és felhasználási kontextust.
A kapcsolódó adatbázis eljárások és szerveroldali logikák részleteit a [PostgreSQL RPC Katalógus](./rpc-catalog.md), a serverless függvényeket az [Edge Functions Katalógus](./edge-functions.md), a biztonsági és indexelési irányelveket pedig az [A-092: Teljes Adatbázis Biztonsági és Teljesítménybeli Audit & Optimalizáció](./decisions/A-092-database-security-and-performance-optimization.md) dokumentálja.

---

## Tartalomjegyzék

- [🔐 Auth & Felhasználók](./database/01-auth-users.md) — 6 tábla, ~73 sor
- [🏢 Cégek & Tagság](./database/02-companies.md) — 8 tábla, ~122 sor
- [🔑 Jogosultságok & Hozzáférés](./database/03-permissions.md) — 3 tábla, ~189 sor
- [📄 Számlák & Bizonylatok](./database/04-invoices.md) — 8 tábla, ~30556 sor
- [🏛️ NAV Integráció](./database/05-nav.md) — 3 tábla, ~164208 sor
- [💳 Tranzakciók & Bank](./database/06-transactions-bank.md) — 10 tábla, ~7945 sor
- [📊 Főkönyv (General Ledger)](./database/07-general-ledger.md) — 9 tábla, ~30771 sor
- [💰 Bér & Munkaidő](./database/08-salary-hr.md) — 5 tábla, ~341 sor
- [🏦 Házipénztár](./database/09-petty-cash.md) — 5 tábla, ~1227 sor
- [📦 Tárgyi Eszközök](./database/10-assets.md) — 3 tábla, ~0 sor
- [🚚 Szállítmányozás](./database/11-shipping.md) — 4 tábla, ~0 sor
- [📋 Éves Beszámoló & ÁFA](./database/12-annual-reports.md) — 11 tábla, ~1934 sor
- [📘 eaisyBooks — Alap](./database/13-eaisybooks-core.md) — 16 tábla, ~26176 sor
- [📘 eaisyBooks — Bérszámfejtés](./database/14-eaisybooks-payroll.md) — 14 tábla, ~174 sor
- [📘 eaisyBooks — Adó & Jogi](./database/15-eaisybooks-tax-legal.md) — 10 tábla, ~11 sor
- [📘 eaisyBooks — Szervezet](./database/16-eaisybooks-org.md) — 10 tábla, ~21 sor
- [📘 eaisyBooks — EV (Egyéni Vállalkozó)](./database/17-eaisybooks-ev.md) — 23 tábla, ~2 sor
- [📘 eaisyBooks — AI Chat](./database/18-eaisybooks-ai.md) — 2 tábla, ~124 sor
- [🛠️ Platform & Üzemeltetés](./database/19-platform-ops.md) — 12 tábla, ~36622 sor
- [🎫 Hibajegy Rendszer](./database/20-tickets.md) — 3 tábla, ~633 sor
- [🏷️ Törzsadatok](./database/21-master-data.md) — 8 tábla, ~5483 sor
- [📄 Könyvelési Naplók](./database/22-accounting-journals.md) — 6 tábla, ~58702 sor

**Kiegészítő katalógusok:**
- [⚡ PostgreSQL RPC Katalógus (132 RPC + 72 Trigger)](./rpc-catalog.md) — Teljes tárolt eljárás és aggregációs motor katalógus
- [🌐 Supabase Edge Functions Katalógus (59 Deno EF)](./edge-functions.md) — NAV szinkron, email, AI és webhook szervermentes funkciók

---

## Összes Tábla (ABC rendben)

| Tábla | Csoport | Sorok | Leírás |
|-------|---------|-------|--------|
| `acc_accounting_periods` | 📄 Könyvelési Naplók | 0 | Havi/éves könyvelési időszakok zártsági állapota |
| `acc_journal_audit_logs` | 📄 Könyvelési Naplók | 40943 | Könyvelési naplófej és tételsor audit napló |
| `acc_journal_counters` | 📄 Könyvelési Naplók | 12 | Naplónkénti és évenkénti ugrásmentes folyósorszámláló |
| `acc_journal_headers` | 📄 Könyvelési Naplók | 5508 | Könyvelési bizonylat fejadatok, dátumok, bizonylatszám, státusz |
| `acc_journal_lines` | 📄 Könyvelési Naplók | 12082 | Kettős könyvviteli tételsorok (T/K, összegek, ÁFA, projekt) |
| `acc_journals` | 📄 Könyvelési Naplók | 157 | Céghez tartozó naplótörzs (Vevő, Szállító, Bank, Pénztár, Vegyes, Bér, Nyitó, Záró) |
| `accounty_ai_chat_messages` | 📘 eaisyBooks — AI Chat | 116 | Individual messages within an AI chat session. Ordered by created_at. |
| `accounty_ai_chat_sessions` | 📘 eaisyBooks — AI Chat | 8 | AI Assistant chat sessions per user. |
| `accounty_assignments` | 📘 eaisyBooks — Alap | 93 | Könyvelő-felhasználó ↔ ügyfélcég hozzárendelés. |
| `accounty_audit_log` | 📘 eaisyBooks — Alap | 0 | Iroda szintű műveleti napló. |
| `accounty_cafeteria` | 📘 eaisyBooks — Bérszámfejtés | 2 | Cafeteria-elszámolás: SZÉP-kártya, lakhatás, ajándék. |
| `accounty_cegkapu_settings` | 📘 eaisyBooks — Adó & Jogi | 1 | Cégkapu / KÜNY tárhely integráció. |
| `accounty_communication_preferences` | 📘 eaisyBooks — Alap | 48 | Ügyfélcég kommunikációs és értesítési beállításai. |
| `accounty_condo_funds` | 📘 eaisyBooks — Szervezet | 0 | Társasházi céltartalék és felújítási alapok. |
| `accounty_condo_maintenance` | 📘 eaisyBooks — Szervezet | 0 | Társasházi karbantartási napló. |
| `accounty_condo_units` | 📘 eaisyBooks — Szervezet | 0 | Társasházi albetétek és tulajdonosok. |
| `accounty_cost_centers` | 📘 eaisyBooks — Szervezet | 0 | Költséghelyek nyilvántartása. |
| `accounty_data_contracts` | 📘 eaisyBooks — Adó & Jogi | 0 | Adatfeldolgozási és könyvelési szerződések. |
| `accounty_deadlines` | 📘 eaisyBooks — Alap | 3728 | Könyvelési és adóügyi határidők cégenként. |
| `accounty_declarations` | 📘 eaisyBooks — Bérszámfejtés | 0 | Adóelőleg-nyilatkozatok kedvezmény-típusonként. |
| `accounty_departments` | 📘 eaisyBooks — Szervezet | 5 | Szervezeti egységek. |
| `accounty_dependents` | 📘 eaisyBooks — Bérszámfejtés | 0 | Eltartottak és kedvezményezett gyermekek nyilvántartása. |
| `accounty_documents` | 📘 eaisyBooks — Alap | 53 | Ügyfél dokumentumtár. |
| `accounty_email_preferences` | 📘 eaisyBooks — Alap | 0 | Ügyfélcég specifikus email és értesítési küldési preferenciák. |
| `accounty_employee_jobs` | 📘 eaisyBooks — Bérszámfejtés | 0 | Foglalkoztatotti munkakörök és FEOR kódok. |
| `accounty_employees` | 📘 eaisyBooks — Bérszámfejtés | 28 | Bérszámfejtési modul foglalkoztatottak törzstáblája. |
| `accounty_employments` | 📘 eaisyBooks — Bérszámfejtés | 28 | Jogviszonyok és bérparaméterek. |
| `accounty_ev_audit_log` | 📘 eaisyBooks — EV | 0 | EV modul audit napló. |
| `accounty_ev_chamber_payments` | 📘 eaisyBooks — EV | 0 | Kamarai hozzájárulások nyilvántartása. |
| `accounty_ev_client_settings` | 📘 eaisyBooks — EV | 1 | EV ügyfél specifikus adózási beállítások. |
| `accounty_ev_contribution_calc` | 📘 eaisyBooks — EV | 0 | EV TB és szocho negyedéves kalkuláció. |
| `accounty_ev_hipa_calc` | 📘 eaisyBooks — EV | 0 | HIPA adókalkuláció. |
| `accounty_ev_lifecycle_events` | 📘 eaisyBooks — EV | 0 | EV életút események (alapítás, szüneteltetés). |
| `accounty_ev_records_consignment` | 📘 eaisyBooks — EV | 0 | Bizományosi nyilvántartás. |
| `accounty_ev_records_fixed_assets` | 📘 eaisyBooks — EV | 0 | Tárgyi eszköz nyilvántartás (EV). |
| `accounty_ev_records_inventory` | 📘 eaisyBooks — EV | 0 | Készletnyilvántartás (EV). |
| `accounty_ev_records_investments` | 📘 eaisyBooks — EV | 0 | Beruházási nyilvántartás. |
| `accounty_ev_records_other_claims` | 📘 eaisyBooks — EV | 0 | Egyéb követelések. |
| `accounty_ev_records_payables` | 📘 eaisyBooks — EV | 0 | Szállítói kötelezettségek (EV). |
| `accounty_ev_records_receivables` | 📘 eaisyBooks — EV | 0 | Vevői követelések (EV). |
| `accounty_ev_records_scrapping` | 📘 eaisyBooks — EV | 0 | Selejtezési jegyzőkönyvek. |
| `accounty_ev_records_securities` | 📘 eaisyBooks — EV | 0 | Értékpapír nyilvántartás. |
| `accounty_ev_records_strict_forms` | 📘 eaisyBooks — EV | 0 | Szigorú számadású bizonylatok. |
| `accounty_ev_records_subcontractors` | 📘 eaisyBooks — EV | 0 | Alvállalkozói teljesítések. |
| `accounty_ev_records_vehicle_log` | 📘 eaisyBooks — EV | 0 | Útnyilvántartás és gépjárműhasználat. |
| `accounty_ev_records_wages` | 📘 eaisyBooks — EV | 0 | Bér és járulék nyilvántartás (EV). |
| `accounty_ev_tax_returns` | 📘 eaisyBooks — EV | 1 | EV adóbevallások. |
| `accounty_ev_vat_returns` | 📘 eaisyBooks — EV | 0 | EV ÁFA analitika és bevallások. |
| `accounty_filings` | 📘 eaisyBooks — Adó & Jogi | 0 | NAV bevallások és bejelentések. |
| `accounty_garnishments` | 📘 eaisyBooks — Bérszámfejtés | 0 | Bérletiltások (Vht. 65.§). |
| `accounty_gdpr_requests` | 📘 eaisyBooks — Alap | 0 | GDPR kérelmek nyilvántartása. |
| `accounty_global_tax_params` | 📘 eaisyBooks — Adó & Jogi | 0 | Globális adómértékek és küszöbök. |
| `accounty_job_codes` | 📘 eaisyBooks — Bérszámfejtés | 0 | NAV jogviszonykódok master táblája. |
| `accounty_job_modifications` | 📘 eaisyBooks — Bérszámfejtés | 0 | Munkaszerződés módosítások. |
| `accounty_leaves` | 📘 eaisyBooks — Bérszámfejtés | 0 | Szabadság és távollét nyilvántartás. |
| `accounty_legal_updates` | 📘 eaisyBooks — Adó & Jogi | 0 | Jogszabályváltozások hírfolyama. |
| `accounty_messages` | 📘 eaisyBooks — Alap | 0 | Belső üzenetek könyvelő és ügyfél között. |
| `accounty_missing_items` | 📘 eaisyBooks — Alap | 22208 | Hiányzó számlák és bankkivonatok listája. |
| `accounty_module_permissions` | 🔑 Jogosultságok | 0 | eaisyBooks modulonkénti jogosultságok. |
| `accounty_nav_representations` | 📘 eaisyBooks — Adó & Jogi | 0 | Meghatalmazások és EGYKE nyilvántartás. |
| `accounty_office_settings` | 📘 eaisyBooks — Szervezet | 2 | Iroda általános működési beállításai. |
| `accounty_org_report_lines` | 📘 eaisyBooks — Szervezet | 0 | Egyszerűsített beszámoló tételsorok. |
| `accounty_payroll_calculations` | 📘 eaisyBooks — Bérszámfejtés | 96 | Havi bérszámfejtési kalkulációs eredmények. |
| `accounty_payroll_cycles` | 📘 eaisyBooks — Bérszámfejtés | 18 | Havi bérszámfejtési ciklusok. |
| `accounty_payroll_items` | 📘 eaisyBooks — Bérszámfejtés | 2 | Bérelemek jogviszonyonként. |
| `accounty_penztarkonyv_period_close` | 📘 eaisyBooks — EV | 0 | Pénztárkönyv időszaki zárások. |
| `accounty_penztarkonyv_tetel` | 📘 eaisyBooks — EV | 0 | Pénztárkönyv egyszeres könyvviteli tételek. |
| `accounty_portal_tokens` | 📘 eaisyBooks — Alap | 29 | Magic link ügyfélportál belépési tokenek. |
| `accounty_push_preferences` | 📘 eaisyBooks — Alap | 1 | Web push értesítési preferenciák. |
| `accounty_push_subscriptions` | 📘 eaisyBooks — Alap | 0 | VAPID push feliratkozási tokenek. |
| `accounty_retention_rules` | 📘 eaisyBooks — Adó & Jogi | 8 | Adatmegőrzési és selejtezési szabályok. |
| `accounty_sites` | 📘 eaisyBooks — Szervezet | 1 | Telephelyek és fióktelepek. |
| `accounty_tao_yearly` | 📘 eaisyBooks — Adó & Jogi | 2 | TAO éves adókalkuláció. |
| `accounty_tax_parameters` | 📘 eaisyBooks — Adó & Jogi | 0 | Adómértékek és küszöbök. |
| `accounty_tax_params_global` | 📘 eaisyBooks — Adó & Jogi | 0 | Globális adókulcsok. |
| `accounty_tax_profiles` | 📘 eaisyBooks — Alap | 16 | Cég adózási profilja (ÁFA, KATA, KIVA). |
| `accounty_template_versions` | 📘 eaisyBooks — Alap | 0 | Dokumentum sablon verziók. |
| `accounty_templates` | 📘 eaisyBooks — Alap | 0 | Sablonok nyilvántartása. |
| `accounty_timesheets` | 📘 eaisyBooks — Bérszámfejtés | 0 | Jelenléti ívek és munkaidő adatok. |
| `accounty_transfers` | 📘 eaisyBooks — Szervezet | 13 | Belső pénzmozgások. |
| `accounty_uploads` | 📘 eaisyBooks — Alap | 0 | Ügyfél által feltöltött dokumentumok. |
| `accounty_year_end_tasks` | 📘 eaisyBooks — Szervezet | 0 | Év végi zárási ellenőrzőlista feladatai. |
| `accrual_entries` | 📊 Főkönyv | 0 | Időbeli elhatárolások nyilvántartása. |
| `annual_report_notes_templates` | 📋 Éves Beszámoló & ÁFA | 0 | Kiegészítő melléklet szöveges sablonok. |
| `annual_reports` | 📋 Éves Beszámoló & ÁFA | 1 | Éves beszámolók állapota és véglegesített adatai. |
| `api_keys` | 🛠️ Platform & Üzemeltetés | 0 | OpenClaw külső REST API hozzáférési kulcsok. |
| `app_error_logs` | 🛠️ Platform & Üzemeltetés | 4 | Rendszer szintű hibalogok. |
| `asset_events` | 📦 Tárgyi Eszközök | 0 | Értékcsökkenési és aktiválási események. |
| `audit_logs` | 🛠️ Platform & Üzemeltetés | 17938 | Általános rendszer audit napló. |
| `bank_statement_uploads` | 💳 Tranzakciók & Bank | 5 | Bankkivonat fájlfeltöltések. |
| `bank_statements` | 💳 Tranzakciók & Bank | 0 | Kivonatok fejléc adatai. |
| `bank_transactions` | 💳 Tranzakciók & Bank | 0 | Kivonat tételsorok. |
| `bs_mapping` | 📋 Éves Beszámoló & ÁFA | 976 | Mérleg főkönyvi számla összerendelések. |
| `bs_prior_year` | 📋 Éves Beszámoló & ÁFA | 0 | Mérleg előző évi adatai. |
| `bs_structure` | 📋 Éves Beszámoló & ÁFA | 0 | Mérleg hierarchikus sorszerkezete. |
| `categories` | 🏷️ Törzsadatok | 43 | Költség és bevétel kategóriák. |
| `chart_of_accounts_presets` | 📊 Főkönyv | 31 | Számlatükör sablonok (KKV, EV, stb.). |
| `companies` | 🏢 Cégek & Tagság | 13 | Cégek törzsadatai. |
| `company_bank_accounts` | 🏢 Cégek & Tagság | 2 | Cég saját bankszámlái kimenő/bejövő utalásokhoz. |
| `company_email_accounts` | 🏢 Cégek & Tagság | 0 | Többprofilos IMAP/SMTP fiókok titkosított Vault jelszavakkal. |
| `company_email_settings` | 🏢 Cégek & Tagság | 8 | *(Legacy)* Régi egyrekordos levelezési beállítás. |
| `company_fx_settings` | 🏢 Cégek & Tagság | 0 | Devizaárfolyam forrás beállítások. |
| `company_locations` | 🏢 Cégek & Tagság | 0 | Telephelyek és székhelyek. |
| `company_members` | 🏢 Cégek & Tagság | 95 | Felhasználói tagságok és szerepkörök. |
| `company_prompt_rules` | 🛠️ Platform & Üzemeltetés | 3 | Cégenkénti testreszabott LLM prompt szabályok és instrukciók (A-079). |
| `company_settings` | 🏢 Cégek & Tagság | 4 | Cég általános működési beállításai. |
| `courier_reports` | 🏷️ Törzsadatok | 113 | Futárszolgálati elszámolások (GLS, MPL, FoxPost). |
| `daily_exchange_rates` | 🛠️ Platform & Üzemeltetés | 5395 | MNB napi hivatalos devizaárfolyamok. |
| `dunning_sends` | 🛠️ Platform & Üzemeltetés | 0 | Kiküldött fizetési felszólítások naplója. |
| `eaisybill_module_permissions` | 🔑 Jogosultságok | 0 | eaisybill modulonkénti felhasználói engedélyek. |
| `egyszerusitett_szamla_backup` | 📄 Számlák | 0 | Backup tábla. |
| `email_aliases` | 🛠️ Platform & Üzemeltetés | 12 | Céges bejövő számla email aliasok. |
| `employee_rates` | 💰 Bér & Munkaidő | 50 | Alkalmazotti óradíjak és bérkategóriák. |
| `feedback` | 🛠️ Platform & Üzemeltetés | 71 | Felhasználói visszajelzések és hibajelentések. |
| `fixed_assets` | 📦 Tárgyi Eszközök | 0 | Tárgyi eszközök törzsadatai és projekt FK. |
| `gl_accounts` | 📊 Főkönyv | 20853 | Számlatükör főkönyvi számlái. |
| `gl_audit_accounts` | 📊 Főkönyv | 116 | Importált főkönyvi számlák. |
| `gl_audit_imports` | 📊 Főkönyv | 3 | XML főkönyvi import kötegek. |
| `gl_audit_partners` | 📊 Főkönyv | 352 | Importált partnerek. |
| `gl_journal_entries` | 📊 Főkönyv | 4805 | Főkönyvi tételek analitikája. |
| `gl_overrides_log` | 📊 Főkönyv | 350 | Kézi GL besorolás felülbírálási napló. |
| `gl_upload_notifications` | 📊 Főkönyv | 2950 | Főkönyvi import értesítések. |
| `hp_settings` | 🏦 Házipénztár | 0 | Házipénztár beállítások és határértékek. |
| `invoice_items` | 📄 Számlák | 17473 | Feltöltött számlák tételsorai (ÁFA, GL, projekt, jegyzet). |
| `invoice_uploads` | 📄 Számlák | 7186 | Számlafeltöltési kötegek és fájlok. |
| `invoices` | 📄 Számlák | 5897 | Feltöltött számlák fejadatai (OCR/AI feldolgozva). |
| `invoices_vat_audit_backup_20260907` | 🛠️ Platform & Üzemeltetés | 67 | Ideiglenes ÁFA audit biztonsági mentés tábla (2026-09-07). |
| `item_project_rules` | 🏷️ Törzsadatok | 0 | Tételszintű automatikus projekt-hozzárendelési szabályok. |
| `leave_requests` | 💰 Bér & Munkaidő | 0 | Szabadságkérelmek munkaidő modulban. |
| `llm_koltsegek` | 🛠️ Platform & Üzemeltetés | 11888 | LLM token-használat és költségek tracking. |
| `match_transaction_overrides_log` | 💳 Tranzakciók & Bank | 4 | Tranzakció párosítás felülbírálási audit log. |
| `nav_invoice_items` | 🏛️ NAV Integráció | 126402 | NAV-ból szinkronizált számlák tételei (GL, projekt, jegyzet). |
| `nav_invoices` | 🏛️ NAV Integráció | 32524 | NAV Online Számla rendszerből érkező számlák. |
| `nav_sync_logs` | 🏛️ NAV Integráció | 5282 | NAV szinkronizációs folyamat logjai. |
| `notes` | 📋 Jegyzetek | 0 | Kétpaneles megosztott és belső céges jegyzetek. |
| `nylas_tokens` | 🔐 Auth & Felhasználók | 0 | Nylas OAuth tokenek. |
| `outgoing_emails` | 🛠️ Platform & Üzemeltetés | 1 | Rendszer által kiküldött emailek naplója. |
| `partners` | 🏷️ Törzsadatok | 5186 | Partnertörzs (vevők és szállítók adatai). |
| `payment_transfers` | 💳 Tranzakciók & Bank | 0 | Banki utalási csomagok (GIRO/OTP/SEPA) és állapotuk. |
| `pdf_export_jobs` | 🛠️ Platform & Üzemeltetés | 0 | Aszinkron PDF export feladatok és letöltési linkek. |
| `petty_cash_entries` | 🏦 Házipénztár | 1224 | Házipénztár bevételek és kiadások. |
| `petty_cash_opening_balances` | 🏦 Házipénztár | 0 | Házipénztári nyitóegyenlegek. |
| `petty_cash_registers` | 🏦 Házipénztár | 3 | Pénztárkasszák nyilvántartása devizánként. |
| `petty_cash_routing_rules` | 🏦 Házipénztár | 0 | Tranzakció-pénztár elosztási szabályok. |
| `pnl_mapping` | 📋 Éves Beszámoló & ÁFA | 0 | Eredménykimutatás főkönyvi összerendelések. |
| `pnl_structure` | 📋 Éves Beszámoló & ÁFA | 0 | Eredménykimutatás sorszerkezete. |
| `profiles` | 🔐 Auth & Felhasználók | 7 | Felhasználói profilok és beállítások. |
| `proforma_backup` | 📄 Számlák | 0 | Backup tábla. |
| `projects` | 🏷️ Törzsadatok | 36 | Projektek törzsadatai és költségkeretei. |
| `report_uploads` | 🏷️ Törzsadatok | 105 | Riport feltöltések. |
| `reverse_charge_entries` | 🏷️ Törzsadatok | 0 | Fordított adózású tételek. |
| `salary` | 💰 Bér & Munkaidő | 177 | Béradatok és levonások. |
| `salary_files` | 💰 Bér & Munkaidő | 6 | Bérjegyzék fájlok. |
| `settings` | 🔐 Auth & Felhasználók | 5 | Globális felhasználói beállítások. |
| `shipment_import_batches` | 🚚 Szállítmányozás | 0 | Fuvarlevél import kötegek. |
| `shipment_matches` | 🚚 Szállítmányozás | 0 | Fuvar ↔ számla összerendelések. |
| `shipments` | 🚚 Szállítmányozás | 0 | Fuvarok és szállítási megbízások. |
| `sima_szamla_backup` | 📄 Számlák | 0 | Backup tábla. |
| `szep_card_transactions` | 💳 Tranzakciók & Bank | 0 | SZÉP kártya tranzakciók. |
| `tao_depreciation_templates` | 📦 Tárgyi Eszközök | 0 | TAO értékcsökkenési kulcs sablonok. |
| `tax` | 🏷️ Törzsadatok | 0 | Adókulcsok. |
| `ticket_comments` | 🎫 Hibajegy Rendszer | 102 | Hibajegy hozzászólások. |
| `ticket_events` | 🎫 Hibajegy Rendszer | 342 | Hibajegy állapotváltozási események. |
| `ticket_reads` | 🎫 Hibajegy Rendszer | 189 | Olvasottsági jelzők. |
| `time_entries` | 💰 Bér & Munkaidő | 108 | Munkaidő bejegyzések dolgozónként. |
| `transaction_invoice_matches` | 💳 Tranzakciók & Bank | 4 | Tranzakció ↔ Számla manuális/automatikus kötések. |
| `transaction_rules` | 💳 Tranzakciók & Bank | 0 | Automatikus tranzakció-kategorizálási szabályok. |
| `transaction_uploads` | 💳 Tranzakciók & Bank | 546 | Bankkivonat és tranzakció feltöltési kötegek. |
| `transactions` | 💳 Tranzakciók & Bank | 7386 | Banki tranzakciók és jóváírások/terhelések. |
| `transport_documents` | 🚚 Szállítmányozás | 0 | Fuvarozási és szállítmányozási dokumentumok. |
| `user_company_access_cache` | 🔑 Jogosultságok | 189 | Cég-felhasználó hozzáférési gyorsítótár RLS-hez. |
| `user_email_preferences` | 🔐 Auth & Felhasználók | 7 | Email értesítési preferenciák. |
| `user_nav_credentials` | 🔐 Auth & Felhasználók | 47 | Titkosított NAV API belépési adatok. |
| `user_subscriptions` | 🔐 Auth & Felhasználók | 7 | Felhasználói hozzáférési állapotok. |
| `vat_codes` | 📊 Főkönyv | 1311 | ÁFA kulcsok és számlatükör kódok. |
| `vat_form_rows` | 📋 Éves Beszámoló & ÁFA | 0 | ÁFA bevallás hivatalos nyomtatvány sorai. |
| `vat_return_lines` | 📋 Éves Beszámoló & ÁFA | 661 | Számított ÁFA bevallás sorai. |
| `vat_return_m_lines` | 📋 Éves Beszámoló & ÁFA | 242 | ÁFA M-lapos partnerenkénti összesítők. |
| `vat_returns` | 📋 Éves Beszámoló & ÁFA | 54 | Havi/negyedéves/éves ÁFA bevallások állapota. |
| `vegszamla_backup` | 📄 Számlák | 0 | Backup tábla. |
| `worker_heartbeats` | 🛠️ Platform & Üzemeltetés | 1310 | Python worker healthcheck és pipeline liveness heartbeat telemetria. |

---

> ℹ️ *A fenti táblázat az éles PostgreSQL adatbázis közvetlen lekérdezése (`information_schema` és `pg_class`) alapján lett szinkronizálva. A sorok száma a 2026-09-07-i állapotot tükrözi.*