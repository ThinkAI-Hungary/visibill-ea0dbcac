# A-093: Atomi Cégbeállítások Upsert, Versenyhelyzet Megelőzés és Parciális Frissítések Izolációja

**Status:** Decided  
**Date:** 2026-09-05  
**Category:** Architecture / Database / Concurrency / React Query / Settings  
**Releváns komponensek:** `useCompanySettings.ts`, `BusinessSection.tsx`, `SettingsPage.tsx`, `GeneralSettingsTab.tsx`  
**Kapcsolódó döntések:** [P-066: Főkönyvi Dátum Alap UX](../../product/decisions/P-066-gl-date-basis-toggle-and-settings-ux.md), [A-085: Főkönyvi Dátum Alap RPC](../../architecture/decisions/A-085-gl-date-basis-rpc-and-chunk-error-recovery.md), [BRD 049](../../business/decisions/049-gl-date-basis-fulfillment-vs-issue.md)

---

## Context

A `company_settings` tábla cégenként egyetlen konfigurációs rekordot tárol (1:1 kapcsolat a `companies` táblával, `CONSTRAINT company_settings_company_id_key UNIQUE (company_id)`). A tábla oszlopai tartalmazzák a standard munkaidő határidőket (`work_start_time`, `work_end_time`, `admin_deadline`, `monthly_working_hours`), valamint a P-066 döntéssel bevezetett főkönyvi dátum alapot (`gl_date_basis`). Minden oszlop rendelkezik sémaszintű PostgreSQL alapértelmezett értékkel.

A frontend rétegben a `useCompanySettings.ts` hook korábban kliensoldali memóriabeli ellenőrzést (`if (settings) update else insert`) alkalmazott a mentésnél. 

Amikor egy olyan cég profilján módosították a beállításokat, amelynek még nem volt létező sora az adatbázisban:
1. A rádiógomb körül elhelyezett `<label onClick>` és a benne lévő `<input onChange>` böngészőszintű esemény-összefonódása miatt egyetlen kattintás 2 darab aszinkron mentési kérést lőtt ki a szerver felé pontosan ugyanabban az ezredmásodpercben.
2. Mindkét kérés a `settings === null` állapotot látta a React Query gyorsítótárában.
3. Mindkét hívás `INSERT` utasítást hajtott végre.
4. Az első `INSERT` sikeresen lefutott, a pár ezredmásodperccel később érkező második hívás pedig beleütközött az egyedi kulcsba:  
   `ERROR: 23505: duplicate key value violates unique constraint "company_settings_company_id_key"`.
5. A hiba megjelent a Supabase Postgres naplókban, az `app_error_logs` táblában és hibaüzenetként felugrott a felhasználói felületen.

Emellett a kód auditja feltárta, hogy a kliensoldali szintetikus alapértelmezésekkel felépített teljes objektum küldése esetén egy parciális mentés (pl. csak a főkönyvi dátum alap mentése a cégbeállítások oldalról) felülírhatta volna a másik modulban (munkaidő nyilvántartásban) korábban már testreszabott havi munkaóraszámot vagy munkaidő-határokat.

---

## Decision

### 1. Atomi PostgREST Upsert (`onConflict: 'company_id'`)
A nem biztonságos kliensoldali `if (settings) { update } else { insert }` elágazást lecseréltük a PostgREST atomi upsert mechanizmusára:
```typescript
const { error } = await supabase
  .from('company_settings')
  .upsert(payload, { onConflict: 'company_id' });
```
Ez a PostgreSQL adatbázis szintjén natív `INSERT INTO company_settings (...) VALUES (...) ON CONFLICT (company_id) DO UPDATE SET ...` utasításként fut le egyetlen atomi tranzakcióban. Ezzel a versenyhelyzet strukturálisan megszűnt, a konkurens hívások nem dobnak `23505` hibát.

### 2. Parciális Frissítések Izolációja (Partial Payload Isolation)
A `saveMutation` által összeállított payload **kizárólag** azokat a mezőket tartalmazza, amelyek a mutáció hívásakor ténylegesen átadásra kerültek (`form[key] !== undefined`), kiegészítve a `company_id` és `updated_at` mezőkkel. Nem töltünk fel szintetikus kliensoldali alapértelmezéseket a meg nem adott mezőkre.
- **INSERT esetén:** A PostgreSQL automatikusan a sémában definiált `DEFAULT` értékeket rendeli a kihagyott oszlopokhoz (`'09:00'`, `'17:00'`, `'20:00'`, `168`, `'kibocsatas'`).
- **UPDATE (ütközés) esetén:** A PostgREST a `DO UPDATE SET` záradékban kizárólag a payloadban szereplő oszlopokat módosítja, így egyetlen modul beállítása (pl. `gl_date_basis`) sem írja felül a cég egyéb, meglévő konfigurációs mezőit.

### 3. Szigorú Típusbiztonság (`CompanySettingsInsert`)
A payloadot közvetlenül a generált Supabase típushoz kötöttük (`type CompanySettingsInsert = Database['public']['Tables']['company_settings']['Insert']`), megszüntetve a laza `Record<string, any>` okozta TypeScript overload hibákat.

### 4. UI Dupla Eseménykiváltás Megszüntetése és Pending Védelem
A `BusinessSection.tsx` és `GeneralSettingsTab.tsx` komponensekben:
- A külső `<label>` elemről eltávolításra került a redundáns `onClick` eseményfigyelő; a vezérlést natívan az input `onChange` kezeli.
- A rádiógombok letiltásra kerülnek a mentési mutáció futása alatt (`disabled={!isOwner || compSaveMutation.isPending}`).
- Bekerült a redundáns hívásokat kizáró guard: `if (newBasis === glBasis || compSaveMutation.isPending) return;`.

### 5. Optimista UI Rollback Hiba Esetén
Ha a mutáció elbukik (pl. hálózati megszakadás vagy RLS tiltás miatt), a komponens elkapja a hibát a `catch` blokkban és visszaállítja az előző értéket (`setGlBasis(prevBasis)`), megakadályozva a felület és az adatbázis deszinkronizációját.

### 6. Memóriabeli Referencia Stabilitás (`useMemo`)
A `useCompanySettings` hook által visszaadott `effectiveSettings` objektumot `useMemo(() => ({ ... }), [settings])` mögé szerveztük, garantálva az objektumreferencia stabilitását és eleget téve a Vercel React Best Practices irányelveknek.

---

## Consequences

- **Pozitív:**
  - Teljesen megszűnt a `23505` Postgres duplikációs hiba az éles és teszt környezetekben.
  - A cégbeállítások mentése 100%-osan determinisztikus, atomi és párhuzamosan is biztonságos.
  - A parciális mentések nem clobberelik más modulok beállításait.
  - A felület és a háttérrendszer hibakezelése konzisztens (optimista rollback).
  - A kód teljesen típusbiztos, 4 dedikált automatizált unit teszttel lefedett.
- **Negatív / Kötöttségek:**
  - A `company_settings` táblában minden új oszlop hozzáadásakor kötelező PostgreSQL szintű `DEFAULT` értéket definiálni a migrációban, hogy a parciális INSERT zökkenőmentesen működjön.

---

## Kapcsolódó
- PRD: [P-066: Főkönyvi Dátum Alap Kapcsoló és Beállítások UX](../../product/decisions/P-066-gl-date-basis-toggle-and-settings-ux.md)
- ADR: [A-085: Főkönyvi Dátum Alap RPC Pushdown](../../architecture/decisions/A-085-gl-date-basis-rpc-and-chunk-error-recovery.md)
- Adatbázis sémadoksi: [02-companies.md](../database/02-companies.md)
- Tesztállomány: [`src/hooks/__tests__/useCompanySettings.test.ts`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/__tests__/useCompanySettings.test.ts)
