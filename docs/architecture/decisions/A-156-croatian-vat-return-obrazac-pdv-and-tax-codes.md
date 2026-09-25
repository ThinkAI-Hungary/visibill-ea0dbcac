# A-156: Horvát ÁFA Bevallás (Obrazac PDV) és Adókód Architektúra

**Status:** Decided  
**Date:** 2026-09-25  
**Érintett modulok:** `supabase/migrations/20260925140000_add_croatian_vat_form_rows_and_seed_codes.sql`, `supabase/migrations/20260925141000_croatian_vat_return_engine.sql`, `src/features/vat/components/VatObrazacPdvReplica.tsx`, `src/features/vat/components/VatReturnViewTab.tsx`, `src/features/vat/components/VatCalculatorView.tsx`, `src/components/vat/InvoiceVatCodeSelector.tsx`, `src/features/vat/types.ts`  

---

## 1. Context

A Visibill többjurisdikciós (multi-jurisdiction) könyvelési támogatást épít ki magyar (`HU`) és horvát (`HR`) cégek számára.
Míg a magyar cégek a NAV 2665-ös nyomtatványát használják forintban (ezer forintra kerekítve, egész összegekkel), addig a horvát cégek a hivatalos horvát ÁFA bevallási nyomtatványt (**Obrazac PDV** — *Prijava poreza na dodanu vrijednost*, Pravilnik o porezu na dodanu vrijednost, NN 1/26) alkalmazzák:
1. **Pénznem és kerekítés:** Horvátországban az elszámolás euróban és centben történik (*iznos u eurima i centima* — két tizedesjegy pontossággal).
2. **Bevallási struktúra:** A nyomtatvány 7 fő szekcióból áll:
   - **I. Szekció:** Transakcije koje ne podliježu oporezivanju i oslobođene transakcije (`I.1`–`I.11`, `I` zbroj).
   - **II. Szekció:** Oporezive transakcije — fizetendő PDV (`II.1`–`II.15`, `II` zbroj baza i porez; 5%, 13%, 25%, tuzemni prijenos, uvoz, stjecanje iz EU).
   - **III. Szekció:** Obračunani pretporez — levonható előzetes adó (`III.1`–`III.15`, `III` zbroj baza i pretporez).
   - **IV. Szekció:** Obveza PDV-a za uplatu / za povrat (`II.porez - III.pretporez`).
   - **V. Szekció:** Razmjerni odbitak pretporeza (%).
   - **VI. Szekció:** Ostali podaci (dugotrajna imovina, oporezivanje po naplati).
   - **VII. Szekció:** Donacije hrane.
3. **Adatforrások:** A horvát cégek nem rendelkeznek magyar NAV számlaszinkronnal (`nav_invoices` = 0), a könyvelési és adóadatok a `public.invoices` és `public.invoice_items` táblákban keletkeznek.

---

## 2. Decision

### 1. Közös Adatbázis-táblák Jurisdikció-specifikus Kiterjesztése
- **`public.vat_form_rows`:** Hozzáadásra került a `country_code VARCHAR(2) NOT NULL DEFAULT 'HU'` oszlop. Az elsődleges kulcsot felváltotta az összetett `(country_code, row_number)` PK. Betöltésre került a 48 hivatalos horvát Obrazac PDV sor (`PDV-1` és `PDV-2` lapok).
- **`public.vat_codes`:** Megmaradt a közös tábla, a rekordokat a `country_code` és a cégvezérelt automatikus seed függvény választja szét.
- **`seed_default_vat_codes(p_company_id)`:** Vizsgálja a cég országkódját (`companies.country_code`). Ha `HR`, automatikusan betölti a hivatalos horvát kódokat (`HR_IZL_25`, `HR_IZL_13`, `HR_IZL_5`, `HR_IZL_TUZ_PRIJ`, `HR_UL_25_ODB`, `HR_UL_13_ODB`, `HR_UL_5_ODB`, `HR_UL_TUZ_PRIJ`, `HR_UL_EU_USL`, stb.), míg `HU` esetén a NAV 2665 kódokat.
- **`seed_fad_vat_codes(p_company_id)`:** Guarded: csak `country_code = 'HU'` cégek esetén fut le.

### 2. Többjurisdikciós Számítási Motor (Top-level Router Pattern)
A meglévő `calculate_vat_return(p_company_id, p_year, p_month, p_frequency)` funkciót intelligens routerré alakítottuk:
```sql
IF v_country_code = 'HR' THEN
  RETURN public.calculate_croatian_vat_return(p_company_id, p_year, p_month, p_frequency);
ELSE
  RETURN public.calculate_hungarian_vat_return(p_company_id, p_year, p_month, p_frequency);
END IF;
```
- **`calculate_hungarian_vat_return`:** 100%-ban megőrzi a 2665-ös logikát, eFt kerekítést, M-lapokat és fordított adózást.
- **`calculate_croatian_vat_return`:**
  - `invoices` és `invoice_items` alapján aggregál euróban, két tizedesjegy pontossággal (`ROUND(..., 2)`).
  - Automatikus devizakonverzió cross-rate alapon (`r_cur.rate / r_eur.rate`), ha a bizonylat nem EUR pénznemű.
  - Szekció szerinti összesítés: `I`, `II`, `III`, és egyenlegképzés `IV` (pozitív esetén `amount_to_pay`, negatív esetén `amount_reclaimable`).
  - Rekordok mentése a `vat_returns` és `vat_return_lines` táblákba.

### 3. Frontend Nyomtatvány-replika és Nézetválasztó
- **`VatObrazacPdvReplica.tsx`:** Dedikált, hivatalos horvát adóbevallási nyomtatvány-másolat a PDF specifikáció alapján:
  - Hivatalos fejléc OIB-vel, cégnévvel és elszámolási időszakkal.
  - KPI kártyák a 4 fő szekcióra (I. Neoporezivo, II. Obračunani, III. Pretporez, IV. Obveza/Povrat).
  - Szűrhető táblázat keresővel, szekciófülekkel és "csak összeggel rendelkező sorok" nézettel.
  - Jogszabályi hivatkozások (*čl. 75. st. 2.*, *čl. 41. st. 1.*, stb.) és adómérték jelölések.
- **`VatReturnViewTab.tsx`:**
  - `useCompanyJurisdiction()` alapján horvát cégeknél az alfülek között a *NAV 65 nyomtatvány replika* helyett az *Obrazac PDV replika* jelenik meg, és a magyar-specifikus 6/B acélipari fül elrejtésre kerül.
- **`InvoiceVatCodeSelector.tsx`:**
  - Horvát cégeknél horvát ÁFA kód opciókat és redak hivatkozásokat kínál fel drop-down menüben.
- **Formázás:**
  - `fmtEur` segédfüggvény két tizedesjeggyel és `€` szimbólummal (`1 234,56 €`), a `fmtVatAmount(val, isCroatia)` univerzális formázóval.

---

## 3. Consequences

### Pozitív
- A horvát cégek (`country_code = 'HR'`) automatikusan, valós időben megkapják a törvényes Obrazac PDV kimutatást és adókötelezettségüket euróban.
- A meglévő magyar funkcionalitás (NAV 2665, eFt, M-lapok, 6/B acélipar) 100%-ban érintetlen maradt és regressziómentesen működik.
- A kód- és formnyomtatvány-sorok az adatbázis szintjén izoláltak, elkerülve az ütközéseket és a felesleges redundanciát.
- 100%-os kulcsparitás biztosított a 20 nyelvi névtér között (HU és HR).

### Negatív / Kockázatok
- Az ePorezna XML export formátum a jövőben DTD/XSD séma szerint bővítendő, amíg a hatóság közvetlen API-t nem biztosít. Addig a felhasználók PDF nyomtatási nézettel exportálhatják a bevallást.
