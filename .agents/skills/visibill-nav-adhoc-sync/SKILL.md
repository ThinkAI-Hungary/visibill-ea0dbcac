---
name: visibill-nav-adhoc-sync
description: Performs ad-hoc NAV invoice synchronization for a specific company and date range. Fetches both digests and full line item details.
---

# NAV Ad-hoc Synchronization Skill

Use this skill when you need to manually fetch NAV invoices for a company that might have missed some periods, or for initial data loading when the automatic sync is not sufficient.

## Workflow

### 1. Context Gathering
Identify the target `user_id`, `company_id`, and the `date_range` (start and end dates).
Retrieve the NAV credentials for the company using the `get_nav_credentials` RPC:
```sql
SELECT public.get_nav_credentials('COMPANY_ID');
```

### 2. Fetch Invoice Digests
Use the `nav_sync_engine.py` script to fetch the list of invoices for the specified period.
```bash
python .agents/skills/visibill-nav-adhoc-sync/scripts/nav_sync_engine.py digest --start-date YYYY-MM-DD --end-date YYYY-MM-DD --creds 'JSON_CREDS'
```
The script will output a JSON list of invoices.

### 3. Load Invoices into Database
Generate and execute an UPSERT SQL statement for the `public.nav_invoices` table using the fetched data.
Ensure `user_id` and `company_id` are correctly set.
Set `details_fetched = false` (the default) if you plan to fetch details in the next step.

### 4. Fetch Invoice Details (Line Items)
Use the same script to fetch full details for the newly imported invoices.
```bash
python .agents/skills/visibill-nav-adhoc-sync/scripts/nav_sync_engine.py details --invoices 'JSON_INVOICE_LIST' --creds 'JSON_CREDS'
```
This will return the line items and updated header info (gross amount, cash accounting status).

### 5. Load Details into Database
Generate and execute SQL to:
- Update `nav_invoices` with `details_fetched = true`, `is_cash_accounting`, and `invoice_gross_amount`.
- Insert into `nav_invoice_items`.

## Guidelines
- **Date Chunking:** The NAV API allows maximum 35 days per request. The script handles this automatically.
- **Rate Limiting:** Use at least 0.5s delay between requests to avoid NAV blocking.
- **Namespaces:** NAV XML uses various namespaces. Use regex-based parsing (`<(?:[^:]+:)?tag>`) for resilience.
- **Authentication:** Use `SHA3-512` for request signatures and `SHA-512` for passwords.

## Support Scripts
- `scripts/nav_sync_engine.py`: The core engine for NAV API interaction.
