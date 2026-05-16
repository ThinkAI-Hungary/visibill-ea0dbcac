# Decision 021: Főkönyvi Rendszer (General Ledger)

**Status:** Decided

**Category:** Pénzügyi Modulok

**Question:** Hogyan működik a főkönyvi számlakeret és az AI-alapú osztályozás?

**Decision:**
- Számlatükör sablonok (chart_of_accounts_presets): generic / custom típusok
- Hierarchikus GL számlák (gl_accounts, parent_id) — 1,804 számla a production-ben
- AI-alapú GL osztályozás minden entitáson: invoices, nav_invoices, transactions, invoice_items, nav_invoice_items
- Manuális felülbírálás (gl_is_manually_overridden) + override napló (gl_overrides_log)
- Confidence score + reasoning az AI döntésekhez
- Tétel-szintű GL osztályozás (gl_classifications JSONB)

**Rationale:** A hierarchikus számlatükör és az AI-alapú osztályozás lehetővé teszi, hogy a rendszer automatikusan könyvelje a tételeket, miközben a felhasználó felülbírálhatja a döntéseket. Az override log biztosítja az auditálhatóságot.
