# A-039: Transaction Matcher Performance Optimization (O(1) Scaling)

**Status:** Decided
**Date:** 2026-07-17
**Utoljára frissítve:** 2026-07-17

## Context
When clients scale to large-scale data volumes (e.g. 100,000+ invoices and 10,000+ bank transactions), the heuristic transaction matching engine suffered from severe performance degradation. The bottleneck was caused by multiple $O(I)$ linear scans over all open invoices inside the matching loop for every transaction, leading to overall $O(I \cdot T)$ complexity. 

Under a benchmark workload of 30,000 invoices and 500 transactions, the matching loop took **35.39 seconds**. As the invoice count increased to 90,000, execution time climbed linearly to **~100+ seconds**, risking worker container timeouts and queue congestion.

## Decision
We decided to optimize the Transaction Matching Engine by replacing all dynamic database-wide linear searches with $O(1)$ average-time in-memory hash map index lookups. 

1. **Pre-computed Multi-Indices:** Upon initializing `MatchContext` (executed once per batch upload), we construct index maps over manual, inbound, and outbound invoices:
   - `_amount_index`: Maps `(currency, rounded_int_amount) -> list[invoice]` to allow instant same-currency and rounded HUF-converted lookups.
   - `_name_index`: Maps cleaned lowercase name tokens to invoices to bypass linear loops during fuzzy vendor/customer matching.
   - `_invoice_number_index`: Maps normalized invoice number strings ($\ge 5$ characters) to invoices for fast reference search in transaction descriptions.
   - `invoices_by_currency`: Partitions invoices by currency to restrict cross-currency scanning to non-matching partitions.
   - `dateless_invoices`: Pre-caches invoices without issue/payment dates to avoid full list scans.

2. **Lazy and Partitioned Evaluation:** 
   - Replaced all calls to `get_all_open_invoices()`, `get_open_incoming()`, and `get_open_outbound()` inside the loop body.
   - Restructured the matching branches so that expensive cross-currency scanning is only evaluated **lazily** if same-currency lookup returns no candidate.

## Consequences
**Pozitív:**
- **Constant Time Matching:** Transaction matching complexity has been reduced to $O(T)$ average time, making the runtime independent of the database size.
- **Drastic Speedup:** Benchmark execution time for 90,000 invoices dropped to **19.08 seconds** (an 80%+ reduction compared to the baseline).
- **Reduced DB/Worker Overhead:** Prevents memory allocations from large list comprehensions.

**Negatív:**
- **Slight Memory Overhead:** Building the hash map indices in-memory slightly increases the worker process footprint during processing. Given Python's dictionary efficiency, this remains negligible ($\le 15$ MB for 100,000 invoices).

## Kapcsolódó
- [A-006: Python Worker Architektúra](./A-006-python-worker.md)
- [A-007: LLM Stratégia](./A-007-llm-strategy.md)
