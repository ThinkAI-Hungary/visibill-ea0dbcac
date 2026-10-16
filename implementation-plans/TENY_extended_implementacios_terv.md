# TENY (Tárgyi Eszköz Nyilvántartó) Kiterjesztés — Hivatalos Implementációs Terv

> **Hivatkozási alap:** [teny_extended_fejlesztesi_doksi.md](./teny_extended_fejlesztesi_doksi.md)  
> **Protokoll:** `/visibill-feature-planner` (Zero Silent Decisions, Spec Reviewer Audit, Maker–Checker Architecture)  
> **Környezet:** `eaisybill-dev` (`dev.visibill.hu`, Supabase Dev DB: `qhvcdqkqpgpdxogqqvyr`)  
> **Aktuális Git ág:** `develop`  
> **Dátum:** 2026-10-16  

---

## 🎯 FÁZIS 1: Kontextus és Hipotézis

### 1.0 Hipotézis és Megértés
* **Hipotézis:** A könyvelő csapat által specifikált 9 funkciócsoport kiterjeszti a VisiBill TENY modulját és az eaisyBooks könyvviteli ökoszisztémát a hiányzó szakmai, adózási és operatív képességekkel. A feladat magában foglalja:
  1. A 3. (Pályázatos) amortizációs kalkulációs ág és az eltérő ÉCS-alapok (`tax_depreciation_base`, `grant_depreciation_base`) kezelését.
  2. A többéves fejlesztési tartalékkeret egyetlen eszközhöz történő hozzákapcsolását intelligens FIFO levonási javaslattal (`fixed_asset_reserve_allocations`).
  3. A beruházási adókedvezmények (KKV hitelkamat, fejlesztési adókedvezmény) követését és a 4 éves kivezetési védelmet/riasztást.
  4. Az ingatlan (Hrsz.) és jármű (rendszám, alvázszám) törzsadatok dinamikus űrlapkezelését és leltári/szűrési integrációját.
  5. A többdimenziós allokáció (költséghely, projekt, pályázat) átvezetését az időszaki ÉCS vegyes naplós könyvelésére (`depreciationPostingService` és `post_depreciation_run_to_gl` RPC).
  6. A nyitó eszközök átvételi dátumának (`last_depreciation_date`) és átvételkori halmozott ÉCS-jének tiszteletben tartását múltbeli újraszámolás nélkül.
  7. A számviteli hasznos élettartam ↔ éves kulcs (%) kétirányú reaktív kalkulációját és az egyedi TAO kulcs azonnali felülbírálatát.
  8. A teljes számviteli mozgásnem-törzset (10+ típus), valamint a terven felüli értékcsökkenés (T 866 → K 139/149) és visszaírás (T 139/149 → K 966) könyvelő modulját.
  9. Az önálló Cégautóadó és Gépjárműadó modult (`company_cars`, kW/Euro mátrix, határidő-ellenőrzött gépjárműadó levonási automatizmus).
* **Confidence szint:** 98% — A meglévő kód (`useDepreciation.ts`, `depreciationPostingService.ts`, `CreateFixedAssetDialog.tsx`, `FixedAssetsPage.tsx`), a Dev DB sémája és az [teny_extended_fejlesztesi_doksi.md](./teny_extended_fejlesztesi_doksi.md) alapján minden függőség, számviteli szabály és UI pont feltárt.

### 1.1 Rendszer-feltételezések (Assumptions I'm Making)
1. **Multi-tenancy és RLS:** Minden új tábla (`fixed_asset_reserve_allocations`, `company_cars`, `fixed_asset_dimension_splits`) kötelezően tartalmaz `company_id UUID REFERENCES companies(id)` mezőt, és szigorú RLS házirendet kap a `company_members` táblán keresztül.
2. **Környezeti izoláció:** Minden migráció és fejlesztés kizárólag a Dev Supabase (`qhvcdqkqpgpdxogqqvyr`) adatbázisban fut és tesztelődik a `develop` ágon; éles DB-hez tilos nyúlni.
3. **Főkönyvi séma paritás:** A könyvelési tételek közvetlenül az `acc_journal_headers` és `acc_journal_lines` táblákba kerülnek, `fixed_asset_id`, `cost_center_id` és `project_id` címkézéssel.
4. **Visszafelé kompatibilitás:** A meglévő `fixed_assets.development_reserve_id` és `development_reserve_amount` mezők megmaradnak (vagy szinkronizálódnak), a meglévő egyedi rekordok automatikusan átkerülnek az új kapcsolótáblába egy idempotens backfill migrációval.
5. **Cégautóadó elhelyezése:** A Cégautóadó kezelése a TENY-ben mint jármű törzsadat kapcsolódik, valamint az eaisyBooks modulban (Adózás / Gépjárművek) kap dedikált negyedéves bevallás-előkészítő nézetet.

---

## 🔍 FÁZIS 2: Döntési Mátrix (Zero Silent Decisions)

### 📊 1. Adatmodell Döntések

| # | Kérdés | Opciók | Meglévő Pattern | Javasolt Döntés | Racionálé |
|---|--------|--------|-----------------|-----------------|-----------|
| **D-1** | Hogyan tároljuk a több évi fejlesztési tartalék keretek allokációját? | a) `fixed_assets.reserve_allocations` JSONB tömb<br>b) Külön relációs kapcsolótábla (`fixed_asset_reserve_allocations`) | `fixed_asset_components`, `invoice_item_project_allocations` | **b) Külön relációs tábla** | Relációs integritás (`ON DELETE RESTRICT` a tartalékra), egyedi indexelhetőség, pontos aggregálhatóság és tiszta RLS védelem. |
| **D-2** | Hogyan kezeljük a többdimenziós költségmegosztást (költséghely/projekt/pályázat)? | a) Csak 1 költséghely + 1 projekt mező a `fixed_assets`-en<br>b) Alapértelmezett 1-1 mező a fejen + opcionális `fixed_asset_dimension_splits` tábla százalékos bontáshoz | `invoice_item_project_allocations` (% felosztás) | **b) Fejmezők + százalékos split tábla** | Egyszerű eszközöknél nincs relációs overhead, de ha egy gépet 60-40%-ban használnak, precízen elszámolható az ÉCS. |
| **D-3** | Hogyan tároljuk a beruházási adókedvezmény típusát? | a) Szabad szöveges mező<br>b) PostgreSQL ENUM vagy text + CHECK constraint | `disposal_status` text + CHECK constraint | **b) text + CHECK constraint** | Könnyen bővíthető új jogcímekkel újabb PostgreSQL TYPE alteráció nélkül, de garantálja az értékkészletet (`KKV_BERUHAZAS`, `FEJLESZTESI_ADOKEDVEZMENY`, `ENERGIAHATEKONYSAGI`). |
| **D-4** | Hol tároljuk a cégautókat (saját + bérelt)? | a) Csak a `fixed_assets`-ben egy `is_company_car` flaggel<br>b) Önálló `company_cars` tábla, opcionális `fixed_asset_id` idegen kulccsal | `accounty_employees`, `partners` | **b) Önálló `company_cars` tábla** | A tartósan bérelt / operatív lízingelt autók nem képezik a cég tárgyi eszköz vagyonát (nincs 1-es számla ÉCS), de cégautóadót kell fizetni utánuk. |
| **D-5** | Hogyan tároljuk az ingatlan/jármű törzsmezőket? | a) Egy `extra_identifiers` JSONB mezőben<br>b) Dedikált oszlopok: `property_registry_number`, `license_plate`, `vin_chassis_number` | `invoices.bizonylatsorszam`, partner adószám | **b) Dedikált oszlopok** | Közvetlenül indexelhetők (gyors keresés leltári számmal/rendszámmal), típusbiztosak a TypeScript felületen és egyszerűen exportálhatók Excelbe/PDF-be. |

---

### 🏗️ 2. Architektúra és Számviteli Döntések

| # | Kérdés | Opciók | Meglévő Pattern | Javasolt Döntés | Racionálé |
|---|--------|--------|-----------------|-----------------|-----------|
| **D-6** | Hol fusson a Pályázatos ÉCS és a Nyitó Karton kalkuláció? | a) Kizárólag adatbázis RPC-ben<br>b) Kliensoldali TypeScript kalkulátorban (`useDepreciation.ts`) + RPC a könyveléshez | `calculateDepreciation`, `assetReconciliationService` | **b) TypeScript kalkulátor + RPC feladás** | Az azonnali UI reaktivitás (futamidő ↔ kulcs változtatás gépelés közben) kliensen azonnali (<1ms), míg a könyvelést tranzakcionális RPC végzi. |
| **D-7** | Hogyan kerüljenek át a dimenziók az ÉCS vegyes könyvelésbe? | a) Kliens generálja a sorokat és küldi az RPC-nek<br>b) A `post_depreciation_run_to_gl` RPC veszi át a kibővített tétellistát (`cost_center_id`, `project_id`) és könyveli a sorokat | `post_depreciation_run_to_gl` | **b) Bővített RPC tétellista** | Atomi tranzakció, a szerver garantálja a naplósorszám szigorú kiadását és az `acc_journal_lines` dimenziók helyes bejegyzését. |
| **D-8** | Hogyan működjön a terven felüli ÉCS és visszaírás könyvelése? | a) Kézi vegyes napló rögzítés sablon nélkül<br>b) Dedikált `UnplannedDepreciationDialog` + `post_unplanned_depreciation_to_gl` RPC | `approve_asset_disposal` | **b) Dedikált dialógus és atomi RPC** | T 866 → K 1x9 és T 1x9 → K 966 automatikus kontírozása, az eszköz könyv szerinti értékének azonnali frissítésével és `asset_events` naplózással. |
| **D-9** | Hogyan párosítsuk a gépjárműadó befizetést a cégautóadóhoz? | a) Kézi összegbeírás a bevallás készítésekor<br>b) Félautomata javaslattevő: banki tételek NAV gépjárműadó számlaszám (`10032000-01076167`) és közleménybeli rendszám alapján | `bank_transaction_rules` | **b) Félautomata felismerés és határidő-ellenőrzés** | Ellenőrzi a törvényi esedékességet (I. félév: ápr. 15., II. félév: szept. 15.); késedelem esetén figyelmeztet a levonási jog elvesztésére (Gjt. 17/A. §). |
| **D-10** | Hogyan működjön a fejlesztési tartalék FIFO allokáció? | a) Kézi beírás tartalékonként<br>b) Egykattintásos "⚡ FIFO Allokáció" algoritmus, kézi felülbírálati lehetőséggel | FIFO elszámolás készleteknél | **b) Automata FIFO javaslat kézi felülbírálattal** | Minimalizálja a hibát (a legkorábbi lejáratú tartalékot meríti ki először), de lehetővé teszi az egyedi könyvelői döntést. |

---

### 🖥️ 3. Frontend & UX Döntések

| # | Kérdés | Opciók | Meglévő Pattern | Javasolt Döntés | Racionálé |
|---|--------|--------|-----------------|-----------------|-----------|
| **D-11** | Hogyan jelenjen meg a 4 éves beruházási adókedvezmény kivezetési korlát? | a) Kemény tiltás (gomb letiltva)<br>b) Figyelmeztető sáv + könyvelői megerősítő felülbírálás indoklással | `DisposalDialog.tsx` | **b) Figyelmeztetés + explicit felülbírálás** | Az eszköz vis maior (lopás, totálkár) esetén fizikailag kivezetendő lehet, de a rendszernek kényszerítenie kell a jogkövetkezmények tudomásulvételét. |
| **D-12** | Hogyan jelenjenek meg a speciális azonosítók (Hrsz., Rendszám, Alvázszám)? | a) Mindig minden mező látható az űrlapon<br>b) Kontextuális dinamikus megjelenítés: 12-es számlánál Hrsz., 142/143-nál Rendszám és Alvázszám kötelező | Dinamikus form mezők | **b) Kontextuális megjelenítés** | Tisztán tartja az űrlapot az egyszerű eszközöknél (laptop, irodabútor), de kikényszeríti az adatokat járműveknél és ingatlanoknál. |
| **D-13** | Hogyan működjön a hasznos élettartam és leírási kulcs (%) megadása? | a) Csak futamidő hónapokban<br>b) Kétirányú szinkronizált beviteli mező: Hasznos élettartam (Év/Hó) ↔ Éves kulcs (%) | Kétirányú reaktív input | **b) Kétirányú reaktív kalkulátor** | A könyvelők gyakran kulcsban gondolkodnak (pl. 14,5% vagy 33%), míg a gazdasági vezetők években; mindkét megközelítés azonnal érvényesül. |
| **D-14** | Hol kapjon helyet az új Cégautóadó modul? | a) Csak egy táblázat a TENY beállításokban<br>b) Önálló lapfül a TENY-ben (`/teny?tab=company_cars`) és összeköttetés az eaisyBooks Adózási menüjével | `FixedAssetsPage` tabok | **b) Dedikált lapfül és adózási navigáció** | Közvetlen átjárhatóságot biztosít az eszközökből a járművekhez és a negyedéves adómegállapításhoz. |

---

## 🛡️ FÁZIS 2.1: Spec Reviewer Audit (6-Dimenziós Elemzés)

A tervezetet független minőségbiztosítási szempontok alapján ellenőriztük:

1. **ADR & Architektúra Konzisztencia:**  
   * Teljesen illeszkedik a meglévő [A-164](file:///d:/ThinkAI/Visibill/eaisybill/docs/architecture/decisions/A-164-development-reserve-fixed-assets-db-and-depreciation.md) (Fejlesztési tartalék), [A-180](file:///d:/ThinkAI/Visibill/eaisybill/docs/architecture/decisions/A-180-fixed-assets-periodic-depreciation-posting-service.md) (ÉCS feladás) és [A-251](file:///d:/ThinkAI/Visibill/eaisybill/docs/architecture/decisions/A-251-fixed-assets-gl-linkage-reconciliation-and-disposal-workflow.md) (Főkönyvi kapcsolat és kivezetés) architektúrákhoz.
2. **Zero Silent Decisions:**  
   * Minden adatmodell (D-1 – D-5), számviteli (D-6 – D-10) és felületi (D-11 – D-14) kérdés részletes indoklással és alternatívákkal fel van tüntetve.
3. **Skálázhatóság & Adatbázis:**  
   * Minden új idegen kulcs (`asset_id`, `reserve_id`, `fixed_asset_id`, `company_id`) B-tree indexet kap.  
   * A cégautóadó és ÉCS aggregációk nem végeznek teljes táblapásztázást, `company_id` indexek védik a multitenancy szűrést.
4. **Biztonság (STRIDE & RLS):**  
   * Minden új táblán (`fixed_asset_reserve_allocations`, `company_cars`, `fixed_asset_dimension_splits`) be van kapcsolva a Row Level Security (`company_members` ellenőrzéssel).  
   * Minden új RPC (`post_unplanned_depreciation_to_gl`, `post_depreciation_run_to_gl` bővítés) `SECURITY DEFINER`, rögzített `search_path`-szal, explicit `REVOKE ALL FROM PUBLIC, anon;`.
5. **Vercel React & Composition Minőség:**  
   * A nehéz dialógusok (`UnplannedDepreciationDialog`, `CompanyCarDialog`) `React.lazy` betöltést kapnak.  
   * Kétirányú szinkron mezőknél stabil állapotlevezetés és `useCallback` védi a felesleges re-rendereket.
6. **Dekompozíciós Megfelelőség:**  
   * A 9 elem 4 önálló fázisra és 11 méretezett micro-modulra (M4.1 – M7.3) van bontva.

---

## 📦 FÁZIS 2.5 & 2.6: Micro-Module Dekomponálás és Függőségi Gráf

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       TELJES FÜGGŐSÉGI HÁLÓZAT                                         │
│                                                                                                        │
│   [ Phase 4: Pályázatos ÉCS, Eltérő Alapok, Nyitó ÉCS & Reaktív Kulcsok ]                             │
│   M4.1 (DB Séma Bővítés) ──► M4.2 (useDepreciation Motor) ──► M4.3 (Create/Edit Form Reaktív UI)      │
│                                                                                                        │
│   [ Phase 5: Fejlesztési Tartalék FIFO Allokáció & Beruházási Adókedvezmény Védelem ]                  │
│   M5.1 (Allocations Tábla) ──► M5.2 (FIFO Szerviz & UI) ──► M5.3 (Adókedvezmény & Kivezetési Gát)    │
│                                                                                                        │
│   [ Phase 6: Mozgásnemek, Terven Felüli ÉCS & Dimenziós Vegyes Feladás ]                               │
│   M6.1 (Terven Felüli ÉCS RPC & UI) ──► M6.2 (Dimenziós ÉCS Feladás depreciationPostingService-ben)   │
│                                                                                                        │
│   [ Phase 7: Cégautóadó Modul & Gépjárműadó Levonási Automatizmus ]                                    │
│   M7.1 (company_cars Tábla & Gjt Motor) ──► M7.2 (Gépjárműadó Összekötés) ──► M7.3 (Cégautóadó UI)     │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 🚀 PHASE 4: Pályázatos ÉCS, Eltérő Alapok, Nyitó ÉCS & Reaktív Kulcsok
> **Fókusz:** 3-pályás kalkuláció (számviteli, TAO, pályázatos), átvett nyitó kartonok rögzítése, és kétirányú reaktív leírási kulcs megadás.

#### Micro-Module 4.1: Adatbázis Séma Bővítés és Típusok (Méret: S)
* **Érintett fájlok:**
  * `supabase/migrations/20261016100000_teny_extended_fields.sql`
  * `src/types/fixed-assets.ts`
  * `src/integrations/supabase/types.ts`
* **Feladat:**
  * `fixed_assets` mezők hozzáadása:
    * `tax_depreciation_base` (NUMERIC(15,2))
    * `grant_depreciation_base` (NUMERIC(15,2))
    * `grant_depreciation_rate` (NUMERIC(5,2))
    * `grant_depreciation_method` (text DEFAULT 'linear')
    * `opening_accumulated_depreciation` (NUMERIC(15,2) DEFAULT 0)
    * `opening_tax_depreciation` (NUMERIC(15,2) DEFAULT 0)
    * `last_depreciation_date` (DATE)
    * `depreciation_rate_percent` (NUMERIC(5,2))
    * `property_registry_number` (VARCHAR(50))
    * `license_plate` (VARCHAR(20))
    * `vin_chassis_number` (VARCHAR(30))
  * TypeScript típusok frissítése.
* **Verifikáció:** Dev DB migráció futtatása, séma validáció.

#### Micro-Module 4.2: Kibővített Amortizációs Motor (Méret: M)
* **Érintett fájlok:**
  * `src/hooks/useDepreciation.ts`
  * `src/test/accounty/depreciation.test.ts`
  * `src/test/fixed-assets/assetDepreciationExtended.test.ts`
* **Feladat:**
  * `calculateDepreciation` bővítése:
    * Harmadik ág (`grant: { monthly, accumulated, bookValue, ratePercent, grantBase }`).
    * Eltérő adóalap (`tax_depreciation_base`) tiszteletben tartása a bekerülési érték helyett.
    * `last_depreciation_date` kezelése: a jövőbeli ÉCS szigorúan a záró dátum utáni naptári hónaptól indul; nyitó nettó érték = `acquisitionValue - opening_accumulated_depreciation`.
    * Éves kulcs (%) szerinti lineáris kalkuláció futtatása.
* **Verifikáció:** Vitest matematikai egységtesztek átvett nyitó kartonokra, pályázati ÉCS-re és törtrészekre.

#### Micro-Module 4.3: Reaktív Létrehozó és Szerkesztő Felület (Méret: M)
* **Érintett fájlok:**
  * `src/components/fixed-assets/CreateFixedAssetDialog.tsx`
  * `src/components/fixed-assets/AssetDetailPanel.tsx`
* **Feladat:**
  * Kétirányú reaktív mező: Hasznos élettartam (Év/Hó) ↔ Éves kulcs (%).
  * TAO egyedi kulcs felülbíráló mező (`tao_rate_override`).
  * Nyitó karton szekció: átvételkori halmozott ÉCS és utolsó elszámolt dátum.
  * Pályázatos amortizáció szekció: elkülönített alap és kulcs.
  * Dinamikus törzsadatok: 12-es főkönyvi számlánál Hrsz., 142/143-nál Rendszám és Alvázszám.
* **Verifikáció:** Form interakció, kétirányú számítás és dinamikus mezőmegjelenés ellenőrzése.

---

### 📦 PHASE 5: Fejlesztési Tartalék FIFO Allokáció & Beruházási Adókedvezmény Védelem
> **Fókusz:** Több évi tartalékkeret együttes hozzárendelése, automatikus FIFO javaslat, és a 4 éves adókedvezmény kivezetési korlát.

#### Micro-Module 5.1: Fejlesztési Tartalék Allokációs Tábla és Backfill (Méret: S)
* **Érintett fájlok:**
  * `supabase/migrations/20261016110000_fixed_asset_reserve_allocations.sql`
  * `src/types/fixed-assets.ts`
  * `src/hooks/useDevelopmentReserves.ts`
* **Feladat:**
  * `fixed_asset_reserve_allocations` tábla (`company_id`, `asset_id`, `reserve_id`, `allocated_amount`), RLS házirendek, idegen kulcs indexek.
  * Idempotens backfill: a meglévő `fixed_assets.development_reserve_id` rekordok automatikus átmásolása a kapcsolótáblába.
* **Verifikáció:** SQL sémaellenőrzés, backfill adatintegritás igazolása.

#### Micro-Module 5.2: FIFO Allokációs Szerviz és Felületi Integráció (Méret: M)
* **Érintett fájlok:**
  * `src/lib/fixed-assets/developmentReserveAllocationService.ts`
  * `src/components/fixed-assets/DevelopmentReserveAllocationSelector.tsx`
  * `src/components/fixed-assets/CreateFixedAssetDialog.tsx`
  * `src/components/fixed-assets/AssetListTable.tsx`
  * `src/test/fixed-assets/developmentReserveAllocation.test.ts`
* **Feladat:**
  * Intelligens FIFO algoritmus: legkorábbi lejáratú tartalékkeretek automatikus merítése a kívánt összegig.
  * Többes választó komponens kézi korrekcióval és keretellenőrzéssel.
  * Oszlopok az eszközlistában és kartonon: Bekerülési érték, Fejlesztési tartalék levonás (évenkénti bontás), TAO ÉCS-alap.
* **Verifikáció:** Vitest teszt többéves tartalékkeret kimerítésére és lista megjelenítésre.

#### Micro-Module 5.3: Beruházási Adókedvezmény és 4 Éves Kivezetési Gát (Méret: M)
* **Érintett fájlok:**
  * `supabase/migrations/20261016120000_tax_credit_retention.sql`
  * `src/components/fixed-assets/DisposalDialog.tsx`
  * `src/components/fixed-assets/DisposalApprovalDialog.tsx`
  * `src/test/fixed-assets/taxCreditDisposalProtection.test.ts`
* **Feladat:**
  * `fixed_assets.has_tax_credit`, `tax_credit_type`, `tax_credit_retention_until` mezők.
  * `DisposalDialog.tsx`: 4 éves korlát vizsgálata; lejárati idő előtti kivezetéskor piros riasztás, jogkövetkezményi tájékoztató és kényszerített könyvelői felülbírálás indoklással.
* **Verifikáció:** Kivezetési folyamat tesztelése védett eszköznél lejárati idő előtt és után.

---

### 🏛️ PHASE 6: Mozgásnemek, Terven Felüli ÉCS & Dimenziós Vegyes Feladás
> **Fókusz:** Teljes számviteli mozgásnem-törzs, terven felüli ÉCS könyvelése (866 / 966), és dimenziók átadása az időszaki ÉCS feladásban.

#### Micro-Module 6.1: Terven Felüli ÉCS és Visszaírás Motor (Méret: M)
* **Érintett fájlok:**
  * `supabase/migrations/20261016130000_unplanned_depreciation_rpc.sql`
  * `src/components/fixed-assets/UnplannedDepreciationDialog.tsx`
  * `src/lib/fixed-assets/unplannedDepreciationService.ts`
  * `src/components/fixed-assets/AssetDetailPanel.tsx`
  * `src/test/fixed-assets/unplannedDepreciation.test.ts`
* **Feladat:**
  * `asset_events.event_type` bővítése: `unplanned_depreciation`, `unplanned_depreciation_reversal`, `contribution_in_kind`, `free_transfer_out`, `free_transfer_in`.
  * `post_unplanned_depreciation_to_gl` RPC:
    * Elszámolás: T 866 (Terven felüli ÉCS) → K 1x9 (Halmozott ÉCS).
    * Visszaírás: T 1x9 → K 966 (Terven felüli ÉCS visszaírása).
  * Új dialógus az eszközkartonon összeggel, indoklással és azonnali bizonylatszám képzéssel.
* **Verifikáció:** Vitest könyvelési szerződésteszt és könyv szerinti érték frissülés igazolása.

#### Micro-Module 6.2: Dimenziós ÉCS Vegyes Feladás (Költséghely & Projekt) (Méret: M)
* **Érintett fájlok:**
  * `supabase/migrations/20261016140000_depreciation_run_dimensions.sql`
  * `src/lib/fixed-assets/depreciationPostingService.ts`
  * `src/test/accounty/depreciationPostingService.test.ts`
* **Feladat:**
  * `post_depreciation_run_to_gl` RPC bővítése: `p_items` elemeiben fogadja és bejegyzi a `cost_center_id` és `project_id` mezőket az `acc_journal_lines`-ba.
  * `depreciationPostingService.ts`: az 5711-es sorok átveszik az eszköz költséghelyét és projektjét.
* **Verifikáció:** Vitest integrációs teszt: az ÉCS könyvelése után a naplósorok tartalmazzák a helyes dimenziókat.

---

### 🚗 PHASE 7: Cégautó Adó Modul & Gépjárműadó Levonási Automatizmus
> **Fókusz:** Személygépkocsik cégautóadó nyilvántartása, kW/Euro törvényi adótábla, és határidő-ellenőrzött gépjárműadó levonás.

#### Micro-Module 7.1: Cégautó Adatmodell és Gjt. Kalkulációs Motor (Méret: M)
* **Érintett fájlok:**
  * `supabase/migrations/20261016150000_company_cars.sql`
  * `src/types/company-cars.ts`
  * `src/lib/tax/companyCarTaxCalculator.ts`
  * `src/test/tax/companyCarTaxCalculator.test.ts`
* **Feladat:**
  * `company_cars` tábla RLS-sel és TENY kivezetési szinkron triggerrel (`disposal_date` → `tax_liability_to`).
  * Gjt. törvényi adótábla motor: havi fix összeg kalkuláció kW és környezetvédelmi osztály (EURO 5, EURO 6, zöld rendszám mentesség) alapján.
* **Verifikáció:** Törvényi példák matematikai tesztelése (pl. 110 kW Euro 6: 22 000 Ft/hó; elektromos: 0 Ft).

#### Micro-Module 7.2: Gépjárműadó Levonás Határidő-vizsgálattal (Méret: M)
* **Érintett fájlok:**
  * `src/lib/tax/motorVehicleTaxDeductionService.ts`
  * `src/test/tax/motorVehicleTaxDeduction.test.ts`
* **Feladat:**
  * Banki utalások szűrése a NAV Gépjárműadó számlára (`10032000-01076167`) és rendszám-illesztés.
  * Törvényi esedékesség ellenőrzése (I. félév: ápr. 15., II. félév: szept. 15.).
  * Határidőben fizetett tételek levonása a negyedéves cégautóadóból (Gjt. 17/A. §); késedelem esetén figyelmeztetés a levonási jog elvesztéséről.
* **Verifikáció:** Vitest határidős és késedelmes forgatókönyv tesztek.

#### Micro-Module 7.3: Cégautóadó Felület és Negyedéves Kimutatás (Méret: L)
* **Érintett fájlok:**
  * `src/components/fixed-assets/CompanyCarsTab.tsx`
  * `src/components/fixed-assets/CompanyCarDialog.tsx`
  * `src/pages/FixedAssetsPage.tsx`
  * `src/test/fixed-assets/CompanyCarsTab.test.tsx`
* **Feladat:**
  * Új lapfül a TENY-ben: `Cégautóadó`.
  * Járművek listája (saját tulajdonú, bérelt, lízingelt), havi adótétel, levont gépjárműadó és nettó fizetendő.
  * Negyedéves bevallás-összesítő és export könyvelők számára.
* **Verifikáció:** UI renderelés, modál interakció és számítási előnézet ellenőrzése.

---

## 🔬 FÁZIS 3: Maker–Checker Minőségbiztosítási Protokoll

Minden micro-modul kizárólag a **Maker–Checker** kapun keresztül tekinthető késznek:
1. **Maker:** Kódolás → `npm run lint:fast` → `npx tsc --project tsconfig.app.json --noEmit`.
2. **Checker (Független Verifier):**
   * Adatbázisnál: Dev DB `execute_sql` lekérdezéssel ellenőrzi a sémát, indexeket és RLS-t.
   * Szerviznél/RPC-nél: Vitest automatizált szerződéstesztet futtat.
   * UI komponensnél: Renderelés és hiba-mentesség ellenőrzése.

---

## 📋 Jóváhagyási Kapu a Felhasználó Felé

Kérlek, tekintsd át a fenti implementációs tervet és jelezz vissza:
1. **Jóváhagyod-e a Döntési Mátrixban (D-1 – D-14) vázolt technikai irányokat?**
2. **Indíthatjuk-e az implementációt a Phase 4-gyel (Micro-Module 4.1: Adatbázis Séma Bővítés és Típusok) a Dev környezetben?**
