# A-252: TÉNY Phase 2 és Phase 3 — Tárolóhely- és Felelős-hierarchia, Hibrid Címkenyomtatás, Mobil Leltározó, Többforrásos Komponensek, Pályázati PIE Feloldás és 4-oldalú Rekonciliáció

**Status:** Decided  
**Date:** 2026-10-13  
**Utoljára frissítve:** 2026-10-13  

## Context

A TENY modul Phase 1 ([A-251](./A-251-fixed-assets-gl-linkage-reconciliation-and-disposal-workflow.md)) megteremtette az analitika és a főkönyv közötti `fixed_asset_id` szintű kapcsolatot és a jóváhagyás-alapú kivezetést. Ugyanakkor a vállalati eszközgazdálkodás és a jogszabályi megfelelőség terén további kritikus követelmények álltak fenn:

1. **Tárolóhely & Felelős (Sztv. és Mt. szerinti felelősségvállalás):** Az eszközök nem rendelkeztek strukturált, telephelyen belüli tárolóhely-hierarchiával (épület / emelet / szoba) és szervezeti egység / felelős személy nyilvántartással. Az átadások nem generáltak jogilag kötelező érvényű átadás-átvételi nyilatkozatot (Mt. 179. §).
2. **Fizikai azonosítás & Leltározás (Sztv. 69. §):** Nem volt lehetőség ipari vonalkódos címkenyomtatásra, sem mobilbarát, kamerás leltárellenőrzésre, sem a törvényben előírt 3 fős bizottsági fordulónapi leltárív exportálására.
3. **Pályázati források & Eszköz-komponensek (Sztv. 23. §, 45. § (2), 77. § (3)):** Komplex eszközök (gépsorok, IT rendszerek) eltérő élettartamú alkatrészekből állnak, és jelentős részük vissza nem térítendő támogatásból (pályázat) valósul meg. Kötelező az ÉCS arányában passzív időbeli elhatárolást (PIE) képezni és feloldani egyéb bevétellel szemben (**T 483 → K 964**). Ennek hiányában a főkönyv és a pályázati elszámolás torzult.

## Decision

### 1. Tárolóhely & Felelős Struktúra (`company_sub_locations`)
- Új tábla: `company_sub_locations` (`company_id`, `site_id`, `parent_id`, `name`, `code`, `location_type`, `is_active`). Rekurzív hierarchikus faépítő hook (`useCompanySubLocations`).
- `fixed_assets.sub_location_id` és `fixed_assets.custodian_name` relációk FK-indexszel, cég-izolációs őrrel és RLS házirendekkel (`company_members` + `accounty_assignments`).
- Migráció: `supabase/migrations/20261013140000_sub_locations_and_custodians.sql`.

### 2. Kétnyelvű Átadás-Átvételi Nyilatkozat (Mt. 179. §) & Áthelyezési Napló
- `TransferDialog.tsx`: tárolóhely, felelős és költséghely áthelyezési varázsló, timeline esemény bejegyzéssel (`transfer` event type).
- `assetHandoverProtocolPdf.ts`: jsPDF alapú, professzionális, kétnyelvű (magyar / angol) felelősségvállalási nyilatkozat generálása jogi záradékkal, átadó és átvevő aláírási blokkal.

### 3. Hibrid Címkenyomtatás (Code 128B SVG + QR kód)
- `barcodeGenerator.ts`: külső függőség nélküli, tiszta TypeScript SVG Code 128B vonalkód renderelő motor ellenőrző összeggel.
- `QrLabelDialog.tsx`: 50×30 mm (kompakt), 70×36 mm (standard) és A4 íves (24 címke/oldal) nyomtatási profilok közvetlen böngészős CSS `@page` print és SVG letöltés támogatással.

### 4. Mobilbarát Leltározás és Fordulónapi Leltárív (Sztv. 69. §)
- `InventoryCheckDialog.tsx`: mobil kamerás vonalkód-leolvasás (`html5-qrcode`), fizikai állapot rögzítés (ép, sérült, selejt), észrevételek és azonnali korrekciós jóváhagyás.
- `inventoryReportExport.ts`: xlsx és jsPDF alapú hivatalos analitikus fordulónapi leltárív generálás könyv szerinti vs. leltározott egyenleggel, leltárkülönbözet (többlet/hiány) kimutatással és 3 fős leltározási bizottsági aláíró panellel.

### 5. Pályázati Projektek és Eszköz-komponensek Sémája
- Új táblák:
  - `grant_projects`: szerződéses adatok, támogatási intenzitás %, támogatási keretösszeg, előleg, folyósítás, fenntartási időszak (kezdete és vége), státusz.
  - `fixed_asset_components`: eszköz-alkatrészek eltérő aktiválási dátummal, hasznos élettartammal, támogatott összeggel és saját erővel.
- Cross-tenant őr trigger: komponens nem tartozhat másik cég eszköztárához.
- Migráció: `supabase/migrations/20261013150000_grant_projects_and_components.sql`.

### 6. Komponens-szintű ÉCS és ÉCS-arányos PIE Feloldás Könyvelése (Sztv. 45. § (2))
- `assetComponentCalculator.ts`: támogatott és saját erő ÉCS és könyv szerinti nettó érték szétválasztása komponensenként.
- `post_grant_deferral_release_to_gl` RPC (`supabase/migrations/20261013160000_post_grant_deferral_release_rpc.sql`):
  - Időszaki támogatási ÉCS összeg automatikus feladása a Vegyes naplóba: **T 483 (Passzív időbeli elhatárolás) → K 964 (Egyéb támogatási bevétel)**.
  - A könyvelési tételek közvetlenül felcímkézésre kerülnek a `fixed_asset_id` értékkel, biztosítva az idempotenciát és a rekonciliálhatóságot.

### 7. Digitális Támogatási Projektlap és Négyoldalú Rekonciliáció
- `grantReconciliationService.ts`: 4-oldalú egyezőségi motor:
  1. *Pályázati keret* (odaítélt vs. allokált összeg)
  2. *TÉNY analitika* (eszköz és komponens támogatott értékek összege)
  3. *Főkönyvi támogatási bevétel* (964-es számla forgalom)
  4. *Főkönyvi elhatárolás* (483-as passzív időbeli elhatárolás egyenleg)
- Riasztási rendszer: kerettúllépés, PIE elszámolási eltérés, és elidegenítési tilalom riasztás a fenntartási időszak alatti kivezetési kísérlet esetén.
- `GrantProjectsTab.tsx`: integrált dashboard a `FixedAssetsPage.tsx` 5. fülén.

### 8. Blind-Spot Védelem és Adatintegritási Keményítés (Option A Implementáció)
A `/morfi-implementation-review` mélyaudit megállapításai alapján az alábbi 6 megbízhatósági és biztonsági védelmi vonalat vezettük be:
1. **Szinkron Mutex Dupla Kattintás Ellen (Concurrency):** A `GrantProjectsTab.tsx`-ben `inFlightRef.current` azonnali szinkron zárolás védi a „Könyvelés főkönyvbe” gombot, megakadályozva a duplikált bizonylat-keletkezést gyors egymás utáni kattintás esetén.
2. **Többéves Kerekítési Maradék Catch-Up (Boundaries):** A `grantDeferralPostingService.ts` a hasznos élettartam végén vagy az utolsó periódusban pontosan a fennmaradó elhatárolási keretre zár (±10 Ft toleranciával), megszüntetve a többéves forintos kerekítési maradékokat a 4831-es számlán.
3. **Rugalmas Számlatükör-Választó és Dúsított Hibakezelés (Failure Modes):** A PIE feloldási modálban a felhasználó közvetlenül választhat az aktív 483-as és 964-es számlák közül (`fetchAvailableGrantAccounts`), és hiányzó számla esetén navigációs útmutatást kap a Beállítások -> Számlatükör menüponthoz.
4. **Kivezetett Eszköz Komponenszárolása (State Lifecycle):** Az `AssetComponentsView.tsx`-ben kivezetett (`disposed`, `sold`, `missing`) eszköznél letiltásra kerül az új komponens hozzáadása és a meglévők szerkesztése/törlése.
5. **Használatban Lévő Pályázati Projekt Törlésvédelme (Data Integrity):** Új PostgreSQL trigger: `trg_prevent_delete_grant_project_with_usage` (`check_grant_project_can_delete()`), amely megakadályozza a projekt törlését, ha aktív eszköz, alkatrész-komponens vagy lekönyvelt PIE tétel kapcsolódik hozzá. A felületen a törlés gomb automatikusan letiltódik kapcsolt tételek esetén.
6. **Explicit Anon és PUBLIC Megvonás (Security):** Mind az 5 TÉNY tárolt eljárásról (`reconcile_fixed_assets_with_gl`, `request_asset_disposal`, `reject_asset_disposal`, `approve_asset_disposal`, `post_grant_deferral_release_to_gl`) explicit `REVOKE ALL ... FROM PUBLIC, anon;` és csak `authenticated`, `service_role` kapott futtatási jogot.
- Migráció: `supabase/migrations/20261013170000_teny_blind_spot_hardening.sql`.

## Consequences

**Pozitív:**
- Teljes körű, audit-biztos tárgyi eszköz gazdálkodás telephelytől a pályázati elszámolásig.
- A pályázati eszközök ÉCS-arányos elhatárolás feloldása matematikailag és számvitelileg ellenőrzött, 1 kattintással feladható a főkönyvbe.
- A fenntartási időszakok és a visszafizetési kockázatok proaktívan monitorozottak.
- A blind-spot keményítések kiküszöbölik a párhuzamossági és kerekítési hibákat, valamint az adatintegritás megsértését.

**Kockázatok és megkötések:**
- A PIE feloldás a 483 és 964 főkönyvi számlák létezésére támaszkodik a cég számlatükrében (ha hiányoznak, a felület és a szerviz egyértelmű hibát jelez és kéri a felvételüket).
- A kamerás QR/vonalkód olvasáshoz HTTPS vagy localhost környezet szükséges böngészőoldalon.

## Kapcsolódó
- [A-251: Tárgyi Eszköz ↔ Főkönyv Kapcsolat és Kivezetés](./A-251-fixed-assets-gl-linkage-reconciliation-and-disposal-workflow.md)
- [P-186: TENY Phase 2 & Phase 3 UX](../../product/decisions/P-186-fixed-assets-phase2-and-phase3-ux.md)
- Terv: `implementation-plans/TENY_implementacios_terv.md`
- Migrációk: `20261013140000_sub_locations_and_custodians.sql`, `20261013150000_grant_projects_and_components.sql`, `20261013160000_post_grant_deferral_release_rpc.sql`, `20261013170000_teny_blind_spot_hardening.sql`
