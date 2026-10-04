---
name: visibill-nav-sync-e2e
description: Use when the user wants to trigger a live NAV sync on eaisybill-prod to test or verify the nav-auto-sync → nav_item_jobs → worker → nav-fetch-details → auto-categorize chain. Triggers on "triggerelj nav szinkront", "indíts nav szinkront", "teszteljük élesben a nav szinkront", "nav sync e2e", "próbáljuk ki egy cégnél", "nézzük meg élesben a nav láncot".
---

# Célzott éles NAV szinkron + láncellenőrzés

Prod projekt: `vxxgvdlqvvchtlmqnrqf` (MCP szerver: `supabase-visibill`).

## ⚠️ Biztonsági szabályok
- **Mindig csak 1 cégre** (`companyId`). `companyId` nélkül, a hajnali ablakon (01–05 UTC) kívül az `nav-auto-sync` az ÖSSZES céget szinkronizálja.
- Éles NAV-hívás + AI-kategorizálás: valós költség, kategóriákat ír → **a cégválasztást mindig kérdezd meg** (`ask_question`, ajánlott opcióval, indoklással).
- Mellékhatás: a mai hajnali cron ezt a céget kihagyja (20 órás frekvencia-szabály). Ezt jelezd a kérdésben.
- A `cron_secret`-et soha ne olvasd ki és ne írd ki: SQL-ből, a vaultból hivatkozz rá.
- A `supabase-visibill` MCP `execute_sql` **nem fogad `project_id` paramétert** (ZodError), csak `query`-t.

## 1. Cégjelölt keresése
Olyan céget keress, ahol régi az utolsó szinkron, sok a bejövő számla, és van kategorizálatlan számla. Így a tételsor-letöltés és a kategóriaírás ága is lefut.

```sql
WITH x AS (
  SELECT c.id AS company_id, c.name,
    (SELECT max(completed_at) FROM nav_sync_logs l WHERE l.company_id=c.id AND l.status='completed' AND l.invoice_direction='INBOUND') AS last_inbound_sync,
    (SELECT count(*) FROM nav_invoices n WHERE n.company_id=c.id AND n.invoice_direction='INBOUND' AND n.invoice_issue_date >= current_date - 30) AS inbound_30d,
    (SELECT count(*) FROM nav_invoices n WHERE n.company_id=c.id AND n.invoice_direction='INBOUND' AND n.created_at >= now() - interval '30 days' AND n.category_id IS NULL) AS uncategorized_30d
  FROM user_nav_credentials unc JOIN companies c ON c.id=unc.company_id
  WHERE unc.validation_status='valid' AND c.name NOT ILIKE '%test%')
SELECT *, round(extract(epoch FROM now()-last_inbound_sync)/3600,1) AS hours_since
FROM x WHERE inbound_30d > 0 ORDER BY inbound_30d DESC LIMIT 12;
```

## 2. Baseline (indítás előtt)
```sql
SELECT
  (SELECT max(created_at) FROM auto_categorize_jobs WHERE company_id='<uuid>') AS last_cat_job,
  (SELECT count(*) FROM nav_invoices WHERE company_id='<uuid>') AS invoices_total,
  (SELECT count(*) FROM nav_invoices WHERE company_id='<uuid>' AND NOT coalesce(details_fetched,false)) AS without_details,
  (SELECT count(*) FROM nav_invoices WHERE company_id='<uuid>' AND invoice_direction='INBOUND' AND category_id IS NULL) AS inbound_uncat,
  (SELECT count(*) FROM nav_invoice_items WHERE company_id='<uuid>') AS items_total,
  (SELECT max(msg_id) FROM pgmq.a_nav_item_jobs) AS last_archived,
  now();
```

## 3. Indítás (ugyanúgy, ahogy a `nav-daily-sync` pg_cron job)
```sql
SELECT net.http_post(
  url := 'https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/nav-auto-sync',
  headers := jsonb_build_object('Content-Type','application/json',
    'x-cron-secret',(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='cron_secret' LIMIT 1)),
  body := jsonb_build_object('companyId','<uuid>','forceSync',true),
  timeout_milliseconds := 150000) AS request_id;
```
Várakozás: `run_command` → `Start-Sleep -Seconds 30` (ne `schedule`, ne polling).

## 4. Ellenőrzés
1. **EF válasz:** `SELECT status_code, timed_out, error_msg, content FROM net._http_response WHERE id = <request_id>;`
   - Elvárt: 200, `worker_jobs_enqueued ≥ 1`, `auto_categorize_queued`, `enqueue_failed = 0`.
2. **Dátumtartomány:** `nav_sync_logs` (`date_from`, `date_to` irányonként). A tartomány az utolsó sikeres szinkron mínusz 2 nap, legfeljebb 7 nap.
3. **Queue:** `pgmq.q_nav_item_jobs` (még fut, `vt`), illetve `pgmq.a_nav_item_jobs WHERE msg_id > <baseline>`.
   - Elvárt: `read_ct = 1`, archiválva, `auto_categorize: true`.
   - Ha a job még fut, várj ≈60 s-ot (a kategorizálás akár 160 s is lehet).
4. **Kategorizálás:** `auto_categorize_jobs` (`company_id`, `created_at` > indítás): `completed`, `processed_invoices`, `categorized_count`.
5. **Baseline-diff:** `without_details` csökkent, `inbound_uncat` csökkent, `items_total` (nincs duplikáció).
6. **Logok:** `query_logs`, mindig `iso_timestamp_start` / `end`-del:
   ```sql
   select source, substring(event_message, 1, 90) as msg, count(*) as n, min(timestamp) as first_ts, max(timestamp) as last_ts
   from logs
   where (source = 'edge_logs' and (event_message like '%pgmq_set_vt%' or event_message like '%pgmq_send_retry%'
          or event_message like '%save_nav_invoice%' or event_message like '%pgmq_archive%'
          or event_message like '% | 4__ | %' or event_message like '% | 5__ | %'))
      or (source = 'postgres_logs' and (event_message ilike '%permission denied%' or event_message ilike '%error%'))
   group by source, msg order by first_ts limit 40
   ```
   - Elvárt: minden RPC 200, nincs 4xx/5xx, nincs „permission denied”.
   - Sorrend: `save_nav_invoice_details_and_items` → `pgmq_set_vt` → kategorizálás → `pgmq_archive`.

## Riport
- Táblázat lépésenként, időbélyeggel (UTC), számokkal.
- **Külön jelöld, ami NEM lett kipróbálva.** Például: nem volt új / tételek nélküli számla, ezért a `nav-fetch-details` ág nem futott. Vagy 0 besorolás volt, ezért a kategóriaírás nincs igazolva. Ilyenkor ajánlj másik céget.
