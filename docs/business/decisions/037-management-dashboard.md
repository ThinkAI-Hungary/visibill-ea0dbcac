# Decision 037: [Accounty] Management Dashboard

**Status:** Decided

**Category:** Platform Üzemeltetés

**Question:** Hogyan monitorozza a platform üzemeltető a rendszer állapotát és a felhasználókat?

**Decision:**
- Platform-szintű admin panel: `ManagementDashboard` (`/management`)
- Önálló route, saját layout (sem fő app sidebar, sem Accounty sidebar)
- Csak `management` role-lal rendelkező felhasználóknak elérhető
- RootRedirect automatikusan `/management`-re irányít management role esetén
- Funkciók:
  - Felhasználók és cégek áttekintése
  - Feldolgozási pipeline monitoring
  - Rendszer metrikák

**Rationale:** A platform üzemeltetőnek más nézetre van szüksége, mint egy könyvelőnek vagy végfelhasználónak. Az elkülönített route biztosítja, hogy a management funkciók ne zavarják a normál felhasználókat.
