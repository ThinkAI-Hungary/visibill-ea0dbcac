# A-164: Fejlesztési Tartalék és Tárgyi Eszközök Adatmodell, ÉCS Kalkuláció és API

**Állapot:** Elfogadva (Accepted)  
**Dátum:** 2026-09-27  
**Döntéshozó:** Architecture & Database Team  
**Kapcsolódó döntések:** P-123, 023-fixed-assets, A-053-fixed-assets-project-assignment  

---

## 1. Döntési Kontextus

A P-123 termékdöntés alapján meg kell valósítani a céges fejlesztési tartalék keretek tárolását, azok kapcsolását a tárgyi eszközökhöz, a kétirányú egyenlegkalkulációt és a kettős értékcsökkenés (Sztv. vs. Tao) szabályos számítását.

---

## 2. Adatbázis Séma

### 2.1 Új tábla: `public.development_reserves`
```sql
CREATE TABLE IF NOT EXISTS public.development_reserves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  creation_year INTEGER NOT NULL CHECK (creation_year BETWEEN 2000 AND 2100),
  reserve_amount NUMERIC(15, 2) NOT NULL CHECK (reserve_amount > 0),
  expiration_date DATE NOT NULL,
  description TEXT,
  gl_account_id UUID REFERENCES public.gl_accounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexek
CREATE INDEX IF NOT EXISTS idx_development_reserves_company ON public.development_reserves(company_id);
CREATE INDEX IF NOT EXISTS idx_development_reserves_year ON public.development_reserves(creation_year);

-- RLS
ALTER TABLE public.development_reserves ENABLE ROW LEVEL SECURITY;

CREATE POLICY development_reserves_select ON public.development_reserves
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  );

CREATE POLICY development_reserves_insert ON public.development_reserves
  FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  );

CREATE POLICY development_reserves_update ON public.development_reserves
  FOR UPDATE USING (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  );

CREATE POLICY development_reserves_delete ON public.development_reserves
  FOR DELETE USING (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  );
```

### 2.2 `public.fixed_assets` bővítése
```sql
ALTER TABLE public.fixed_assets
  ADD COLUMN IF NOT EXISTS development_reserve_id UUID REFERENCES public.development_reserves(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS development_reserve_amount NUMERIC(15, 2) DEFAULT 0.00;

CREATE INDEX IF NOT EXISTS idx_fixed_assets_dev_reserve ON public.fixed_assets(development_reserve_id);
```

---

## 3. Értékcsökkenési Matematika és Algoritmus (`useDepreciation.ts`)

A `calculateDepreciation` függvény új opcionális paramétere:
* `developmentReserveAmount?: number`

### Számítási Logika:
1. **Számviteli ÉCS:** Változatlanul az `acquisitionValue` és `residualValue` alapján történik (költségként elszámolható).
2. **Tao ÉCS:**
   ```typescript
   // Tao szerinti amortizálható tőkealap
   const devReserve = Math.max(0, developmentReserveAmount || 0);
   const taxAcquisitionBase = Math.max(0, acquisitionValue - devReserve);

   const taxMonthly = taxAcquisitionBase > 0 
     ? (taxAcquisitionBase * (taoRatePercent / 100)) / 12 
     : 0;

   const rawTaxAccumulated = taxMonthly * elapsedMonths;
   const taxAccumulated = Math.min(rawTaxAccumulated, taxAcquisitionBase);
   const taxBookValue = Math.max(0, taxAcquisitionBase - taxAccumulated);
   ```
* **Konzisztencia:** Ha `devReserve >= acquisitionValue`, akkor `taxMonthly = 0`, `taxAccumulated = 0`, `taxBookValue = 0`.
* A Tao törvény szerinti adóalap-csökkentés így pontosan 0 Ft lesz erre az eszközre, teljesítve a Tao. tv. 7. § (15) előírását.

---

## 4. Frontend Architektúra

* `src/types/fixed-assets.ts`:
  * `DevelopmentReserve` interfész
  * `FixedAsset` kibővítése `development_reserve_id`, `development_reserve_amount`, `development_reserve?` mezőkkel.
* `src/hooks/useDevelopmentReserves.ts`:
  * `useDevelopmentReserves(companyId)`: Lekéri a kereteket a céghez, hozzáillesztve a felhasznált összegeket (`sum(development_reserve_amount)` a `fixed_assets`-ből).
  * `useCreateDevelopmentReserve()`: Új keret rögzítése.
  * `useDeleteDevelopmentReserve()`: Keret törlése (ha nincs hozzá rendelve eszköz).
  * `useAssignDevelopmentReserve()`: Utólagos tartalék összerendelés, leválasztás, eseménynaplózás, jegyzőkönyv frissítés és könyvelési szinkronizáció.
* `src/components/fixed-assets/DevelopmentReservesTab.tsx`:
  * Új tab a `FixedAssetsPage.tsx`-ben statisztikákkal, progress barral és keretkezeléssel.
* `src/components/AssetActivationDialog.tsx`:
  * Checkbox és select mezők a szabad keret kiválasztásához aktiváláskor.
* `src/components/fixed-assets/DevelopmentReserveAssignDialog.tsx`:
  * Utólagos tartalékkezelő dialógus az `AssetDetailPanel`-ből elérhetően.

---

## 5. Automatikus Főkönyvi Könyvelés (`developmentReserveAutoPoster.ts`)

* **Tranzakció:** Fejlesztési tartalék feloldása aktiváláskor (Sztv. és Tao. tv. 7. § (15)):
  * **T 414 (Lekötött tartalék)** — **K 413 (Eredménytartalék)**
* **Főkönyvi számlák automatikus feloldása:**
  * Céges aktív számlatükörből (`active_coa_preset_id` és egyedi céges `gl_accounts` tábla) a 414 / 4140 és 413 / 4130 számlaszámok azonosítása.
* **Napló és Bizonylatszám:**
  * Napló: Vegyes napló (`VE`).
  * Fejléc bizonylatszám: `FT-FELOLD-[Leltári szám]` (idempotens, duplikációmentes).
* **Visszavonás és törlés (`removeDevelopmentReservePosting`):**
  * Ha az eszközről leválasztják a tartalékot, a korábbi tétel sorai és fejléce törlésre kerülnek.

---

## 6. Tao Éves Zárás Integráció (`TaoYearEndWizardPage.tsx`)

* `calculateAnnualDepreciation()`:
  * Naptári évre pontosan kiszámolja az adott cég eszközeinek éves számviteli és Tao értékcsökkenését, figyelembe véve a tartaléklevonást.
* **Egykattintásos átvételi varázsló funkciók:**
  * 1. lépés: TENY számviteli ÉCS átvétele a beszámoló sorba.
  * 3. lépés: Tárgyévben képzett tartalék (7. § (1) f)) és Tao ÉCS (7. § (1) d)) átvétele a csökkentő tételekbe.
  * 4. lépés: Számviteli vs. Tao ÉCS különbözet (8. § (1) b)) átvétele a növelő tételekbe.

---

## 7. Kapcsolódó Dokumentáció és Döntések
- [P-123: Fejlesztési Tartalék és Tárgyi Eszköz Nyilvántartás (TENY) Összekapcsolása UX](../../product/decisions/P-123-development-reserve-teny-ux.md)
- [10-assets: Tárgyi Eszközök Adatbázis Séma](../database/10-assets.md)

