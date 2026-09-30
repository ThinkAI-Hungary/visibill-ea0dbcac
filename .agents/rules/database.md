---
trigger: model_decision
description: Apply when touching database schemas, writing migrations, RPC functions, RLS policies, or Supabase queries in eaisybill-prod.
---

# Database & Migration Guidelines (Visibill / eaisybill-prod)

## 🎯 1. Zero Silent DB Decisions
* **Kifejezett jóváhagyás kötelező:**
  * Bármilyen új tábla létrehozása, meglévő tábla oszlopainak módosítása, típusváltása vagy törlése előtt kötelező bemutatni a tervezett sémát a felhasználónak.
* **Destruktív műveletek tiltása:**
  * `DROP TABLE`, `DROP COLUMN`, `TRUNCATE` vagy feltétel nélküli `DELETE` szigorúan tilos felhasználói jóváhagyás nélkül.

---

## 📁 2. Migrációs Szabvány & Fájlkonvenciók (KÖTELEZŐ)
A projekt Supabase Git-alapú automatikus deploymentet használ. A migrációs motor hibátlan működéséhez az alábbi szabályok nem-alkuképesek:

* **Hely és fájlformátum:**
  * Minden adatbázis-módosításnak kizárólag a `supabase/migrations/` könyvtárba kell kerülnie.
  * Fájlnév formátum: `YYYYMMDDHHMMSS_<leiro_nev_snake_case>.sql` (pontosan 14 számjegyű időbélyeg).
  * *Példa:* `20260930120000_add_invoice_delivery_notes.sql`.
* **Időbélyeg-egyediség:**
  * Tilos korábbi vagy más fájlban már használt időbélyeget újra felhasználni! Mindig generálj egyedi, aktuális időbélyeget:
    ```powershell
    node -e "console.log(new Date().toISOString().replace(/\D/g, '').slice(0, 14))"
    ```
* **Tilos nem-migrációs SQL-t ide tenni:**
  * Bármilyen manuális segédszkript, teszt adatbázis-feltöltő, egyszeri javítószkript (`MANUAL_RUN_...`, `seed_...`, `temp_...`) kizárólag a `scripts/` mappába kerülhet, **soha nem a `supabase/migrations/` könyvtárba**!
* **Kötelező Idempotencia (Hiba-biztos DDL):**
  * Minden migrációnak újrafuttathatónak és ütközésmentesnek kell lennie:
    ```sql
    -- Tábla létrehozás
    CREATE TABLE IF NOT EXISTS public.table_name (...);

    -- Új oszlop hozzáadása
    ALTER TABLE public.table_name ADD COLUMN IF NOT EXISTS column_name text;

    -- Index létrehozás
    CREATE INDEX IF NOT EXISTS idx_table_col ON public.table_name (column_name);

    -- Trigger létrehozás
    DROP TRIGGER IF EXISTS trg_example ON public.table_name;
    CREATE TRIGGER trg_example BEFORE INSERT ON public.table_name ...;
    ```

---

## ⚙️ 3. RPC (Postgres Stored Procedures & Functions) Szabvány
* **Minden RPC migrációban él:**
  * Szigorúan tilos RPC-t kizárólag a Supabase SQL Editorban vagy ad-hoc módon létrehozni. Minden tárolt eljárásnak benne kell lennie egy verziózott migrációs fájlban (`supabase/migrations/`).
* **Kötelező `search_path` védelem (`SECURITY DEFINER` esetén):**
  * Minden `SECURITY DEFINER` függvényben kötelező rögzíteni a keresési útvonalat a jogosultság-kiterjesztési és schema-poisoning támadások kivédésére:
    ```sql
    CREATE OR REPLACE FUNCTION public.my_secure_rpc(...)
    RETURNS ...
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
    ...
    $$;
    ```
* **Függvény Volatilitás explicit deklarálása:**
  * **`STABLE`:** Ha a függvény csak lekérdez (nem módosít adatot). Ez teszi lehetővé a Postgres query optimizer számára a hatékony végrehajtást és indexhasználatot.
  * **`VOLATILE`:** Ha a függvény módosítást (INSERT/UPDATE/DELETE/TRUNCATE) végez.
  * **`IMMUTABLE`:** Ha a függvény tiszta matematikai/szöveges transzformációt végez, és az adatbázis állapotától független.
* **Strukturált visszatérési értékek:**
  * Mindig határozz meg pontos visszatérési típust (`RETURNS jsonb`, `RETURNS boolean`, vagy `RETURNS TABLE (id uuid, name text, ...)`). Kerüld a generikus, nem típusos `RETURNS record` használatát.

---

## 🛡️ 4. Row Level Security (RLS) és Bérlői Védelem
* **RLS kötelező minden táblán:**
  * Új tábla létrehozásakor azonnal ki kell adni:
    ```sql
    ALTER TABLE public.table_name ENABLE ROW LEVEL SECURITY;
    ```
* **Explicit szabályok:**
  * Mindig definiálj explicit `SELECT`, `INSERT`, `UPDATE`, `DELETE` szabályokat a bérlői/cég jogosultságok (`company_id`, `auth.uid()`) alapján.
* **Service Role bypass tudatosság:**
  * RLS házirendek írásakor vedd figyelembe, hogy a háttér worker (`service_role`) átlépi az RLS-t, míg a frontend kliensek szigorúan a felhasználó JWT tokenjével hajtják végre a szabályokat.

---

## 🚀 5. Teljesítmény és Indexelés (Production-Grade)
* **Idegen kulcsok (`REFERENCES`):**
  * Minden idegen kulcs oszlopra kötelező B-tree indexet tenni a JOIN műveletek és kaszkádolt törlések felgyorsítására.
* **Gyakran szűrt mezők:**
  * A `company_id, status`, `created_at DESC` típusú lekérdezésekhez készíts összetett (composite) indexet.
* **Nagy lekérdezések védelme:**
  * Frontend lekérdezéseknél szigorúan tilos `SELECT *` jellegű lekérdezést futtatni nagy táblákon vagy JSONB mezőkön; csak a szükséges mezőket kérd le.

---

## 🔄 6. Migrációs Nyilvántartás & Git Szinkron (Baseline Garancia)
* **Zero Phantom Migrations:**
  * Soha ne állítsd a felhasználónak, hogy egy migráció elkészült, amíg a fájl fizikailag meg nem íródott a `supabase/migrations/` mappában.
* **`schema_migrations` konzisztencia:**
  * Ha egy migrációt közvetlenül lefuttatsz egy távoli adatbázison (pl. MCP tool-lal), gondoskodj róla, hogy a verzió bekerüljön a `supabase_migrations.schema_migrations` táblába, különben a Supabase Git integráció a következő merge-kor újra megpróbálja lefuttatni és hibát dob.
* **Frontend TypeScript típusok:**
  * Bármilyen séma-, oszlop- vagy RPC-módosítás után ellenőrizd vagy frissítsd a TypeScript típusokat (`src/integrations/supabase/types.ts`).
