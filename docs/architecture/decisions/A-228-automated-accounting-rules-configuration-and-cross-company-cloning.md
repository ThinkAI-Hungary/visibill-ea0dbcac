# A-228: Automatikus Könyvelési Szabályok Konfigurációs Felülete és Cégek Közötti Klónozása (EB-0256)

**Status:** Decided  
**Date:** 2026-10-08  
**Utoljára frissítve:** 2026-10-08  
**Ügyféligény:** EB-0256 (Lendvai Ádám · Ván Iroda / Kolos Transport Kft., spec: `tests/docs/lendvai_feature/256.pdf`)

## Context
A könyvelőirodák számára kiemelten fontos, hogy a háttérben automatikusan lefutó könyvelési tételek (ÁFA átvezetések, árfolyam-különbözetek és kerekítési elszámolások) egy központi, vizuális felületen legyenek felparaméterezve ahelyett, hogy fix főkönyvi számok lennének beégetve a tárolt eljárásokba. Különböző cégeknél ugyanis eltérhet a számlatükör felépítése (pl. pénzforgalmi levonható ÁFA kontóként `36911` a `3689` helyett, fizetendőként `47911` a `47993` helyett). Továbbá egy új cég beállításakor elvárás az 1-kattintásos szabályátvétel egy már konfigurált cégről.

**Kritikus követelmények:**
1. **ÁFA átvezetések konfigurálása:**
   - Pénzforgalmi ÁFA átvezetése (pl. 47911 fizetendő / 36911 levonható)
   - Bruttó előleg ÁFA átvezetése (pl. 36914)
   - Éven belüli ÁFA átvezetés (eltérő hónapú teljesítés és ÁFA dátum esetén: pl. 47912 / 36912)
   - Évek közötti ÁFA átvezetés (pl. 47913 / 36913)
2. **Realizált árfolyam-különbözet:** Nyereség (9779) és veszteség (8755) számlák + kapcsolt vegyes napló (VE).
3. **Nem realizált árfolyam-különbözet:** Nyereség (9762) és veszteség (8762) számlák + kapcsolt vegyes napló.
4. **Kerekítési különbözet:** Nyereség (9699) és veszteség (8699) folyószámla és bizonylat-lezáráskor — max Ft limittel (alapértelmezetten 10 Ft).
5. **Cégek közötti átvétel:** 1-kattintásos klónozás, amely a forrás cég `gl_number` számlaszámai és naplókódjai alapján inteligensen hozzárendeli a cél cég saját számláit.

## Decision

1. **Dedikált Relációs Adatbázis Séma (`public.company_auto_accounting_rules`):**
   * Létrehoztunk egy per-cég relációs táblát (`company_id UUID UNIQUE`), szigorú idegen kulcsokkal (`gl_accounts.id` és `acc_journals.id` `ON DELETE SET NULL`).
   * InitPlan-optimalizált RLS házirendek a `company_user_roles` jogosultság-ellenőrzéssel (`(SELECT auth.uid())`).
   * Mezők:
     - `vat_pf_payable_gl_id`, `vat_pf_deductible_gl_id`
     - `vat_advance_gross_gl_id`
     - `vat_intra_year_payable_gl_id`, `vat_intra_year_deductible_gl_id`
     - `vat_cross_year_payable_gl_id`, `vat_cross_year_deductible_gl_id`
     - `fx_realized_journal_id`, `fx_realized_gain_gl_id`, `fx_realized_loss_gl_id`
     - `fx_unrealized_journal_id`, `fx_unrealized_gain_gl_id`, `fx_unrealized_loss_gl_id`
     - `rounding_gain_gl_id`, `rounding_loss_gl_id`, `rounding_max_limit_huf` (alapérték: 10.0)

2. **Dinamikus Tárolt Eljárások:**
   * `public.acc_get_auto_accounting_rules(p_company_id uuid)`: Visszaadja a feloldott főkönyvi számokat és neveket, vagy intelligens defaultokat generál a számlatükörből, ha még nincs egyedi konfiguráció.
   * `public.acc_copy_auto_accounting_rules(p_source_company_id uuid, p_target_company_id uuid)`: Intelligens másoló eljárás, ami a forrás számlaszámait leképezi a cél cég aktív számlatükrére (`gl_number` és napló `code` alapján), feloldva az eltérő belső azonosítókat.

3. **Háttér Könyvelési RPC Integráció (Zéró Hardcode, 100% Visszafelé Kompatibilis):**
   * `public.write_off_subledger_difference`: Először a `company_auto_accounting_rules` táblából olvassa ki a kerekítési (9699/8699) és árfolyam-különbözeti (9779/8755) számlákat, valamint a vegyes naplót és a max limitet. Hiányzó beállítás esetén zökkenőmentesen a meglévő heurisztikára esik vissza.
   * `public.acc_generate_drafts_from_ledger`: A pénzforgalmi ÁFA (fizetendő/levonható) és a vegyes napló feloldása elsődlegesen a `company_auto_accounting_rules`-ból történik, támogatva az egyedi (pl. 47911 / 36911) kontókat.

4. **Frontend UI és Állapotkezelés:**
   * **Elhelyezés:** A meglévő Könyvelési szabályok (`/accounting-rules`, `PromptsPage.tsx`) felületen kapott kiemelt első helyet az új **Automata könyvelés** tab (`auto_rules`), valamint közvetlen útvonalként a `/auto-accounting-rules` is támogatott.
   * **Kártyák és Kereshető Számlaválasztó:**
     - `GlAccountCombobox`: Kereshető számlaválasztó, amely kiemelt badge-ben mutatja az ajánlott standard kontókat (pl. 47911, 36911, 9779, 8755, 9699, 8699).
     - `VatTransferRulesCard`: 4 szekció (pénzforgalmi, bruttó előleg, éven belüli, évek közötti).
     - `FxDifferenceRulesCard`: Realizált és nem realizált különbözetek vegyes napló választóval.
     - `RoundingRulesCard`: Nyereség, veszteség és max Ft limit.
     - `CopyCompanyRulesModal`: 1-kattintásos átvétel forrás cég választással és tájékoztatóval.
   * **Lebegő Mentési Sáv (Unsaved Changes Floating Bar):** Tiszta reaktív dirty tracking, amely csak módosítás esetén jeleníti meg a lebegő mentési panelt, azonnali vizuális megerősítéssel és visszaállítási lehetőséggel.

## Consequences

**Pozitív:**
- A könyvelőirodák tetszőleges számlatükör-struktúrát használhatnak anélkül, hogy a rendszer hardcode-olt számlákra próbálna könyvelni.
- Az 1-kattintásos másolás drasztikusan lerövidíti az új cégek onboarding idejét: egyetlen kattintással átvehetők a bevált szabályok.
- A háttér-RPC-k azonnal érvényesítik a felhasználó beállításait mind a bizonylat-generálásban, mind a folyószámla leírásban.
- Teljes regressziómentesség a meglévő heurisztikus fallback-mechanizmusnak köszönhetően.

**Kockázatok / Korlátok:**
- Ha a cél cég számlatükre hiányos (pl. egyáltalán nincs létrehozva a 9779 vagy 8755 kontó), az átvételkor az adott mező üres marad; erről a rendszer a felületen és a másolási jelentésben is tájékoztatást ad.

## Kapcsolódó
- [A-057: Könyvelési Napló Architektúra és Zárt Tételek](./A-057-accounting-journals-architecture.md)
- [A-102: eaisyBooks Kettős Működési Mód és Moduláris Architektúra](./A-102-eaisybooks-dual-mode-modular-architecture.md)
- [A-226: GL Folyószámla Szinkronizáció és Analitikus Egyeztetés](./A-226-gl-subledger-concurrency-storm-and-analytic-reconciliation-schema-fix.md)
- [P-165: Könyvelési Szabályok és Prompt Könyvtár UX](../../product/decisions/P-165-accounting-rules-and-prompt-library-ux.md)
