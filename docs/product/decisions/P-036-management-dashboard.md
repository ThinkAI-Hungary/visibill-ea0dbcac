# P-036: Management Dashboard UI és Navigáció

**Status:** Decided  
**Category:** Platform Üzemeltetés  
**BRD Reference:** Decision 037 (Management Dashboard)

**Question:** Hogyan néz ki a platform admin dashboard?

**Decision:** Önálló route, saját layout, csak management role számára.

**Current Implementation:**
- `ManagementDashboard.tsx` — route: `/management`
- Saját layout: nincs fő app sidebar, nincs Accounty sidebar
- Hozzáférés: `profiles.role === 'management'` — automatikus redirect `/management`-re bejelentkezéskor
- Monitoring: felhasználók, cégek, feldolgozási pipeline állapot.
- **Worker Monitor (Control Center)**: Valós idejű konténer monitoring, amely a futó workerek CPU terheltségét és RAM használatát is kijelzi progress bar indikátorokkal, valamint mutatja a futó pipeline-ok és queue-k részletes állapotát.
- **Fájlok Tab (`FilesPanel`)**: Összesített nézet a platform összes feltöltött fájljáról (`invoice`, `transaction`, `bank_statement`, `report`), azok aktuális feldolgozási állapotáról, metaadataival (méret, feltöltő stb).
- **Support Admin Impersonation**: A cég adatlapján lehetőség van "Belépés a cégbe" funkcióra. Ilyenkor a user átkerül az adott cég nézetébe egy narancssárga/teal figyelmeztető sávval a képernyő tetején. Kilépéskor egy full-page fehér loading overlay jelenik meg, amíg a háttérben az ideiglenes jogosultságok törlődnek, így elkerülve az előző cég adatainak felvillanását ("layout shift").

**Rationale:** A platform üzemeltető igényei annyira különböznek a normál felhasználóétól, hogy saját dashboard szükséges. Az automatikus redirect biztosítja, hogy a management user ne a normál dashboardon landoljon. A Support Impersonation funkció és a globális fájl áttekintő kulcsfontosságú a debugoláshoz és ügyfélszolgálati esetek kivizsgálásához.

## Kapcsolódó
- [A-019: Management Dashboard](../../architecture/decisions/A-019-management-dashboard.md)
- [A-026: Support Admin Ideiglenes Hozzáférés](../../architecture/decisions/A-026-support-impersonation-access.md)
