# Implementációs Terv: Discrepancy 2 — Auto-Poster RPC Refaktorálás és Cégvezetői Főkönyvi Írási Korlátozás

## 📋 Összefoglaló és Célkitűzés
Az **A-247-es döntési rekord** és a **visibill-rbac-matrix.md** alapján az eaisyBill `admin` (Cégvezető / Ügyvezető) és az eaisyBooks `payroll_specialist` (Bérszámfejtő) szerepkörök **nem rendelkezhetnek közvetlen könyveléstechnikai írási joggal** a kettős könyvvitel alaptábláin (`acc_journals`, `acc_journal_headers`, `acc_journal_lines`, `acc_open_item_matches`). 

Jelenleg 5 automatikus feladó szerviz (auto-poster) közvetlen kliensoldali `INSERT`, `UPDATE` és `DELETE` műveleteket hajt végre ezeken a táblákon a bejelentkezett felhasználó JWT tokenjével. Emiatt a PostgreSQL RLS engedélyezni kényszerül az `admin` szerepkörnek a táblaszintű írást, ami súlyos biztonsági és auditálhatósági rést jelent.

A feladat célja:
1. Az 5 auto-poster (ÉCS, Eszközaktiválás, Fejlesztési tartalék feloldás, Osztalék, Bérfeladás) és azok törlési/sztornó eljárásainak átültetése dedikált, tranzakcionális, atomi PostgreSQL `SECURITY DEFINER` RPC függvényekbe (a meglévő `post_cash_report_to_gl` mintájára).
2. A kliensoldali TypeScript hívók átállítása a fenti RPC-kre a meglévő frontend felületek érintetlenül hagyása mellett (100% backward compatibility).
3. A kettős könyvvitel alaptábláinak lezárása: az `admin`, `owner` és `payroll_specialist` közvetlen írási jogainak végleges megvonása az RLS rétegben, így a főkönyv kizárólag a hivatásos könyvelők (`iroda_admin`, `senior_könyvelő`, `könyvelő`, `asszisztens`) számára lesz közvetlenül szerkeszthető, míg az operatív vezetők kizárólag az auditált, ellenőrzött RPC-ken keresztül adhatnak fel tételeket.

---

## 🎯 FÁZIS 1: Kontextus és Hipotézis

### 1.0 Hipotézis & Magabiztossági Szint
- **HIPOTÉZIS:** Ha az 5 kliensoldali auto-poster funkciót és azok törlési/visszanyitási logikáját átültetjük `SECURITY DEFINER` RPC-kbe, a cégvezető (`admin`) és a bérszámfejtő (`payroll_specialist`) képes lesz elvégezni a szükséges automatikus feladásokat (bérzárás, ÉCS, aktiválás) anélkül, hogy közvetlen táblaszintű `INSERT/UPDATE/DELETE` joggal rendelkezne a főkönyvi naplókon és tételeken.
- **MAGABIZTOSSÁG:** 98% (A mintát a már élesben működő `post_cash_report_to_gl` és az `acc_post_journal_entry` RPC-k 100%-ban validálják).

### 1.1 Előfeltételek és Feltételezések (Assumptions I'm Making)
1. **Tranzakcionális integritás:** A PostgreSQL eljárások egyetlen tranzakcióban (`BEGIN ... EXCEPTION ... ROLLBACK`) hozzák létre a bizonylatfejlécet, a kiegyensúlyozott kontírozó sorokat (T = K), és meghívják a meglévő `acc_post_journal_entry` RPC-t a sorszámozáshoz és véglegesítéshez.
2. **Kliensoldali kompatibilitás:** A meglévő TypeScript függvények (`postDepreciationRunToLedger`, `postAssetActivationToLedger`, `postDevelopmentReserveReleaseToLedger`, `postDividendToLedger`, `postPayrollCycleToLedger`) szignatúrája és visszatérési típusa nem változik, a UI komponensek (`FixedAssetsPage`, `PayrollCyclePage`, `DividendPayrollPage`, `SubledgerPage`) nem igényelnek törő módosítást.
3. **Környezeti izoláció:** A fejlesztés és tesztelés kizárólag a `develop` ágon és a Dev adatbázisban (`qhvcdqkqpgpdxogqqvyr`) történik.

---

## 🔍 FÁZIS 2: Döntési Mátrix

### 🏗️ Architektúra Döntések
| # | Kérdés | Opciók | Meglévő pattern | Ajánlott Döntés |
|---|--------|--------|-----------------|-----------------|
| **D-1** | RPC Granularitás | **a)** Domain-specifikus dedikált RPC-k (5 pár)<br>**b)** Egyetlen polimorfikus, generikus RPC (`post_automated_journal_entry`) | `post_cash_report_to_gl` (A-005, ADR-028) | **Opció a) (Ajánlott):** A generikus RPC nem tudná a szerveroldalon ellenőrizni az üzleti entitások (pl. bérciklus, tárgyi eszköz) összegszerűségét és állapotát. A domain-specifikus RPC garantálja a csalás- és hibaállóságot. |
| **D-2** | Hívói Jogosultságok | **a)** Csak könyvelők<br>**b)** Céghez rendelt `owner`, `admin`, `payroll_specialist` + könyvelők<br>**c)** Bárki, aki a cég tagja | `validate_cash_report_for_posting` | **Opció b) (Ajánlott):** Az ÉCS-t és aktiválást az `admin`, `owner` és a könyvelők, a bérfeladást és osztalékot ezen felül a `payroll_specialist` is meghívhatja a saját cégére. |
| **D-3** | RLS Írási Restrikció Időzítése | **a)** Azonnal, a migráció elején<br>**b)** Kétfázisú: RPC telepítés + frontend átkötés UTÁN lép életbe a tiltó RLS | Biztonsági Quality Gate | **Opció b) (Ajánlott):** Elkerüli a futásidejű kiesést a tesztelés alatt. |
| **D-4** | Törlés és Sztornózás Kezelése | **a)** Kliensoldali delete<br>**b)** Szerveroldali `remove_*_from_gl` RPC-k meghívása, melyek ha már van `journal_number`, számviteli sztornót (`acc_storno_journal_entry`), ha piszkozat, fizikai törlést végeznek | Sztv. 166. § (sorszámfolytonosság) | **Opció b) (Ajánlott):** Megakadályozza a lekönyvelt tételek jogtalan fizikai törlését, garantálja a törvényi megfelelést. |

---

## 🤖 FÁZIS 2.1: Spec Reviewer Pre-Gate Audit (6 Dimenzió)

1. **ADR & Architektúra Konzisztencia:**  
   - Megfelel az A-247-es döntési rekordnak: az operatív cégvezetői és bérszámfejtői szerepkörök elveszítik a közvetlen GL táblamódosítási képességet (`canManageAccountingTech = false`).
   - A multi-tenancy védelem maximális: minden RPC explicit módon ellenőrzi, hogy `auth.uid()` tagja-e az adott `company_id`-nak a megfelelő szerepkörrel.
2. **Zero Silent Decisions:**  
   - A D-1, D-2, D-3 és D-4 pontok explicit fel lettek vázolva és a felhasználó jóváhagyására várnak.
3. **Skálázhatóság & Adatbázis kockázatok:**  
   - A tranzakciók sorszámfoglalása a meglévő `acc_journal_counters` sorzároló logikán (`FOR UPDATE`) fut, nincs race-condition vagy holtpont veszély.
   - Nincs kliensoldali batch-olvasási N+1 kockázat, mert a kontírozás egyetlen SQL blokkban történik.
4. **Biztonság & Multi-tenancy (STRIDE check):**  
   - Bitorlásvédelem: A `SECURITY DEFINER` függvények `SET search_path = public, extensions` beállítást használnak, kizárva a search_path hijacking támadásokat.
   - `REVOKE EXECUTE ... FROM anon, PUBLIC` és kizárólag `authenticated` jogosultság.
5. **Vercel React & Frontend Minőség:**  
   - A hívó service-ek Promise alapú hibakezelést használnak, a UI állapotok nem duplikálódnak, a react-query cache invalidációk megmaradnak.
6. **Dekompozíciós megfelelőség:**  
   - A feladat 5 jól elkülönülő micro-modulra (M-1 – M-5) van bontva, XS-M méretosztályokban, a függőségi fa szigorúan lineáris és átlátható.

---

## 🧩 FÁZIS 2.5: Micro-Modul Dekomponálás

### Modul M-1: Adatbázis Migráció — Auto-Poster RPC-k Telepítése (M méret, 1 fájl)
- **Fájl:** `supabase/migrations/20261011060000_create_autoposter_rpc_functions.sql`
- **Felelősség:**
  - `post_depreciation_run_to_gl(p_company_id, p_period_type, p_date_from, p_date_to, p_posting_date, p_document_id, p_description, p_currency, p_items)`
  - `post_asset_activation_to_gl(p_company_id, p_asset_id, p_asset_name, p_inventory_number, p_acquisition_value, p_activation_date, p_gl_account_id, p_cip_gl_account_id, p_currency)`
  - `remove_asset_activation_from_gl(p_company_id, p_inventory_number)`
  - `post_development_reserve_to_gl(p_company_id, p_asset_id, p_asset_name, p_inventory_number, p_reserve_amount, p_activation_date, p_reserve_year, p_gl_414_id, p_gl_413_id)`
  - `remove_development_reserve_from_gl(p_company_id, p_inventory_number)`
  - `post_dividend_to_gl(p_company_id, p_dividend_id, p_gross_amount, p_szja_amount, p_szocho_amount, p_member_name, p_resolution_number, p_posting_date, p_document_date, p_gl_413_id, p_gl_4791_id, p_gl_462_id, p_gl_463_id)`
  - `delete_dividend_gl_entry(p_company_id, p_dividend_id)`
  - `post_payroll_cycle_to_gl(p_company_id, p_cycle_id, p_custom_gl_mapping)`
  - Biztonság: `SECURITY DEFINER`, `search_path = public, extensions`, explicit szerepkör és cégellenőrzés.

### Modul M-2: pgTAP Adatbázis Tesztcsomag (S méret, 1 fájl)
- **Fájl:** `supabase/tests/database/autoposter_rpc_functions.test.sql`
- **Felelősség:**
  - Teszteli mind az 5 RPC hívását érvényes céges jogosultsággal.
  - Teszteli az idegen cég / jogosulatlan szerepkör (`employee`, `viewer`) elutasítását.
  - Ellenőrzi a T = K kettős könyvviteli egyensúlyt és az automatikus sorszámkiosztást.

### Modul M-3: Kliensoldali Service Réteg Átállítása RPC Hívásokra (M méret, 5 fájl)
- **Fájlok:**
  1. `src/lib/fixed-assets/depreciationPostingService.ts`
  2. `src/lib/fixed-assets/assetActivationAutoPoster.ts`
  3. `src/lib/fixed-assets/developmentReserveAutoPoster.ts`
  4. `src/lib/payroll/dividendAutoPoster.ts` (és `src/hooks/useDividends.ts`)
  5. `src/lib/payroll/payrollAutoPoster.ts`
- **Felelősség:**
  - A közvetlen `.from('acc_journal_headers').insert(...)` és `.from('acc_journal_lines').insert(...)` hívások lecserélése a megfelelő `supabase.rpc(...)` eljárásokra.
  - Hiba- és visszatérési értékek illesztése, változatlan UI szerződés.

### Modul M-4: Vitest Kliensoldali és Integrációs Tesztek (S méret, 2 fájl)
- **Fájlok:**
  - `src/test/accounty/autoPosterRpcContract.test.ts`
  - `src/test/accounty/payrollIdempotencyAndCycleLock.test.ts`
- **Felelősség:**
  - RPC mock és szerződés ellenőrzés.
  - Idempotencia vizsgálata (duplikált bérfeladás nem hoz létre új tételt).

### Modul M-5: RLS Szigorítás — Admin & Nem-Könyvelő Közvetlen GL Írás Zárolása (XS méret, 1 fájl)
- **Fájl:** `supabase/migrations/20261011063000_restrict_acc_tables_write_to_accountants.sql`
- **Felelősség:**
  - `acc_journals`, `acc_journal_headers`, `acc_journal_lines`, `acc_open_item_matches` táblákon RESTRICTIVE write policy alkalmazása.
  - Kizárólag az alábbi szerepkörök kapnak közvetlen `INSERT`, `UPDATE`, `DELETE` jogosultságot:
    - `iroda_admin`
    - `senior_könyvelő`
    - `könyvelő`
    - `asszisztens`
  - Az `admin`, `owner`, `payroll_specialist`, `member` közvetlen írása blokkolva (kizárólag a `SECURITY DEFINER` RPC-ken keresztül írhatnak).
  - pgTAP verifikáció hozzáadása a tesztcsomaghoz.

---

## 🚦 FÁZIS 3: Verifikációs Kapuk és Kritériumok
1. **Adatbázis szintű ellenőrzés:**
   - pgTAP tesztek lefutása a Dev DB-ben (`qhvcdqkqpgpdxogqqvyr`): 100% zöld.
2. **Kliensoldali fordítás és típusellenőrzés:**
   - `npx oxlint <módosított fájlok>` hiba nélkül (<50ms).
   - `npx tsc --noEmit` / `npm run build` sikeres.
   - `npx vitest run src/test/accounty/autoPosterRpcContract.test.ts` zöld.
3. **Jogosultsági teszt:**
   - Cégvezetői (`admin`) hitelesítéssel a bérfeladás és az ÉCS könyvelés sikeresen lefut (az RPC-n keresztül).
   - Ugyanezen cégvezetői fiókkal egy közvetlen `supabase.from('acc_journal_headers').insert(...)` RLS hibát (`permission denied` / `row violation`) dob.
