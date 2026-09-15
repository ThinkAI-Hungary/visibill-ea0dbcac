# P-081: Eaisybill Horvát Lokalizáció, /hr/ Route Prefix és Demó Navigáció UX

**Status:** Decided  
**Category:** UI / Localization / Navigation  
**Question:** Hogyan tegyük zökkenőmentesen demonstrálhatóvá az Eaisybill alkalmazást horvát partnerek számára anélkül, hogy a magyar felhasználók felületén zavaró nyelvválasztó jelenne meg, vagy a nyelvváltás véletlenszerűen beragadna a helyi tárolóban?  
**Decision:**
1. **Dedikált `/hr/` Route Prefix:**
   - A horvát felület elérése a `/hr/` prefixen keresztül történik mind a bejelentkezési oldalon (`/hr/auth`), mind a védett felületen (`/hr/:companyId/:dateRange/...`).
   - Ha egy partner vagy értékesítő a `/hr/auth` oldalon lép be, a sikeres autentikáció után automatikusan a horvát nyelvű védett kezdőlapra navigál.
2. **Nyelvválasztó Eltávolítása a Felületről:**
   - A fejlesztési és tesztelési fázisban a felhasználói felület (AppSidebar) nem tartalmaz látható nyelvváltó komponenst, így a normál magyar felhasználók nem találkoznak idegen nyelvű opcióval.
   - A demó prezentációja közvetlenül a dedikált URL hivatkozás átadásával / megnyitásával történik.
3. **Determinisztikus, LocalStorage-Mentes Nyelvszinkronizáció:**
   - A nyelv nem tárolódik a böngésző `localStorage`-ában. Ha a felhasználó a böngésző címsorából kitörli a `/hr/` szegmenst, az oldal azonnal és tisztán visszavált a magyar nyelvű felületre.
4. **Pénznem és Dátum Lokáció:**
   - Horvát felületen a KPI kártyák, táblázatok és diagramok automatikusan euróban (`€`), horvát számformátummal és horvát hónapnevekkel (`date-fns/locale/hr`) renderelődnek.

**Current Implementation:**
- A `src/App.tsx`-ben `<LanguageRouteSync />` figyeli az útvonal változásait és szinkronizálja az `i18n` állapotot.
- A `src/routes/authRoutes.tsx` a `/hr/auth` és `/hr/auth/callback` útvonalakat `<LanguageRouteWrapper language="hr">` burokban futtatja.
- Az `AppSidebar.tsx` minden csoportneve és menüpontja többnyelvű kulcsokból táplálkozik.
- A `VatSection.tsx` automatikusan számolja ki a fizetendő / visszaigényelhető ÁFA pozíciót és jeleníti meg a kiválasztott devizában.
- A **Mérleg (`/balance-sheet`) és Eredménykimutatás (`/profit-and-loss`)**:
  - A widgetek (Mérleg-hinta, Egyezőségi Diagnosztika, Likviditási Mutatók), nézetvezérlő sáv (Hivatalos nézet, Nullás sorok elrejtése, Hagyományos nézet, Deviza konszolidáció, Exportok), táblázatfejlécek és a Hozzárendelés (mapping) fül 100%-ban lokalizáltak (`accounting:balance_sheet.*`, `accounting:profit_and_loss.*`).
  - A sorok lenyitásakor megjelenő részletező számlák és számlacsoportok (pl. `41.`, `42.`, `311. Belföldi vevők`) a 374 tételes számlatükör-szótár alapján horvát számviteli terminológiával (HSFI / RRIF standard kontni plan) jelennek meg.
  - Az Excel exportok (`bsExport.ts`, `pnlExport.ts`) a felület aktív nyelvének megfelelően generálják a letölthető táblázatokat.
- Az **Éves Beszámoló Varázsló (`/annual-report`)** 6 lépéskapszulája, előrehaladás-kijelzője és léptetőgombjai, valamint az 1–6. lépések (alapadatok, adatbefagyasztás, validáció, kiegészítő melléklet, osztalék, export) tisztán horvát/magyar nyelven jelennek meg az aktív útvonalnak megfelelően (`accounting:annual_report.*`).
- A **Munkaidő Nyilvántartás (`/working-time`)**: Dolgozói lista és havi egyenlegkártya (`hr:working_time.*`), túlóra és ledolgozott napok horvát nyelven.
- A **Tárgyi Eszközök (`/fixed-assets`) és Bérjegyzékek (`/salaries`)**: Eszköz részletező panel és bérjegyzék fájlok táblázata (`hr:fixed_assets.*`, `hr:salaries.*`).
- A **Házipénztár (`/petty-cash`)**: Pénztári bejegyzések fül, jóváhagyási fül, lapozás és bizonylat nyomtatási dialógus (`pettyCash:*`).
- A **Hibajegykezelés (`/tickets`)**: Részletező nézet, státusz szalag, idővonal, galéria modál és 404 állapot (`tickets:*`).
- A **Jegyzetek (`/notes`)**: Jegyzet lista, keresés és jegyzet szerkesztő/létrehozó modál (`notes:*`).
- A **Számlakezelés Kiterjesztett Sorai és Tömeges Műveletei (`/invoices`)**: Lebegő műveleti sáv (`invoices:bulk.*`), folyamatos teljesítés, számlajegyzetek, összekapcsolt számlák, futár- és NAV egyeztetési panelek, netting kártya (`invoices:*`).
- A **Főkönyvi Kivonat, Karton & Könyvelési Naplók (`/general-ledger`, `/journals`)**:
  - Főkönyvi táblázat, kártyás karton nézet, szűrők, lapozók, összehasonlító táblázat és naplók listája (`accounting:general_ledger.*`, `accounting:journals.*`).
  - Kétnyelvű gyorskeresés és számlaválasztó: a keresőmezők (`GlSearchAutocomplete`, `AddManualJournalEntryModal`) magyar és horvát megnevezés vagy számlaszám alapján is megtalálják a tételeket.
- A **Bizonylatfeltöltés és Duplikáció-védelem (`/upload`)**:
  - A feltöltési csatornaválasztók (banki, futár), fájllista és állapotjelzők lokalizáltak (`upload:*`).
  - A már adatbázisban létező (`DbDuplicateDialog`) és a listán belüli (`ListDuplicateDialog`) duplikátumok figyelmeztető modáljai teljes fordítást és világos témában (light mode) is kontrasztos, elcsúszásmentes megjelenést kaptak.
- A **Pénzátvezetések és Futárriportok (`/transfers`, `/courier-reports`)**: Banki átvezetések oldala, futárriportok füle és riportfájl dialógusa (`transfers:*`, `invoices:courier_reports.*`).
- A **Közös UI Komponensek**: Lebegő bulk sáv, többes kijelölő, másolható cellák (`copyable-cell`), üres állapotok és fájl előnézeti modál (`common:*`).

**Rationale:**
A nemzetközi értékesítéshez kulcsfontosságú az autentikus helyi nyelvű és pénznemű demonstráció. Ugyanakkor a termelésben lévő magyar ügyfelek zavartalan élménye és a technikai stabilitás (ne ragadjon be a felület horvát nyelven) elsődleges prioritás. A tiszta útvonal-vezérelt megoldás mindkét feltételt maximálisan teljesíti.

## Kapcsolódó
- [A-109: Eaisybill Horvát Lokalizáció, /hr/ Scoped Route Architektúra](../../architecture/decisions/A-109-eaisybill-i18n-croatia-localization-and-route-architecture.md)
- [P-006: Sidebar Menüstruktúra](./P-006-sidebar-structure.md)
- [Information Architecture](../information-architecture.md)
