---
name: visibill-error-hunter
description: Systematically inspect all Visibill error tables and system logs (app_error_logs, nav_sync_logs, api_request_logs, upload tables, cron job runs, pgmq queues, and Supabase unified postgres_logs / postgrest_logs / function_logs via query_logs MCP), filter benign noise, categorize actionable bugs vs environmental issues, present a prioritized error report, and guide root-cause fixes through visibill-dev, visibill-db-checklist, and visibill-spec-lookup. Trigger on "hibatáblák", "app_error_logs", "error audit", "hibavadászat", "nézd át a logokat", "keress hibákat", "rendszerhibák", "milyen hibák történnek", "postgres logok", "supabase logok", "/visibill-error-hunter", "/error-hunter", or any request to find, audit, or resolve logged errors across the database, server platform, and frontend.
license: MIT
metadata:
  author: Visibill Team
  version: "1.0.0"
  date: September 2026
---

# 🎯 Visibill Error Hunter Framework

Ez a skill a Visibill/eAIsyBill rendszerben bekövetkező hibák szisztematikus felkutatására, osztályozására és végponttól-végpontig történő, specifikáció-vezérelt javítására szolgál.

---

## 🧭 Működési Folyamat (5 Fázis)

```
[ 1. Hiba Felderítés ]  ──>  [ 2. Triage & Osztályozás ]  ──>  [ 3. Audit Jelentés ]
       │                                                                │
(app_error_logs,                                                        ▼
 nav_sync_logs,                                            [ 4. User Döntési Kapu ]
 uploads, cron, pgmq,                                            (Zero Silent Decisions)
 postgres_logs)                                                         │
                                                                        ▼
                                                           [ 5. Komplex Javítás ]
                                                                • visibill-spec-lookup
                                                                • visibill-db-checklist
                                                                • visibill-dev
                                                                • Build & Test Verifikáció
```

---

## 1. FÁZIS: Log & Hibatábla Felderítés (Data Collection)

Az AI asszisztensnek az alábbi adatbázis és platform forrásokat **kötelező** lekérdeznie (a `supabase-visibill` MCP eszközök: `execute_sql` és `query_logs` segítségével):

### 1.1. `app_error_logs` (Központi frontend & backend alkalmazásnapló)
Futtasd le a hibák csoportosított lekérdezését:
```sql
SELECT 
    error_type,
    count(*) AS total_count,
    max(created_at) AS latest_at,
    substring(message from 1 for 120) AS sample_message
FROM public.app_error_logs
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY error_type, substring(message from 1 for 120)
ORDER BY count(*) DESC;
```
*Külön figyelemmel vizsgáld:*
- `error_type = 'unhandled'` (Nem kezelt JavaScript runtime hibák a kliensoldalon)
- `error_type = 'db_query'` (PostgREST, RPC vagy sémahibák)
- `error_type = 'frontend'` (React ErrorBoundary által elkapott összeomlások)
- `error_type = 'worker'` (Worker feldolgozási hibák)
- `error_type = 'auth'` (Hitelesítési problémák)

### 1.2. `nav_sync_logs` (NAV Online Számla Szinkronizációs Napló)
```sql
SELECT 
    status,
    count(*),
    max(created_at) AS latest_at,
    substring(error_message from 1 for 120) AS sample_err
FROM public.nav_sync_logs
WHERE status = 'failed' OR error_message IS NOT NULL
GROUP BY status, substring(error_message from 1 for 120)
ORDER BY count(*) DESC;
```

### 1.3. `api_request_logs` (Ügyfél REST API Napló)
```sql
SELECT 
    status_code,
    count(*),
    max(created_at) AS latest_at,
    substring(error_message from 1 for 100) AS sample_err
FROM public.api_request_logs
WHERE status_code >= 400
GROUP BY status_code, substring(error_message from 1 for 100)
ORDER BY count(*) DESC;
```

### 1.4. Feltöltési táblák (Upload pipelines)
Vizsgáld meg a sikertelen feldolgozásokat:
```sql
SELECT 'invoice_uploads' AS tbl, processing_status, count(*), max(created_at) AS latest_at 
FROM public.invoice_uploads WHERE processing_status IN ('error', 'webhook_failed') GROUP BY processing_status
UNION ALL
SELECT 'transaction_uploads' AS tbl, processing_status, count(*), max(created_at) AS latest_at 
FROM public.transaction_uploads WHERE processing_status IN ('error', 'webhook_failed') GROUP BY processing_status
UNION ALL
SELECT 'bank_statement_uploads' AS tbl, processing_status, count(*), max(created_at) AS latest_at 
FROM public.bank_statement_uploads WHERE processing_status IN ('error', 'webhook_failed') GROUP BY processing_status
UNION ALL
SELECT 'accounty_uploads' AS tbl, status, count(*), max(created_at) AS latest_at 
FROM public.accounty_uploads WHERE status = 'error' GROUP BY status
UNION ALL
SELECT 'outgoing_emails' AS tbl, status, count(*), max(created_at) AS latest_at 
FROM public.outgoing_emails WHERE status = 'error' GROUP BY status;
```

### 1.5. Időzített feladatok (`cron.job_run_details`)
```sql
SELECT jobid, status, count(*), max(end_time) AS latest_run, substring(return_message from 1 for 120) AS sample_msg
FROM cron.job_run_details
WHERE start_time >= NOW() - INTERVAL '7 days' AND status != 'succeeded'
GROUP BY jobid, status, substring(return_message from 1 for 120)
ORDER BY max(end_time) DESC;
```

### 1.6. PGMQ üzenetsorok (Queue health & stuck messages)
```sql
SELECT 'q_invoice_jobs' AS q, count(*), max(read_ct) AS max_retries FROM pgmq.q_invoice_jobs
UNION ALL
SELECT 'q_transaction_jobs' AS q, count(*), max(read_ct) AS max_retries FROM pgmq.q_transaction_jobs
UNION ALL
SELECT 'q_gl_classification_jobs' AS q, count(*), max(read_ct) AS max_retries FROM pgmq.q_gl_classification_jobs
UNION ALL
SELECT 'q_report_jobs' AS q, count(*), max(read_ct) AS max_retries FROM pgmq.q_report_jobs
UNION ALL
SELECT 'q_shipment_matching_jobs' AS q, count(*), max(read_ct) AS max_retries FROM pgmq.q_shipment_matching_jobs;
```

### 1.7. Supabase Platform & Postgres Logok (`query_logs` MCP eszköz)
A fizikai PostgreSQL motor, a PostgREST API gateway, a connection pooler és az Edge Function-ök nyers naplóit a `supabase-visibill` MCP `query_logs` eszközével kérdezd le (ClickHouse SQL):

#### Postgres Engine & PostgREST hibák (utolsó 24 óra):
```sql
SELECT 
    source,
    timestamp,
    substring(event_message, 1, 150) AS message
FROM logs
WHERE source IN ('postgres_logs', 'postgrest_logs')
  AND (event_message LIKE '%ERROR%' OR event_message LIKE '%FATAL%' OR event_message LIKE '%timeout%')
ORDER BY timestamp DESC
LIMIT 20
```

#### Edge Functions futási hibák és exception-ök:
```sql
SELECT 
    timestamp,
    substring(event_message, 1, 150) AS err_message
FROM logs
WHERE source IN ('function_logs', 'function_edge_logs')
  AND (event_message LIKE '%Error%' OR event_message LIKE '%Exception%' OR event_message LIKE '%failed%')
ORDER BY timestamp DESC
LIMIT 20
```

#### Connection pooler (Supavisor / PgBouncer) állapot:
```sql
SELECT 
    source,
    count(*),
    substring(event_message, 1, 100) AS sample_msg
FROM logs
WHERE source IN ('supavisor_logs', 'pgbouncer_logs')
  AND (event_message LIKE '%error%' OR event_message LIKE '%exhausted%')
GROUP BY source, substring(event_message, 1, 100)
LIMIT 10
```

---

## 2. FÁZIS: Hiba Osztályozás & Triage (Categorization)

Minden felderített logbejegyzést kötelező az alábbi három kategória egyikébe sorolni:

### 🔴 1. Valós Kód / Séma / RPC Hiba (Actionable Bug)
* **Jellemzője:** Programozási hiba, TypeScript runtime hiba (`TypeError`, `undefined`), hiányzó route, adatbázis séma eltérés (`42804`, hiányzó oszlop), vagy elrontott RLS.
* **Példák:**
  - `Cannot read properties of undefined (reading 'checked')`
  - `structure of query does not match function result type (42804)`
  - `column ga.target_gl_account_id does not exist (42703)`
  - `404 Error: User attempted to access non-existent route: /hr/eaisybooks/...`
* **Teendő:** Azonnali javítási terv készítése.

### 🟡 2. Környezeti / Infrastrukturális Hiba (Transient / External)
* **Jellemzője:** Külső harmadik fél átmeneti elérhetetlensége vagy hálózati timeout.
* **Példák:**
  - `NAV API request failed (HTTP 500 / timeout)`
  - `Mailgun / Resend rate limit vagy átmeneti hálózati hiba`
* **Teendő:** Retry stratégia, timeout kezelés és felhasználóbarát hibaüzenet ellenőrzése.

### ℹ️ 3. Normális Rendszerműködés / Benign Log (No Action Required)
* **Jellemzője:** Az üzleti logika vagy a biztonsági validáció helyesen fogta meg az érvénytelen bemenetet.
* **Példák:**
  - `link_pdf_not_found`: Email feldolgozás során leiratkozási linkek átugrása.
  - `ValueError: A futár jelentés formátuma nem támogatott...`: Nem megfelelő fájl feltöltése a felhasználó által.
  - `Invalid login credentials`: Rossz jelszó beírása.
* **Teendő:** Dokumentálni mint normális viselkedést; kódmódosítást NEM igényel.

---

## 3. FÁZIS: Rendszerezett Hiba Jelentés (Audit Report)

Mutasd be az eredményeket a felhasználónak egy átlátható táblázatban és részletes kártyákon:

```markdown
# 🔍 Rendszer Hiba Audit — [Dátum]

| # | Súlyosság | Hiba típus | Komponens / Hely | Gyakoriság | Utolsó esemény | Leírás |
|---|---|---|---|---|---|---|
| 1 | 🔴 Kritikus | unhandled | ClientMissingInvoicesPage | 6x | 2026-09-16 | Checkbox `checked` olvasási hiba |
| 2 | 🟡 Közepes | db_query | Router / CompanySwitcher | 3x | 2026-09-16 | 404 a `/hr/eaisybooks` útvonalon |
| 3 | ℹ️ Benign | link_pdf_not_found | Mailgun webhook | 666x | 2026-09-16 | Hírlevél linkek kiszűrése |

### Részletes Elemzés
#### [Hiba #1]: [Megnevezés]
- **Gyökérok (Root Cause):** Miért történt?
- **Érintett fájlok:** Kattintható markdown linkekkel
- **Kockázat és hatás:** Mit tapasztal a végfelhasználó?
```

---

## 4. FÁZIS: Felhasználói Döntési Kapu (Zero Silent Decisions)

> [!IMPORTANT]
> **Tilos önhatalmúan belekezdeni a javításokba anélkül, hogy a felhasználó jóváhagyta volna a prioritásokat!**

Tedd fel a kérdést a felhasználónak:
1. Melyik hibákat szeretné kijavítani (pl. "Kezdjük az 1-es és 2-es hibával")?
2. Ha egy hibának több lehetséges megoldása van (pl. átirányítás vs új route), mutasd be az opciókat a döntéshez.

---

## 5. FÁZIS: Komplex Hibajavítási Munkafolyamat (Deep Fix Execution)

Miután a felhasználó jóváhagyta a tervet, aktiváld a megfelelő Visibill szakági skilleket:

1. **Specifikáció és Tervezés:**
   - Hívd meg a [visibill-spec-lookup](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/skills/visibill-spec-lookup/SKILL.md) skillt a vonatkozó ADR-ek és PRD-k ellenőrzésére.
   - Komplex (3+ fájlt vagy üzleti logikát érintő) feladatnál készíts `implementation_plan.md`-t.

2. **Adatbázis / SQL / RPC hibák:**
   - KÖTELEZŐ betartani a [visibill-db-checklist](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/skills/visibill-db-checklist/SKILL.md) előírásait (`SECURITY DEFINER`, `search_path = public`, explicit GRANT-ok).
   - Hozz létre verziózott migrációs fájlt a `supabase/migrations/` mappában.

3. **Frontend / TypeScript hibák:**
   - Tartsd be a [visibill-dev](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/skills/visibill-dev/SKILL.md) és a [rules/frontend.md](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/rules/frontend.md) szabályokat.

4. **Kötelező Verifikáció (Pre-Completion Quality Gate):**
   - Futtasd le és igazolódj meg a hibamentességről:
     ```powershell
     npm run build
     # vagy
     npx tsc --noEmit
     ```
   - Futtasd le a kapcsolódó teszteket (`npx vitest run ...`).
   - SOHA ne állítsd, hogy a javítás kész van fizikai build kimenet nélkül!

5. **Dokumentáció & Grafikon Frissítés:**
   - Szinkronizáld a módosításokat a [visibill-doc-sync](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/skills/visibill-doc-sync/SKILL.md) segítségével.
   - Frissítsd a kódbázis tudásgráfot: `graphify update .`.
