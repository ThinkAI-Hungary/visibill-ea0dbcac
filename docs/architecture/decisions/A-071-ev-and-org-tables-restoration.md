# A-071: Missing EV & Org Database Tables Schema Restoration & Multi-Tenant Parity

**Status:** Decided  
**Date:** 2026-08-31  
**Category:** Adatbázis & eaisyBooks  
**Related Decisions:** [A-003](./A-003-multi-tenancy-rls.md), [A-016](./A-016-postgresql-query-strategy.md), [P-031](../../product/decisions/P-031-accounty-layout.md), [P-032](../../product/decisions/P-032-vat-return-workflow.md)

---

## 1. Context

A frontend eaisyBooks EV moduljának ÁFA bevallások oldalán (`/ev/vat`, `EvVatPage.tsx`) a lekérdezés `PGRST205` hibával elbukott:
`Could not find the table 'public.accounty_ev_vat_returns' in the schema cache`.

A több-adatbázisos vizsgálat feltárta, hogy míg a `VSWEB` és `THINKERMAN` adatbázisokban léteztek az `accounty_ev_vat_returns`, `accounty_ev_chamber_payments` és `accounty_org_report_lines` táblák, a `PROD` adatbázisból hiányoztak. A kimaradás oka egy korábbi (júniusi) migrációban lévő törlő script szekvencia volt.

---

## 2. Decision

Létrehoztuk és élesítettük a `20260831150000_create_missing_accounty_ev_and_org_tables.sql` migrációt, amely garantálja a 100%-os adatbázis-paritást minden tenant bázisban:

1. **Táblák létrehozása:**
   - `accounty_ev_vat_returns`: EV ÁFA analitika és bevallások (negyedéves/havi bontás, levonható/fizetendő/egyenleg összegek, státuszok, határidők).
   - `accounty_ev_chamber_payments`: Éves kötelező kamarai hozzájárulások nyilvántartása és befizetési státusza.
   - `accounty_org_report_lines`: Egyszerűsített éves szervezeti beszámoló (mérleg és eredménykimutatás sorok).
2. **RLS & Jogosultságok:**
   - Mindhárom táblán bekapcsolva az RLS.
   - Hozzáférés-szabályozás a `has_accounty_company_access(company_id)` szabványos függvényen keresztül.
   - Explicit `GRANT ALL` az `authenticated` és `service_role` felhasználóknak.
3. **Indexelés:**
   - Multi-tenant kompozit indexek `(company_id, tax_year)` a gyors aggregáció és szűrés érdekében.

---

## 3. Consequences

### Pozitív:
- Az egyéni vállalkozói és szervezeti modulok (ÁFA bevallás, kamarai díjak, egyszerűsített beszámoló) hibátlanul működnek PROD környezetben is.
- A PostgREST séma cache szinkronban van a frontend hookokkal.
