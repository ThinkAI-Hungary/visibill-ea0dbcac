# Decision 037: [Accounty] Management Dashboard

**Status:** Decided (updated 2026-06-28)

**Category:** Platform Üzemeltetés

**Question:** Hogyan monitorozza a platform üzemeltető a rendszer állapotát és a felhasználókat?

**Decision:**
- Platform-szintű admin panel: `ManagementDashboard` (`/management`)
- Önálló route, saját layout (sem fő app sidebar, sem Accounty sidebar)
- Csak `management` role-lal rendelkező felhasználóknak elérhető
- RootRedirect automatikusan `/management`-re irányít management role esetén
- **4 fő nézet:**
  - **Áttekintés** — Dashboard metrikák, cég/user/LLM összefoglalók
  - **Control Center** — Hibák kezelése (szűrés, törlés, retry, összes törlés), upload error monitoring
  - **Superadmin** — Cégenként 27 modul adatainak böngészése (eaisybill + eaisyBooks)
  - **Jogosultságok** — Felhasználói modul jogosultságok kezelése

### Superadmin Tab

A Superadmin panel lehetővé teszi a teljes platform adatainak cégenként, modulonként történő áttekintését:

- **Navigáció:** Cég mód (név/adószám keresés) + Felhasználó mód (user cégei, kontextus megmarad)
- **Platformsorok:** Felső sor = eaisybill (14 modul, zöld akcenttel), alsó sor = eaisyBooks (13 modul, kék akcenttel)
- **Feltételes hozzáférés:** Ha a cégnek nincs eaisyBooks hozzárendelése → alsó sor szürke/kattinthatatlan + „Nem elérhető"
- **Badge-ek:** Céglistában `eaisybill` / `eaisyBooks` badge-ek jogosultság alapján

#### eaisybill modulok (14)
Számlák, NAV számlák, Tranzakciók, Főkönyv, Bér, Házipénztár, Kategóriák, Projektek, Partnertörzs, TENY, Fuvarok, Beszámoló, Feldolgozások, App hibák

#### eaisyBooks modulok (13)
Portfólió, Adó profil, Hiányzó dok., Határidők, Alkalmazottak, Bérszámfejtés, Bevallások, TAO, Audit napló, Dokumentumok, Sablonok, Jogviszonyok, Jogszabályok

### Control Center

- Hibák szűrése: forrás, kategória, cég, felhasználó, dátum, szöveges keresés
- Kijelölt hibák törlése / újraküldése (pipeline override lehetőséggel)
- **Összes törlés:** Confirmation popup-al, minden forrásból törli/dismiss-eli a hibákat

**Rationale:** A platform üzemeltetőnek más nézetre van szüksége, mint egy könyvelőnek vagy végfelhasználónak. Az elkülönített route biztosítja, hogy a management funkciók ne zavarják a normál felhasználókat. A Superadmin tab kétsoros platform-navigációja vizuálisan elkülöníti az eaisybill és eaisyBooks modulokat, és azonnal jelzi a cég-szintű hozzáférést.
