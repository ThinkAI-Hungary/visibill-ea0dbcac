# A-125: Atomi Házipénztári Számlakiegyenlítés és Auth Életciklus Védelmek

**Status:** Decided  
**Date:** 2026-09-18  
**Utoljára frissítve:** 2026-09-18  

## Context

A rendszerhibák auditálása és a kódmélységi vizsgálatok során három összefüggő integritási hiányosság került feltárásra a házipénztár, a számlakezelés és a kliensoldali hibajelentés területén:
1. **Házipénztári Számlakiegyenlítés Nem-Atomi Állapota:** A `/petty-cash` felületen a nyitott kimenő számlák készpénzes kiegyenlítése korábban két különálló REST mutációként futott le: először beszúrta a bizonylatot a `petty_cash_entries` táblába, majd frissítette a számlák állapotát (`invoices.fizetve = true`). Amennyiben a két művelet között hálózati megszakadás vagy böngészőbezárás történt, a bizonylat létrejött, de a számla nyitott maradt. Emellett a számlák későbbi módosításakor a `sync_petty_cash_on_invoice_change` trigger tévesen törölhette a manuálisan létrehozott kiegyenlítési bizonylatot.
2. **Házipénztár UUID Típuskonverziós Hiba (`22P02`):** Új bizonylat felvitelekor a még be nem töltött pénztárak esetén az üres string (`""`), a kiválasztatlan partnerek esetén pedig a `'none'` került átadásra az adatbázis UUID mezőibe, meghiúsítva a mentést.
3. **PDF Export Anonim Jogosultsági Hiba (`42501`):** A `usePdfExport` hook a felhasználói session felállása előtt futtatta a `pdf_export_jobs` lekérdezést, amelyre az `anon` szerepkörnek nincs joga, így feleslegesen teleírta az `app_error_logs` táblát.
4. **Böngészőbővítmények Zajszűrése:** Harmadik féltől származó kliensbővítmények (pl. `window.__go`, `chrome-extension://`) hibái beszennyezték a globális hibagyűjtőt.

## Decision

A rendszer robusztusságának növelése érdekében a következő architektúrális intézkedéseket hoztuk meg:

### 1. Atomi Számlakiegyenlítő Tárolt Eljárás (`settle_invoices_via_petty_cash`)
Létrehoztunk egy új PostgreSQL tárolt eljárást:
```sql
public.settle_invoices_via_petty_cash(
  p_company_id uuid,
  p_register_id uuid,
  p_entry_date date,
  p_invoice_ids uuid[],
  p_description text DEFAULT NULL
) RETURNS jsonb
```
* **Biztonság & Multi-tenancy:** `SECURITY DEFINER`, `search_path = public`, jogosultság-ellenőrzés a `company_members` táblán vagy `is_support_admin()` hívással.
* **ACID Tranzakcionalitás:** Egyetlen tranzakcióban (`BEGIN ... COMMIT`) hozza létre a `petty_cash_entries` bizonylatot és zárja le a számlákat az `invoices` táblában (`fizetve = true`, `fizetes_napja = p_entry_date`). Hiba esetén a teljes művelet visszagördül.
* **Trigger Védelem:** A `sync_petty_cash_on_invoice_change` triggert felvérteztük az `AND source_type != 'invoice_settlement'` záradékkal, így a háttérbeli NAV számlaszinkronizáció soha nem törölheti a manuális kiegyenlítéseket.
* **Jogosultságok:** `REVOKE ALL FROM public, anon; GRANT EXECUTE TO authenticated, service_role`.

### 2. Kliensoldali Validáció és Szanitizáció
* A `src/components/petty-cash/types.ts` modulba bekerült a `sanitizePartnerId` (üres string és `'none'` konvertálása `null`-ra) és a `validatePettyCashEntryPayload` függvény.
* A `ManualEntryDialog` reaktívan veszi fel az alapértelmezett pénztárat, 0 elérhető pénztár esetén figyelmeztet és letiltja a mentést.

### 3. PDF Export Auth-Életciklus Védelem
* A `usePdfExport.ts` lekérdezése `enabled: Boolean(companyId && userId)` feltételhez kötött, elkerülve az anonim PostgREST hívásokat.
* A `userId` bekerült a React Query kulcsba és a Realtime csatorna figyelőbe.
* A `42501` hibák és auth lejárások csendes konzolos figyelmeztetésként (`console.warn`) futnak az adatbázis-naplózás helyett.

### 4. Bővítmény Zajszűrés
* A `main.tsx` globális figyelőiben és az `errorReporter.ts` modulban bevezetésre került az `isExternalNoise` szűrő a böngészőbővítményekből származó hibák adatbázisba kerülésének megakadályozására.

## Consequences

**Pozitív:**
- **Zero Data Inconsistency:** A bizonylatmentés és számlalezárás nem maradhat félkész állapotban, kizárva az inkonzisztens analitikai és pénztári állapotokat.
- **Tiszta Hibatáblák:** Megszűntek a `22P02`, `42501` és a bővítményekből eredő téves riasztások az `app_error_logs`-ban.
- **Jobb Felhasználói Élmény:** A felhasználó egyértelmű visszajelzést kap, ha nincs elérhető pénztára.

**Negatív / Költségek:**
- Egy újabb karbantartandó tárolt eljárás a Supabase katalógusban.

## Kapcsolódó
- [P-092: Házipénztár Bizonylat Validáció és Számlakiegyenlítés UX](../../product/decisions/P-092-petty-cash-manual-entry-validation-and-settlement-ux.md)
- [A-016: PostgreSQL Query Stratégia](./A-016-postgresql-query-strategy.md)
- [A-028: PDF Export Workflow & Lifecycle](./A-028-pdf-export-lifecycle.md)
- [A-069: Centralized Frontend Error Ingestion](./A-069-frontend-error-reporting-and-context-inspection.md)
