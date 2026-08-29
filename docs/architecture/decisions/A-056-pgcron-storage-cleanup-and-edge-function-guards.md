# A-056: pg_cron Storage Cleanup Guard & Edge Function Schema Alignment

**Status:** Decided  
**Date:** 2026-08-29  
**Utoljára frissítve:** 2026-08-29  

## Context

A Supabase PostgreSQL monitor naplójában két rendszeres futásidejű hiba jelentkezett a háttérben futó cron joboknál és az Edge Functionöknél:
1. **`23502: null value in column "url" of relation "http_request_queue"`**:
   - A `cleanup_pdf_exports()` tárolt eljárás a `vault.decrypted_secrets` táblából próbálta lekérni a `supabase_url`-t. Ha ez nem volt felvéve a vaultban, a `v_url` értéke `NULL` lett.
   - Amikor a függvény `net.http_delete(url := v_url || ...)` hívást végzett, a `pg_net` belső `http_request_queue` táblájának `url NOT NULL` kényszere hibát dobott.
2. **`storage.protect_delete() Blocked Direct Deletion` (`jobid: 16`)**:
   - Létezett egy régebbi `cron.job` bejegyzés (`DELETE FROM storage.objects WHERE bucket_id = 'pdf-exports'`), amit a Supabase Storage belső biztonsági triggere blokkolt.
3. **`42703: column does not exist` (`szallito_nev`, `brutto_osszeg`)**:
   - A `check-payment-deadlines` Edge Function a kézi/beküldött számlák (`invoices` tábla) lekérdezésekor `szallito_nev` és `brutto_osszeg` mezőket kért le a hivatalos `elado_nev` és `brutto_vegosszeg` helyett.

## Decision

1. **`cleanup_pdf_exports()` Fallback & NULL Guard**:
   - Beállítottunk egy automatikus fallbacket a projekt hivatalos URL-jére (`https://vxxgvdlqvvchtlmqnrqf.supabase.co`).
   - Szigorú `IF v_url IS NOT NULL AND v_service_key IS NOT NULL THEN` feltétel védi a `net.http_delete` hívásokat, megakadályozva a `NULL` URL átadását.
2. **Felesleges és blokkolt storage cron törlése**:
   - A `cron.unschedule(16)` utasítással leállítottuk a közvetlen táblatörlést, mivel a szabályos API alapú takarítást a `cleanup_pdf_exports()` elvégzi.
3. **Edge Function Schema & TypeScript típusok javítása**:
   - A `supabase/functions/check-payment-deadlines/index.ts`-ben a lekérdezést átírtuk `elado_nev` és `brutto_vegosszeg` mezőkre.
   - Létrehoztuk a szigorú `NavInvoice` és `ManualInvoice` TypeScript interfészeket, megszüntetve az implicit `any` típusokat.

## Consequences

**Pozitív:**
- **Zéró cron hiba a Postgres logokban**: A hajnali karbantartó feladatok stabilan, hiba nélkül futnak.
- **Tiszta Storage tisztítás**: A lejárt PDF exportok és storage objektumok szabályosan, a Storage API-n keresztül törlődnek.
- **Megbízható értesítések**: A `check-payment-deadlines` függvény mind a NAV, mind a kézi számlákra pontosan detektálja a 3 napon belüli lejáró tételeket.

## Kapcsolódó
- [A-005: Edge Functions](./A-005-edge-functions.md)
- [A-028: PDF Export Lifecycle](./A-028-pdf-export-lifecycle.md)
