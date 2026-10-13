# TENY (Tárgyi Eszköz Nyilvántartó) – Hivatalos Implementációs Terv

> **Hivatkozási alap:** [TENY_gap_elemzes.md](file:///d:/ThinkAI/Visibill/eaisybill/implementation-plans/TENY_gap_elemzes.md) és [TENY_fejlesztes.md](file:///d:/ThinkAI/Visibill/eaisybill/implementation-plans/TENY_fejlesztes.md)  
> **Protokoll:** `/visibill-feature-planner` (Zero Silent Decisions, Spec Reviewer Audit, Maker–Checker Architecture)  
> **Környezet:** `eaisybill-dev` (`dev.visibill.hu`, Supabase Dev DB: `qhvcdqkqpgpdxogqqvyr`)  
> **Aktuális Git ág:** `develop`  
> **Dátum:** 2026-10-13  

---

## 🎯 FÁZIS 1: Kontextus és Hipotézis

### 1.0 Hipotézis és Megértés
* **Hipotézis:** A cél a VisiBill / eaisyBooks Tárgyi Eszköz Nyilvántartó (TENY) moduljának kiterjesztése az analitikai kartonozásból egy zárt, auditbiztos könyvviteli rendszerré mind a 7 funkcionális területen (1.1–1.7). Ez magában foglalja a valós idejű Főkönyv ↔ TENY rekonciliációt, az automatikus 4 jogcímű kivezetési kontírozást, a szervezeti hierarchiát (tárolóhelyek, felelős dolgozók), a mobil/vonalkódos leltározást, a fejlesztési tartalék 3–4. évi pótlék-monitoringját és a Tao 22/A. § kedvezményt, a többéves mozgástáblát és cégvezetői öregedési grafikont, valamint az integrált pályázati/támogatási projektkezelést és az ÉCS-arányos passzív időbeli elhatárolás (PIE: 483 → 964) feloldást.
* **Confidence szint:** 99% — A meglévő forráskód, a Dev adatbázis sémája, a tesztek és a [TENY_gap_elemzes.md](file:///d:/ThinkAI/Visibill/eaisybill/implementation-plans/TENY_gap_elemzes.md) alapján minden függőség, számviteli szabály és UI pont feltárt.

### 1.1 Rendszer-feltételezések (Assumptions I'm Making)
1. **Multi-tenancy:** Minden új tábla (`company_sub_locations`, `grant_projects`, `fixed_asset_components`, `asset_tax_incentives`) kötelezően tartalmaz `company_id UUID REFERENCES companies(id)` mezőt, és szigorú RLS házirendet kap a `company_members` táblán keresztül.
2. **Környezeti izoláció:** Minden migráció és fejlesztés kizárólag a Dev Supabase (`qhvcdqkqpgpdxogqqvyr`) adatbázisban fut és tesztelődik; éles DB-hez tilos nyúlni.
3. **Főkönyvi séma:** A könyvelési tételek közvetlenül az `acc_journal_headers` és `acc_journal_lines` táblákba kerülnek, és az `acc_post_journal_entry` tárolt eljárással kapnak szigorú számadású naplósorszámot.
4. **Alkalmazási szerepkörök (Dual Shell):**
   * *Visibill (Operatív réteg):* Raktári és cégvezetői funkciók (címkenyomtatás, fotók csatolása, mobil leltár, átadási nyilatkozat, selejtezési javaslat indítása, öregedési piramis).
   * *eaisyBooks (Könyvelői réteg):* Könyvelői és adózási funkciók (rekonciliáció, eltérés-levezető munkalap, 1-kattintásos szinkronizáció, kivezetések jóváhagyása és kontírozása, pótlék-kalkuláció, PIE feloldás, 2629 TAO adóbevallás integráció).

---

## 🔍 FÁZIS 2: Döntési Mátrix (Zero Silent Decisions)

Az alábbi döntési pontok határozzák meg a modulok technikai kivitelezését:

### 📊 1. Adatmodell Döntések
| # | Kérdés | Opciók | Meglévő Pattern | Javasolt Döntés | Racionálé |
|---|--------|--------|-----------------|-----------------|-----------|
| **D-1** | Hogyan kapcsolódjanak a főkönyvi sorok a tárgyi eszközökhöz? | a) Szöveges leltári szám keresés a leírásban<br>b) Közvetlen `fixed_asset_id` idegen kulcs az `acc_journal_lines`-ban | `acc_journal_lines.project_id`, `cost_center_id` | **b) Közvetlen `fixed_asset_id` FK** | Számszaki garanciát ad a mérlegegyezőségre, kiküszöböli a szöveg-illesztési hibákat és gyorsítja a rekonciliációs lekérdezést. |
| **D-2** | Hogyan tároljuk a támogatott eszközök komponenseit? | a) Egy táblában JSONB tömbként (`fixed_assets.components`)<br>b) Külön relációs táblában (`fixed_asset_components`) | `payroll_lines`, `invoice_items` relációs tábla | **b) Külön tábla (`fixed_asset_components`)** | Indexelhető, egyedi aktiválási dátummal és pályázati projekthez köthető forrással bír; lehetővé teszi a komponens-szintű ÉCS-t. |
| **D-3** | Hogyan kezeljük a hierarchikus tárolóhelyeket? | a) Összetett szöveges címmező (pl. "Épület/Emelet/Szoba")<br>b) Önhivatkozó fa-struktúra (`company_sub_locations` `parent_id`-val) | `chart_of_accounts` szülő-gyermek reláció | **b) Önhivatkozó `company_sub_locations`** | Tetszőleges mélységű fastruktúrát ad (Telephely → Épület → Iroda/Raktár), szűrhető és áthelyezhető. |
| **D-4** | Hogyan kezeljük a selejtezési jóváhagyási státuszt? | a) Csak lokális UI állapot<br>b) DB státusz mező: `disposal_status` (`none`, `pending_approval`, `approved`, `rejected`) | `acc_journal_headers.status` (`PISZKOZAT`, `KONYVELT`) | **b) DB státusz mező** | Megakadályozza, hogy jóváhagyás nélküli selejtezés vagy hiány azonnal kivezesse az eszközt a könyvekből. |

### 🏗️ 2. Architektúra és Számviteli Döntések
| # | Kérdés | Opciók | Meglévő Pattern | Javasolt Döntés | Racionálé |
|---|--------|--------|-----------------|-----------------|-----------|
| **D-5** | Hol fusson a Főkönyv ↔ TENY Rekonciliációs Motor? | a) Kliensoldali TypeScript hook (`useQuery`)<br>b) Adatbázis tárolt eljárás (RPC: `reconcile_fixed_assets_with_gl`) | `calculate_vat_return` RPC, `get_ledger_card` | **b) PostgreSQL RPC függvény** | Több ezer könyvelési sornál és eszköznél a szerveroldali aggregáció nagyságrendekkel gyorsabb (<50ms), atomi és nem terheli a hálózatot. |
| **D-6** | Mikor történjen a támogatás PIE feloldása (T 483 → K 964)? | a) Teljesen kézi könyvelés a vegyes naplóban<br>b) Az időszaki ÉCS elszámolás részeként automatikusan a `depreciationPostingService`-ben | `developmentReserveAutoPoster` | **b) Integrált automatikus feloldás** | Biztosítja a számviteli eredménysemlegességet (Sztv. 45. § (2)); az ÉCS könyvelésekor azonnal képződik az ellentételező tétel. |
| **D-7** | Hogyan készüljön a kétnyelvű átadási és selejtezési jegyzőkönyv? | a) Szerveroldali Python/PDF worker<br>b) Kliensoldali `pdfmake` / `jspdf` | `assetActivationProtocolPdf.ts` (`pdfmake`) | **b) Kliensoldali `pdfmake` motor** | Azonnali letöltést ad szerverfüggőség nélkül, megegyezik a jól bevált aktiválási jegyzőkönyv architektúrájával. |
| **D-10** | Hogyan kezeljük a fejlesztési tartalék 3–4. évi késedelmi pótlék számítását? | a) Kézi számítás adóbevalláskor<br>b) Automatikus pótlék-kalkulátor (jegybanki alapkamat + 5 pont) és TENY dashboard riasztási sáv | `TaoYearEndWizardPage` | **b) Automatikus kalkulátor és riasztás** | Elkerüli a bírságokat és időben figyelmezteti a vezetőséget a határidő lejárta előtt (Tao tv. 7. § (15)). |

### 🖥️ 3. Frontend & UX Döntések
| # | Kérdés | Opciók | Meglévő Pattern | Javasolt Döntés | Racionálé |
|---|--------|--------|-----------------|-----------------|-----------|
| **D-8** | Hol jelenjen meg a Rekonciliációs Munkalap? | a) Külön főmenüpont az oldalsávban<br>b) Új felső lapfül a TENY oldalon (`/teny?tab=reconciliation`) és a Főkönyv oldalon | `FixedAssetsPage` felső tabok (`assets`, `dev_reserves`) | **b) Felső lapfül a TENY-ben és link a Főkönyvben** | Egységes navigáció, nem terheli az oldalsávot, közvetlenül a tárgyi eszközök mellett érhető el. |
| **D-9** | Milyen vonalkód formátumot használjunk a címkenyomtatáshoz? | a) Csak QR-kód<br>b) QR-kód + Code128 lineáris vonalkód | `QrLabelDialog.tsx` | **b) Hibrid QR + Code128** | A régebbi USB/Bluetooth lézeres vonalkódolvasók és az okostelefonos kamerák egyaránt azonnal felismerik. |
| **D-11** | Hol jelenjen meg a Cégvezetői vagyonkimutatás és öregedési piramis? | a) Külön Management oldalon<br>b) A TENY Dashboard fejlécében összecsukható analitikai kártyasorként (`recharts`) | `FinancialSummaryCards.tsx` | **b) TENY fejléc összecsukható kártyasor** | Azonnali vizuális rálátást ad a döntéshozóknak anélkül, hogy el kellene hagyniuk az eszközlistát. |

---

## 🛡️ FÁZIS 2.1: Spec Reviewer Audit (6-Dimenziós Elemzés)

A tervet lefuttattuk a belső minőségbiztosítási auditon:

1. **ADR Konzisztencia:** Teljes mértékben illeszkedik az [A-164](file:///d:/ThinkAI/Visibill/eaisybill/docs/architecture/decisions/A-164-development-reserve-fixed-assets-db-and-depreciation.md) (Fejlesztési tartalék), [A-180](file:///d:/ThinkAI/Visibill/eaisybill/docs/architecture/decisions/A-180-fixed-assets-periodic-depreciation-posting-service.md) (Időszaki ÉCS feladás), és [A-200](file:///d:/ThinkAI/Visibill/eaisybill/docs/architecture/decisions/A-200-fixed-assets-bulk-excel-csv-import-and-opening-balances.md) (Tömeges import) döntésekhez.
2. **Zero Silent Decisions:** Minden adatmodell (D-1..D-4), számviteli (D-5..D-7, D-10) és UX (D-8, D-9, D-11) pont explicit alternatívákkal és racionáléval szerepel.
3. **Skálázhatóság & Adatbázis:** Minden új idegen kulcs (`fixed_asset_id`, `grant_project_id`, `custodian_id`, `sub_location_id`) dedikált indexet kap. Az összesített mérlegegyezőség SQL RPC-ben fut a kliensoldali N+1 query-k kizárására.
4. **Biztonság (STRIDE & RLS):** Minden új táblán be van kapcsolva az RLS, `company_members` ellenőrzéssel. Cégek közötti adatszivárgás kizárva.
5. **Vercel React & Composition Minőség:** A nehéz modálok (`AssetImportModal`, `InventoryCheckDialog`, `DisposalDialog`) lazy-loadolva maradnak. Nincsenek boolean-prop robbanások; kompozíciós és tab-alapú nézetek épülnek.
6. **Dekompozíciós Megfelelőség:** A feladat 3 logikai fázisra és 12 atomi micro-modulra (M1.1 – M3.4) van bontva a szigorú határidők és tesztelhetőség érdekében.

---

## 📦 FÁZIS 2.5 & 2.6: Micro-Module Dekomponálás és Függőségi Gráf

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       TELJES FÜGGŐSÉGI HÁLÓZAT                                         │
│                                                                                                        │
│   [ Phase 1: Főkönyvi Integritás, Kivezetés & Tartalék Monitoring ]                                    │
│   M1.1 (DB Migration) ──► M1.2 (Rekonciliáció RPC) ──► M1.3 (Rekonciliáció UI) ──► M1.4 (Kivezetés)    │
│            │                                                                                           │
│            └────────────► M1.5 (Fejlesztési Tartalék Pótlék-Monitoring & Tao 22/A. §)                  │
│                                                                                                        │
│   [ Phase 2: Szervezeti Mozgások, Felelősök, Leltár & Öregedési Dashboard ]                           │
│   M2.1 (Sub-locations DB) ──► M2.2 (Áthelyezés & PDF) ──► M2.3 (Code128 Címke) ──► M2.4 (Mobil Leltár)│
│            │                                                                                           │
│            └────────────► M2.5 (Vezetői Öregedési Piramis & Többéves Mozgástábla)                      │
│                                                                                                        │
│   [ Phase 3: Pályázati Modul, Komponensek & PIE ]                                                      │
│   M3.1 (Grants & Komp DB) ──► M3.2 (Komponens ÉCS Motor) ──► M3.3 (PIE Feloldás) ──► M3.4 (Projektlap) │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 🚀 PHASE 1: Főkönyvi Integritás, Kivezetési Motor és Tartalék Monitoring
> **Fókusz:** Zárt kettős könyvviteli egyezőség, root-cause eltérés-levezetés, 4 jogcímű kivezetési kontírozás és 3–4. évi késedelmi pótlék figyelés.

#### Micro-Module 1.1: Adatbázis Kapcsolatok és Indexek (Méret: S)
* **Érintett fájlok:**
  * `supabase/migrations/20261013100000_fixed_assets_gl_and_disposal.sql`
  * `src/types/fixed-assets.ts`
* **Feladat:**
  * `acc_journal_lines.fixed_asset_id` idegen kulcs (`REFERENCES fixed_assets(id) ON DELETE SET NULL`) és index létrehozása.
  * `fixed_assets.disposal_status` (`none`, `pending_approval`, `approved`, `rejected`), `disposal_reason_type`, `disposal_committee`, `disposal_waste_info`, `disposal_journal_entry_id` mezők felvétele.
  * TypeScript típusok frissítése.
* **Verifikáció:** `execute_sql` ellenőrzés a Dev Supabase-en; idegen kulcs integritás és RLS ellenőrzése.
* **Státusz: ✅ KÉSZ (Dev DB, 2026-10-13)** - M1.1 + M1.1b (GL posting RPC-k patch).
  * Migrációk: `20261012231000_fixed_assets_gl_link_and_disposal_gate.sql`, `20261012231100_fixed_asset_id_in_gl_posting_rpcs.sql` (Dev DB-n alkalmazva, `schema_migrations`-ben regisztrálva).
  * Eltérések a tervtől (jelezve): `ON DELETE RESTRICT` (nem SET NULL; az immutability trigger a SET NULL-t amúgy is elutasítaná); `disposal_status` text+CHECK (repo-minta, nem enum); extra `disposal_details` jsonb; jóváhagyás/elutasítás DB triggerrel védve (`ledger_write` szint, `approved` végállapot); cross-tenant guard trigger; `asset_events.event_type` CHECK bővítve (disposal_*, performance_log, document_upload, project_transfer); `acc_storno_journal_entry` + 3 posting RPC `fixed_asset_id`-t kitölti/örökli.
  * Talált és javított bug: A-247 óta a TS hívók rossz RPC paraméternevet küldtek (`p_asset_gl_account_id`, `p_gl414/p_gl413`) → javítva + `assetPostingRpcContract.test.ts` szerződésteszt.
  * Nyitott: történeti (jelölés nélküli) főkönyvi sorok backfillje; Dev seed `location_id` FK-hibás eszközök.

#### Micro-Module 1.2: Főkönyv ↔ TENY Rekonciliációs Motor (Méret: M)
* **Érintett fájlok:**
  * `supabase/migrations/20261013110000_rpc_reconcile_fixed_assets.sql`
  * `src/lib/fixed-assets/assetReconciliationService.ts`
  * `src/test/fixed-assets/assetReconciliationService.test.ts`
* **Feladat:**
  * `reconcile_fixed_assets_with_gl(p_company_id, p_date)` PostgreSQL RPC megírása.
  * 1-es számlaosztály (12, 13, 14, 129, 139, 149, 161) egyenlegek és analitikai értékek összevetése.
  * 3 ok szerinti root-cause kategorizálás (`unposted_assets`, `orphan_gl_lines`, `period_mismatches`).
* **Verifikáció:** Vitest integrációs teszt + SQL lekérdezés futtatása tesztcégen.
* **Státusz: ✅ KÉSZ (Dev DB, 2026-10-13)** - M1.2 reconciliation RPC + service.
  * Migráció: `20261012232300_rpc_reconcile_fixed_assets_with_gl.sql` (STABLE, SECURITY DEFINER, `member_write` szint; anon nem hívhatja). Szerviz: `assetReconciliationService.ts`; tesztek: `assetReconciliationService.test.ts`, `assetReconciliationRepost.test.ts`, `assetPostingRpcContract.test.ts` (+1 RPC).
  * Eltérések a tervtől (jelezve): (1) a **várható ÉCS-t a kliens számolja** a meglévő ÉCS-motorral (`calculateAssetPeriodDepreciation`) - az RPC eszközönként a főkönyvi oldalt adja vissza; így nincs SQL-oldali duplikáció a degresszív/teljesítmény/egyedi módokra; (2) a 3 root-cause mellé negyedik kategória: `value_mismatches`; (3) számítási vágás: az utolsó lezárt hónap vége; (4) a meglévő `get_gl_analytic_reconciliation` RPC-t NEM módosítottuk (megjegyzés: nincs jogosultság-ellenőrzés és státuszszűrés benne - külön javítandó).
  * Bizonyíték: rollback-os DO blokk (ok / value_mismatch / unposted-storno-után / előtte ok / idegen user 42501); katalógus: provolatile=s, anon=false.

#### Micro-Module 1.3: Rekonciliációs Munkalap és 1-Kattintásos Szinkronizáló (Méret: M)
* **Érintett fájlok:**
  * `src/components/fixed-assets/AssetReconciliationTab.tsx`
  * `src/pages/FixedAssetsPage.tsx`
  * `src/components/general-ledger/GlAnalyticReconciliationView.tsx`
* **Feladat:**
  * Új felső fül: `Rekonciliáció & Főkönyv` a TENY oldalon.
  * Zöld/Piros KPI kártyák (Bruttó egyezőség, ÉCS egyezőség, Beruházás egyezőség).
  * Root-cause táblázat és `[ ⚡ Hiányzó tételek pótlása ]` kötegelt varázsló.
* **Verifikáció:** Browser Subagent teszt; UI renderelés, szűrés és szinkronizáló gomb interakció ellenőrzése.
* **Státusz: ✅ KÉSZ (Dev DB, 2026-10-13)** - M1.3 UI.
  * Fájlok: `AssetReconciliationTab.tsx` (4 UI állapot, perzisztens DOM, kötegelt pótlás varázsló), `FixedAssetsPage.tsx` (új fül `?tab=reconciliation`), `GlAnalyticReconciliationView.tsx` (link a Tárgyi eszközök kártyán).
  * Bizonyíték: böngészős teszt (balazs@thinkai.hu, cég ecf31039, Dev DB) - KPI kártyák, root-cause panel, eszköztábla, pótlás dialógus megnyílik (a tényleges könyvelés indítását szándékosan nem futtattuk).

#### Micro-Module 1.4: 4 Jogcímű Kivezetési Könyvelő Motor és Jegyzőkönyv (Méret: L)
* **Érintett fájlok:**
  * `src/lib/fixed-assets/assetDisposalPostingService.ts`
  * `src/lib/fixed-assets/assetDisposalProtocolPdf.ts`
  * `src/components/fixed-assets/DisposalDialog.tsx`
  * `src/test/fixed-assets/assetDisposalPosting.test.ts`
* **Feladat:**
  * Kivezetési szerviz megírása 4 jogcímre:
    1. *Értékesítés:* Tört ÉCS (T 5711 → K 1x9) + Halmozott ÉCS (T 1x9 → K 1x) + Nettó ráfordítás (T 861 → K 1x) + Árbevétel (T 311/384 → K 961).
    2. *Selejtezés:* Halmozott ÉCS (T 1x9 → K 1x) + Terven felüli ÉCS / egyéb ráfordítás (T 869 / 1x9 → K 1x).
    3. *Leltárhiány:* Eszköz kivezetése (T 869 → K 1x) + Dolgozói kártérítés (T 361 → K 969).
    4. *Térítés nélküli átadás:* Nettó érték kivezetése egyéb ráfordításként (T 869 → K 1x).
  * Jóváhagyási workflow ("Jóváhagyásra vár" jelvény).
  * Hivatalos Selejtezési Jegyzőkönyv PDF készítése (`pdfmake`).
* **Verifikáció:** Vitest könyvelési szerződésteszt + PDF generálás és letöltés tesztelése.
* **Státusz: ✅ KÉSZ (Dev DB, 2026-10-13)** - M1.4.
  * Migráció: `20261013000000_asset_disposal_workflow_rpcs.sql` (Dev DB-n alkalmazva, `schema_migrations`-ben regisztrálva): `request_asset_disposal` (`member_write`), `reject_asset_disposal` és `approve_asset_disposal` (`ledger_write`), mind SECURITY DEFINER, anon nem hívhatja. Az approve atomi: validál (≥2 sor, pozitív összeg, T/K, kiegyensúlyozott, a cég számlatükréhez tartozó számla), `KIV-<leltári szám>` fejlécet könyvel, a sorokat `fixed_asset_id`-val jelöli, az eszköz `sold`/`disposed` lesz, `disposal_approved` + `disposal` esemény.
  * Fájlok: `assetDisposalPostingService.ts` (tiszta `buildDisposalJournal`, `fetchAssetGlPosition`, `resolveDisposalAccounts`, RPC wrapperek), `assetDisposalProtocolPdf.ts` + `assetDisposalProtocolService.ts` (jegyzőkönyv PDF), `DisposalDialog.tsx` (kérelem űrlap), `DisposalApprovalDialog.tsx` (jóváhagyó előnézet + elutasítás), `AssetDetailPanel.tsx` (állapotjelző, gomb, timeline).
  * Eltérések a tervtől (jelezve): **jsPDF + jspdf-autotable** `pdfmake` helyett (a repo meglévő aktiválási jegyzőkönyve is így készül); egységes motor: pótlólagos ÉCS (T 5711 → K 1x9) a kivezetés napjáig *minden* jogcímnél, utána T 1x9 → K 1x, a nettó érték T 861 (értékesítés) vagy T 869 (egyéb) számlára; az értékesítési bevétel (T 311/384 → K 961) opcionális (a kimenő számla külön könyvelése esetén kikapcsolható), ÁFA nincs kezelve (nettó ár); a kivezetési sorokat a kliens számolja, az RPC validálja; a régi `useDisposeAsset` `@deprecated` (nem könyvel, megkerülné a kaput).
  * Verifikáció: 16 egységteszt (`assetDisposalPosting.test.ts`) + 30 RPC-szerződésteszt (a 3 új RPC-vel); Dev DB rollbackelt DO-blokk: tag nem hagyhat jóvá (42501), dupla kérelem/jóváhagyás elutasítva, kiegyensúlyozatlan/1 soros/idegen számlás könyvelés elutasítva, jóváhagyás után KONYVELT fejléc + 2 jelölt sor + események, elutasítás → újrakérelmezés működik; böngésző (Dev, ecf31039): kérelem létrejött → „Jóváhagyásra vár” jelvény + „Kivezetés jóváhagyása” dialógus (nem jogosult „Csak megtekintés” nézet, piros hiba: „bruttó értéke nincs a főkönyvben”, „Jegyzőkönyv PDF” gomb látható) – képernyőképpel igazolva. A PDF böngészős letöltése és a tényleges jóváhagyás/elutasítás gombnyomás böngészőben NEM volt kipróbálva (PDF: Vitest; jóváhagyás: Dev DB DO-blokk teszt).
  * Nyitott: TAO adóalap kivezetési korrekció (spec 1.5 utolsó pont) az éves zárásba még nincs bekötve; leltárhiánynál a felelős dolgozó szabad szöveges név (nincs dolgozó-választó).

#### Micro-Module 1.5: Fejlesztési Tartalék Késedelmi Pótlék & Tao 22/A. § Kedvezmény (Méret: M)
* **Érintett fájlok:**
  * `src/lib/fixed-assets/developmentReservePenaltyCalculator.ts`
  * `src/components/fixed-assets/DevelopmentReservesTab.tsx`
  * `src/test/fixed-assets/developmentReservePenalty.test.ts`
* **Feladat:**
  * 3. és 4. adóévben lejáró fel nem használt fejlesztési tartalékok automatikus azonosítása.
  * Visszafizetendő társasági adó és késedelmi pótlék kalkulátor (jegybanki alapkamat + 5 pont a Tao tv. 7. § (15) szerint).
  * Kisvállalkozói beruházási hitelkamat kedvezmény (Tao tv. 22/A. §) és elidegenítési tilalom (4-5 év) ellenőrzése kivezetéskor.
* **Verifikáció:** Vitest matematikai teszt törvényi példákkal + UI alert megjelenésének ellenőrzése.
* **Státusz: ✅ KÉSZ (Dev DB, 2026-10-13)** - M1.5 (részben, lásd eltérések).
  * Fájlok: `developmentReservePenaltyCalculator.ts` (`assessReserveExpiry`, `estimateUnusedReservePenalty`, `checkAlienationRestriction`, `getReserveDeadline`), `DevelopmentReservesTab.tsx` (riasztássáv `#dev-reserve-expiry-alerts`, tartalékonként `#dev-reserve-alert-<év>`), `DevelopmentReserveAlienationAlert.tsx` (`#disposal-reserve-alienation-alert`, bekötve a `DisposalDialog` és `DisposalApprovalDialog` dialógusokba).
  * Verifikáció: 17 Vitest teszt (`developmentReservePenalty.test.ts`; pl. 10 M Ft fel nem használt, 2027-08-31: adó 900 000, 92 nap, 11,5% → pótlék 26 088); `tsc` + `oxlint` tiszta; böngésző (Dev, ecf31039, ideiglenes teszttartalékokkal, utána törölve): a 2021-es tartalék „lejárt, fel nem használt rész” riasztás (adóalap-növelés 2 000 000, társasági adó 180 000, késedelmi pótlék 7 656 Ft [135 nap, 11,5%], összesen 187 656 Ft), a 2022-es „a felhasználás utolsó adóéve (79 nap van hátra)” – képernyőképpel igazolva.
  * Eltérések / nyitott: a jogszabályi paraméterek (9% Tao, MNB alapkamat alapértelmezés 6,5% + 5 pont, 4 éves felhasználási határidő, 5 éves elidegenítési tilalom) **feltevések, konfigurálhatók, jogi felülvizsgálat szükséges** – „tájékoztató becslés”; a Tao tv. 22/A. § kisvállalkozói beruházási hitelkamat-kedvezmény **nincs implementálva** (csak a tartalék-pótlék és az elidegenítési tilalom ellenőrzés); az i18n kulcsok `defaultValue`-val, hu/hr locale JSON bejegyzések nélkül.

---

### 📦 PHASE 2: Szervezeti Mozgások, Felelősök, Leltár & Öregedés
> **Fókusz:** Hierarchikus tárolóhelyek, felelős dolgozók, kétnyelvű átadási nyilatkozat, Code128 vonalkód, mobilbarát leltár, öregedési piramis.

#### Micro-Module 2.1: Hierarchikus Tárolóhelyek és Felelős Dolgozók Sémája (Méret: S)
* **Érintett fájlok:**
  * `supabase/migrations/20261013140000_sub_locations_and_custodians.sql`
  * `src/types/fixed-assets.ts`
  * `src/integrations/supabase/types.ts`
  * `src/hooks/useCompanySubLocations.ts`
  * `src/test/fixed-assets/subLocationsAndCustodians.test.ts`
* **Feladat:**
  * `company_sub_locations` tábla létrehozása RLS házirendekkel (`company_id`, `location_id`, `parent_id`, `name`, `code`), cross-tenant guard és ön-hivatkozás kivédés.
  * `fixed_assets.custodian_id` (`accounty_employees`), `cost_center_id` és `sub_location_id` bekötése.
* **Verifikáció:** SQL sémaellenőrzés és kapcsolatok validációja.
* **Státusz: ✅ KÉSZ (Dev DB, 2026-10-13)**
  * Migráció alkalmazva a Dev adatbázisban (`20261013140000`), a triggerek és RLS házirendek aktívak.
  * Típusok és `useCompanySubLocations` hook faépítő segédfüggvénnyel (`buildSubLocationTree`) megírva.
  * Vitest tesztek: 4/4 zöld (`subLocationsAndCustodians.test.ts`).

#### Micro-Module 2.2: Bővített Áthelyezési Modál és Kétnyelvű Átadási PDF (Méret: M)
* **Érintett fájlok:**
  * `src/components/fixed-assets/TransferDialog.tsx`
  * `src/lib/fixed-assets/assetHandoverProtocolPdf.ts`
  * `src/components/fixed-assets/AssetDetailPanel.tsx`
  * `src/hooks/useFixedAssets.ts`
  * `src/test/fixed-assets/assetHandoverProtocol.test.ts`
* **Feladat:**
  * Felelős dolgozó és hierarchikus tárolóhely választó beépítése a `TransferDialog`-ba.
  * Kétnyelvű (magyar-angol) Átadás-Átvételi és Felelősőrzési Nyilatkozat PDF generálása a felelősök aláírásához (Mt. 179. § záradékkal).
  * `asset_events` bővítése felelősváltási és tárolóhely-váltási adatokkal, és PDF letöltési lehetőség a Timeline-ról.
* **Verifikáció:** Kétnyelvű PDF generálás ellenőrzése és eseménynapló audit.
* **Státusz: ✅ KÉSZ (Dev DB, 2026-10-13)**
  * `useTransferAsset` hook bővítve (`sub_location`, `custodian`, `cost_center`, `location`, `project` dimenziók).
  * `assetHandoverProtocolPdf.ts` tiszta TypeScript jsPDF motor HU/EN kétnyelvű bizonylattal és aláíró blokkal.
  * Vitest tesztek: 3/3 zöld (`assetHandoverProtocol.test.ts`).

#### Micro-Module 2.3: Hibrid QR és Code128 Vonalkód Címkenyomtató (Méret: S)
* **Érintett fájlok:**
  * `src/components/fixed-assets/QrLabelDialog.tsx`
  * `src/lib/fixed-assets/barcodeGenerator.ts`
  * `src/test/fixed-assets/barcodeGenerator.test.ts`
* **Feladat:**
  * Code128 lineáris vonalkód modul és SVG generátor készítése külső csomag nélkül.
  * Matrica formátumválasztó (50×30 mm hordozható címkenyomtató, 70×36 mm irodai etikett, A4 24-es íves lap).
  * Hibrid kódmegjelenítés (QR és Code128 egyszerre, vagy külön-külön), telephely, tárolóhely és felelős adatokkal.
* **Verifikáció:** Nyomtatási előnézet, SVG letöltés és vonalkód kódolás ellenőrzése.
* **Státusz: ✅ KÉSZ (Dev DB, 2026-10-13)**
  * `barcodeGenerator.ts` ISO/IEC 15417 Code 128B szimbólumgeneráló motor elkészült.
  * `QrLabelDialog.tsx` bővítve méretválasztóval, testreszabási kapcsolókkal és nyomtatási CSS-sel.
  * Vitest tesztek: 4/4 zöld (`barcodeGenerator.test.ts`).

#### Micro-Module 2.4: Mobilbarát Leltározó és Fordulónapi Leltárív (Méret: M)
* **Érintett fájlok:**
  * `src/components/fixed-assets/InventoryCheckDialog.tsx`
  * `src/lib/fixed-assets/inventoryReportExport.ts`
  * `src/test/fixed-assets/inventoryReportExport.test.ts`
  * `src/test/fixed-assets/InventoryCheckDialog.test.tsx`
* **Feladat:**
  * Mobilbarát szkenneres leltározó nézet gyors leltári szám beolvasással, állapotrögzítéssel (épp, sérült, selejtezendő) és helyszíni tárolóhely/felelős korrekcióval.
  * Számviteli törvény (Sztv. 69. §) szerinti fordulónapi analitikus leltárív export Excel (.xlsx - ExcelJS) és PDF (jsPDF landscape) formátumban, összesítő sorral és 3 fős leltározó bizottsági aláírási szekcióval.
* **Verifikáció:** Leltározási folyamat, eseményrögzítés (`asset_events`), Excel és PDF generálás tesztelése.
* **Státusz: ✅ KÉSZ (Dev DB, 2026-10-13)**
  * `inventoryReportExport.ts` elkészült formázott munkafüzettel és PDF bizonylattal.
  * `InventoryCheckDialog.tsx` 3 füllel (Gyors Scanner, Leltárlista, Zárás & Export) felépítve.
  * Vitest tesztek: 5/5 zöld (`inventoryReportExport.test.ts` + `InventoryCheckDialog.test.tsx`).

#### Micro-Module 2.5: Vezetői Vagyonkimutatás, Öregedési Piramis & Többéves Mozgástábla (Méret: M)
* **Érintett fájlok:**
  * `src/components/fixed-assets/AssetAgingPyramidChart.tsx`
  * `src/components/fixed-assets/MultiYearMovementTable.tsx`
  * `src/components/fixed-assets/AssetAnalyticsDashboard.tsx`
  * `src/components/fixed-assets/AssetDetailPanel.tsx`
  * `src/pages/FixedAssetsPage.tsx`
  * `src/test/fixed-assets/assetAgingAndMovement.test.tsx`
* **Feladat:**
  * Cégvezetői öregedési piramis (0–1 év, 1–3 év, 3–5 év, 5+ év) vizualizáció `recharts` vízszintes sávdiagrammal és kosarankénti részletezőkkel.
  * Többéves párhuzamos összehasonlító táblázat: Bruttó nyitó, beruházások (+), kivezetések (-), záró bruttó, tárgyévi Sztv. vs. Tao ÉCS, Tao különbözet és könyv szerinti nettó érték.
  * Beépítés a `FixedAssetsPage.tsx` 4. fülébe („Vagyonkimutatás & Elemzés”) és az `AssetDetailPanel.tsx` kartonra.
* **Verifikáció:** Oxlint + típusellenőrzés + Vitest tesztek.
* **Státusz: ✅ KÉSZ (Dev DB, 2026-10-13)**
  * `AssetAgingPyramidChart.tsx` és `MultiYearMovementTable.tsx` tiszta reaktív komponensek elkészültek.
  * `AssetAnalyticsDashboard.tsx` összevont vezetői KPI felülettel integrálva a TENY fejlécbe és a kartonra.
  * Vitest tesztek: 3/3 zöld (`assetAgingAndMovement.test.tsx`). Teljes TÉNY tesztcsomag: 16 fájl, 129/129 passed.

---

### 🏛️ PHASE 3: Pályázatok, Komponensek és Passzív Időbeli Elhatárolások
> **Fókusz:** Támogatási projektlap, többforrásos komponens-karton, ÉCS-arányos PIE feloldás (483 → 964), négyoldalú rekonciliáció.

#### Micro-Module 3.1: Pályázati Projektek és Komponens Táblák Sémája (Méret: S)
* **Érintett fájlok:**
  * `supabase/migrations/20261013150000_grant_projects_and_components.sql`
  * `src/types/fixed-assets.ts`
  * `src/hooks/useGrantProjects.ts`
  * `src/hooks/useAssetComponents.ts`
  * `src/test/fixed-assets/grantProjectsAndComponents.test.ts`
* **Feladat:**
  * `grant_projects` tábla (elszámolható összeg, támogatási összeg, intenzitás %, fenntartási időszak, RLS).
  * `fixed_asset_components` tábla (forráskomponensek, támogatási arány, saját erő, egyedi aktiválási nap, RLS).
* **Verifikáció:** Táblák, RLS szabályok és indexek ellenőrzése Dev DB-ben.
* **Státusz: ✅ KÉSZ (Dev DB, 2026-10-13)**
  * Migráció alkalmazva a Dev adatbázisban (`20261013150000`), a triggerek és RLS házirendek aktívak.
  * Típusok és TanStack Query hookok (`useGrantProjects`, `useAssetComponents`) elkészültek.
  * Vitest tesztek: 4/4 zöld (`grantProjectsAndComponents.test.ts`).

#### Micro-Module 3.2: Komponens-szintű ÉCS és Forráskalkuláció (Méret: M)
* **Érintett fájlok:**
  * `src/lib/fixed-assets/assetComponentCalculator.ts`
  * `src/components/fixed-assets/AssetComponentsView.tsx`
  * `src/components/fixed-assets/AssetDetailPanel.tsx`
  * `src/test/fixed-assets/assetComponentCalculator.test.ts`
  * `src/test/fixed-assets/AssetComponentsView.test.tsx`
* **Feladat:**
  * Komponens-szintű ÉCS és finanszírozási forráskalkulációs motor elkészítése (eltérő aktiválás, ráaktiválás, támogatás vs. önerő).
  * Az eszközkartonon új "Komponens-elvű Eszközkarton" lapfül/szekció megjelenítése és kezelése.
* **Verifikáció:** Többkomponensű teszteszköz kalkulációjának matematikai ellenőrzése és UI tesztelése.
* **Státusz: ✅ KÉSZ (Dev DB, 2026-10-13)**
  * `assetComponentCalculator.ts` elszámolási motor elkészült.
  * `AssetComponentsView.tsx` és `AssetDetailPanel.tsx` integráció aktív, modál és forrásarány sáv működik.
  * Vitest tesztek: 6/6 zöld (`assetComponentCalculator.test.ts` + `AssetComponentsView.test.tsx`).

#### Micro-Module 3.3: ÉCS-arányos Támogatási PIE Feloldó Motor (Méret: M)
* **Érintett fájlok:**
  * `supabase/migrations/20261013160000_post_grant_deferral_release_rpc.sql`
  * `src/lib/fixed-assets/grantDeferralPostingService.ts`
  * `src/test/fixed-assets/grantDeferralPosting.test.ts`
* **Feladat:**
  * Időszaki ÉCS záráskor a támogatott eszközöknél automatikus passzív időbeli elhatárolás feloldás könyvelése: **T 483 → K 964**.
  * Matematikai formula érvényesítése a támogatási intenzitás arányában (Sztv. 45. § (2)).
* **Verifikáció:** Vegyes napló könyvelési teszt és forint-arányosság matematikai tesztelése.
* **Státusz: ✅ KÉSZ (Dev DB, 2026-10-13)**
  * Migráció alkalmazva a Dev DB-ben (`20261013160000_post_grant_deferral_release_rpc.sql`), `post_grant_deferral_release_to_gl` RPC aktív.
  * `grantDeferralPostingService.ts` szerviz és számlakereső elkészült.
  * Vitest tesztek: 5/5 zöld (`grantDeferralPosting.test.ts`).

#### Micro-Module 3.4: Digitális Támogatási Projektlap és Négyoldalú Rekonciliáció (Méret: L)
* **Érintett fájlok:**
  * `src/lib/fixed-assets/grantReconciliationService.ts`
  * `src/components/fixed-assets/GrantProjectsTab.tsx`
  * `src/pages/FixedAssetsPage.tsx`
  * `src/test/fixed-assets/grantReconciliationService.test.ts`
  * `src/test/fixed-assets/GrantProjectsTab.test.tsx`
* **Feladat:**
  * Új felső fül a TENY-ben: `Pályázatok & Támogatások`.
  * Mérföldkövek, kapott előleg, kifizetések, kapcsolt eszközök és fenntartási időszak monitoring.
  * Négyoldalú egyeztetés: **Pályázat ↔ TENY Analitika ↔ Főkönyv (161, 1x, 483, 964) ↔ Elhatárolások**.
* **Verifikáció:** Teljes smoke test és négyoldalú egyeztetési riasztás vizsgálata.
* **Státusz: ✅ KÉSZ (Dev DB, 2026-10-13)**
  * `grantReconciliationService.ts` 4 pillér algoritmus (Keret ↔ Analitika ↔ Főkönyv ↔ Elhatárolás) és riasztási logika elkészült.
  * `GrantProjectsTab.tsx` beépítve a `FixedAssetsPage.tsx` 5. fülébe, egykattintásos PIE feloldási és rekonciliációs widgettel.
  * Vitest tesztek: 7/7 zöld (`grantReconciliationService.test.ts` + `GrantProjectsTab.test.tsx`).
  * Teljes TÉNY tesztcsomag: **22 fájl, 151/151 passed, 0 failed**. Typecheck: **0 error**.

---

## 🔬 FÁZIS 3: Maker–Checker Minőségbiztosítási Protokoll

Minden micro-modul kizárólag a **Maker–Checker** kapun keresztül tekinthető késznek:

1. **Maker Subagent:**
   * Kódolás szigorúan a megadott fájlokra fókuszálva.
   * Betölti és betartja a `vercel-react-best-practices` és `vercel-composition-patterns` szabályokat (anti-boolean flags, render-optimalizáció).
   * Leminősítés: `npx oxlint` + `npx tsc --project tsconfig.app.json --noEmit`.
2. **Checker Subagent (Független Verifier):**
   * Nem fogadja el a szóbeli állítást.
   * Adatbázisnál: `execute_sql` lekérdezéssel ellenőrzi a sémát és az RLS-t.
   * Szerviznél/RPC-nél: Automatizált Vitest tesztet futtat.
   * UI komponensnél: Browser Subagenttel ellenőrzi a képernyőt (`http://localhost:5173`), ellenőrzi a 0 db konzolhibát és a reaktív állapotokat.

---

## 📋 Jóváhagyási Kapu a Felhasználó Felé

A fenti implementációs terv alapján a fejlesztést a legmagasabb prioritású **Phase 1-gyel (Főkönyvi Integritás, Kivezetési Motor & Tartalék Monitoring)** javasolt kezdeni.

Kérlek, jelezz vissza az alábbi pontokra:
1. Jóváhagyod-e a Döntési Mátrixban (D-1 – D-11) felvázolt technikai irányokat?
2. Indíthatjuk-e az implementációt a **Phase 1 (Micro-Module 1.1: Adatbázis Kapcsolatok és Indexek)** lépéssel az `eaisybill-dev` környezetben?
