# Supabase Lock-in: Storage, Realtime, PostgREST, RLS & pg_cron

**Létrehozva:** 2026-06-13  
Ezek az eddig nem dokumentált Supabase-specifikus függőségek.

---

## 📦 Storage (supabase.storage) — 🟡 Közepes lock-in

### Használt bucket-ek (6 db)

| Bucket | Publikus? | Frontend fájlok | Műveletek |
|---|:---:|---|---|
| `invoice-uploads` | Nem | `ManualUpload.tsx`, `InvoiceFilesDialog.tsx` | upload, remove, getPublicUrl |
| `bank-statements` | Nem | `ManualUpload.tsx` | upload, remove, getPublicUrl |
| `transactions` | Nem | `ManualUpload.tsx` | upload, remove, getPublicUrl |
| `report-uploads` | Nem | `ManualUpload.tsx`, `ReportFilesDialog.tsx` | upload, remove, getPublicUrl |
| `salaries` | Nem | `SalaryFilesTable.tsx` | remove |
| `asset-documents` | Nem | `AssetDetailPanel.tsx` | upload, getPublicUrl, remove |
| `ticket-attachments` | Igen | `upload-ticket-image.ts` | upload, getPublicUrl |
| `avatars` | Igen | (legacy) | — |
| `szla_image` | Nem | `InvoiceImagePreview.tsx` (Edge Fn) | signed URL |

### Storage API használat (8 fájl, ~22 hívás)

| Fájl | Hívások száma |
|---|:---:|
| `src/pages/ManualUpload.tsx` | 12 (upload, remove, getPublicUrl) |
| `src/components/fixed-assets/AssetDetailPanel.tsx` | 3 |
| `src/components/courier/ReportFilesDialog.tsx` | 2 |
| `src/components/invoices/InvoiceFilesDialog.tsx` | 2 |
| `src/components/salaries/SalaryFilesTable.tsx` | 1 |
| `src/lib/upload-ticket-image.ts` | 2 |
| `src/pages/Accounty/ClientPortalPage.tsx` | 1 |
| Edge Function: `get-invoice-image-url` | 1 (signed URL) |
| Edge Function: `process-mailgun-webhook` | 1 |

### Storage RLS policies (storage.objects)

A migrációkban ~40 RLS policy van `storage.objects`-re definiálva. Ezek Supabase-specifikus, mert:
- `storage.objects` és `storage.buckets` táblák **nem léteznek** standard PostgreSQL-ben
- A Supabase Storage API `s3`-kompatibilis, DE az RLS policy-k a GoTrue `auth.uid()`-ot használják

### Migrációs nehézség: 🟡 Közepes
- Az S3-kompatibilis API (`upload`, `download`, `remove`, `getPublicUrl`) cserélhető AWS S3 / Cloudflare R2 / DigitalOcean Spaces-re
- A `getPublicUrl()` → sima URL generálás
- A bucket RLS-ek → IAM policy / signed URLs
- **De:** a `storage.objects` policy-ket újra kell írni

---

## 🔄 Realtime (supabase.channel + postgres_changes) — 🟡 Közepes lock-in

### Realtime csatornák (3 db)

| Csatorna | Fájl | Figyelt táblák | Funkció |
|---|---|---|---|
| `realtime-sync-${companyId}` | `LiveNotificationProvider.tsx` (497 sor) | **15 tábla**: salary, salary_files, invoices, invoice_uploads, nav_invoices, transactions, partners, transaction_uploads, categories, projects, dunning_sends, nav_invoice_items, invoice_items, nav_sync_logs, report_uploads, courier_reports | Fő realtime hub: cache invalidáció + toast |
| `ai_notifications` | `GeneralLedgerPage.tsx` | gl_upload_notifications | AI classification status |
| `unread-ticket-count` | `useTickets.ts` | ticket_comments (INSERT only) | Badge frissítés |

### Supabase-specifikus Realtime API-k

```typescript
// 1. Channel létrehozás (Supabase-specifikus)
const channel = supabase.channel('channel-name')

// 2. Postgres Changes listener (WAL-alapú, Supabase-specifikus)
  .on('postgres_changes', {
    event: '*',        // INSERT | UPDATE | DELETE | *
    schema: 'public',
    table: 'invoices',
    filter: `company_id=eq.${id}`,  // opcionális szűrő
  }, callback)

// 3. Subscribe + unsubscribe
  .subscribe();
supabase.removeChannel(channel);

// 4. Auth token küldés Realtime-nek
supabase.realtime.setAuth(session.access_token);
```

### SQL: `supabase_realtime` publication

A következő táblák vannak hozzáadva a `supabase_realtime` WAL publication-höz:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE nav_invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE invoice_uploads;
ALTER PUBLICATION supabase_realtime ADD TABLE transaction_uploads;
ALTER PUBLICATION supabase_realtime ADD TABLE partners;
ALTER PUBLICATION supabase_realtime ADD TABLE nav_invoice_items;
ALTER PUBLICATION supabase_realtime ADD TABLE gl_upload_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE invoice_items;
```

### Migrációs nehézség: 🟡 Közepes
- Alternatívák: **Ably**, **Pusher**, **Socket.io** + saját WebSocket szerver
- A `postgres_changes` mechanizmus a PostgreSQL WAL-ra épül — self-hosted-nél ez `pg_logical`-lal másolható
- A `LiveNotificationProvider.tsx` (497 sor) a legkomplexebb — tab visibility, reconnect, debounced invalidation

---

## 🔌 PostgREST Query Client (supabase.from()) — 🟡 Közepes lock-in

### Használat mértéke

**~20+ fájl** használja a `supabase.from()` query builder-t:
- **Oldalak:** VatReturnPage, Settings, ProfitAndLoss, BalanceSheet, ManualUpload, stb.
- **Hookok:** useDashboardData, useInvoiceData, useInvoiceFilters, useKintlevoData, useSalaryData, useTickets, stb.
- **Komponensek:** GeneralLedgerTable, EmptyStateDashboard, LiveNotificationProvider, stb.

### RPC funkciók (supabase.rpc()) — 10 fájl, 21+ hívás

| RPC funkció | Hol hívják | Mit csinál |
|---|---|---|
| `get_invoice_aggregates` | useDashboardData | Dashboard összesítők |
| `get_nav_invoice_aggregates` | useDashboardData | NAV összesítők |
| `get_petty_cash_balance` | useDashboardData | Pénztár egyenleg |
| `get_linked_invoices` | useInvoiceData | Párosított számlák |
| `get_filtered_nav_invoices` | useInvoiceFilters | Szűrt NAV számlák |
| `get_filtered_submitted_invoices` | useInvoiceFilters | Szűrt benyújtott számlák |
| `get_gl_balances` | GeneralLedgerTable | Főkönyvi egyenlegek |
| `get_gl_categorized_items` | GeneralLedgerTable, PnL, BS | GL tételek |
| `override_gl_classifications_batch` | GeneralLedgerTable | GL besorolás override |
| `get_pnl_report` | ProfitAndLoss | P&L riport |
| `save_pnl_mappings` | ProfitAndLoss | P&L mapping mentés |
| `get_bs_report` | BalanceSheet | Mérleg riport |
| `save_bs_mappings` | BalanceSheet | Mérleg mapping mentés |
| `freeze_annual_data` | AnnualReportPage | Éves zárlat |
| `validate_annual_report` | AnnualReportPage | Éves validáció |
| `seed_default_vat_codes` | VatReturnPage | ÁFA kódok seed |
| `calculate_vat_return` | VatReturnPage | ÁFA bevallás kalkuláció |
| `rematch_courier_report` | useCourierReportData | Futár riport újrapárosítás |

### Migrációs nehézség: 🟡 Közepes
- A `supabase.from('table').select()...` query builder **PostgREST-specifikus**, DE:
- Az RPC funkciók **standard PL/pgSQL** — bármelyik PostgreSQL-en futnak
- Alternatíva: **Drizzle ORM**, **Prisma**, **Kysely** — mind tudja ugyanezt

---

## 🔒 RLS (Row Level Security) — 🟢 Alacsony lock-in, DE `auth.uid()` kötöttség

### auth.uid() és auth.role() használat

**365+ előfordulás** az SQL migrációkban. Minta:

```sql
-- Tipikus RLS policy
CREATE POLICY "Users can view own companies" ON companies
  FOR SELECT USING (owner_id = auth.uid());

-- Initplan-optimalizált változat (jelenleg használt)
CREATE POLICY "Users can view own data" ON invoices
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = (SELECT auth.uid())
    )
  );
```

### FK hivatkozások auth.users-re

**~10 tábla** tartalmaz `REFERENCES auth.users(id)` foreign key-t:
- `accounty_assignments.accountant_user_id`
- `accounty_todos.completed_by`
- `accounty_missing_items.ignored_by`, `resolved_by`
- `accounty_notes.created_by`
- `accounty_audit_log.user_id`
- `accounty_messages.sender_user_id`
- `vat_returns.user_id`

### Migrációs hatás
- **`auth.uid()`** → saját `current_user_id()` SQL function-re cserélhető (JWT claim-ből)
- **`auth.users` FK** → saját `users` tábla létrehozása szükséges az auth migráláshoz
- **Az RLS policy-k maguk** standard PostgreSQL — nem kell újraírni, csak az `auth.uid()` hivatkozásokat

---

## ⏰ pg_cron — 🟢 Alacsony lock-in

### Ütemezett feladatok

```sql
-- Accounty cron schedules (3 job)
SELECT cron.schedule('accounty-auto-sync', '0 */4 * * *', ...);     -- 4 óránként
SELECT cron.schedule('accounty-detect-missing', '0 6 * * *', ...);  -- reggel 6
SELECT cron.schedule('accounty-generate-deadlines', '0 7 1 * *', ...); -- hó 1. reggel 7

-- NAV auto-sync (1 job)
SELECT cron.schedule('nav-auto-sync-all', '0 */6 * * *', ...);     -- 6 óránként
```

### Migrációs nehézség: 🟢 Alacsony
- `pg_cron` standard PostgreSQL extension — bármelyik self-hosted PG-n elérhető
- Alternatíva: OS-szintű cron, Cloud Scheduler, vagy Temporal/BullMQ

---

## 🔗 Hardcoded Supabase URL-ek & Token-ek

| Fájl | Mit tartalmaz |
|---|---|
| `src/integrations/supabase/client.ts` | `SUPABASE_URL` + `SUPABASE_PUBLISHABLE_KEY` |
| `src/pages/Auth.tsx:202` | Hardcoded URL fallback: `https://vxxgvdlqvvchtlmqnrqf.supabase.co` |
| `src/pages/Auth.tsx:241-242` | Hardcoded URL + anon key (resend verification) |
| `src/lib/constants.ts:8` | `AUTH_TOKEN: 'sb-vxxgvdlqvvchtlmqnrqf-auth-token'` |
| `src/components/ErrorBoundary.tsx:84` | Hardcoded auth token key |

### Migrációs hatás: 🟢 Alacsony
- Environment variable-re cserélhető (`VITE_SUPABASE_URL` már létezik, de nem mindenütt használt)
- A hardcoded URL-ek find-replace-tel javíthatók
