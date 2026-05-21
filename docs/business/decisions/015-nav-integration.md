# Decision 015: NAV Integráció Scope

**Status:** Decided

**Category:** NAV Integráció

**Question:** Milyen mélységben integráljuk a NAV Online Számla rendszert?

**Decision:**
- **NAV Online Számla API v3** teljes integráció
- **Bejövő** (INBOUND) és **kimenő** (OUTBOUND) számlák lekérdezése
- Credentials biztonságos tárolása **Supabase Vault**-ban (password, sign key, exchange key → secret_id-k)
- **Test/Production** környezet támogatás (is_test_environment flag)
- Validációs állapot nyomon követése (validation_status: pending → valid/invalid)
- Kétfázisú lekérdezés: lista lekérdezés → részletes adatok (details_fetched flag)
- Tételes bontás (nav_invoice_items) — 33,776 tétel a production DB-ben

**Rationale:** A NAV integráció a Visibill egyik core értékajánlata. A Vault használata biztosítja, hogy az érzékeny NAV credentials-ök soha ne legyenek plain text-ben tárolva. A kétfázisú lekérdezés optimalizálja az API hívások számát.
