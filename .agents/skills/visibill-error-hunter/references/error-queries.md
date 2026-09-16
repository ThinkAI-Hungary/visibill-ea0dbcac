# Visibill Rendszerhibák Lekérdezési Kézikönyv (SQL Cheat Sheet)

Ez a dokumentum tartalmazza azokat a közvetlenül másolható és futtatható SQL lekérdezéseket, amelyekkel az AI agent másodpercek alatt át tudja tekinteni a Visibill rendszer összes hibatábláját és naplóját.

---

## 1. `app_error_logs` Részletes Típus- és Súlyosságelemzés

### Csoportosítás hibatípus és üzenet szerint (utolsó 14 nap)
```sql
SELECT 
    error_type,
    severity,
    count(*) AS total_count,
    max(created_at) AS latest_at,
    substring(message from 1 for 100) AS sample_msg
FROM public.app_error_logs
WHERE created_at >= NOW() - INTERVAL '14 days'
GROUP BY error_type, severity, substring(message from 1 for 100)
ORDER BY count(*) DESC;
```

### Nem kezelt runtime hibák és stack trace-ek lekérése
```sql
SELECT 
    id,
    created_at,
    component,
    action,
    message,
    stack_trace,
    url,
    context
FROM public.app_error_logs
WHERE error_type IN ('unhandled', 'frontend')
ORDER BY created_at DESC
LIMIT 10;
```

---

## 2. NAV Online Számla Szinkronizációs Hibák (`nav_sync_logs`)

### Legfrissebb NAV hibák részletes vizsgálata
```sql
SELECT 
    id,
    created_at,
    company_id,
    sync_direction,
    date_from,
    date_to,
    status,
    error_message
FROM public.nav_sync_logs
WHERE status = 'failed' OR error_message IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
```

---

## 3. Ügyfél REST API Hibák (`api_request_logs`)

### Hibás hívások végpont és státuszkód szerint
```sql
SELECT 
    status_code,
    method,
    path,
    count(*) AS count,
    max(created_at) AS latest_at,
    substring(error_message from 1 for 100) AS sample_err
FROM public.api_request_logs
WHERE status_code >= 400
GROUP BY status_code, method, path, substring(error_message from 1 for 100)
ORDER BY count(*) DESC;
```

---

## 4. Feltöltési és Pipeline Hibák (Invoices, Transactions, Statements, Accounty)

### Összesített hibás feltöltések
```sql
SELECT 'invoice_uploads' AS source, id, created_at, processing_status AS status, substring(error_message from 1 for 120) AS err
FROM public.invoice_uploads WHERE processing_status IN ('error', 'webhook_failed')
UNION ALL
SELECT 'transaction_uploads' AS source, id, created_at, processing_status AS status, substring(error_message from 1 for 120) AS err
FROM public.transaction_uploads WHERE processing_status IN ('error', 'webhook_failed')
UNION ALL
SELECT 'bank_statement_uploads' AS source, id, created_at, processing_status AS status, substring(error_message from 1 for 120) AS err
FROM public.bank_statement_uploads WHERE processing_status IN ('error', 'webhook_failed')
UNION ALL
SELECT 'accounty_uploads' AS source, id, created_at, status, substring(error_message from 1 for 120) AS err
FROM public.accounty_uploads WHERE status = 'error'
UNION ALL
SELECT 'outgoing_emails' AS source, id, created_at, status, substring(error_message from 1 for 120) AS err
FROM public.outgoing_emails WHERE status = 'error'
ORDER BY created_at DESC
LIMIT 20;
```

---

## 5. Időzített Cron Feladatok (`cron.job_run_details`)

### Hibás vagy elbukott cron futások
```sql
SELECT 
    j.jobname,
    d.jobid,
    d.status,
    d.return_message,
    d.start_time,
    d.end_time
FROM cron.job_run_details d
JOIN cron.job j ON d.jobid = j.jobid
WHERE d.status != 'succeeded'
ORDER BY d.start_time DESC
LIMIT 10;
```

---

## 6. PGMQ Üzenetsor Beragadás és Retry Figyelés

### Üzenetsor állapotok és maximális retry-k
```sql
SELECT 'q_invoice_jobs' AS q, count(*) AS pending_count, max(read_ct) AS max_retries FROM pgmq.q_invoice_jobs
UNION ALL
SELECT 'q_transaction_jobs' AS q, count(*) AS pending_count, max(read_ct) AS max_retries FROM pgmq.q_transaction_jobs
UNION ALL
SELECT 'q_gl_classification_jobs' AS q, count(*) AS pending_count, max(read_ct) AS max_retries FROM pgmq.q_gl_classification_jobs
UNION ALL
SELECT 'q_report_jobs' AS q, count(*) AS pending_count, max(read_ct) AS max_retries FROM pgmq.q_report_jobs
UNION ALL
SELECT 'q_shipment_matching_jobs' AS q, count(*) AS pending_count, max(read_ct) AS max_retries FROM pgmq.q_shipment_matching_jobs
UNION ALL
SELECT 'q_pdf_export_jobs' AS q, count(*) AS pending_count, max(read_ct) AS max_retries FROM pgmq.q_pdf_export_jobs;
```

---

## 7. Supabase Platform & Postgres Logok (ClickHouse `query_logs` MCP)

Ezek a lekérdezések a `supabase-visibill` MCP szerver `query_logs` eszközével futtathatók ClickHouse SQL formátumban:

### 7.1. PostgreSQL Motor hibák és figyelmeztetések (utolsó 24 óra)
```sql
SELECT 
    timestamp,
    event_message,
    log_attributes
FROM logs
WHERE source = 'postgres_logs'
  AND (event_message LIKE '%ERROR%' OR event_message LIKE '%FATAL%' OR event_message LIKE '%PANIC%' OR event_message LIKE '%timeout%')
ORDER BY timestamp DESC
LIMIT 20
```

### 7.2. PostgREST API Gateway hibák és lassú kérések
```sql
SELECT 
    timestamp,
    event_message
FROM logs
WHERE source = 'postgrest_logs'
  AND (event_message LIKE '%error%' OR event_message LIKE '%timeout%' OR event_message LIKE '%500%')
ORDER BY timestamp DESC
LIMIT 20
```

### 7.3. Edge Functions Deno hibák és crash logok
```sql
SELECT 
    timestamp,
    event_message
FROM logs
WHERE source IN ('function_logs', 'function_edge_logs')
  AND (event_message LIKE '%Error%' OR event_message LIKE '%Exception%' OR event_message LIKE '%failed%')
ORDER BY timestamp DESC
LIMIT 20
```

### 7.4. Connection Pooler (Supavisor / PgBouncer) terheltség és timeoutok
```sql
SELECT 
    source,
    timestamp,
    event_message
FROM logs
WHERE source IN ('supavisor_logs', 'pgbouncer_logs')
  AND (event_message LIKE '%error%' OR event_message LIKE '%exhausted%' OR event_message LIKE '%timeout%')
ORDER BY timestamp DESC
LIMIT 20
```
