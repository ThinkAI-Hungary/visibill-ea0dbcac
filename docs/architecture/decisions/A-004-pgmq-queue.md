# A-004: PGMQ mint Aszinkron Queue

**Status:** Decided  
**Date:** 2025-09

## Context

A dokumentumfeldolgozás (OCR + LLM) 5-30 másodpercig tart. A felhasználónak nem szabad várakoznia. Szükségünk van egy megbízható queue rendszerre. Lehetőségek: Redis/BullMQ, RabbitMQ, AWS SQS, PGMQ.

## Decision

**PGMQ** (Postgres Message Queue) — a Supabase PostgreSQL-ben futó natív queue extension.

**Queue-k:**
| Queue | Trigger | Worker művelet |
|-------|---------|---------------|
| `invoice_processing` | Számla upload/email | OCR → LLM extraction → GL |
| `transaction_processing` | CSV upload | Parsing → AI matching |
| `salary_processing` | Bérjegyzék upload | OCR → LLM extraction |
| `bank_statement_processing` | Bankszámlakivonat | CSV parsing → matching |
| `nav_categorization` | NAV sync | GL kategorizálás |

**Működés:**
1. Edge Function / DB trigger → `pgmq.send()` — üzenet a queue-ba
2. Python Worker → `pgmq.read()` — poll loop, 5s interval
3. Feldolgozás → `pgmq.delete()` — sikeres befejezés
4. Hiba → `pgmq.archive()` — retry vagy dead letter

## Consequences

**Pozitív:**
- Nincs extra infrastruktúra — a queue a Supabase DB-ben fut
- Tranzakcionális — a queue műveletek ACID-kompatibilisek
- Visibility timeout — nincs dupla feldolgozás
- Monitoring a DB-ből (SQL query-vel lekérdezhető a queue állapot)

**Negatív:**
- A PostgreSQL nem queue-optimalizált — nagyon nagy terhelésnél (1000+ msg/s) lassulhat
- Nincs beépített dead letter queue (manuálisan kezelendő)
- A worker aktívan poll-oz — nincs push notification (5s latency)
