# A-231: Cégprofil Számviteli Beállítások Kiterjesztése: Teljesítés Dátum, Összevont Főkönyvi Nézet és Devizaárfolyam Bankkatalógus

## Állapot
Elfogadva és Élesítve (EB-0258)

## Kontextus és Érintett Területek
- Adatbázis tábla: `public.company_settings`
- Típusdefiníciók: `src/lib/payrollUtils.ts` (`CompanyWorkSettings`)
- Hook és állapotkezelés: `src/hooks/useCompanySettings.ts`
- Bankkatalógus modul: `src/lib/banking/exchangeRateBanks.ts`
- Felület: `src/components/settings/BusinessSection.tsx`
- Főkönyvi kivonat: `src/components/general-ledger/GeneralLedgerTable.tsx`, `src/pages/GeneralLedgerPage.tsx`
- Tesztelés: `src/test/eb0258DefaultDateAndGlAggregated.test.ts`

---

## Architektúrális Döntések

### 1. Adatbázis Séma és Migráció (`supabase/migrations/20261008140000_eb0258_accounting_settings_date_gl_fx.sql`)
1. Meglévő oszlop módosítása:
   ```sql
   ALTER TABLE public.company_settings
     ALTER COLUMN gl_date_basis SET DEFAULT 'teljesites';
   ```
2. Új oszlopok hozzáadása:
   - `gl_default_view_mode text NOT NULL DEFAULT 'osszevont'` (check constraint: `'osszevont'`, `'teteles'`)
   - `fx_accounting_bank_code text NOT NULL DEFAULT 'MNB'`
   - `fx_accounting_rate_type text NOT NULL DEFAULT 'mid'` (check constraint: `'mid'`, `'buy'`, `'sell'`)
   - `fx_revaluation_bank_code text NOT NULL DEFAULT 'MNB'`
   - `fx_revaluation_rate_type text NOT NULL DEFAULT 'mid'` (check constraint: `'mid'`, `'buy'`, `'sell'`)
3. Teljesítmény index:
   ```sql
   CREATE INDEX IF NOT EXISTS idx_company_settings_company_id ON public.company_settings(company_id);
   ```

### 2. Hivatalos Bankkatalógus (`src/lib/banking/exchangeRateBanks.ts`)
- Számviteli törvény és a 258.pdf alapján struktúrált katalógus ~45 bankkal (GIRO kódok, MNB, MFB, nemzetközi fintechek: Wise, Revolut).
- Lookup segédfüggvény: `getExchangeRateBank(code)` kód, alias és név alapon is keres, hibás/hiányzó paraméter esetén biztonságosan az MNB definícióra esik vissza (`DEFAULT_FX_BANK_CODE = 'MNB'`).

### 3. Főkönyvi Összevont vs Tételes Nézet Modellje (`GeneralLedgerTable.tsx`)
- Korábban a `DEFAULT_EXPANDED_IDS` mély analitikus alábontásokat (`31`, `311`, `45`, `454`, `46`, `466`) is alapértelmezetten kibontott, ami nagy forgalmú cégeknél 800+ sort generált.
- Bevezetésre került az `AGGREGATED_EXPANDED_IDS`, amely kizárólag a legfelső számlaosztályokat (`1`, `2`, `3`, `4`, `5`, `8`, `9`, `UNCLASSIFIED`) tartalmazza.
- A `GeneralLedgerTable` fogadja a `defaultViewMode?: 'osszevont' | 'teteles'` propot, és kezdeti állapotban, valamint cégváltáskor a cégprofilnak megfelelő alapértelmezett kibontási szintet állítja be.

### 4. NAV Adószám Auto-kitöltés Integráció (`BusinessSection.tsx`)
- A meglévő `queryTaxpayerFromNav` Edge Function kliens meghívása aszinkron módon az adószám input mellé épített gombbal.
- Zéró renderelési mellékhatás: a reaktív állapotok a Vercel/React Compiler tiszta derived state mintáját követik, megakadályozva a `react(set-state-in-effect)` kaszkád renderelési hibákat.

---

## Verifikáció és Minőségi Kapuk
- **Oxlint:** 0 hiba a módosított állományokban.
- **TypeScript:** `npx tsc --noEmit` 0 típushiba.
- **Automatizált Regressziós Tesztek:** `npx vitest run src/test/eb0258DefaultDateAndGlAggregated.test.ts` (10/10 zöld).
- **Élő DB Katalógus:** Supabase REST/SQL API-n keresztül a migráció élesítve, sémaleíró ellenőrizve.
