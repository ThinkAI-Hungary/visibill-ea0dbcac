# A-003: Multi-tenancy RLS Alapon

**Status:** Decided  
**Date:** 2025-09

## Context

A rendszer multi-company: egy felhasználó több céget kezelhet, és egy cégnek több tagja lehet. Az adatokat cég szinten kell szeparálni.

## Decision

**Row Level Security (RLS)** — minden tábla RLS policy-val van védve. A `company_id` mező a tenant identifier.

**Pattern:**
```sql
-- Minden felhasználó csak a saját cégeihez tartozó sorokat látja
CREATE POLICY "Users can view own company data"
ON invoices FOR SELECT
USING (company_id IN (
  SELECT company_id FROM company_members
  WHERE user_id = auth.uid()
));
```

**Struktúra:**
- `company_members` — összekapcsolja a user-eket és a cégeket (role: owner/admin/member)
- Minden adat-tábla (invoices, transactions, stb.) tartalmaz `company_id`-t
- A RLS policy a `company_members` táblán keresztül ellenőriz

## Consequences

**Pozitív:**
- Adatszeparáció DB szinten — nem lehet véletlenül "átszivárogni"
- A frontend kódnak nem kell szűrnie — a DB automatikusan szűr
- A service_role key (worker) megkerüli a RLS-t — hatékony batch feldolgozás

**Negatív:**
- Komplex JOIN-os RLS policy-k lassíthatják a lekérdezéseket
- Debugolás nehéz (RLS "csendesen" szűr, nem dob hibát)
- A `company_members` tábla RLS policy-ja kritikus pont — ha hibás, minden adat sérülékeny
