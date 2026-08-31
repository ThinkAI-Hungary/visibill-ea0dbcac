# A-075: Management Overview Null-Safety in SQL JSON Aggregations

**Status:** Decided  
**Date:** 2026-08-31  
**Category:** Adatbázis & Platform Üzemeltetés  
**Related Decisions:** [A-019](./A-019-management-dashboard.md), [A-061](./A-061-decompose-management-dashboard.md), [A-068](./A-068-management-files-rpc-pagination.md)

---

## 1. Context

A Management Dashboard **Áttekintés** és **Superadmin** fülén minden statisztika 0-t mutatott:
- Felhasználók száma: 0
- Regisztrált cégek száma: 0
- Havi összköltség: $0.0000
- Superadmin cég- és felhasználólisták: "Nincs találat"

A vizsgálat kiderítette, hogy az `action=overview` kiszolgálásakor meghívott `get_company_counts()` tárolt eljárás elszállt a következő PostgreSQL hibával:
`ERROR: 22004: null value not allowed for object key`
`PL/pgSQL function get_company_counts() line 4 at SQL statement`

**A hiba oka:**
Az eljárásban a `json_object_agg(company_id::text, cnt)` aggregációs függvény `WHERE company_id IS NOT NULL` szűrés nélkül futott le a `nav_invoices`, `invoices`, `transactions` és `salary` táblákon. Amikor árván maradt vagy nem hozzárendelt rekordok miatt a `company_id` értéke `NULL` volt, a `json_object_agg` megkísérelte a `NULL` értéket JSON kulcsként használni, amit a PostgreSQL szigorúan elutasít. Emiatt a `management-stats` Edge Function catch ága lefutott és `emptyOverview`-t adott vissza.

---

## 2. Decision

1. **Null-Safe JSON Object Aggregation:**
   - A `get_company_counts()` SQL függvény mind a 4 rész-lekérdezésében kötelezővé tettük a `WHERE company_id IS NOT NULL` feltételt:
     ```sql
     CREATE OR REPLACE FUNCTION public.get_company_counts()
     RETURNS json
     LANGUAGE plpgsql
     SECURITY DEFINER
     AS $$
     DECLARE result json;
     BEGIN
       SELECT json_build_object(
         'invoices',     (SELECT COALESCE(json_object_agg(company_id::text, cnt), '{}') FROM (SELECT company_id, COUNT(*) AS cnt FROM invoices WHERE company_id IS NOT NULL GROUP BY company_id) x),
         'nav_invoices', (SELECT COALESCE(json_object_agg(company_id::text, cnt), '{}') FROM (SELECT company_id, COUNT(*) AS cnt FROM nav_invoices WHERE company_id IS NOT NULL GROUP BY company_id) x),
         'transactions', (SELECT COALESCE(json_object_agg(company_id::text, cnt), '{}') FROM (SELECT company_id, COUNT(*) AS cnt FROM transactions WHERE company_id IS NOT NULL GROUP BY company_id) x),
         'salary',       (SELECT COALESCE(json_object_agg(company_id::text, cnt), '{}') FROM (SELECT company_id, COUNT(*) AS cnt FROM salary WHERE company_id IS NOT NULL GROUP BY company_id) x)
       ) INTO result;
       RETURN result;
     END;
     $$;
     ```
2. **Multi-Tenant Adatbázis Paritás:**
   - A javítás azonnal alkalmazásra került mindhárom adatbázisban: `PROD` (supabase-visibill), `VSWEB` (supabase-visibill-vsweb) és `THINKERMAN` (supabase-visibill-thinkerman).
   - Létrehoztuk a `supabase/migrations/20260831153000_fix_get_company_counts_null_keys.sql` migrációs fájlt.

---

## 3. Consequences

### Pozitív:
- A Management Dashboard Áttekintés oldala és a Superadmin fül azonnal és hiba nélkül betölti a regisztrált cégeket (39+ cég), felhasználókat és számlaszámokat.
- Megszűntek a `22004: null value not allowed for object key` adatbázis hibák.
