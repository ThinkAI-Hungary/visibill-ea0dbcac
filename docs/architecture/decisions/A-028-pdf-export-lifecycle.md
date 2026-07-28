# A-028: PDF Export Workflow & Lifecycle (v2 — Worker Pipeline)

**Status:** Decided
**Date:** 2026-07-05
**Utoljára frissítve:** 2026-07-05
**Supersedes:** A-028 v1 (EF-based processing)

## Context
A felhasználóknak szükségük van a kiválasztott számlák PDF alapú exportálására.
Több ezer számla is lehet egy exportban. Az eredeti EF-alapú megoldás timeout-okba
ütközött (Deno 400s limit), a böngésző-alapú pdf-lib merge pedig elveszett ha a user elnavigált.

### Elvetett megoldások
1. **Edge Function feldolgozás** (v12) — 400s timeout limit, nem skálázható
2. **Böngésző-alapú pdf-lib merge** (v13) — User elnavigáláskor elveszett, memóriaigényes

## Decision
A PDF export feldolgozás a **Python Worker**-be került, PGMQ-n keresztül:

### Architektúra
```
Frontend → EF (auth + query + PGMQ enqueue) → Worker felveszi <1s
                                                     ↓
                                               Download images (httpx async)
                                               PyMuPDF + Pillow merge
                                               Upload → Storage
                                               Job → completed
                                                     ↓
                              Frontend ← Poll/Realtime ← DB update
                                   ↓
                             Auto-download / Toast notification
```

### Komponensek

| Komponens | Fájl | Felelősség |
|---|---|---|
| **Edge Function** (v14) | `generate-pdf-export/index.ts` | Auth, invoice query, `export_mode` & `include_posting_slips` opciók átvétele, job insert, PGMQ enqueue |
| **Worker** | `pdf_export_processor.py` | Download, merge, A4 **Kontírozó Lap** PIL képgenerálás (`_generate_posting_slip_image`), upload, DB update |
| **Frontend hook** | `usePdfExport.ts` | Start, poll, auto-download, banner |
| **Global notification** | `usePdfExportNotifications.ts` | Toast bármely oldalon (transition-based) |
| **Banner** | `PdfExportBanner.tsx` | Vizuális állapotjelző |

### Job lifecycle & Modes
```
queued → processing → completed → downloaded → [cleanup cron 24h]
                   ↘ error
```
- **Export Módok (`export_mode` / `include_posting_slips`):**
  - **`standard`**: Sima számlaképek kötege egymás után összefűzve.
  - **`posting_slips`**: Minden egyes számla képe mögé automatikusan legyártásra kerül annak 1 oldalas A4-es **Kontírozó Lapja** (bizonylat adatok, Tartozik T / Követel K főkönyvi számlák, tételes bontás).

### Cleanup
- **pg_cron** `cleanup-pdf-exports`: hajnali 3:00 UTC
  - Storage fájlok: 24h+ törlés (pg_net HTTP DELETE → Storage API)
  - Job rekordok: 7d+ `downloaded`/`expired`/`error` törlés

### RLS
- SELECT: `user_id = auth.uid()` — user csak saját jobját látja
- UPDATE: `user_id = auth.uid()` — user csak saját jobját módosíthatja (downloaded státusz)
- INSERT/DELETE: service_role only (EF + cron)

### PGMQ
- Queue: `pdf_export_jobs`
- VT: 1800s (30 perc) — nagy exportokhoz
- Worker listener: `pdf_export_listener` az `asyncio.gather()`-ben

## Consequences
**Pozitív:**
- Nincs timeout limit (worker nincs korlátozva)
- User elnavigálhat — a feldolgozás a háttérben megy
- Párhuzamos exportok (asyncio I/O concurrency)
- Globális toast notification bármely oldalon

**Negatív:**
- Worker dependency (ha a worker leáll, az export is)
- Polling overhead (3-15s interval a global hook-ban)

## Kapcsolódó
- [A-004: PGMQ](./A-004-pgmq-queue.md)
- [A-005: Edge Functions](./A-005-edge-functions.md)
- [A-006: Python Worker](./A-006-python-worker.md)
- [P-045: PDF Export UX](../product/decisions/P-045-pdf-export-ux.md)
