# A-031: Mailgun Webhook Robustness & Error Silencing

**Status:** Decided  
**Date:** 2026-07-07  
**Utoljára frissítve:** 2026-07-07

## Context

The `process-mailgun-webhook` Edge Function is responsible for handling incoming emails forwarded by Mailgun. When a recipient email alias is not found in the `email_aliases` table (e.g., for deactivated companies or legacy test data), the system historically logged a high-severity error to `app_error_logs` and returned a `404 Not Found` response.

This behavior had two negative consequences:
1. **Dashboard Noise:** The Management Dashboard was flooded with "Alias not found" errors for known defunct companies (e.g., `think-ai`).
2. **Mailgun Retries:** Mailgun interprets 4xx/5xx responses as transient failures and retries the webhook delivery multiple times over several hours, multiplying the error log volume.

## Decision

To improve system robustness and reduce monitoring noise, we have implemented the following changes in the `process-mailgun-webhook` function:

1. **Silent Fail-Fast (200 OK):** When an alias is not found, the function now returns a `200 OK` status instead of a `404`. This signals to Mailgun that the webhook was successfully received and processed, preventing unnecessary retries.
2. **Dashboard Silencing:** The `logError` call for missing aliases has been replaced with a `console.warn` (Runtime Log only). This keeps the Management Dashboard "Hibák" (Errors) tab focused on actionable system errors.
3. **Legacy Test Filtering:** Added an explicit hardcoded skip for the `think-ai@in.visibill.hu` address. Requests for this recipient are skipped immediately with a specific log message and no further processing.
4. **Improved Classification:** Added robust normalization and keyword matching for GLS COD (Cash on Delivery) reports to prevent misclassification as standard invoices.

## Consequences

**Pozitív:**
- Cleaner Management Dashboard (only actionable errors remain).
- Reduced database write volume (no `app_error_logs` inserts for missing aliases).
- Reduced compute costs (no Mailgun retries for dead aliases).

**Negatív:**
- Silent failures: If a legitimate alias is missing due to a bug, it will no longer appear on the Error Dashboard (only visible in Edge Function runtime logs).

## Kapcsolódó
- [A-011: Mailgun Email Processing](./A-011-email-processing.md)
- [A-005: Edge Functions](./A-005-edge-functions.md)
- [A-019: Management Dashboard](./A-019-management-dashboard.md)
- [A-041: Mailgun Webhook Concurrent Dedup — Háromrétegű Idempotency](./A-041-mailgun-concurrent-dedup.md)
