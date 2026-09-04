# A-089: Management Dashboard Hibajegy Létrehozás Felhasználó Nevében (Impersonated Ticket Creation)

> **Státusz:** ✅ Decided  
> **Dátum:** 2026-09-04  
> **Érintett komponensek:** `supabase/functions/management-stats/`, `src/features/management/api/`, `src/features/management/components/tickets/`, `src/pages/TicketsPage.tsx`  
> **Kapcsolódó PRD:** [P-070](../../product/decisions/P-070-management-impersonated-ticket-creation-ux.md)  
> **Kapcsolódó ADR-ek:** [A-003](./A-003-multi-tenancy-rls.md), [A-018](./A-018-ticket-system.md), [A-019](./A-019-management-dashboard.md), [A-026](./A-026-support-impersonation-access.md), [A-077](./A-077-management-stats-edge-function-and-telemetry-decomposition.md)

---

## 1. Context

A Visibill platform ügyfélszolgálati és support folyamatai során gyakran előfordul, hogy egy ügyfél telefonon, emailben vagy más külső csatornán jelez hibát, kérdést vagy igényt. Annak érdekében, hogy a teljes hibajegy-életciklus (valós idejű push és in-app értesítések, státuszváltások, audit trail és az ügyfél saját felületén való visszakövethetőség) megvalósuljon, elengedhetetlen, hogy a Management Dashboard-ot használó operátorok és adminisztrátorok közvetlenül a célfelhasználó nevében tudjanak hibajegyet nyitni.

### Problémák és korlátok a döntés előtt:
1. **Szigorú RLS védelem:** A `feedback` táblán lévő PostgreSQL RLS policy (`auth.uid() = user_id`) megtagadja a közvetlen kliens-oldali beszúrást, amennyiben az aktív bejelentkezett session (`auth.uid()`) nem egyezik meg a rekordban rögzített `user_id`-val.
2. **Kliens RLS lazítás kockázata:** Nem engedélyezhető általános kliens-oldali RLS módosítás (pl. `OR auth.role() = 'service_role'` vagy admin UID alapú INSERT szabály a frontend kliens felé), mert az biztonsági rést nyithatna vagy megkerülhetné a több bérlős (multi-tenant) adatvédelmet.
3. **Kontextus és cég-integritás:** Ha az adminisztrátor nem köti a jegyet a célfelhasználó releváns cégéhez, vagy manuálisan rossz emailt/nevet gépel be, az értesítési lánc (`ticket_events`, email webhooks) sérül.

---

## 2. Decision

### A. Biztonságos Backend Proxy: `management-stats` Edge Function (`action: create-ticket`)

A közvetlen frontend Supabase kliens beszúrás helyett az adminisztrátori ticket létrehozást a meglévő, szigorúan védett `management-stats` Edge Functionön keresztül vezetjük át:

```
[Management Frontend] (TicketsPage / ManagementCreateTicketDialog)
        │
        ▼ (POST /management-stats?action=create-ticket, Bearer Admin JWT)
[Edge Function Middleware] (authenticateRequester: management / thinkai role)
        │
        ▼
[ticketsHandler.ts] (createTicketOnBehalf)
        ├── 1. Admin jogosultság és input validáció (targetUserId, title, message)
        ├── 2. Célfelhasználó profil & auth adatok lekérése (profiles, auth.admin.getUserById)
        ├── 3. Cég-tagság feloldása & validálása (company_members ellenőrzés)
        ├── 4. Feedback rekord beszúrása service_role klienssel
        └── 5. Audit esemény rögzítése a ticket_events táblában
        │
        ▼ (JSON válasz: { success: true, ticket: { id, ticket_number, ... } })
[Frontend React Query Cache Invalidálás & Auto-Navigáció]
```

### B. Adatbázis Integritás és Eseménylánc (Event Sourcing)

1. **Rekord Létrehozás a Célfelhasználó Neve Alatt:**
   - A `feedback` tábla sora a kiválasztott felhasználó `user_id`-jával, nevével (`user_name`) és emailjével (`user_email`) kerül elmentésre.
   - Így a célfelhasználó a saját felületén (`/tickets` és értesítési központ) azonnal látja a jegyet, mintha ő maga küldte volna be.
2. **Adatbázis Trigger Automatikus Működése:**
   - A meglévő `trg_ticket_created_event` PostgreSQL trigger automatikusan lefut, és generálja a kezdeti `created` eseményt a `ticket_events` táblába.
3. **Adminisztrátori Audit Trail:**
   - A `ticketsHandler.ts` a jegy létrehozása után explicit módon rögzít egy audit eseményt a `ticket_events` táblában (`event_type: 'created'`, `actor_id: adminUser.id`, `metadata: { created_by_admin: true, admin_id, admin_email }`). Ez transzparens felügyeletet biztosít arról, melyik admin nyitotta a jegyet a kliens helyett.

### C. Dinamikus Cégkezelés és Auto-Fill Szabály

- A célfelhasználó kiválasztásakor a frontend lekéri vagy szűri a felhasználóhoz tartozó cégeket (`company_members` alapján).
- **1 cég esetén:** A rendszer automatikusan hozzárendeli a céget a jegyhez (`company_id`), csökkentve az adminisztrátori adminisztrációs terhet.
- **Több cég esetén:** Kötelező/ajánlott legördülő listából választhatja ki az érintett céget.
- **0 cég esetén (pl. meghívott vagy független fiók):** A jegy cég nélkül (globális felhasználói jegyként) jön létre.

---

## 3. Consequences

### Pozitívumok (Pros):
- **Zéró RLS kompromisszum:** A kliens-oldali PostgreSQL RLS policy-k érintetlenek maradnak; nem szükséges biztonsági kivételeket vagy komplex policy logikákat építeni a `feedback` táblára.
- **Konzisztens értesítési ökoszisztéma:** Mivel a jegy a célfelhasználó adatait viseli, a platform összes meglévő értesítési mechanizmusa (Push, Email digest, In-app badges, Realtime) azonnal és módosítás nélkül működik.
- **Auditálhatóság:** Az adminisztrátori beavatkozás nem rejtett; a `ticket_events` naplóban nyomon követhető a jegyet rögzítő operátor személye.
- **Kényelmes UI / DX:** A moduláris `ManagementCreateTicketDialog` tiszta és intuitív felületet nyújt kereshető felhasználóválasztóval, formázott leírással és csatolmánykezeléssel.

### Negatívumok / Kockázatok (Cons & Mitigations):
- **Edge Function függőség:** A funkció működéséhez szükséges a `management-stats` Edge Function elérhetősége. (Megoldás: A frontend egységes hibakezelést és barátságos hibaüzeneteket jelenít meg toast formájában.)
- **Csatolmány méretkorlát:** Fájlfeltöltés esetén a meglévő 10 MB/fájl és max 5 db fájl korlátozás érvényesül.

---

## 4. Kapcsolódó Dokumentumok
- [P-070: Management Impersonated Ticket Creation UX](../../product/decisions/P-070-management-impersonated-ticket-creation-ux.md)
- [A-018: Hibajegy Rendszer Architektúra](./A-018-ticket-system.md)
- [A-019: Management Dashboard Architektúra](./A-019-management-dashboard.md)
- [A-077: Management Stats Edge Function & Telemetry Decomposition](./A-077-management-stats-edge-function-and-telemetry-decomposition.md)
