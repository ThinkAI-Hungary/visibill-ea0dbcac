# A-109: Eaisybill Horvát Lokalizáció, /hr/ Scoped Route Architektúra és Helyi Tároló Mentes Nyelvkezelés

**Status:** Decided  
**Date:** 2026-09-11  
**Utoljára frissítve:** 2026-09-16  

---

## Context
A cég nemzetközi terjeszkedésének első lépéseként felmerült az igény az **Eaisybill modul teljes frontend lokalizációjára horvát nyelvre (`hr`)**, kifejezetten értékesítési és ügyfél-demonstrációs célokra.

A fejlesztés során három kritikus architekturális kihívás jelentkezett:
1. **Navigáció és Route Izoláció:** A meglévő URL struktúra mélyen beágyazott scoped routingot használ (`/:companyId/:dateRange/<page>/:tab?`). A horvát demonstrációnak tisztán, determinisztikusan egy `/hr/` prefixszel kell futnia mind a publikus autentikációs felületen (`/hr/auth`), mind a bejelentkezett nézetekben (`/hr/:companyId/:dateRange/...`).
2. **Nyelvi Perzisztencia Beragadási Csapda (LocalStorage Trap):** A standard `i18next-browser-languagedetector` alapértelmezésben a böngésző `localStorage`-ába mentette a választott nyelvet (`visibill_lang: 'hr'`). Ennek következtében ha a felhasználó egyszer meglátogatta a `/hr/auth` oldalt, majd a böngésző címsorából kitörölte a `/hr`-t és visszalépett a normál `/auth` vagy `/` címre, a rendszer továbbra is a `localStorage`-ból olvasta a horvát nyelvet, beragadva a horvát felületre.
3. **Pénznem és Numerikus Adatok Lokalizációja:** Horvát nyelvű környezetben az elvárás az Euró (€) alapú megjelenítés, a magyar forint (Ft) helyett, miközben az aggregált adatoknak (pl. ÁFA kimutatás, KPI kártyák) matematikai és devizaváltási szempontból precíznek kell maradniuk.

---

## Decision

### 1. i18next & react-i18next Keretrendszer Névterekkel (Namespaces)
A lokalizációt az `i18next` és a `react-i18next` segítségével valósítottuk meg. A szótárakat moduláris, per-funkció JSON állományokra bontottuk szét (`src/locales/hu/*.json` és `src/locales/hr/*.json`), lefedve a rendszer mind a 19 névtérét:
- `accounting`, `auth`, `categories`, `common`, `dashboard`, `exchangeRates`, `hr`, `invoices`, `navigation`, `notes`, `partners`, `pettyCash`, `projects`, `receivables`, `settings`, `tickets`, `transactions`, `transfers`, `upload`.
- TypeScript típusdefinícióval (`src/types/i18next.d.ts`) biztosítottuk a típusbiztos fordítási kulcsokat és az automatikus kiegészítést.

### 2. Tiszta Útvonal-Vezérelt Nyelvmeghatározás (Zero LocalStorage Persistence)
A nyelvi állapotot 100%-ban az URL útvonala határozza meg, kizárva a böngésző tárhelyének perzisztenciáját:
- **`src/lib/i18n.ts`:**
  - Egyedi `pathDetector` implementálva: ha a `window.location.pathname` kezdete `/hr` vagy `/hr/`, a nyelv `'hr'`, minden más esetben azonnal visszavált `'hu'`-ra.
  - A `cacheUserLanguage()` függvény no-op lett (nem ír a `localStorage`-ba).
  - A detektor konfigurációjából töröltük a `localStorage` cache-t (`caches: []`).
  - Inicializáláskor automatikusan meghívódik a `localStorage.removeItem('visibill_lang')`, hogy a korábban beragadt kulcsok se okozzanak anomáliát.
- **`LanguageRouteSync` Router Integráció (`src/App.tsx`):**
  - A `<BrowserRouter>` gyökerébe beépítettünk egy reaktív komponenst, amely a `useLocation()` hook segítségével kliensoldali route-váltáskor azonnal meghívja az `i18n.changeLanguage('hr')` vagy `i18n.changeLanguage('hu')` függvényt.

### 3. Route Wrapperek és Redirect Stratégia
- **Auth útvonalak (`src/routes/authRoutes.tsx`):**
  - Létrehoztuk a `/hr/auth` és `/hr/auth/callback` útvonalakat `<LanguageRouteWrapper language="hr">` védőburok alatt.
  - A `ProtectedLayout` nem hitelesített felhasználó esetén a `/hr/...` prefix meglétekor automatikusan a `/hr/auth` oldalra irányít át.
- **Eaisybill Scoped útvonalak (`src/routes/eaisybillRoutes.tsx`):**
  - A meglévő scoped routing mellett regisztráltuk a `/hr/:companyId/:dateRange/*` útvonalakat is ugyanazon komponensekkel, biztosítva a teljes funkcionális paritást.
- **Redirect tisztítás (`src/routes/redirects.tsx`):**
  - A `RootRedirect` kódjából kikerült a korábbi nyelvi állapot alapú automatikus átirányítás, így a `/` mindig a standard gyökérre visz.

### 4. Pénznem és Dátumkezelés Adaptációja
- **`src/lib/utils.ts` (`formatCurrency`):**
  - Ha a pénznem nincs explicit megadva és az aktív nyelv `hr`, az automatikus fallback `EUR` és a horvát pénznemszimbólum (`€`), míg magyar nyelv esetén `HUF` (`Ft`).
- **`src/lib/locale/dateLocale.ts` (`getDateFnsLocale`):**
  - A dátumformázók dinamikusan váltanak a `date-fns/locale/hu` és `date-fns/locale/hr` között. Statikus locale importok helyett a központi `getDateFnsLocale()` segédfüggvény biztosítja a runtime nyelvi igazodást.
- **`src/lib/locale/formatters.ts` (`formatNumberLocale`):**
  - A számformázó univerzálisan kezeli a törttizedesek számát, valamint a teljes `Intl.NumberFormatOptions` opciókat, garantálva a horvát és magyar számformázási szabványok hibátlan betartását.
- **ÁFA Kimutatás (`VatSection.tsx`):**
  - Javításra került a devizaösszegek konverziója: a `navVatData` nyers objektumának átadása helyett a `vatBreakdown` tételeiből aggregált összegek kerülnek átváltásra, így elkerülhető a `NaN Ft` hiba, a fizetendő és visszaigényelhető ÁFA pedig dinamikusan jelenik meg.

### 5. Nyelvválasztó Kivezetése az Oldalsávról
- A felhasználói felület tisztasága érdekében a `LanguageSwitcher` komponenst kivezettük a sidebar-ból. A demó tisztán és kizárólag a `/hr/` route beírásával és linkelésével mutatható be.

### 6. Teljes Frontend Lokalizáció (Batches 1–7) & Automata Regressziós Tesztelés
A rendszer minden funkcionális modulját 7 különálló kötegben (Batch) lokalizáltuk:
- **Batch 1: Munkaidő Nyilvántartás (Working Time):** `EmployeeListPanel`, `MonthlyBalanceCard` és kapcsolódó munkanap/túlóra kalkulációs felületek.
- **Batch 2: Tárgyi Eszközök & Bérszámfejtés (Fixed Assets & Salaries):** `AssetDetailPanel`, `SalaryFilesTable`, bérjegyzék dokumentumtárak és leírásszámítások.
- **Batch 3: Házipénztár (Petty Cash):** `EntriesTab`, `ApprovalTab`, `PettyCashUnifiedTable`, pénztárbizonylat nyomtatási és jóváhagyási folyamatok.
- **Batch 4: Hibajegykezelés (Tickets):** `TicketDetailView`, `TicketResolutionBanner`, `TicketTimeline`, `TicketNotFoundView`, `ImageGalleryModal`.
- **Batch 5: Jegyzetek (Notes):** `NotesPage`, `NoteModal`, szűrési és kategória címkék.
- **Batch 6: Számlakezelés Kiterjesztett Panelei & Akciók:** `InvoiceBulkActionsBar`, folyamatos teljesítésű szerződések (`ContinuousServiceCardSection`), számlajegyzetek, összekapcsolt számlák, NAV és beküldött számla egyeztetési panelek, netting kompenzációk.
- **Batch 7: Futárriportok, Főkönyv, Átvezetések & Közös UI:** `CourierReportTab`, `ReportFilesDialog`, `MatchedCourierReportsCard`, `GeneralLedgerTable`, `GlAccountCardView`, `JournalsPage`, `TransfersPage`, Éves beszámoló 4–6. lépés (`Step4KiegMelleklet`, `Step5Osztalek`, `Step6Export`), lebegő csoportos műveleti sávok (`floating-bulk-bar`), másolható táblázatcellák és üres állapot komponensek.
- **Mérleg és Éves Beszámoló Alapjai:**
  - Mérleg-hinta widget, Egyezőségi Diagnosztika, Likviditási Mutatók, nézetvezérlő eszköztár, táblázatfejlécek és mapping fül.
  - Éves beszámoló varázsló 1–3. lépései (alapadatok, cégadatok, adatbefagyasztás és validáció).
- **Autentikáció & Útvonal Megőrzés (`resolveAuthTarget`, `Auth.tsx`, `AuthCallback.tsx`, `redirects.tsx`, `ProtectedLayout.tsx`):**
  - A `/hr/auth` bejelentkezés után a felhasználó megőrzi a `/hr` útvonalat a `resolveAuthTarget` segédfüggvényen keresztül mind az alapértelmezett, mind a scoped útvonalak esetén.
  - A Google OAuth visszatérési útvonala dinamikusan `/hr/auth/callback`-ra irányul horvát nyelv esetén.
- **Automatizált Kulcsparitás és Regresszióvédelem (`src/test/i18n.test.ts`):**
  - 25 önálló Vitest tesztcsomag fut le zölden: rekurzív `findMissingKeys` motor ellenőrzi a `hu` és `hr` szótárak közötti 100%-os mélységi egyezést mind a 19 névtérre.
  - Dedikált regressziós tesztek futnak az `accounting:balance_sheet`, `accounting:annual_report`, standard főkönyvi számlák kulcsparitására (`general_ledger.accounts`), `journalUtils`, `bsUtils`, `glUtils`, `pnlUtils`, `pettyCashUtils`, `transactionUtils` és `resolveAuthTarget` logikákra, meggátolva a fordítási kulcsok és útvonalak elcsúszását a jövőbeli fejlesztések során.

### 7. Standard Számlatükör és Főkönyvi Lokalizációs Motor (Chart of Accounts Localization Engine)
A pénzügyi kimutatásokban (Mérleg, Eredménykimutatás, Főkönyvi kivonat, Karton nézet, Könyvelési naplók) a magyar számviteli törvény szerinti számlatükör számlái és számlacsoportjai korábban csak 1 számjegyű osztályszinten (0–9) fordultak le. A 2, 3 és 4 számjegyű számlák (pl. `41.`, `42.`, `311. Belföldi vevők`) nyers magyar adatbázis magként jelentek meg.

Ennek feloldására egy többrétegű lokalizációs motort hoztunk létre:
1. **374 Standard Számlatétel Kétnyelvű Katalógusa (`src/locales/{hu,hr}/accounting.json`):**
   - Minden standard számlacsoport és alszámla felvételre került a `general_ledger.accounts.*` kulcsok alá (pl. `acc_311`, `acc_411`), horvát oldalon a hivatalos horvát standard számlatükör (HSFI / RRIF standard kontni plan) szerinti terminológiával.
   - 100%-os mélységi kulcsparitást garantál a tesztcsomag a két nyelv között.
2. **Normalizált Leképezési Szótár (`src/lib/glAccountDictionary.ts`):**
   - `HU_GL_NAME_TO_KEY`: ~370 magyar számlamegnevezést és számlaszámot indexel kulcsokhoz.
   - `normalizeGlAccountName` és `normalizeGlKey`: kezeli az ékezeteket, írásjeleket, pontokat, kettőspontokat és kis/nagybetűket, így a formázott vagy prefix nélküli adatbázis rekordokat is determinisztikusan azonosítja.
3. **Többszintű Feloldási Lánc (`src/lib/glUtils.ts` -> `getLocalizedGlAccountName`):**
   - 1. szint: 1 számjegyű főkönyvi osztályok (`accounting:general_ledger.classes.*`).
   - 2. szint: Számlaszám szerinti keresés (`accounting:general_ledger.accounts.acc_<szám>`).
   - 3. szint: Normalizált magyar név szerinti fallback feloldás (`HU_GL_NAME_TO_KEY`).
   - 4. szint: Biztonságos fallback az eredeti névre, ha egyedi számla vagy nem standard tételről van szó.
4. **Kétnyelvű Keresési Filter (`matchesGlSearch`):**
   - A `GlSearchAutocomplete.tsx` és `AddManualJournalEntryModal.tsx` komponensek egyszerre hasonlítják össze a felhasználó által beírt keresőszót az eredeti magyar és a feloldott horvát megnevezéssel, lehetővé téve a gyorskeresést bármelyik nyelven.
5. **Pénzügyi Exportok Szinkronizálása:**
   - A `bsExport.ts` (Mérleg) és `pnlExport.ts` (Eredménykimutatás) Excel fájlgenerálók integrálták a `getLocalizedGlAccountName` feloldót, így az exportált munkafüzetek is az aktív nyelvnek megfelelő sor- és számlamegnevezéseket tartalmazzák.

### 8. Bizonylatfeltöltési Duplikáció-védelem és Modál Stabilitás
- A számlafeltöltési folyamat duplikáció-figyelmeztető dialógusait (`DbDuplicateDialog.tsx`, `ListDuplicateDialog.tsx`) leválasztottuk a hardkódolt magyar szövegekről, és bekötöttük az `upload:dialogs.db_duplicate.*` és `upload:dialogs.list_duplicate.*` névterekbe.
- **Megjelenési Javítás:** A dialógus maximális szélességét (`max-w-xl`), a belső görgetést és a gombok elrendezését responzívvá tettük, megakadályozva a modál szétcsúszását kisebb vagy felbontás-váltott kijelzőkön.
- **Light Mode Kontraszt:** A másodlagos műveleti gombokhoz explicit kontrasztos háttér- és betűszínt (`bg-muted/80 text-foreground hover:bg-muted font-medium border border-border/60`) rendeltünk, biztosítva az olvashatóságot világos felületi témában is.

---

## Consequences

### Pozitív
- **Értékesítési Készség:** A teljes Eaisybill felület bemutatható horvát nyelven az ügyfeleknek a `/hr/` útvonalon, beleértve a szakmai számlatükröt és pénzügyi kimutatásokat is.
- **Szakmai Hitelesség:** A számlák nem félrefordított nyers kifejezésekkel, hanem a hivatalos horvát számviteli szabvány (HSFI / RRIF) terminus technicus-aival jelennek meg.
- **Kétnyelvű Rugalmasság:** A főkönyvi keresés és kontírozás magyar és horvát kulcsszavakkal is azonnal működik.
- **Nincs Beragadás:** Az URL-ből a `/hr` törlésével a felület determinisztikusan és azonnal visszavált a standard magyar működésre.
- **Típusbiztonság:** A fordítási kulcsok TypeScript definícióval támogatottak, elkerülve az elírásokat.
- **Nulla Adatbázis Változás:** A megoldás tiszta kliensoldali route-, i18n- és szótár-réteg, nem igényel backend migrációt vagy adatbázis sémamódosítást.

### Negatív / Kötöttségek
- Új UI elemek, oldalak vagy űrlapmezők fejlesztésekor kötelező a szövegeket a `src/locales/hu/*.json` és `src/locales/hr/*.json` szótárakba is felvenni.
- Egyedi céges számlatükör-bővítések esetén, ha nem standard számlaszámot használnak, a motor az eredeti elnevezést jeleníti meg fallbackként.

---

## Kapcsolódó
- [P-081: Eaisybill Horvát Lokalizáció és Demó UX](../../product/decisions/P-081-eaisybill-croatia-localization-and-demo-ux.md)
- [A-013: Scoped URL Routing](./A-013-scoped-routing.md)
- [A-060: Moduláris App Router Architektúra](./A-060-modular-app-router-and-bootstrap-shell.md)
- [Information Architecture](../../product/information-architecture.md)

