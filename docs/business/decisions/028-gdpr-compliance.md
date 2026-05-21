# Decision 028: GDPR & Adatvédelem

**Status:** Open

**Category:** Biztonság & Compliance

**Question:** Milyen adatvédelmi és GDPR compliance intézkedések szükségesek? Mi az adatmegőrzési policy? Van-e törlési kérelem workflow? Szükséges-e kétfaktoros hitelesítés (2FA)?

**Decision:**

**Jelenlegi implementáció:**
- **RLS:** Minden tábla RLS-engedélyezett ✅
- **Audit log:** audit_logs tábla (1,671 bejegyzés) ✅
- **Adatexport:** export-user-data Edge Function ✅
- **Session kezelés:** IdleWarningModal (inaktivitási figyelmeztetés) ✅
- **Vault:** Érzékeny NAV credentials Supabase Vault-ban ✅
- **Hiányzik:** Adatmegőrzési policy, GDPR törlési workflow, 2FA

**Rationale:**
