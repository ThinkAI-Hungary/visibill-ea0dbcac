# P-036: Management Dashboard UI és Navigáció

**Status:** Decided  
**Category:** Platform Üzemeltetés  
**BRD Reference:** Decision 037 (Management Dashboard)

**Question:** Hogyan néz ki a platform admin dashboard?

**Decision:** Önálló route, saját layout, csak management role számára.

**Current Implementation:**
- `ManagementDashboard.tsx` — route: `/management`
- Saját layout: nincs fő app sidebar, nincs Accounty sidebar
- Hozzáférés: `profiles.role === 'management'` vagy `'thinkai'` — automatikus redirect `/management`-re bejelentkezéskor. **Nem jogosult felhasználók a `/management` felkeresésekor 404 (NotFound) oldalt kapnak.**
- Monitoring:
  - **Áttekintés (Bento Grid)**: A fő Overview lap Bento Grid elrendezést használ, amely magában foglalja az LLM Pénzügyi Áttekintést (modellek költségmegoszlásával, mindenkori legdrágább céggel multi-tenant szinten), a Worker státuszokat (aktív konténerek száma, átlagos CPU/RAM terheltség), a valós idejű feldolgozás alatt lévő tételek számát, a legutóbbi hibajegyeket (új és megoldott státuszok szerint) és a legutóbbi fájlokat. A feldolgozási hibák panel be van ágyazva a Worker status kártyába.
  - **Felhasználók és Jogosultságok szekció (Control Center)**:
    - **Felhasználók fül (`UsersControlPanel`)**: Részletes felhasználói lista cégszámokkal, kinyitható céges táblázattal, törlési és anonimizálási funkcióval. A kereső támogatja a név, email és cégnevek szerinti szűrést.
    - **Jogosultságok fül (`PermissionsPanel`)**: Felhasználónkénti részletes modul jogosultsági mátrix (eaisybill & accounty platformokra), support agent toggle és eaisybooks hozzáférés kapcsoló. A bal oldali kereső támogatja a név, email és a hozzárendelt cégnevek szerinti szűrést (`Keresés név, email vagy cég...`), a felhasználói kártyákon megjelennek a hozzárendelt cégek is.
  - **Hibaközpont (`ErrorControlPanel`)**: Kifejtett error nézet 5 mezős gyorsáttekintővel (Forrás tábla, Rekord ID, Felhasználó, Cég, Időpont), webes útvonallal (`url`), részletgazdag, formázott JSON kontextussal és külön másolható JavaScript Stack Trace kódblokkal.
- **Worker Monitor (Control Center)**: Valós idejű konténer monitoring, amely a futó workerek CPU terheltségét és RAM használatát is kijelzi progress bar indikátorokkal, valamint mutatja a futó pipeline-ok és queue-k részletes állapotát.
- **Fájlok Tab (`FilesPanel`)**: Nagy teljesítményű szerver-oldali SQL aggregáció (`get_management_files` RPC), amely a platform összes feltöltött fájlját (több mint 7 130+ fájl) és azok pontos KPI számait valós időben, szerver-oldali kereséssel és lapozással jeleníti meg.
- **Hibajegyek Tab (`TicketsPage`)**: Integrált ügyfélszolgálati vezérlőközpont (Jegyek listája, Kezelőkonzol, Analitika & SLA, Terhelés & Elosztás), valamint a navigációs sávból indítható `+ Új hibajegy nyitása` funkció (`ManagementCreateTicketDialog`), amellyel support adminok közvetlenül célfelhasználó nevében rögzíthetnek hibajegyet dinamikus cégválasztóval, RichText leírással és csatolmányokkal (részletek: [P-070](./P-070-management-impersonated-ticket-creation-ux.md), [A-089](../../architecture/decisions/A-089-management-ticket-creation-on-behalf-of-user.md)).
- **Support Admin Impersonation**: A cég adatlapján lehetőség van "Belépés a cégbe" funkcióra. Ilyenkor a user átkerül az adott cég nézetébe egy narancssárga/teal figyelmeztető sávval a képernyő tetején. Kilépéskor egy full-page fehér loading overlay jelenik meg, amíg a háttérben az ideiglenes jogosultságok törlődnek, így elkerülve az előző cég adatainak felvillanását ("layout shift").

**Rationale:** A platform üzemeltető igényei annyira különböznek a normál felhasználóétól, hogy saját dashboard szükséges. Az automatikus redirect biztosítja, hogy a management user ne a normál dashboardon landoljon. A Support Impersonation funkció, a hibaközpont részletes stack trace nézete és a globális fájl áttekintő kulcsfontosságú a debugoláshoz és ügyfélszolgálati esetek kivizsgálásához. A jogosulatlan felhasználók elől a felület 404 oldallal rejtve marad.

## Kapcsolódó
- [A-019: Management Dashboard](../../architecture/decisions/A-019-management-dashboard.md)
- [A-026: Support Admin Ideiglenes Hozzáférés](../../architecture/decisions/A-026-support-impersonation-access.md)
- [A-061: Decomposing the Monolithic Management Dashboard](../../architecture/decisions/A-061-decompose-management-dashboard.md)
- [A-066: Management Route Access Control és NotFound Guard](../../architecture/decisions/A-066-management-route-access-control-and-not-found-guard.md)
- [A-068: Szerver-oldali Fájl Lapozás és Összesítés (`get_management_files` RPC)](../../architecture/decisions/A-068-management-files-rpc-pagination.md)
- [A-069: Centralized Frontend Error Ingestion, Stack Trace & Context Deserialization](../../architecture/decisions/A-069-frontend-error-reporting-and-context-inspection.md)
- [A-089: Management Dashboard Hibajegy Létrehozás Felhasználó Nevében](../../architecture/decisions/A-089-management-ticket-creation-on-behalf-of-user.md)
- [P-070: Management Dashboard Hibajegy Létrehozás Felhasználó Nevében UX](./P-070-management-impersonated-ticket-creation-ux.md)
