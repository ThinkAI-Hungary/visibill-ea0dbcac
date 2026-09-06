# A-101: Közvetlen Szkript-Automatizációk Letiltása és Kettős Védelmi Retesz (PostgREST Pre-Request Hook & Edge Function Client Guard)

**Status:** Decided  
**Date:** 2026-09-06  
**Utoljára frissítve:** 2026-09-06  

---

## Context

2026-09-06-án biztonsági és terhelésbeli incidens történt: egy felhasználó (Marco / Mauroni) sikeres felhasználói belépést követően kapott JWT bearer tokennel egy saját Node.js szkriptből (`User-Agent: node`) közvetlenül, automatizált ciklusban hívogatta a Visibill PostgREST adatbázis-végpontjait és Edge Function-jeit.

Bár a Row Level Security (RLS) megakadályozta, hogy idegen cégek adataihoz hozzáférjen, a közvetlen és nem auditált szkript-alapú automatizáció több kritikus kockázatot hordoz:
1. **Erőforrás-kimerítés és DoS-kockázat:** Egyetlen felhasználó kontrolálatlan ciklusa eláraszthatja a Supabase PostgREST és Kong API átjáróit, lassítva a többi bérlőt.
2. **Harmadik feles API költségek (OpenAI / DeepSeek / Resend):** Ha a felhasználó scripttel hívja az AI kategorizáló (`accounty-ai-categorize`), AI chat (`accounty-ai-chat`) vagy cégleíró (`generate-company-description`) Edge Function-öket, kontrolálatlan API költségeket termel a platformnak.
3. **Adatintegritási és üzleti szabály megkerülés:** A hivatalos webapp UI validációit kikerülve közvetlenül adatbázis-rekordokat módosíthat vagy törölhet.
4. **Hiányzó API licencelés és audit:** A Visibill üzleti modellje szerint a gépi integrációkhoz dedikált, auditált és korlátozott API hozzáférés szükséges (lásd: [BRD 030: API Hozzáférés](../../business/decisions/030-api-access.md)), nem pedig a webes felhasználói fiók tokenjeinek visszaélésszerű scriptelése.

A felhasználó igényként megfogalmazta, hogy a közvetlen szkriptes automatizációt tiltsuk le, a hivatalos API igénylési és kulcskezelési munkafolyamatot pedig egy későbbi session-ben fejlesszük ki.

---

## Decision

Kiépítettük a **kettős védelmi vonalat (Defense-in-Depth)** a jogosulatlan szkript-alapú automatizációk ellen:

```
                                [ Bejövő HTTP Kérés ]
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  ▼                                               ▼
     [ /rest/v1/* (PostgREST) ]                     [ /functions/v1/* (Edge Functions) ]
                  │                                               │
                  ▼                                               ▼
       PostgREST Pre-Request Hook                       Edge Function Client Guard
          (public.check_request)                      (_shared/client-guard.ts)
                  │                                               │
     ├─ service_role? → BYPASS (Worker)              ├─ service_role? → BYPASS (Worker)
     ├─ Deno runtime? → BYPASS                       ├─ Webhook (Mailgun)? → BYPASS
     ├─ Script runner? → 403 FORBIDDEN               ├─ Script runner? → 403 FORBIDDEN
     ├─ Nincs Origin/Referer &                       ├─ Nincs Origin/Referer &
     │  nincs x-visibill-client? → 403               │  nincs x-visibill-client? → 403
     └─ Legitim webapp? → ÁTENGEDVE                  └─ Legitim webapp? → ÁTENGEDVE
```

---

### 1. Védelmi Vonal: PostgREST Pre-Request Hook (`check_request()`)

A PostgreSQL `public.check_request()` hook minden beérkező PostgREST kérés előtt lefut:
- **Migráció:** `supabase/migrations/20260906183000_block_external_script_automations.sql`
- **Vizsgálat:** A PostgreSQL `request.headers` kontextusából kinyeri a `user-agent`, `x-client-info`, `origin`, `referer` és `x-visibill-client` fejléceket.
- **Kivételek (Azonnali bypass):**
  - `jwt_role = 'service_role'`: Visibill Python Worker és belső cron folyamatok azonnal átengedve (0 overhead).
  - Deno Edge Functions (`supabase-js-deno`): Belső Edge Function adatbázishívások átengedve.
- **Tiltási feltételek (`authenticated` kéréseknél):**
  - Ismert script futtatók / HTTP könyvtárak: `node%`, `node-fetch%`, `axios%`, `undici%`, `python%`, `aiohttp%`, `requests%`, `urllib%`, `curl%`, `wget%`, `httpie%`, `postman%`, `insomnia%`, `go-http-client%`, `powershell%`.
  - Hiányzó böngészős `Origin` és `Referer` kontextus a hivatalos kliens fejléc nélkül (`x-visibill-client: web-app`).
- **Elutasítási válasz:** Azonnali `HTTP 403 Forbidden` kivétel dobása:
  ```json
  {
    "code": "AUTOMATION_BLOCKED",
    "message": "A közvetlen szkript-alapú automatizáció le van tiltva a Visibill rendszerében. Kérjük használd a hivatalos webes felületet!",
    "details": "Direct script automation is restricted. Please use the official Visibill web application."
  }
  ```

---

### 2. Védelmi Vonal: Edge Function Client Guard (`_shared/client-guard.ts`)

Mivel a Supabase Edge Runtime (`/functions/v1/*`) kérései nem futnak át a PostgREST pre-request hookon, a funkciók egyenkénti védelmére közös pajzs modult vezettünk be:
- **Fájl:** `supabase/functions/_shared/client-guard.ts`
- **Függvény:** `checkAutomationShield(req: Request): Response | null`
  - Ha script futtatót észlel (`node`, `python`, `curl`, `postman`, `powershell`, stb.) vagy hiányzik a böngészős Origin/Referer kontextus, azonnali `HTTP 403 AUTOMATION_BLOCKED` választ küld vissza.
  - A böngészős webapp hívások standard `Origin` és `User-Agent` jelenléte mellett zökkenőmentesen átjutnak.
- **Védett funkciók (20 db):**
  - `trigger-nav-categorization`
  - `create-email-alias`
  - `delete-email-alias`
  - `delete-email-settings`
  - `delete-nav-credentials`
  - `export-user-data`
  - `save-credentials`
  - `nav-query-outbound-invoices`
  - `nav-sync`
  - `query-nav-invoices`
  - `test-email-connection`
  - `generate-pdf-export`
  - `get-invoice-image-url`
  - `accounty-ai-categorize` (LLM védelem)
  - `accounty-ai-chat` (LLM védelem)
  - `generate-company-description` (LLM védelem)
  - `accounty-generate-xml`
  - `shipment-retroactive-match`
  - `invite-user`
  - `impersonate-company`
- **Felmentett külső webhook:**
  - `process-mailgun-webhook`: Közvetlen szerver-szerver integráció, fel van mentve a kliens-guard alól, saját Mailgun HMAC szignatúra ellenőrzéssel működik.

---

### 3. Zéró-CORS-Súrlódás Webapp Integráció

A frontend kliens nem küld nem-standard egyedi fejléceket, így elkerüli a preflight `Access-Control-Allow-Headers` blokkolásokat az Edge Function hívásoknál:
- A modern böngészők cross-origin `fetch()` hívásai automatikusan tartalmazzák a megbízható `Origin` (pl. `http://localhost:8080` vagy `https://app.visibill.hu`), `Referer` és a böngészős `User-Agent` fejlécet.
- Mivel a böngésző homokozója (sandbox) garantálja, hogy kliens oldali JS kód nem tudja manipulálni a `User-Agent`-et és nem tudja elrejteni az `Origin`-t, a PostgREST és az Edge Function védelmi reteszek megbízhatóan megkülönböztetik a valós webapp felhasználókat a külső CLI szkriptektől (Node.js, Python, curl).

---

## Consequences

### Pozitív:
- **Teljes védelem:** Nem lehetséges a webes felhasználói tokenekkel közvetlen Node.js/Python/cURL szkripteket futtatni sem a PostgREST adatbázisra, sem az Edge Function-ökre.
- **Nulla fennakadás a legális forgalomban:** A hivatalos webapp böngészős felhasználói, a Visibill Worker és a beérkező Mailgun számla-webhookok 100%-ban zavartalanul működnek tovább.
- **Költségvédelem:** Az OpenAI és DeepSeek LLM tokeneket fogyasztó Edge Function-ök védettek az automatizált lehalászástól.
- **Konzisztens hibajelzés:** Mind PostgREST, mind Edge Function szinten egységes `HTTP 403 AUTOMATION_BLOCKED` válaszkód és magyar/angol hibaüzenet tájékoztatja a felhasználót.

### Negatív / Trade-off:
- **Ad-hoc fejlesztői szkriptek tiltva:** A fejlesztők sem tudnak egyszerű `curl` paranccsal felhasználói tokent használva végpontot hívni tesztelésre; ehhez `service_role` kulcsot, az `x-visibill-client: web-app` fejlécet, vagy az OpenClaw API kulcsot kell használni.
- **Jövőbeli követelmény:** A hivatalos gépi integrációkra vágyó ügyfelek számára ki kell építeni a dedikált API kulcs igénylő és jóváhagyó felületet (következő session).

---

## Kapcsolódó

- [A-005: Edge Functions](./A-005-edge-functions.md) — Edge Function katalógus és `_shared/client-guard.ts`
- [A-016: PostgreSQL Query Strategy](./A-016-postgresql-query-strategy.md) — `check_request()` hook specifikáció
- [A-017: Security Architecture](./A-017-security-architecture.md) — 9. réteg: Script Automation Shield
- [BRD 030: API & Third-party Hozzáférés](../../business/decisions/030-api-access.md) — API licencelés és harmadik feles integrációk
