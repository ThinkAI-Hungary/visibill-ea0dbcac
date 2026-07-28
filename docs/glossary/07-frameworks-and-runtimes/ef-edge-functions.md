# ⚡ EF — Edge Functions (Supabase Serverless Functions)

> **Utoljára frissítve:** 2026-07-25  
> **Kapcsolódó doksi:** [A-005: Edge Functions Architecture](../../architecture/decisions/A-005-edge-functions.md) | [GLOSSARY Index](../index.md)

---

## 📖 Fogalom Meghatározása

Az **EF (Edge Function)** a Supabase által biztosított **Deno TypeScript/JavaScript szervermentes (serverless) felhőfüggvény**, amely a felhőhálózat szélén (edge) fut alacsony válaszidővel. 

A Visibill architektúrájában az Edge Function-ök képezik a középső réteget a React Frontend és a Supabase PostgreSQL adatbázis / Python Worker között.

---

## 🏗️ Miért használunk Edge Function-öket?

1. **RLS Bypass (Service Role):** Olyan feladatoknál, ahol több cég adatait kell aggregálni (pl. `management-stats`), a frontend nem használhatja a `service_role` kulcsot. Az EF-en belül biztonságosan futtatható cross-tenant lekérdezés.
2. **Külső API Integrációk:** Külső szolgáltatások titkos kulcsait (pl. Mailgun API key, NAV aláírókulcs, OpenAI/LiteLLM API key) az EF környezeti változóiban (`Deno.env`) tároljuk, így azok sosem kerülnek a kliens böngészőjébe.
3. **Harmadik Fél Webhook-ok:** A Mailgun webhook-ok és szinkronizációs triggerek fogadása és validálása.

---

## 💡 Use-Case-ek a Visibillben

| Edge Function Név | Szerep & Use-Case | Kérési Mód |
|---|---|---|
| **`management-stats`** | Centralizált admin és üzemeltetési API (15+ action: `overview`, `files`, `errors`, `llm-costs`). | `POST` / `GET` Bearer JWT token-nel |
| **`process-mailgun-webhook`** | Beérkező e-mailek és csatolmányok feldolgozása, dedup ellenőrzés és feltöltés. | Webhook `POST` |
| **`nav-sync`** | NAV Online Számla API v3 aszinkron és ad-hoc számlaletöltés. | Scheduled Cron / Manual Trigger |
| **`send-email`** | Rendszer-értesítések, regisztrációs és meghívó e-mailek kiküldése Mailgun-on keresztül. | Belső EF hívás / Service Key |

---

## ⚙️ Akció-Alapú API Minta (Action Pattern)

Különálló mikro-funkciók tucatjai helyett a Visibill a **kontolidált action mintát** alkalmazza (pl. `management-stats` esetén):

```typescript
// management-stats/index.ts
const action = url.searchParams.get("action") || body.action;

switch (action) {
  case "overview":
    return handleOverview();
  case "llm-costs":
    return handleLLMCosts();
  case "files":
    return handleFiles();
  default:
    return json({ error: "Invalid action" }, { status: 400 });
}
```
