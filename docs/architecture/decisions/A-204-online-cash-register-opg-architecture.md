# A-204: Online Pénztárgép (OPG) Modul Architektúra és Házipénztár Integráció

## Státusz
Elfogadva

## Dátum
2026-10-06

## Kontextus
A NAV Online Pénztárgép (OPG) adatszolgáltatási rendszerének integrálásához olyan robusztus adatszerkezetre és feldolgozási folyamatra volt szükség, amely:
1. Biztosítja az abszolút idempotenciát és duplikációvédelmet (`external_transaction_id`).
2. Támogatja a több pénztárgépet, valamint a telephelyenkénti vagy kasszánkénti házipénztárhoz rendelést (`petty_cash_register_id`).
3. Kétféle könyvelési módot támogat (`daily_z_summary` és `itemized_receipt`).
4. Teljesen izolált multi-tenant Row Level Security (RLS) szabályrendszert alkalmaz.
5. Regressziómentesen együttműködik a meglévő `petty_cash_registers` és `petty_cash_entries` táblákkal.

## Döntések

### 1. Adatbázis Séma
- `public.opg_cash_registers`:
  - `id` (UUID PK), `company_id` (FK), `ap_code` (egyedi cég szinten), `name`, `location`, `status`, `petty_cash_register_id` (FK to `petty_cash_registers`), `cash_booking_mode`, `sync_interval_minutes`, `last_successful_sync_at`, `last_failed_sync_at`, `last_error_message`.
- `public.opg_transactions`:
  - `id` (UUID PK), `company_id` (FK), `opg_id` (FK), `external_transaction_id` (UNIQUE), `receipt_number`, `transaction_date`, `transaction_time`, `transaction_type`, `total_gross_amount`, `cash_amount`, `card_amount`, `szep_card_amount`, `voucher_amount`, `payment_method_breakdown` (JSONB), `vat_breakdown` (JSONB), `processing_status`, `cash_entry_id` (FK to `petty_cash_entries`), `source_payload` (JSONB).
- `public.opg_sync_logs`:
  - `id` (UUID PK), `company_id` (FK), `opg_id`, `started_at`, `finished_at`, `period_from`, `period_to`, `records_fetched`, `records_new`, `records_duplicated`, `records_errors`, `status`, `error_message`.

### 2. Adatbázis Szintű Integrációs RPC-k
- `process_opg_transaction_to_petty_cash(p_transaction_id uuid)`:
  - Biztonságos (`SECURITY DEFINER`, `search_path = 'public'`).
  - Ellenőrzi a duplikációt (`cash_entry_id IS NOT NULL`).
  - Feloldja a cél házipénztárt: `opg_cash_registers.petty_cash_register_id` -> ha nincs, cég alapértelmezett házipénztára.
  - Előjeles összeget képez: sztornó és visszáru esetén negatív előjellel csökkenti a pénztár egyenlegét.
  - Beszúr a `petty_cash_entries` táblába `source_table = 'opg_transactions'`, `source_type = 'cash_sale'`, `routed_by = 'opg_auto'` értékekkel.
- `process_pending_opg_transactions(p_company_id uuid, p_opg_id uuid)`:
  - Kötegelt feldolgozást végez a beállított könyvelési mód (`cash_booking_mode`) figyelembevételével.

### 3. Kliensoldali Réteg és Resziliencia
- `src/services/opgService.ts`: Teljes CRUD műveletek, AP kód kapcsolat-ellenőrzés, szinkronizációs motor, automatikus pénztárgép-felderítés (`discoverCashRegisters`) és automatikus fallback kezelés arra az esetre, ha az RPC még nincs a távoli környezetben érvényesítve.
- `src/hooks/useOpg.ts`: TanStack React Query alapú reaktív állapotkezelés és cache-érvénytelenítés a központi `queryKeys` gyáron keresztül.
- Felhasználói felület és fejléces módváltás: Az OPG a Házipénztár fejlécében található kétállású címkapcsolóval (`Házipénztár` / `OPG`) érhető el közvetlenül (`/petty-cash/opg` vagy `/opg`). Házipénztár módban a felirat aktív fehér, mellette a kiszürkített OPG kapcsolóval, míg OPG nézetben az OPG felirat fehér, és a Házipénztár válik szürkévé. A házipénztár alsó füllistája maradéktalanul megőrzi az 5 eredeti fület (`Tételek`, `Jóváhagyások`, `Pénztárjelentések`, `Pénztárak`, `Routing szabályok`), megelőzve az alsó gombsor túlzsúfolását és a redundáns oldalsáv-bejegyzéseket.

### 4. NAV M2M OPG SOAP Proxy és Automatikus AP Kód Felderítés
- **`nav-opg-proxy` Edge Function (`supabase/functions/nav-opg-proxy/index.ts`):**
  - Dedikált Deno szerveroldali proxy a NAV Online Pénztárgép SOAP v1 interfészéhez (`queryCashRegisterStatus`, `queryCashRegisterFile`).
  - **Hitelesítés:** A meglévő NAV Online Számla technikai felhasználó (technikai felhasználónév, jelszó, adószám, aláírókulcs, cserekulcs) adataiból generál SHA-512 jelszó-hash-t, UTC ISO-8601 idóbélyeget és HMAC-SHA-512 digitális kérés-aláírást.
  - **Automatikus AP kód felderítés (`discover_registers`):** A NAV `queryCashRegisterStatus` végpontja üres kéréssel visszaadja a céghez bejegyzett összes pénztárgépet, azok AP kódjával (`APNumber`), utolsó kommunikációjával és elérhető naplófájl-sorszámaival (`minAvailableFileNumber` .. `maxAvailableFileNumber`). Ez teljesen kiküszöböli a manuális AP kód begépelést és elgépelési hibákat.
  - **Napló letöltés és kibontás:** A bináris multipart SOAP válaszból kinyeri a GZIP-tömörített bájtokat, kitömöríti az XML naplófolyamot, és idempotens módon menti az adatbázisba:
    - Nyugták (`<NYU>`, `<BES>`), egyszerűsített számlák (`<ESN>`),
    - Napi forgalmi jelentések / Z-zárások (`<NFN>`),
    - Pénzmozgás bizonylatok (`<PMN>`).
  - **Séma integritás:** Az `opg_transactions_transaction_type_check` adatbázis-szintű korlát kibővítve a pénzmozgások támogatására (`cash_movement`).

## Következmények
- A házipénztári analitika azonnal és valós időben tükrözi a bolti készpénzmozgásokat.
- A könyvelők számára a napi zárásokból képzett forgalom egy kattintással áttekinthető és beemelhető.
- Zéró-konfigurációs bevezetés: A meglévő NAV Online Számla kulcsokkal azonnal automatikusan felderíthető az összes pénztárgép, egyetlen gombnyomással.
- Robusztus, hibatűrő szerveroldali naplókibontás és multi-tenant biztonság a `nav-opg-proxy` Edge Functionön keresztül.
- Letisztult, ergonomikus fejléc-navigáció a házipénztár és a pénztárgépek között, zéró oldalsáv-zaj mellett.

## Kapcsolódó
- [P-163: Online Pénztárgép (OPG) Modul és Házipénztár Integráció UX](../../product/decisions/P-163-online-cash-register-opg-module-ux.md)
- [A-005: Supabase Edge Functions Katalógus](./A-005-edge-functions.md)
- [09-petty-cash.md: Házipénztár & OPG Adatbázis Séma](../database/09-petty-cash.md)
