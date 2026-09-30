---
name: visibill-migration-sync
description: Use when checking, fixing, or synchronizing Supabase migration versions before pushing to Git or deploying via GitHub integration. Triggers on "/migration-sync", "/visibill-migration-sync", "migrációk ellenőrzése", "migráció szinkronizáció", "git push előtt migráció ellenőrzés", "supabase deploy előkészítés", "javítsd a migrációk verziózását", "migráció verziózás ellenőrzése", or any request to verify DB migrations against remote Supabase schema_migrations.
---

# Visibill Supabase Migration Sync & Deploy Guard

Ez a skill garantálja, hogy a helyi `supabase/migrations/` könyvtárban található migrációs fájlok és a távoli Supabase éles adatbázis `supabase_migrations.schema_migrations` táblája 100%-os szinkronban legyenek.

A GitHub-Supabase integráció bekötése után **minden Git push előtt kötelező lefuttatni**, mert a Supabase CI/CD deploy azonnal elhasal, ha:
1. Duplikált vagy formátumhibás timestamp szerepel a repóban.
2. A távoli adatbázisban létezik olyan migráció, ami hiányzik a Git repóból (Ghost Migration).
3. A repóban olyan migráció szerepel, ami már korábban manuálisan lefutott a DB-ben, de nincs regisztrálva a `schema_migrations` táblában (a push újra megpróbálná lefutatni: `relation already exists` fatális hiba).
4. Egy új migráció időbélyege korábbi, mint az utolsó lefutott távoli migráció (Out-of-order Migration hiba).

---

## ⚡ Gyors Futtatás (Quick Start)

### 1. Helyi fájlok statikus ellenőrzése
```powershell
npm run verify:migrations
```
Ez azonnal ellenőrzi a duplikátumokat és a formátumot.

---

## 🔄 Részletes Szinkronizációs Protokoll (Workflow)

### 1. Lépés: Helyi migrációk feltérképezése
Futtasd le a helyi szkennert:
```powershell
node scripts/verify-migrations.mjs
```
Ellenőrizd:
- Van-e formátumhibás fájlnév (`malformed`)?
- Van-e duplikált időbélyeg (`duplicates`)? Ha igen, a későbbi funkciót kapó fájlt át kell nevezni egyedi, szabad timestamp-re!
- Mi a helyi legnagyobb verziószám (`latest local version`)?

### 2. Lépés: Távoli adatbázis lekérdezése (`supabase-visibill`)
Kérdezd le az adatbázisban regisztrált összes migrációt az MCP `execute_sql` segítségével:
```sql
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version ASC;
```

### 3. Lépés: Kétirányú Diff Analízis (Disk vs DB)
Hasonlítsd össze a lemezen lévő fájlokat és a DB-ben lévő verziókat:

#### A) IN DB ONLY (Ghost Migration — Adatbázisban létezik, de lemezről hiányzik)
* **Kockázat:** A Supabase GitHub deploy driftet jelez, a helyi kódbázis elmarad az éles sémától.
* **Megoldás:**
  1. Kérdezd le a migráció SQL tartalmát a távoli táblából:
     ```sql
     SELECT statements FROM supabase_migrations.schema_migrations WHERE version = '<version>';
     ```
  2. Generáld le és mentsd el a fájlt a lemezre:
     `supabase/migrations/<version>_<name>.sql`
  3. Formázd meg szabályos SQL-ként (pontosvesszők és elválasztó újsorok).

#### B) ON DISK ONLY (Lemezről létezik, de a DB-ben nincs bejegyezve)
* **1. Eset — A sémaváltozás már érvényesült az éles DB-ben:**
  * Ha a migrációban szereplő tábla, oszlop, jogosultság vagy RPC már fizikailag létezik a távoli DB-ben (pl. manuálisan lett futtatva):
  * **KÖTELEZŐ bejegyezni a `schema_migrations` táblába push előtt**, különben a Supabase GitHub Integration megpróbálja újra lefutatni, ami `relation already exists` vagy `column already exists` hibával meghiúsítja a teljes CI/CD deployt!
  * Regisztráció:
    ```sql
    INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
    VALUES ('<version>', '<name>', ARRAY['<stmt1>', '<stmt2>'])
    ON CONFLICT (version) DO NOTHING;
    ```
* **2. Eset — Valóban új migráció (amit a GitHub deploynak kell lefutatnia):**
  * Ellenőrizd a verziószámot! A verziónak **szigorúan nagyobbnak kell lennie**, mint a távoli DB-ben valaha regisztrált legnagyobb verzió:
    `version > MAX(schema_migrations.version)`
  * Ha kisebb (out-of-order): nevezd át a fájlt a jelenlegi UTC időbélyegre: `YYYYMMDDHHMMSS_<name>.sql`!

---

## 🛡️ Minőségbiztosítási Kapuk Git Push Előtt

Mielőtt a kódot pusholnád a remote repóba:
1. **Fájlrendszer szinkronitás:**
   `ON DISK ONLY: []` és `IN DB ONLY: []`
2. **TypeScript fordítás ellenőrzés:**
   ```powershell
   npx tsc --noEmit
   ```
3. **Graphify tudásgráf szinkronizálása:**
   ```powershell
   graphify update .
   ```
4. **Git Státusz & Pre-Commit:**
   Csak a szándékos és letesztelt `.sql` fájlok és kódok kerüljenek a commitba.
