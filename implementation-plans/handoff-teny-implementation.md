# HANDOFF – TENY (Tárgyi Eszköz Nyilvántartó) fejlesztés

**Dátum:** 2026-10-13 · **Ág:** `develop` · **Környezet:** `eaisybill-dev`, Dev Supabase `qhvcdqkqpgpdxogqqvyr` (MCP: `supabase-visibill-dev`) · **Commit:** még NINCS (minden módosítás working tree-ben)
**Következő session célja:** A TÉNY modulcsoport (Phase 1, 2, 3) élesítése Prod környezetben (divergencia audit, szelektív hotfix vs. teljes merge döntés, távoli DB migrációk szinkronja), vagy a fejlesztés lezárása.

## 1. Dokumentumok (ezek a forrásigazság – ne duplikáld)
| Dok | Szerep |
|---|---|
| [TENY_fejlesztes.md](./TENY_fejlesztes.md) | Eredeti specifikáció (spec 1.5 = kivezetés, 1.6 = komponensek, 1.7 = támogatások) |
| [TENY_gap_elemzes.md](./TENY_gap_elemzes.md) | Spec vs. megvalósítás gap-elemzés |
| [TENY_implementacios_terv.md](./TENY_implementacios_terv.md) | **Implementációs terv**: Mind a 12 micro-modul (M1.1–M3.4) és döntési mátrix (D-1…D-11) státusza, tesztbizonyítékai és migrációi |
| [A-251 ADR](../docs/architecture/decisions/A-251-fixed-assets-gl-linkage-reconciliation-and-disposal-workflow.md) | Phase 1 technikai döntések |
| [A-252 ADR](../docs/architecture/decisions/A-252-fixed-assets-phase2-and-phase3-inventory-grants-components-pie.md) | Phase 2 és Phase 3 technikai döntések |
| [P-185 PRD](../docs/product/decisions/P-185-fixed-assets-reconciliation-disposal-approval-and-reserve-alerts-ux.md) | Phase 1 UX döntések |
| [P-186 PRD](../docs/product/decisions/P-186-fixed-assets-phase2-and-phase3-ux.md) | Phase 2 és Phase 3 UX döntések |
| [18-teny.md](../docs/knowledge-base/eaisybill/18-teny.md), [10-assets.md](../docs/architecture/database/10-assets.md) | Felhasználói tudásbázis, DB séma (frissítve az összes új táblával) |

## 2. Hol tartunk
**Phase 1 (M1.1–M1.5), Phase 2 (M2.1–M2.5) ÉS Phase 3 (M3.1–M3.4) TELJES EGÉSZÉBEN KÉSZ és Dev-en ellenőrzött (12/12 micro-modul).**
Következő lépés: **Prod-ra élesítés (Release)**.

### Elkészült Phase 2 modulok (M2.1–M2.5)
- **M2.1 DB & Hook:** `20261013140000_sub_locations_and_custodians.sql` migráció a Dev DB-ben (`qhvcdqkqpgpdxogqqvyr`), `company_sub_locations` RLS-sel és triggerekkel, `useCompanySubLocations.ts` faépítővel.
- **M2.2 Áthelyezés & Kétnyelvű Nyilatkozat:** `TransferDialog.tsx` tárolóhely/felelős/költséghely választóval, `assetHandoverProtocolPdf.ts` (HU/EN kétnyelvű Mt. 179. § záradékolt PDF), letöltési lehetőség a karton Timeline-ról.
- **M2.3 Hibrid Címkenyomtatás:** `barcodeGenerator.ts` (Code 128B tiszta TS SVG motor), `QrLabelDialog.tsx` (50×30 mm, 70×36 mm, A4 íves címkenyomtatás és SVG letöltés).
- **M2.4 Mobilbarát Leltározó & Fordulónapi Leltárív:** `InventoryCheckDialog.tsx` (optikai scanner, fizikai állapot: épp/sérült/selejt, azonnali korrekció), `inventoryReportExport.ts` (Sztv. 69. § szerinti fordulónapi analitikus leltárív Excel és tájolásos PDF export 3 fős bizottsági aláíróval).
- **M2.5 Vezetői Vagyonkimutatás & Mozgástábla:** `AssetAgingPyramidChart.tsx` (recharts öregedési piramis), `MultiYearMovementTable.tsx` (egyedi és cég szintű többéves Sztv. vs. Tao ÉCS összehasonlító tábla), `AssetAnalyticsDashboard.tsx` beépítve a `FixedAssetsPage.tsx` 4. fülébe és az `AssetDetailPanel.tsx` kartonra.

### Elkészült Phase 3 modulok (M3.1–M3.4)
- **M3.1 DB & Hook:** `20261013150000_grant_projects_and_components.sql` migráció a Dev DB-ben (`qhvcdqkqpgpdxogqqvyr`), `grant_projects`, `fixed_asset_components`, RLS és cégőr triggerek, `useGrantProjects.ts`, `useAssetComponents.ts`.
- **M3.2 Komponens ÉCS és Forráskalkuláció:** `assetComponentCalculator.ts` motor, `AssetComponentsView.tsx` interaktív finanszírozási forrásarány-sávval és komponens-táblázattal beépítve az `AssetDetailPanel.tsx` kartonra.
- **M3.3 ÉCS-arányos PIE Feloldás Könyvelés:** `20261013160000_post_grant_deferral_release_rpc.sql` (`post_grant_deferral_release_to_gl` RPC), `grantDeferralPostingService.ts` a **T 483 → K 964** automatikus könyveléséhez.
- **M3.4 Digitális Támogatási Projektlap & Négyoldalú Rekonciliáció:** `grantReconciliationService.ts` 4 pillér algoritmus (Pályázati keret ↔ TÉNY analitika ↔ Főkönyv 483/964 ↔ Elhatárolások) és fenntartási időszak monitoring, `GrantProjectsTab.tsx` beépítve a `FixedAssetsPage.tsx` 5. fülébe.
- **Verifikáció:** `src/test/fixed-assets/*`: **22 fájl, 151 passed, 0 failed**. `npx tsc --project tsconfig.app.json --noEmit`: **0 error (exit code 0)**. `oxlint`: **0 hiba**.

Megjegyzés: a migrációs fájlnevek a tervben tájékoztatóak; mindig legyenek egyediek és **későbbiek, mint `20261013000000`**.

## 5. Élesítés (Prod) – még NEM történt
Prod/`main` érintetlen. Élesítés előtt kötelező: divergencia-audit (`git log main..develop`), `ask_question` a teljes merge vs. szelektív hotfix kérdésről, a migrációk és RPC-k Prod DB szinkronja, és a Dev élő definícióból másolt függvénytestek összevetése a Prod definíciókkal.

## 6. Munkakörnyezeti tudnivalók (hogy ne kelljen újra felfedezni)
- **Dirty working tree:** sok, a TENY-hez NEM tartozó módosítás van (pl. `.agents/rules/verification.md`, `package.json`, VAT fájlok, JournalsPage, PayrollReconciliationPage, Partner360DossierTab, useCompanySettings, useGlViewTemplates, agoraPnlPdf, glExport…). **Ne nyúlj hozzájuk és ne commitold őket.** A TENY-hez tartozók listája: `git status --short | Select-String "fixed|asset|disposal|Reserve|migrations/2026101"`. Érintett meglévő fájl még: `useFixedAssets.ts`, `types.ts` (csak sebészi kiegészítés!), `fixed-assets.ts`, `assetActivationAutoPoster.ts`, `developmentReserveAutoPoster.ts` (RPC paraméternév javítás), `FixedAssetsPage.tsx`, `AssetDetailPanel.tsx`.
- **DB munka:** `apply_migration` saját időbélyeget generál → utána `UPDATE supabase_migrations.schema_migrations SET version='<fájlnév ts>' WHERE …`. Új táblához: RLS, FK indexek, SECURITY DEFINER + `search_path`, REVOKE anon, `NOTIFY pgrst,'reload schema'`. `types.ts`-t NE regeneráld, kézzel/szkripttel egészítsd ki. RPC-hez kötelező Vitest szerződésteszt (a kliens `rpc('name', {` hívás egysoros, `p_*:` kulcsok külön sorban) + rollbackelt DO-blokk DB-teszt (`set_config('request.jwt.claims',…)` + `SET LOCAL ROLE authenticated`, eredmény `RAISE EXCEPTION 'TESTRESULT: %'`).
- **Eszközök:** `grep_search` megbízhatatlan → `Get-ChildItem -Recurse | Select-String`. PowerShell: `;` nem `&&`. Több fájl CRLF – `replace_file_content` működik, a sorvéget tartsd meg, UTF-8 BOM nélkül. Temp szkriptek csak `scratch/`-be (gitignored).
- **oxlint:** `react(set-state-in-effect)` / `react(purity)` → state levezetés renderben / lazy `useState` inicializáló a `new Date()`-hez.
- **UI szabályok:** `.agents/rules/ui-ux.md` – 4 állapot (skeleton csak első betöltésnél, üres állapot ikon+szöveg+CTA, hiba Retry-jal, adat), double-submit védelem, AlertDialog destruktív műveletnél, `formatCurrency`/`formatDateLocale` (`@/lib/locale/formatters`), nincs `transition-all`, perzisztens DOM a füleknél, egyedi elem-id-k.
- **Browser subagent megbízhatatlan:** gyakran „Step is still running”-et ad vissza riport nélkül. **Csak a „Completed At” + valódi riport/screenshot számít bizonyítéknak** (a screenshotot `view_file`-lal nézd meg). Mindig kösd ki, hogy ne kattintson kényes gombokra (pl. „Hiányzó tételek pótlása”, „Könyvelés indítása”, végleges Jóváhagyás). Belépéshez lásd a `visibill-browser-testing` skillt (a teszt-felhasználó adatait ott találod; itt nem szerepelnek).
- **Dev fixture-ök:** teszt cég `ecf31039-b539-4e04-bbea-70ea48c701bb` (7 eszköz, URL: `http://localhost:8080/<companyId>/2026-01-01_2026-12-31/teny`); cég `377d28cb-edc9-48a7-b261-bcd9c91d81a1` (28 eszköz, könyvelővel). Az előző teszt-adatokat (pending kivezetés, 2 `TESZT M1.5…` tartalék) kitakarítottam. Dev szerver: `npm run dev` → localhost:8080.

## 7. Kötelező szabályok (AGENTS.md kivonat)
Zero Silent Decisions (architekturális/DB döntés előtt opciók a felhasználónak, `ask_question`), Evidence Before Assertions (`npx oxlint <fájl>`, `npx tsc --project tsconfig.app.json --noEmit` – paraméter nélküli `tsc --noEmit` TILOS –, `npm test`; RPC/Edge-hez teszt kötelező), csak Dev DB, `main`/Prod művelet előtt megállni és figyelmeztetni, válasz magyarul, Unicode szimbólumok (→ ≈ ≤), nincs LaTeX. ÁFA-logika érintésekor VAT Safety Gate (`vatRegressionTaxology.test.ts` + `npm run vat:guard`) – a TENY eddig nem érintette.

## 8. Javasolt skillek a következő sessionhöz
- `visibill-spec-lookup` + `visibill-drift-check` → Phase 2/3 specifikáció és kód-drift ellenőrzés indulás előtt
- `visibill-feature-planner` → csak ha a scope változik (a terv már megvan)
- `visibill-db-checklist`, `supabase`, `supabase-postgres-best-practices` → M2.1, M3.1 migrációk
- `visibill-dev`, `vercel-react-best-practices`, `vercel-composition-patterns`, `ui-ux-pro-max` → UI modulok
- `test-driven-development`, `verification-before-completion` → minden modul zárása
- `visibill-browser-testing` → UI ellenőrzés
- `visibill-migration-sync` → git push / Prod előtt
- `/morfi-implementation-review` → **ajánlott** mélyaudit Phase 1-en (5+ fájl, DB-séma, pénzügyi logika), mielőtt Phase 2 indul vagy Prod-ra megy
- `visibill-doc-sync` → modulcsoportok végén (A-/P- számozás: következő szabad **A-252**, **P-186** – az index.md-t ellenőrizd!); `graphify update .` mindig a legutolsó lépés, a docs-írás UTÁN

## 9. Javasolt első lépések a release-hez
1. `git status` ellenőrzése és felülvizsgálata (dirty tree izoláció megtartása).
2. Verifikáció ismétlése (`npx vitest run src/test/fixed-assets/` -> 22/22 fájl, 151 teszt; `npx tsc --project tsconfig.app.json --noEmit` -> 0 error).
3. Divergencia-audit (`git log main..develop`) és döntés kérése a felhasználótól (`ask_question`: Teljes merge vs. szelektív cherry-pick hotfix ág).
4. Jóváhagyás után a Dev DB migrációk és RPC-k (`20261012231000`, `20261012231100`, `20261012232300`, `20261013000000`, `20261013140000`, `20261013150000`, `20261013160000`) szinkronizálása a Prod DB-vel.
