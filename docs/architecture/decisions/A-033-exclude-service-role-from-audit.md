# A-033: Exclude Service Role Operations from Company Audit Trail

**Status:** Decided
**Date:** 2026-07-09
**Utoljára frissítve:** 2026-07-09

## Context
Deleting files or invoices from the operator / management dashboard triggered the database-level global audit trigger `global_audit_trigger_func()`. Because the operator dashboard operates using the Supabase Service Role (admin client bypasses RLS), the trigger ran with `auth.uid()` as `NULL`, inserting entries like `"Rendszer törölt egy dokumentumot"` (System deleted a document) into the `audit_logs` table.

This mixed developer/operator-initiated system cleanup tasks with the user-visible, client-company-specific audit log (activity log), creating confusing noise for company users on their dashboard sidebars.

## Decision
1. **Audit Log szűrés**: Módosítottuk a `global_audit_trigger_func()` trigger-függvényt, hogy ellenőrizze az aktív Postgres jogosultsági szerepkört (`auth.role()`). Amennyiben az `'service_role'` (üzemeltetői Edge Function-ök, háttér worker-ek), a cég szintű `public.audit_logs` táblába való beírás elmarad:
   ```sql
   -- Only write to audit logs if auth.role() is not 'service_role'
   IF (v_company_id IS NOT NULL AND v_entity_name IS NOT NULL AND auth.role() <> 'service_role') THEN
       INSERT INTO public.audit_logs (company_id, user_id, action, entity, entity_name, details)
       VALUES (...);
   END IF;
   ```
   Ez megakadályozza, hogy a dashboardról indított vagy automata takarításokból származó események (mint a `"Rendszer törölt egy dokumentumot"`) bekerüljenek az ügyfél naplójába.

2. **Törölt fájlok szoftveres szűrése (llm_koltsegek megőrzésével)**: Ha egy fájl törlődik az uploads táblákból, a hozzá kapcsolódó költségrekordot a `public.llm_koltsegek` táblában **megőrizzük**, hogy a rendszerszintű LLM statisztikák és elszámolások pontosak maradjanak.
   Ugyanakkor az üzemeltetői felület tisztán tartása érdekében az Edge Function (`management-stats`) szintjén kiszűrjük azokat a bejegyzéseket, amelyeknél a hivatkozott feltöltési rekord már nem létezik a forrástáblában:
   ```typescript
   // Kiszűrjük azokat a recent_jobs elemeket, amiknek az upload-ja már nem létezik a rendszerben
   .filter((r: any) => !r.upload_id || r.source !== null)
   ```
   A hibalista (`error_jobs`) szintén automatikusan szűri ezeket, mivel a hibás elemeket közvetlenül az aktív feltöltési táblákból olvassa fel.

## Consequences

### Pozitív
* A cégek tevékenységnaplója (Activity Log) tiszta marad, kizárólag a cég saját felhasználóinak interakcióit mutatja.
* Nem keletkeznek félrevezető "Rendszer törölt egy dokumentumot" és hasonló rendszer-generált bejegyzések a klienseknél.

### Negatív
* A management dashboardról indított akciók nem kerülnek be az `audit_logs` táblába. (Ezek a műveletek szükség esetén külön üzemeltetői naplókban követhetők nyomon.)

## Kapcsolódó
* [A-017: Security Architecture](./A-017-security-architecture.md)
* [A-019: Management Dashboard Architecture](./A-019-management-dashboard.md)
