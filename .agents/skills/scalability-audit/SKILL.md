---
name: visibill-scalability-audit
description: Use when auditing the Visibill codebase for scalability bottlenecks, performance issues, security gaps, or preparing for growth. Covers database, API, security, frontend, worker, and infrastructure layers for the Supabase+React+Edge Function+PGMQ stack.
license: MIT
metadata:
  author: Visibill Team
  version: "2.0.0"
  date: May 2026
  abstract: Comprehensive scalability and security audit framework tailored for Visibill's full-stack architecture (Supabase Postgres, Edge Functions, PGMQ workers, React frontend). Includes automated severity classification, RLS-specific diagnostics, PGMQ queue analysis, storage security, Supabase tier awareness, and Edge Function code audit patterns.
---

# Visibill Scalability & Security Audit

Systematic framework for identifying and resolving scalability bottlenecks and security gaps across all layers of the Visibill platform.

## When to Use

- Before a major feature launch or user growth milestone
- When response times degrade or CPU/memory spikes appear
- During periodic (monthly/quarterly) health checks
- After adding new tables, queries, or Edge Functions
- When worker queue depth grows faster than processing rate
- When Supabase dashboard shows elevated connection counts
- After modifying RLS policies or adding SECURITY DEFINER functions

## The Audit Layers

```
┌─────────────────────────────────────────┐
│  Layer 1: DATABASE (Postgres)           │  ← Start here. Always.
│  Layer 2: RLS & SECURITY               │  ← Supabase-specific critical layer
│  Layer 3: API (Edge Functions / RPCs)   │
│  Layer 4: WORKER (PGMQ + Background)   │  ← Visibill-specific
│  Layer 5: FRONTEND (React)             │
│  Layer 6: STORAGE (Buckets)            │
│  Layer 7: CRON & SCHEDULED JOBS        │
└─────────────────────────────────────────┘
```

**Iron Rule:** Audit top-down. Database problems masquerade as API problems, API problems masquerade as frontend problems.

## Severity Classification

Use these thresholds to assign severity consistently:

| Metric | 🔴 Critical | 🟡 High | 🟢 Medium | ✅ OK |
|--------|-------------|---------|-----------|-------|
| Query avg time | > 1000ms | > 100ms | > 50ms | < 50ms |
| Seq scan ratio (seq/idx) | > 100:1 | > 10:1 | > 3:1 | < 3:1 |
| Connection utilization | > 80% | > 60% | > 40% | < 40% |
| Idle-in-transaction | > 10 | > 5 | > 2 | 0-1 |
| Queue depth | Growing trend | > 100 | > 50 | < 50 |
| Message age (sec) | > 600 | > 300 | > 60 | < 60 |
| Bundle size (gzipped) | > 1MB | > 500KB | > 300KB | < 300KB |
| Anon-callable SECDEF fns | Any | — | — | 0 |
| Public storage buckets (sensitive) | Any | — | — | 0 |

### Supabase Tier Limits Reference

| Resource | Free | Pro | Team |
|----------|------|-----|------|
| Max connections | 60 | 60-200 | 200+ |
| DB size | 500MB | 8GB | 16GB+ |
| Storage | 1GB | 100GB | 100GB+ |
| Edge Function timeout | 2s | 60s | 60s |
| Edge Function invocations | 500K/mo | 2M/mo | Unlimited |
| Realtime connections | 200 | 500 | 500+ |

---

## Layer 1: Database Performance

### 1.1 — Table Size & Row Counts

```sql
SELECT
  schemaname || '.' || relname AS table,
  n_live_tup AS row_count,
  pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;
```

**Red flags:**
- Any table > 1M rows without partitioning strategy
- `pg_total_relation_size` approaching tier limit
- Archive tables (`pgmq.a_*`) growing without cleanup

### 1.2 — Missing Indexes (Critical)

```sql
SELECT
  schemaname || '.' || relname AS table,
  seq_scan,
  seq_tup_read,
  idx_scan,
  CASE WHEN seq_scan > 0
    THEN round(seq_tup_read::numeric / seq_scan, 0)
    ELSE 0
  END AS avg_rows_per_seq_scan
FROM pg_stat_user_tables
WHERE seq_scan > 100
  AND idx_scan < seq_scan
ORDER BY seq_tup_read DESC
LIMIT 20;
```

**Red flags:**
- `seq_scan >> idx_scan` on large tables
- `avg_rows_per_seq_scan` > 10,000

### 1.3 — Slow Queries

```sql
SELECT
  calls,
  round(mean_exec_time::numeric, 2) AS avg_ms,
  round(total_exec_time::numeric, 0) AS total_ms,
  rows,
  LEFT(query, 120) AS query_preview
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;
```

**Severity:**
- 🔴 `avg_ms > 1000` — immediate fix needed
- 🟡 `avg_ms > 100` — schedule optimization
- High `calls` × high `avg_ms` = compounding problem

### 1.4 — N+1 Query Detection

```sql
SELECT
  calls,
  LEFT(query, 100) AS query_preview,
  round(mean_exec_time::numeric, 2) AS avg_ms,
  round((calls * mean_exec_time)::numeric, 0) AS total_ms
FROM pg_stat_statements
WHERE calls > 50
  AND query NOT LIKE '%pg_stat%'
ORDER BY calls DESC
LIMIT 20;
```

**Fix pattern:** Replace per-item queries with batch queries using `IN ()` or JOINs.

### 1.5 — Connection Pool Saturation

```sql
SELECT
  count(*) AS total_connections,
  count(*) FILTER (WHERE state = 'active') AS active,
  count(*) FILTER (WHERE state = 'idle') AS idle,
  count(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_tx,
  max_conn.setting::int AS max_connections
FROM pg_stat_activity, pg_settings max_conn
WHERE max_conn.name = 'max_connections'
GROUP BY max_conn.setting;
```

**Red flags:**
- `active` > 50% of `max_connections`
- `idle_in_transaction` > 5 (leaked transactions)
- Total connections within 80% of max

### 1.6 — Unindexed Foreign Keys

```sql
SELECT
  tc.table_name,
  kcu.column_name,
  tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND NOT EXISTS (
    SELECT 1 FROM pg_indexes pi
    WHERE pi.tablename = tc.table_name
      AND pi.indexdef LIKE '%' || kcu.column_name || '%'
  );
```

**Impact:** Missing FK indexes cause slow DELETE cascades and JOIN performance.

### 1.7 — Unused Indexes (Wasted Write Overhead)

```sql
SELECT
  schemaname || '.' || relname AS table,
  indexrelname AS index,
  idx_scan AS times_used,
  pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
WHERE idx_scan < 10
  AND indexrelname NOT LIKE '%pkey%'
  AND indexrelname NOT LIKE '%unique%'
ORDER BY pg_relation_size(indexrelid) DESC;
```

**Rule:** Don't drop indexes on tables with < 1000 rows or recently created features. Wait for at least 2 weeks of data before deciding.

---

## Layer 2: RLS & Security (Supabase-Specific)

### 2.1 — RLS InitPlan Check (Critical Performance)

This is the **#1 most common Supabase performance bug**.

**The problem:** Using `auth.uid()` directly in RLS policies causes Postgres to re-evaluate it for EVERY ROW. Wrapping in `(select auth.uid())` makes it evaluate once.

**Diagnostic:** Use the Supabase `get_advisors` tool with type `performance` and look for `auth_rls_initplan` warnings.

**Fix pattern:**
```sql
-- ❌ SLOW: re-evaluates per row
CREATE POLICY "Users see own data" ON invoices
  USING (user_id = auth.uid());

-- ✅ FAST: evaluates once as subquery
CREATE POLICY "Users see own data" ON invoices
  USING (user_id = (select auth.uid()));
```

**Also applies to:**
- `auth.jwt()`
- `current_setting('request.jwt.claims', true)`
- Any custom function call in RLS

### 2.2 — Anon-Callable SECURITY DEFINER Functions

**Diagnostic:** Use `get_advisors` with type `security` and look for `anon_security_definer_function_executable`.

Any `SECURITY DEFINER` function callable by `anon` is a **critical security risk** — it runs with the function owner's elevated privileges without requiring authentication.

**Fix:**
```sql
REVOKE EXECUTE ON FUNCTION public.my_function FROM anon;
```

**Visibill-specific:** The following function categories should NEVER be anon-callable:
- `pgmq_*` functions (queue manipulation)
- `get_user_emails_*` (user data exposure)
- `trigger_enqueue_*` (job injection)
- `get_gl_*` (financial data)

### 2.3 — Function Search Path Mutable

**Diagnostic:** Look for `function_search_path_mutable` in security advisors.

**Fix:**
```sql
ALTER FUNCTION public.my_function SET search_path = '';
-- Or recreate with:
CREATE OR REPLACE FUNCTION public.my_function()
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$ ... $$;
```

### 2.4 — Leaked Password Protection

Check if leaked password protection is enabled in Supabase Auth settings. This prevents users from registering with passwords known to be in data breaches (via HaveIBeenPwned.org).

**Fix:** Enable in Supabase Dashboard → Auth → Settings → Password Security.

---

## Layer 3: API Layer (Edge Functions & RPCs)

### 3.1 — Edge Function Cold Start

**Check:** Supabase Dashboard → Edge Functions → Execution time distribution

**Red flags:**
- P99 latency > 5x P50 (cold start problem)
- Functions importing heavy dependencies at module level
- Functions creating new Supabase clients per request

**Fix pattern:**
```typescript
// ❌ Cold start penalty — client created per request
Deno.serve(async (req) => {
  const client = createClient(url, key);
  // ...
});

// ✅ Client created once at module scope
const client = createClient(url, key);
Deno.serve(async (req) => {
  // reuse client
});
```

### 3.2 — Edge Function Code Audit (Automated Grep Patterns)

Run these searches against the Edge Function codebase to detect anti-patterns:

```bash
# N+1 in loops — supabase calls inside for/forEach/map
grep -rn "for.*\(.*of\|forEach\|\.map" supabase/functions/ | grep -A5 "supabase\.\(from\|rpc\)"

# Client created inside handler (cold start issue)
grep -rn "createClient" supabase/functions/ --include="*.ts" -A2 | grep "Deno.serve\|async.*req"

# SELECT * without LIMIT (unbounded queries)
grep -rn "\.select(\s*['\"]\\*['\"]" supabase/functions/ --include="*.ts" | grep -v "\.limit\|\.single\|\.maybeSingle"

# Missing error handling on supabase calls
grep -rn "await supabase" supabase/functions/ --include="*.ts" | grep -v "error\|catch\|throw"
```

### 3.3 — Edge Function Query Efficiency Checklist

- [ ] Each EF makes ≤ 5 DB round-trips
- [ ] No sequential queries that could be parallelized with `Promise.all()`
- [ ] Aggregation done in SQL, not JS (don't `.select('*')` then `.filter()` in JS)
- [ ] Pagination used for list endpoints (never `SELECT *` without LIMIT)
- [ ] Response payloads < 500KB
- [ ] Error responses include meaningful status codes

### 3.4 — RPC vs REST Decision Matrix

| Use Case | Use RPC | Use REST |
|----------|---------|----------|
| Multi-table atomic operation | ✅ | ❌ |
| Complex aggregation | ✅ | ❌ |
| Row-level calculations | ✅ | ❌ |
| Simple CRUD on single table | ❌ | ✅ |
| RLS handles auth naturally | ❌ | ✅ |
| Batch operations | ✅ | ❌ |

---

## Layer 4: Worker Layer (PGMQ-Specific)

### 4.1 — Queue Depth & Health

```sql
SELECT queue_name, queue_length, newest_msg_age_sec
FROM pgmq.metrics_all();
```

**Severity thresholds:**
- 🔴 `queue_length` growing over time (processing < ingestion)
- 🔴 `newest_msg_age_sec` > 600 (messages waiting > 10 min)
- 🟡 `newest_msg_age_sec` > 300 (messages waiting > 5 min)

### 4.2 — Archive Table Size (Visibill-Specific)

PGMQ archive tables grow indefinitely. Monitor them:

```sql
SELECT
  relname AS archive_table,
  n_live_tup AS row_count,
  pg_size_pretty(pg_total_relation_size(oid)) AS total_size
FROM pg_class
WHERE relname LIKE 'a_%_jobs'
  AND relkind = 'r'
ORDER BY pg_total_relation_size(oid) DESC;
```

**Red flags:**
- Archive tables > 10K rows (should be periodically cleaned)
- Combined archive size > 100MB

**Fix:** Add a cron job to purge old archive records:
```sql
-- Purge archived messages older than 30 days
DELETE FROM pgmq.a_gl_classification_jobs
WHERE archived_at < NOW() - INTERVAL '30 days';
```

### 4.3 — Worker Polling Efficiency

**Visibill uses `pgmq_read` RPC for polling. Check its performance:**

```sql
SELECT
  calls,
  round(mean_exec_time::numeric, 2) AS avg_ms,
  round(total_exec_time::numeric, 0) AS total_ms
FROM pg_stat_statements
WHERE query LIKE '%pgmq_read%' OR query LIKE '%pgmq%read%'
ORDER BY total_exec_time DESC;
```

**Red flags:**
- `avg_ms > 100` for read operations
- High `calls` count with empty results (idle polling waste)

**Audit checklist:**
- [ ] Workers use long-polling (`max_poll_seconds` > 0), not tight loops
- [ ] Poll interval scales with queue depth (backoff when idle)
- [ ] Workers release DB connections between jobs
- [ ] Failed jobs have exponential backoff retry
- [ ] Dead letter queue or max retry count for permanently failed jobs

### 4.4 — Worker Concurrency

**Check for Visibill:**
- How many worker instances run in parallel?
- Do workers compete for the same DB connections?
- Is there a max concurrency limit for external API calls (NAV, n8n)?
- Are LLM API calls rate-limited to prevent cost spikes?

---

## Layer 5: Frontend (React)

### 5.1 — Bundle Size Audit

```bash
npx vite-bundle-visualizer
# or
npx vite-bundle-analyzer
```

**Severity:**
- 🔴 Total JS > 1MB gzipped
- 🟡 Total JS > 500KB gzipped
- Single vendor chunk > 200KB
- Duplicate dependencies in bundle
- Icons library importing all icons (e.g., full `lucide-react`)

### 5.2 — Re-render Profiling

**React DevTools Profiler checklist:**
- [ ] No component re-rendering > 30 times on a single interaction
- [ ] List items use stable `key` props (not array index for dynamic lists)
- [ ] Heavy computations wrapped in `useMemo`
- [ ] Callbacks passed to children wrapped in `useCallback`
- [ ] Context providers don't cause cascading re-renders

### 5.3 — React Query / TanStack Cache Efficiency

```typescript
// ❌ Refetching every second with no stale time
useQuery({ queryKey: ['data'], queryFn: fetch, refetchInterval: 1000, staleTime: 0 });

// ✅ Reasonable intervals with stale time
useQuery({ queryKey: ['data'], queryFn: fetch, refetchInterval: 5000, staleTime: 3000,
  placeholderData: prev => prev });
```

**Audit checklist:**
- [ ] `staleTime` set appropriately (not all 0)
- [ ] `refetchInterval` not too aggressive (< 3s only when critical)
- [ ] `placeholderData` or `keepPreviousData` used to prevent loading flicker
- [ ] Queries properly keyed to avoid cache collisions
- [ ] No duplicate queries for same data on same page

**Grep for aggressive refetching:**
```bash
grep -rn "refetchInterval" src/ --include="*.tsx" --include="*.ts"
grep -rn "staleTime.*:.*0" src/ --include="*.tsx" --include="*.ts"
```

### 5.4 — Lazy Loading & Code Splitting

- [ ] Route-based code splitting (`React.lazy()`)
- [ ] Heavy components loaded on-demand (charts, PDF viewers, GL table)
- [ ] Images using `loading="lazy"` or intersection observer
- [ ] Large datasets using virtualization (react-window, tanstack-virtual)

**Grep for missing lazy loading:**
```bash
# Find large component imports that could be lazy
grep -rn "^import.*from.*pages/" src/App.tsx src/routes.tsx
```

---

## Layer 6: Storage

### 6.1 — Bucket Security Audit (Critical for Financial Data)

```sql
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets;
```

**Visibill-specific rules:**
| Bucket | Should be public? | Recommended limit | Allowed MIME |
|--------|-------------------|-------------------|--------------|
| `avatars` | ✅ Yes (profile pics) | 5 MB | `image/*` |
| `invoice-uploads` | ❌ **No** (financial) | 25 MB | `application/pdf, image/*` |
| `bank-statements` | ❌ **No** (financial) | 25 MB | `application/pdf, text/csv, application/vnd.openxmlformats*` |
| `salaries` | ❌ **No** (HR/financial) | 25 MB | `application/pdf` |
| `transactions` | ❌ **No** (financial) | 25 MB | `application/pdf, text/csv` |
| `asset-documents` | ❌ **No** (business) | 25 MB | `application/pdf, image/*` |
| `szla_image` | ❌ **No** (invoice imgs) | 10 MB | `image/*` |

**Red flags:**
- 🔴 Any financial bucket set to `public: true`
- 🔴 No `file_size_limit` (allows unlimited uploads → storage abuse)
- 🟡 No `allowed_mime_types` (allows executable uploads)

### 6.2 — Orphaned Files Check

```sql
-- Files in storage not referenced by any table
SELECT s.name, s.bucket_id, s.created_at
FROM storage.objects s
LEFT JOIN invoice_uploads iu ON iu.file_path LIKE '%' || s.name || '%'
LEFT JOIN transaction_uploads tu ON tu.file_path LIKE '%' || s.name || '%'
WHERE iu.id IS NULL AND tu.id IS NULL
  AND s.created_at < NOW() - INTERVAL '30 days'
ORDER BY s.created_at;
```

---

## Layer 7: Cron & Scheduled Jobs

### 7.1 — Active Cron Jobs

```sql
SELECT
  jobid,
  jobname,
  schedule,
  command,
  nodename,
  active
FROM cron.job
ORDER BY jobid;
```

**Audit checklist:**
- [ ] No cron jobs running more frequently than needed
- [ ] Long-running cron jobs don't overlap (check `cron.job_run_details`)
- [ ] Failed cron jobs are monitored

### 7.2 — Cron Job Run History

```sql
SELECT
  jobid,
  job_pid,
  status,
  return_message,
  start_time,
  end_time,
  end_time - start_time AS duration
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;
```

**Red flags:**
- `status = 'failed'` recurring
- `duration` > 30 seconds
- Overlapping runs (same `jobid` with overlapping `start_time`/`end_time`)

---

## Audit Output Template

After completing all layers, produce a structured report:

```markdown
# Scalability Audit Report — Visibill
## Date: YYYY-MM-DD

### 🔴 Critical (Fix Now)
| # | Issue | Layer | Impact | Fix |
|---|-------|-------|--------|-----|

### 🟡 High (Fix This Sprint)
| # | Issue | Layer | Impact | Fix |
|---|-------|-------|--------|-----|

### 🟢 Medium (Schedule)
| # | Issue | Layer | Impact | Fix |
|---|-------|-------|--------|-----|

### Metrics Baseline
| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Largest table rows | X | <100K | |
| Total DB size | X | <tier limit | |
| Connections (peak) | X/Y | <80% | |
| Idle-in-transaction | X | 0 | |
| Slowest query (avg) | Xms | <200ms | |
| Queue depth (peak) | X | <100 | |
| Bundle size (gzipped) | XKB | <500KB | |
| Public sensitive buckets | X | 0 | |
| Anon-callable SECDEF fns | X | 0 | |
```

### Recommended Action Priority Order

1. **Immediately**: Security issues (anon-callable functions, public buckets)
2. **Immediately**: RLS initplan fixes on high-traffic tables
3. **This week**: Slow query optimization (> 1000ms)
4. **This sprint**: Missing indexes, FK indexes
5. **Scheduled**: Unused index cleanup, archive purge, cron audit

---

## Quick Reference

| Layer | Tool | What to Check |
|-------|------|---------------|
| Database | `pg_stat_statements` | Slow queries, N+1 |
| Database | `pg_stat_user_tables` | Missing indexes, seq scan ratio |
| Database | `pg_stat_activity` | Connection saturation |
| RLS/Security | `get_advisors(security)` | Anon SECDEF, search_path |
| RLS/Security | `get_advisors(performance)` | RLS initplan, unused indexes |
| API | Supabase Dashboard | Edge Function latency |
| API | `grep` patterns | Code anti-patterns |
| Worker | `pgmq.metrics_all()` | Queue depth, message age |
| Worker | `pg_stat_statements` | `pgmq_read` perf |
| Frontend | `vite-bundle-visualizer` | JS payload size |
| Frontend | `grep refetchInterval` | Aggressive polling |
| Storage | `storage.buckets` | Public flag, limits, MIME |
| Cron | `cron.job` + `job_run_details` | Schedule, failures, duration |

## Related Skills

- **`supabase-postgres-best-practices`** — Detailed SQL optimization rules
- **`systematic-debugging`** — When audit reveals specific issues
- **`react-best-practices`** — Frontend optimization patterns
- **`verification-before-completion`** — Verify fixes actually improve metrics
