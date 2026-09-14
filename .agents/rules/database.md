---
trigger: model_decision
description: Apply when touching database schemas, writing migrations, RPC functions, RLS policies, or Supabase queries in eaisybill-prod.
---

# Database & Supabase Guidelines (Visibill / eaisybill-prod)

## 1. Zero Silent DB Decisions
* **Kifejezett jóváhagyás kötelező:**
  * Bármilyen új tábla létrehozása, meglévő tábla oszlopainak módosítása, típusa vagy törlése előtt kötelező bemutatni a tervezett sémát és megszerezni a felhasználó jóváhagyását.
* **Destruktív műveletek védelme:**
  * `DROP TABLE`, `DROP COLUMN`, `TRUNCATE` vagy feltétel nélküli `DELETE` szigorúan tilos felhasználói jóváhagyás nélkül.

## 2. Row Level Security (RLS) és Biztonság
* **RLS kötelező minden táblán:**
  * Minden újonnan létrehozott táblára kötelező azonnal kiadni:
    ```sql
    ALTER TABLE public.table_name ENABLE ROW LEVEL SECURITY;
    ```
  * Definiálj explicit SELECT, INSERT, UPDATE, DELETE szabályokat a bérlői/szervezeti jogosultságok (`auth.uid()`, `organization_id`, stb.) alapján.
* **SECURITY DEFINER függvények védelme:**
  * Minden `SECURITY DEFINER` függvénynek kötelező rögzíteni a keresési útvonalát:
    ```sql
    SET search_path = public;
    ```
  * Ezzel kivédjük a jogosultság-kiterjesztési és függvény-injektálási sérülékenységeket.

## 3. Teljesítmény és Indexelés (Postgres Best Practices)
* **Idegen kulcsok és szűrések:**
  * Minden `REFERENCES` idegen kulcs oszlopra kötelező B-tree indexet tenni a JOIN műveletek és kaszkádolt ellenőrzések felgyorsítására.
  * Gyakran szűrt vagy rendezett oszlopokra (pl. `status`, `created_at`, `due_date`) megfontolandó a kompozit vagy részleges (partial) index.
* **Nagy lekérdezések:**
  * Kerüld a `SELECT *` jellegű lekérdezéseket hatalmas szöveges/JSON mezőkkel. Csak a képernyőn ténylegesen megjelenítendő mezőket kérd le (`.select('id, name, status')`).

## 4. Típus- és Sémakövetés
* Adatbázis módosítás vagy új migráció után ellenőrizd vagy frissítsd a TypeScript típusokat (`src/integrations/supabase/types.ts`), hogy a frontend azonnal típusbiztosan lássa az új mezőket.
* Kövesd a [visibill-db-checklist](file:///d:/ThinkAI/Visibill/eaisybill-prod/.agents/skills/visibill-db-checklist/SKILL.md) lépéseit minden kritikus módosítás előtt.
