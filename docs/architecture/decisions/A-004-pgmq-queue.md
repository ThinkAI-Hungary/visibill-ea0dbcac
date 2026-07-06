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
1. Edge Function / DB trigger → dedup guard check → `pgmq.send()` — üzenet a queue-ba
2. Python Worker → `pgmq.read()` — poll loop, 5s interval
3. Feldolgozás → `pgmq.delete()` — sikeres befejezés
4. Hiba → `pgmq.archive()` — retry vagy dead letter

**Dedup Guard** (hozzáadva: 2026-06-28, ld. [A-023](./A-023-upload-dedup-protection.md)):

A `trigger_enqueue_invoice_job()` BEFORE INSERT trigger **1 perces ablakban** ellenőrzi,
hogy azonos `file_name + company_id` kombináció nem lett-e már `pending` vagy `processing`
státusszal beküldve. Ha igen, `processing_status := 'ignored'` és **nem** küld `pgmq.send()`-et.
Ez a DB-szintű safety net a frontend multi-click burst ellen.

## Consequences

**Pozitív:**
- Nincs extra infrastruktúra — a queue a Supabase DB-ben fut
- Tranzakcionális — a queue műveletek ACID-kompatibilisek
- Visibility timeout — nincs dupla feldolgozás
- Monitoring a DB-ből (SQL query-vel lekérdezhető a queue állapot)
- Dedup guard a trigger-ben — felesleges PGMQ üzenetek nem keletkeznek

**Negatív:**
- A PostgreSQL nem queue-optimalizált — nagyon nagy terhelésnél (1000+ msg/s) lassulhat
- Nincs beépített dead letter queue (manuálisan kezelendő)
- A worker aktívan poll-oz — nincs push notification (5s latency)
- A dedup guard 1 perces ablaka megakadályozza a szándékos gyors újrafeltöltést

