# A-016: PostgreSQL Query Stratégia (RPC + PostgREST)

**Status:** Decided  
**Date:** 2025-Q3 (implementálva) → Folyamatosan bővül  
**Utoljára frissítve:** 2026-06-23

## Context

A Supabase PostgREST automatikusan REST API-t generál minden táblához. Egyszerű CRUD-hoz ez elegendő, de komplex aggregációkhoz, JOIN-okhoz, és batch műveletekhez korlátozott.

## Decision

**Kettős query stratégia:** PostgREST direkt query + PostgreSQL RPC funkciók.

---

### 1. PostgREST Direkt Query (egyszerű CRUD)

A frontend a `supabase-js` klienssel közvetlenül lekérdezi a táblákat:

```typescript
// SELECT — szűrőkkel, rendezéssel
const { data } = await supabase
  .from('invoices')
  .select('*, invoice_items(*)')
  .eq('company_id', companyId)
  .gte('invoice_date', dateFrom)
  .order('invoice_date', { ascending: false });

// INSERT / UPDATE / DELETE
await supabase.from('invoices').update({ status: 'verified' }).eq('id', invoiceId);
```

**Mikor használjuk:**
- Egyszerű tábla lekérdezés szűrőkkel
- Egy-rekord CRUD műveletek
- Kapcsolt táblák betöltése (`select('*, related_table(*)')`)

**Korlátai:**
- Max 1000 sor alapértelmezetten (`max_rows` limit)
- Nincs komplex aggregáció (SUM, GROUP BY, CASE WHEN)
- Nincs cross-table JOIN szűrés

---

### 2. Teljes RPC Function Katalógus

**Összesen: 79 function** a `public` sémában.

---

#### 📊 2.1 Frontend által hívott Query RPC-k

Komplex üzleti logikához — aggregációk, szűrt lapozott listák, report-ok.

| RPC Function | Security | Hívó | Cél |
|---|---|---|---|
| `get_pnl_report(p_company_id, p_preset_id, p_date_from?, p_date_to?, p_exchange_rates?)` | DEFINER | ProfitAndLoss.tsx | Eredménykimutatás aggregáció |
| `get_bs_report(p_company_id, p_preset_id, p_date_to?, p_fiscal_year?, p_exchange_rates?)` | DEFINER | BalanceSheet.tsx | Mérleg aggregáció |
| `get_gl_balances(p_company_id, p_preset_id, p_date_from?, p_date_to?, p_exchange_rates?)` | DEFINER | GeneralLedgerTable.tsx | Főkönyvi egyenlegek |
| `get_gl_categorized_items(p_company_id, p_preset_id, p_date_from?, p_date_to?, p_exchange_rates?)` | DEFINER | GeneralLedgerTable.tsx | GL drill-down tételek |
| `get_invoice_aggregates(p_company_id, p_date_from, p_date_to)` | DEFINER | useDashboardData.ts | Dashboard számla összesítők |
| `get_nav_invoice_aggregates(p_company_id, p_date_from, p_date_to)` | DEFINER | useDashboardData.ts | Dashboard NAV összesítők |
| `get_petty_cash_balance(p_company_id)` | DEFINER | useDashboardData.ts | Házipénztár egyenleg |
| `get_filtered_nav_invoices(p_company_id, p_date_from, p_date_to, p_direction, ...)` | DEFINER | useInvoiceFilters.ts | NAV számlák szűrt/lapozott lekérdezés |
| `get_filtered_nav_invoices(... + p_issue_date_from?, p_issue_date_to?)` | DEFINER | useInvoiceFilters.ts | ↑ Overload: kibocsátási dátum szűrővel |
| `get_filtered_submitted_invoices(p_company_id, p_date_from, p_date_to, p_direction, ...)` | DEFINER | useInvoiceFilters.ts | Feltöltött számlák szűrt/lapozott lekérdezés |
| `get_filtered_submitted_invoices(... + p_payment_method?, p_issue_date_from?, p_issue_date_to?)` | DEFINER | useInvoiceFilters.ts | ↑ Overload: fizetési mód + kibocsátási dátum szűrőkkel |
| `get_linked_invoices(p_company_id, p_seed_bizonylat[], p_seed_reference[], p_exclude_ids[])` | DEFINER | useInvoiceData.ts | Összekapcsolt számlák (végszámla ↔ díjbekérő) |
| `get_transaction_filter_options(p_company_id)` | DEFINER | useTransactionData.ts | Tranzakció szűrő dropdown értékek |
| `calculate_vat_return(p_company_id, p_year, p_month, p_frequency?)` | DEFINER | VatReturnPage.tsx | ÁFA bevallás kalkuláció |
| `freeze_annual_data(p_report_id, p_company_id, p_preset_id, p_fiscal_year, p_exchange_rates?)` | DEFINER | AnnualReportPage.tsx | Éves beszámoló zárolás |
| `validate_annual_report(p_report_id)` | DEFINER | AnnualReportPage.tsx | Éves beszámoló validáció |
| `rematch_courier_report(p_report_id)` | DEFINER | useCourierReportData.ts | Futárjelentés újrapárosítás |

#### ✏️ 2.2 Frontend által hívott Mutation RPC-k

| RPC Function | Security | Hívó | Cél |
|---|---|---|---|
| `save_pnl_mappings(p_company_id, p_preset_id, p_mappings)` | DEFINER | ProfitAndLoss.tsx | PnL GL mapping mentés |
| `save_bs_mappings(p_company_id, p_preset_id, p_mappings)` | DEFINER | BalanceSheet.tsx | Mérleg GL mapping mentés |
| `save_bs_prior_year(p_company_id, p_fiscal_year, p_data)` | DEFINER | BalanceSheet.tsx | Mérleg előző évi adatok mentés |
| `override_gl_classification(p_item_id, p_source_table, p_new_gl_account_id, ...)` | DEFINER | GeneralLedgerTable.tsx | Egyedi GL felülbírálás |
| `override_gl_classifications_batch(p_items, p_new_gl_account_id, ...)` | DEFINER | GeneralLedgerTable.tsx | Batch GL felülbírálás |
| `seed_default_vat_codes(p_company_id)` | INVOKER | VatReturnPage.tsx | ÁFA kódok inicializálás |
| `assign_supplier_default_projects(p_company_id)` | DEFINER | ProjectsPage.tsx | Szállítók alapértelmezett projektjének beállítása |

#### 🔑 2.3 Auth & Credential RPC-k

| RPC Function | Security | Hívó | Cél |
|---|---|---|---|
| `save_nav_credentials(p_nav_username, p_nav_password, p_nav_tax_number, ...)` | DEFINER | save-credentials EF | NAV credentials titkosított mentés |
| `get_nav_credentials(p_user_id, p_company_id?)` | DEFINER | query-nav-invoices EF | NAV credentials lekérés (feloldás) |
| `get_user_role(p_company_id)` | DEFINER | Frontend auth | Felhasználó szerepkör lekérdezése |
| `is_company_admin(p_company_id)` | DEFINER | RLS policy-k | Admin jogosultság ellenőrzés |
| `is_company_member_or_above(p_company_id)` | DEFINER | RLS policy-k | Member+ jogosultság ellenőrzés |
| `user_has_company_access(p_company_id)` | DEFINER | RLS policy-k | Céghez való hozzáférés ellenőrzés |
| `user_is_company_member(p_company_id)` | DEFINER | RLS policy-k | Cég tagság ellenőrzés |
| `check_request()` | DEFINER | PostgREST pre-request hook | Globális request validáció (rate limiting, auth check) |
| `increment_invoice_usage(user_uuid)` | DEFINER | Trigger / EF | Havi számlafeldolgozási kvóta növelése |
| `calculate_hourly_cost(p_base_salary, p_monthly_hours?)` | INVOKER | Frontend | Óradíj kalkuláció alapbérből |
| `generate_api_key(p_company_id?, p_name?)` | DEFINER | Frontend / SQL | API kulcs generálás külső integrációkhoz (SHA-256 hash, nyers kulcs csak egyszer jelenik meg) |
| `revoke_api_key(p_key_id)` | DEFINER | Frontend / SQL | API kulcs deaktiválása (is_active = false) |

#### 📬 2.4 PGMQ Wrapper RPC-k (Worker által hívott)

| RPC Function | Security | Hívó | Cél |
|---|---|---|---|
| `pgmq_read(queue_name, vt, qty?, max_poll_seconds?, poll_interval_ms?)` | DEFINER | pgmq_consumer.py | Queue olvasás (long polling) |
| `pgmq_archive(queue_name, msg_id)` | DEFINER | pgmq_consumer.py | Feldolgozott üzenet archiválás |
| `pgmq_delete(queue_name, msg_id)` | DEFINER | pgmq_consumer.py | Üzenet törlés |
| `pgmq_metrics(queue_name)` | DEFINER | pgmq_consumer.py | Queue statisztika (depth, oldest) |

#### 🤖 2.5 Worker-Only RPC-k

| RPC Function | Security | Hívó | Cél |
|---|---|---|---|
| `claim_invoice_jobs(p_batch_size?)` | DEFINER | invoice_pipeline.py | Invoice job-ok lefoglalása feldolgozásra |
| `claim_transaction_jobs(p_batch_size?)` | INVOKER | transaction_pipeline.py | Tranzakció job-ok lefoglalása |
| `claim_gl_jobs(p_batch_size?)` | INVOKER | gl_pipeline.py | GL kategorizálás job-ok lefoglalása |
| `auto_approve_high_confidence()` | DEFINER | Worker | Magas confidence-ű tételek auto-jóváhagyása |
| `auto_match_salary_transaction()` | DEFINER | Worker trigger | Bér-tranzakció automatikus párosítás |

#### 🏗️ 2.6 eaisyBooks / Management RPC-k

| RPC Function | Security | Hívó | Cél |
|---|---|---|---|
| `get_accounty_company_summary(p_user_id)` | DEFINER | eaisyBooks dashboard | Könyvelői cég összefoglaló |
| `get_accounty_company_names(p_company_ids[])` | DEFINER | eaisyBooks dashboard | Cégnevek batch lekérdezés |
| `get_user_emails_for_management(user_ids[])` | DEFINER | management-stats EF | Management email lekérdezés |

---

### 3. DB Trigger Function-ök (25 db)

#### 📋 3.1 Adat-integritás Trigger-ek

| Trigger Function | Tábla | Cél |
|---|---|---|
| `mark_nav_invoice_as_submitted()` | invoices | NAV számla submitted flag beállítás |
| `mark_nav_invoice_paid_on_transaction_match()` | transactions | NAV számla fizetett jelölés match-nél |
| `match_nav_invoice_on_insert()` | invoices | Új számla automatikus NAV párosítás |
| `reset_nav_submitted_on_invoice_delete()` | invoices | NAV submitted flag reset törléskor |
| `clear_transaction_match_on_invoice_delete()` | invoices | Tranzakció match törlése számla törlésnél |
| `reset_paid_on_transaction_delete()` | transactions | Fizetett flag reset tranzakció törlésnél |
| `reset_paid_on_transaction_unmatch()` | transactions | Fizetett flag reset unmatch-nél |
| `mark_invoice_upload_completed_on_invoice_insert()` | invoices | Upload rekord processed jelölés |
| `mark_salary_file_completed_on_salary_insert()` | salary | Salary fájl processed jelölés |
| `mark_transaction_upload_completed_on_transaction_insert()` | transactions | Tranzakció upload processed jelölés |
| `set_invoice_feldolgozva_on_upload_link()` | invoices | Feldolgozva flag beállítás upload linkelésnél |
| `enforce_invoice_single_project()` | invoices | Egy számla = egy projekt constraint |
| `auto_mark_cash_paid()` | invoices | Készpénzes számlák auto fizetett jelölés |
| `sync_salary_to_employee_rates()` | salary | Bérfrissítés → alkalmazotti óradíj szinkron |

#### ⚡ 3.2 Queue Enqueue Trigger-ek

| Trigger Function | Tábla | Queue | Cél |
|---|---|---|---|
| `trigger_enqueue_invoice_job()` | invoice_uploads | `invoice_jobs` | Új upload → PGMQ invoice queue |
| `trigger_enqueue_transaction_job()` | transaction_uploads | `transaction_jobs` | Új upload → PGMQ transaction queue |
| `trigger_enqueue_gl_job()` | invoices/transactions | `gl_jobs` | Feldolgozott tétel → PGMQ GL queue |
| `enqueue_report_job()` | report_requests | `report_jobs` | Report kérés → PGMQ report queue |

#### 👤 3.3 Auth & Signup Trigger-ek

| Trigger Function | Tábla | Cél |
|---|---|---|
| `handle_new_user()` | auth.users | Új user → profiles tábla rekord létrehozás |
| `on_company_created()` | companies | Új cég → owner company_member rekord |
| `initialize_email_preferences()` | profiles | Email preferenciák inicializálás |
| `initialize_user_subscription()` | profiles | Előfizetési rekord inicializálás |
| `generate_project_code()` | projects | Automatikus projektkód generálás |
| `generate_ticket_number()` | tickets | Automatikus hibajegy szám generálás |

#### 🎫 3.4 Ticket System Trigger-ek

| Trigger Function | Tábla | Cél |
|---|---|---|
| `create_ticket_created_event()` | tickets | Ticket létrehozás event rögzítés |
| `create_ticket_status_event()` | tickets | Ticket státuszváltozás event rögzítés |
| `create_comment_event()` | ticket_comments | Komment event rögzítés |

#### 🕐 3.5 Updated_at Timestamp Trigger-ek (9 db)

| Trigger Function | Tábla(k) |
|---|---|
| `update_updated_at()` | Általános updated_at frissítés |
| `update_updated_at_column()` | Alternatív updated_at frissítés |
| `update_frissitve_column()` | `frissitve` oszlop (magyar nyelvű legacy) |
| `update_settings_updated_at()` | company_settings |
| `update_feedback_updated_at()` | feedback |
| `update_vat_updated_at()` | vat_returns |
| `update_annual_reports_updated_at()` | annual_reports |
| `update_user_subscriptions_updated_at()` | user_subscriptions |
| `accounty_set_updated_at()` | accounty_* táblák (eaisyBooks modul) |

#### 🛡️ 3.6 Rendszer Utility Function-ök

| Function | Security | Cél |
|---|---|---|
| `global_audit_trigger_func()` | DEFINER | Globális audit log trigger (INSERT/UPDATE/DELETE naplózás). UPDATE-nél `invoice_uploads.processing_status = 'processed'` átmenetre tüzel. |
| `rls_auto_enable()` | DEFINER | Automatikus RLS engedélyezés új táblákon |
| `reset_monthly_usage()` | DEFINER | Havi számlafeldolgozási kvóta nullázás (cron) |
| `sync_sandbox_from_taxology()` | DEFINER | Sandbox adatok szinkronizálás taxology-ból |

---

### 4. SECURITY DEFINER Pattern

**A legtöbb RPC funkció `SECURITY DEFINER`:**
- A funkció a *létrehozó* jogosultságával fut (superuser), nem a hívó felhasználóéval
- Lehetővé teszi a cross-table JOIN-okat és aggregációkat anélkül, hogy a felhasználónak közvetlen hozzáférést adjunk minden táblához
- `SET search_path TO 'public'` — véd a search path injection ellen

**Miért nem `SECURITY INVOKER`?**
- Az RLS policy-k blokkolnák a cross-table aggregációkat
- A felhasználó nem láthatja más cégek adatait → a company_id szűrés a function-ben van

**Kivételek (`SECURITY INVOKER`):**
- `seed_default_vat_codes` — egyszerű INSERT, RLS kezeli
- `claim_transaction_jobs`, `claim_gl_jobs` — worker service_role-lal hív
- `update_*_at` trigger-ek — egyszerű timestamp frissítés
- `calculate_hourly_cost` — pure function, nincs DB hozzáférés

---

### 5. Frontend Hook Pattern (React Query)

Minden DB lekérdezés React Query hook-ban:

```typescript
// src/hooks/useInvoiceData.ts
export function useInvoiceData(companyId: string) {
  return useQuery({
    queryKey: ['invoices', companyId, dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('company_id', companyId);
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 perc
  });
}
```

**Konvenciók:**
- Hook neve: `use{Entity}Data` vagy `use{Entity}Mutations`
- `queryKey`: `[entity, companyId, ...filters]`
- `staleTime`: 5 perc (legtöbb hook)
- Error → `throw error` (React Query error handling)
- Mutation → `useMutation` + `invalidateQueries`

---

### 6. Worker DB Pattern (supabase-py)

A Python worker **service_role** kulccsal dolgozik (RLS bypass):

```python
# db.py — szinkron supabase-py kliens
client = create_client(url, service_role_key)

# Paginated fetch (Supabase max_rows=1000 bypass)
def _fetch_all_rows(table, select, filters, page_size=1000):
    while True:
        data = client.table(table).select(select).range(offset, offset+page_size-1).execute()
        if len(data.data) < page_size: break

# Async bridge
messages = await asyncio.to_thread(_sync_rpc_read, ...)
```

---

## Consequences

**Pozitív:**
- Egyszerű CRUD: nincs boilerplate, PostgREST automatikus
- Komplex logika: SQL-ben, közel az adathoz (gyors)
- Security: DEFINER pattern + company_id szűrés a function-ben
- Frontend: React Query cache → kevés felesleges lekérdezés

**Negatív:**
- RPC funkciók migration-ökben élnek → verziókezelés nehéz
- SECURITY DEFINER → ha a function bugos, jogosultsági szivárgás lehetséges
- Nincs type safety az RPC response-oknál (a frontend manuálisan tipizál)

## Kapcsolódó
- [A-002: Supabase mint BaaS](./A-002-supabase-baas.md)
- [A-003: Multi-tenancy RLS](./A-003-multi-tenancy-rls.md)
- [A-005: Edge Functions](./A-005-edge-functions.md)
- [A-014: React Query Cache](./A-014-react-query-cache.md)
- [A-017: Security Architecture](./A-017-security-architecture.md)
- [Worker DB pattern](../../../worker/docs/ARCHITECTURE.md#6-adatbázis-műveletek-dbpy)
