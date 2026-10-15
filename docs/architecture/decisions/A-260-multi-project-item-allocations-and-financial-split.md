# A-260: Multi-Project Line Item Allocations, Zero-Jitter Cache and Financial Split Architecture

**Status:** Decided  
**Date:** 2026-10-15  
**Utoljára frissítve:** 2026-10-15  
**Kapcsolódó döntések:** [074 (BRD)](../../business/decisions/074-multi-project-item-allocations-and-cost-split.md), [P-190 (PRD)](../../product/decisions/P-190-multi-project-item-allocations-ux.md), [A-050](./A-050-server-side-aggregation-and-n-plus-1-optimization.md)

---

## Context és Problémafelvetés
A számlák tételes nézetében (`InvoiceItemsDialog`) korábban egy számlatétel kizárólag egyetlen projekthez (`project_id`) volt hozzárendelhető (vagy a szülő számla projektjét örökölte). Összetett beruházásoknál, vegyes költségszámláknál és alvállalkozói díjaknál azonban gyakori üzleti igény, hogy egyetlen beszerzési vagy értékesítési tétel költsége/bevétele több különálló projekt között oszlik meg meghatározott százalékos arányban (pl. 60% Projekt A, 40% Projekt B).

Emellett a tömeges számlaműveletek során (`InvoiceBulkActionsBar`) a felhasználónak lehetősége kell legyen kijelölt számlákat egyszerre egyetlen projekthez vagy többes százalékos felosztáshoz rendelni anélkül, hogy a kijelölési műveletek közben a lebegő akciósáv villódzna vagy fals állapotot mutatna (Zero-Jitter és UI/UX védelmi szabályok).

Olyan megoldásra volt szükség, amely:
1. Teljes relációs és adatintegritást biztosít 270 000+ meglévő tétel mellett, elkerülve a lassú N+1 lekérdezéseket és a locking torlódást.
2. Szigorú integritási szabállyal megköveteli, hogy a felosztás pontosan 100.00% legyen (se több, se kevesebb).
3. Hibrid módon megőrzi a visszafelé kompatibilitást az egyedi `project_id` oszloppal.
4. Atomikusan átvezeti az arányosított összegeket a Projektek pénzügyi és fedezetszámítási moduljában (`Projects.tsx`).
5. Kétirányú testvér-szinkronizációval (`findTwinItems`) biztosítja a paritást a NAV számlatételek (`nav_invoice_items`) és a feltöltött bizonylatok tételei (`invoice_items`) között.
6. A tömeges kijelölésnél és lista megjelenítésnél azonnali (0 ms) gyorsítótárazott állapotot nyújt hálózati villódzás nélkül (`placeholderData` és kétmenetes öröklési hierarchia).

---

## Döntés

### 1. Adattárolás JSONB oszlopban
Mind a `nav_invoice_items`, mind az `invoice_items` táblák kaptak egy `project_allocations jsonb DEFAULT NULL` oszlopot GIN indexeléssel (`idx_nav_invoice_items_project_allocations`, `idx_invoice_items_project_allocations`):
```json
[
  { "project_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d", "percentage": 60 },
  { "project_id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d", "percentage": 40 }
]
```

### 2. Hibrid `project_id` kompatibilitás
* **Egyetlen projekt (100%):** Ha a tétel egyetlen projekthez van rendelve: a `project_id` mező tartalmazza a projekt UUID-ját, és a `project_allocations` értéke `[{ project_id, percentage: 100 }]`.
* **Többes felosztás (>1 projekt):** A `project_id` értéke `NULL`, és a `project_allocations` tartalmazza az arányokat.
* **Törlés / Örökölt állapot:** Mindkét mező `NULL` lesz, így a tétel a szülő számla fejléc projektjét veszi át.

### 3. Kliens és DB oldali 100%-os validáció
A `src/lib/projectAllocationValidation.ts` tiszta segédfüggvény garantálja, hogy a mentés csak akkor mehet végbe, ha az összeg kerekítve pontosan 100.00%, nincsenek duplikált projektek és minden sor érvényes pozitív százalékot tartalmaz (`isValidAllocationSum`, `validateProjectAllocations`).

### 4. Zero-Jitter TanStack Query Gyorsítótárazás (`useInvoiceItemProjectAllocations`)
A tömeges műveleti sáv és a táblázat sorai nem indítanak redundáns hálózati lekérdezéseket minden egyes checkbox kattintáskor:
* **Előzetes memóriagyorsítótár:** A hook a `queryClient.getQueriesData` segítségével ellenőrzi, hogy a táblázat (`NavInvoiceTable`) korábban már letöltötte-e az adott számla tételszintű felosztását. Amennyiben igen, 0 ms alatt a memóriából adja vissza.
* **PlaceholderData folytonosság:** Kulcsváltáskor a `placeholderData: (previousData) => ({ ...previousData, ...cachedQueries })` megtartja az előzőleg kijelölt számlák adatait, így elkerülhető a transient `undefined` állapot és az 1 másodperces üres sáv villanás.

### 5. Kétmenetes Kijelölési Hierarchia (`InvoiceBulkActionsBar`)
A lebegő akciósáv reaktívan értékeli ki a kijelölt sorokat:
* **1. menet (Többprojekt prioritás):** Átvizsgálja az összes kijelölt számlát; ha bármelyik sor többes projektfelosztással rendelkezik, azonnal a többes megosztást emeli be a felületre (`CUSTOM_SPLIT`, `% X projekt (100%)`).
* **2. menet (Egyedi projekt):** Ha nincs többes megosztás, az egyedi projektet jeleníti meg a legördülőben.
* **Azonnali Uncheck szinkron:** Amint a többprojektes számla kikerül a kijelölésből, a sáv azonnal, szellem-állapotok és beragadás nélkül visszaáll az üres vagy a megmaradó sor állapotára.

### 6. Projektek Modul Pénzügyi Számítás
A `Projects.tsx` PostgREST lekérdezése az `.or('project_id.not.is.null,project_allocations.not.is.null')` szűrővel olvassa be a tételeket. A kalkuláció során az arányosított bruttó összeg:
allocatedGross = itemGross × (percentage / 100)
Ez az összeg jelenik meg az adott projekt tényleges költségvetési és fedezeti mutatószámaiban.

### 7. Adat-export és Számlalétrehozási Továbbadás
Az `exportableInvoices` kontextus átadja a `project_allocations` és `project_id` mezőket, így az Excel és strukturált exportok (`InvoiceDataExportDialog`) pontosan tükrözik a tételes és fejlécszintű felosztásokat.

---

## Következmények

### Pozitív
* **Pontos Pénzügyi Elszámolás:** Megszűnik a kényszerű tételekre bontás és kézi kalkuláció; a tételek közvetlenül feloszthatók a beruházási projektek között.
* **Zero Layout Shift és Villódzásmentes UI:** A gyorsítótárazott hook és reaktív levezetés megszünteti a kijelöléskori ugrálásokat.
* **Zéró N+1 Terhelés:** A PostgREST és GIN indexek biztosítják, hogy 270 000+ tétel mellett is <50 ms alatt végbemenjen az allokációk kiolvasása.

### Konzisztencia és Migráció
* A `20261015120000_add_invoice_items_project_allocations.sql` migráció tartalmazza a két tábla új JSONB oszlopát és GIN indexeit.
* A `main` ágba történő release során a dev DB mellett az éles (Prod) adatbázison is kötelező érvényesíteni.
