# A-104: [eaisyBooks] AI Chat Streaming, Dual-Provider API Routing és Edge Architektúra

**Status:** Decided  
**Date:** 2026-09-07  
**Kategória:** Edge Functions & AI Architektúra  
**Kapcsolódó döntések:** [A-005: Edge Functions](./A-005-edge-functions.md), [A-007: LLM Stratégia](./A-007-llm-strategy.md), [A-101: Direct Script Automation Restriction](./A-101-direct-script-automation-restriction.md), [A-102: eaisyBooks Dual-Mode Architecture](./A-102-eaisybooks-dual-mode-modular-architecture.md), [Decision 055](../../business/decisions/055-eaisybooks-ai-assistant-chat.md), [P-077](../../product/decisions/P-077-eaisybooks-ai-assistant-chat-and-speed-dial-ux.md)

---

## 1. Kontextus és Problémafelvetés

Az eaisyBooks könyvelőirodai ERP-ben felmerült az igény egy valós idejű, beépített jogszabály-értelmező és kontírozási tanácsadó AI asszisztensre. A megvalósítás előtt több technológiai kihívást kellett megoldani:
1. **Látencia és UX:** Egy teljes adózási vagy bérszámfejtési magyarázat generálása 5–15 másodpercet is igénybe vehet. A hagyományos, válaszra várakozó blokkoló REST kérések elfogadhatatlanul rossz felhasználói élményt nyújtanak.
2. **Költséghatékonyság és modellfüggetlenség:** Az OpenAI GPT-4o család magas költséggel jár, míg a DeepSeek API kiemelkedő ár/érték arányt és erős magyar jogszabályi szövegértést biztosít, ám külső API kimaradások ellen védelmet (fallbacket) kell biztosítani.
3. **Erőforrás- és visszaélés-védelem:** Egy nyitott AI endpoint kontrolálatlan meghívása drasztikusan megnövelheti a felhőszámlát. Meg kell akadályozni a botok és a közvetlen automatizált scriptek hozzáférését, és per-user kvótát kell érvényesíteni.
4. **Kontextuális tudatosság:** Az asszisztensnek tudnia kell, hogy a könyvelő éppen melyik cég adatait vagy melyik menüpontot nézi (pl. bérszámfejtés, EV egyszeres könyvvitel vagy hiányzó számlák).

---

## 2. A Döntés

Elfogadtuk az **eaisyBooks AI Chat Streaming és Dual-Provider Edge Architektúráját**:

### 2.1. Server-Sent Events (SSE) Token Streaming
- A backend nem Supabase Realtime csatornát (amely dedikált WebSocket kapcsolatot és DB trigger terhelést igényelne), hanem szabványos **Server-Sent Events (`text/event-stream`)** protokollt használ az [accounty-ai-chat](file:///d:/ThinkAI/Visibill/eaisybill-prod/supabase/functions/accounty-ai-chat/index.ts) Edge Functionben.
- A Deno szerver `ReadableStream`-et nyit az LLM felé, és az érkező `data: {"content": "..."}` token-csomagokat azonnal átfolyatja (streameli) a böngésző felé.
- A kliens oldalon a `response.body.getReader()` és `TextDecoder` olvassa fel a darabokat, valós időben frissítve a React állapotot.
- **Megszakíthatóság:** A kliens szabványos `AbortController`-t használ, amellyel a leállító gombra (`Square`) kattintva a hálózati kapcsolat azonnal megszakad, elkerülve a felesleges token-fogyasztást.

### 2.2. Dual-Provider API Routing, Dinamikus Modellválasztás és Automatikus Fallback
Az Edge Function környezeti változók alapján dinamikusan és konfigurálhatóan választ az AI modellek és szolgáltatók között:
1. **Dinamikusan konfigurálható modell (`OPENAI_CHAT_MODEL` / `AI_CHAT_MODEL`):** Ha a Supabase Secretben be van állítva (pl. `OPENAI_CHAT_MODEL="gpt-5"` vagy `gpt-4o`), az Edge Function közvetlenül a megadott modellt használja az OpenAI API-n keresztül.
   - **Különleges modellkezelés (Reasoning & Next-Gen):** A legújabb modellek (pl. `gpt-5`, `gpt-4.5`, `o1`, `o3-mini`) esetében a rendszer automatikusan a `max_completion_tokens` paramétert küldi a régebbi `max_tokens` helyett, és elhagyja az egyéni alacsony hőmérsékletet (`temperature: 0.3`), mivel ezek a modellek csak az alapértelmezett (1) hőtartományt támogatják.
2. **Költséghatékony DeepSeek alapértelmezés:** Ha nincs egyedi `OPENAI_CHAT_MODEL` megadva, és a `DEEPSEEK_API_KEY` be van állítva, a rendszer a `deepseek-chat` modellt hívja a DeepSeek API-n keresztül (`https://api.deepseek.com/chat/completions`, ~$0.14/Mtok input, ~$0.28/Mtok output).
3. **OpenAI standard fallback:** Ha sem egyedi modell, sem DeepSeek kulcs nincs megadva, de az `OPENAI_API_KEY` elérhető, a kérések automatikusan a `gpt-4o-mini` modellhez futnak be (`temperature: 0.3`, `max_tokens: 2048`).
4. **Költségelszámolás adaptáció:** Az `llm_koltsegek` aszinkron rögzítése dinamikusan alkalmazkodik a modellhez (DeepSeek, Mini és Premium GPT kategóriák szerint).

### 2.3. Védelem és Kvóták (Automation Shield & In-Memory Rate Limiting)
- **Hitelesítés:** Minden kérés kötelezően tartalmazza a Supabase Authorization Bearer tokent, amelyet a szerver a `supabaseClient.auth.getUser()` függvénnyel érvényesít.
- **Automation Shield:** Az [A-101](./A-101-direct-script-automation-restriction.md) döntésnek megfelelően a `checkAutomationShield(req)` vizsgálja a kérések fejléceit, kiszűrve a cURL/Postman vagy külső scriptekből érkező forgalmat.
- **Per-User Rate Limiting:** A szerver memóriájában nyilvántartja a felhasználónkénti kérésszámot:
  ```typescript
  const RATE_LIMIT = 30;
  const RATE_WINDOW_MS = 3600_000; // 1 óra
  ```
  Ha egy felhasználó 1 órán belül 30-nál több kérést indít, az Edge Function azonnal `HTTP 429 Too Many Requests` státusszal tér vissza.

### 2.4. Dinamikus Rendszerprompt és Kontextus-Injektálás
- A rendszerprompt deklarálja a magyar jogi és bérszámfejtési környezetet (Mt., Szja tv., Tbj., Szocho tv., Art., Efo tv.) és a **2026-os sarokszámokat** (minimálbér: 322 800 Ft, garantált bérminimum: 382 200 Ft, duplázott családi kedvezmények).
- A kliens a kérés törzsében átadja az aktuális kontextust: `{ context: { page, clientName } }`.
- Az Edge Function ezt dinamikusan összefűzi a rendszerprompっとtal:
  ```typescript
  if (context?.clientName) systemPrompt += `\n\nAz aktuális ügyfél: ${context.clientName}`;
  if (context?.page) systemPrompt += `\nAz aktuális oldal: ${context.page}`;
  ```

### 2.5. Aszinkron Költségelszámolás (`llm_koltsegek`)
A stream lezárásakor (a `ReadableStream` `finally` ágában) az Edge Function aszinkron bejegyzést hoz létre a Supabase `llm_koltsegek` táblájában:
- `pipeline`: `'accounty_ai_chat'`
- `model_name`: az aktív modell (`deepseek-chat` vagy `gpt-4o-mini`)
- `input_tokens`, `output_tokens`: felhasznált tokenek száma
- `estimated_cost_usd`: az aktuális modell árazása alapján számított költség
- `user_id`: a hívást kezdeményező könyvelő azonosítója.

### 2.6. Adatbázis Séma és RLS Izoláció
- A beszélgetéseket két relációs tábla tárolja ([18-eaisybooks-ai.md](../database/18-eaisybooks-ai.md)):
  - `accounty_ai_chat_sessions` (felhasználónkénti szálak, automatikus címmel).
  - `accounty_ai_chat_messages` (egyes üzenetek, `session_id` cascade törléssel).
- **RLS házirend:** Csak a hitelesített felhasználó saját rekordjai érhetők el (`user_id = auth.uid()`). A névtelen elérés teljesen tiltott (`REVOKE ALL FROM anon`).

### 2.7. Újrafelhasználhatóság a Platformon
Az `accounty-ai-chat` Edge Function központi mikroszolgáltatásként működik, amelyet más eaisyBooks komponensek is felhasználnak:
- [PnlAiAssistant.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/pnl/PnlAiAssistant.tsx) — P&L kimutatás menedzseri elemzés és adóoptimalizálás.
- [EvDepreciationPage.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/Accounty/Ev/EvDepreciationPage.tsx) — Tárgyi eszköz amortizációs kulcs és módszer becslés az Szja tv. 11. melléklete alapján.
- [TenyImportModal.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ev/TenyImportModal.tsx) — Tárgyi eszköz import kötegelt AI felismerése.

### 2.8. Tudástár RAG (Retrieval-Augmented Generation) Integráció
A rendszer funkcióival kapcsolatos kérdések pontos, hallucinációmentes megválaszolására az Edge Function közvetlen RAG csatolást kapott a [knowledge_base_articles](../database/18-eaisybooks-ai.md) táblához és a `search_knowledge_base` PostgreSQL RPC-hez:
1. **Lekérdezés elemzés:** A felhasználó legutóbbi üzenetéből és az aktív oldal útvonalából (`context.page`) az Edge Function kinyeri a keresési szándékot.
2. **Kombinált FTS és Page Context lekérdezés:** A `search_knowledge_base(search_query, page_path, target_category, match_limit => 3)` RPC magyar nyelvi tokenizációval, stop-szavak kiszűrésével és `ts_rank` pontozással azonosítja a releváns cikkeket. Az aktív oldal cikke garantált prioritást kap (`rank: 1.0`).
3. **Rendszerprompt injektálás:** A releváns cikkek kivonata (`summary`, valamint max 1800 karakter tiszta `content`) bekerül a dinamikus rendszerprompt `HIVATALOS EAISYBILL / EAISYBOOKS TUDÁSTÁR` szekciójába.
4. **Grounded és Természetes Válaszadás:** Az LLM szigorú tiltást kapott technikai URL útvonalak (pl. `/eaisybooks/prompts`, `/invoices`) és mesterkélt *"Ugrás a funkcióhoz:"* sablonok generálására. Kizárólag a valós, felületen látható magyar menü- és modulnevekre (pl. *„a bal oldali menüben a Kategóriák menüpontban”*, *„a Bizonylatok menüpontban”*) hivatkozik természetes szövegezéssel.

### 2.9. Felhasználói Visszajelzés és RAG Tuning Feedback Hurok
A belső tudásbázis és a promptok folyamatos, adatvezérelt finomhangolása érdekében minden asszisztens válasz aljára beépült a felhasználói visszajelzési hurok:
- **Adatbázis mezők (`accounty_ai_chat_messages`):** `is_helpful` (boolean), `feedback_reason` (text), `feedback_at` (timestamptz).
- **Parciális index:** `idx_accounty_ai_chat_messages_feedback` a gyors adminisztrátori lekérdezésekhez.
- **Frontend Widget ([MessageFeedbackWidget.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ai/MessageFeedbackWidget.tsx)):** Diszkrét, mikro-interakciós komponens ("Hasznos volt ez a válasz?: Igen / Nem"). Negatív szavazat esetén gyorscímkék (pl. *Pontatlan információ*, *Nem válaszolt a kérdésre*, *Elavult vagy hiányos adat*) és opcionális megjegyzés mező segíti az ok azonosítását.
- **RAG Tuning Nézet (`view_ai_chat_feedback_reports`):** Automatikusan összerendeli az AI választ az azt megelőző felhasználói kérdéssel, az értékeléssel és az indoklással (`security_invoker = true`), lehetővé téve a hiányzó vagy hibás tudástár cikkek azonnali azonosítását.

### 2.10. Élő Cégkontextus & Pénzügyi Pillanatkép (Live Business Data Layer)
A rendszer funkcionális kérdésein túl az asszisztens képes a kiválasztott vállalkozás valós idejű pénzügyi adatait is elemezni:
- **`get_company_live_ai_context` RPC:** PostgreSQL függvény, amely aggregálja az adott cég nyitott és lejárt szállítói tartozásait, vevői kintlévőségeit, legfontosabb határidős tételeit és párosítatlan banki tranzakcióit.
- **Cégválasztó Tokenek (`<<COMPANY_SELECT:id|name>>`):** Ha a felhasználó több céghez tartozik és konkrét cég megjelölése nélkül kérdez pénzügyi adatot, az asszisztens nem találgat, hanem interaktív cégválasztó gombokat fűz a válaszához, amelyekre kattintva a csevegés azonnal a célzott céggel folytatódik.

### 2.11. Komponens Dekompozíció és Teljesítmény-optimalizáció
- **Különválasztott Chat Komponens ([AiAssistantChat.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ai/AiAssistantChat.tsx)):** A korábbi monolitikus `AiAssistantPage.tsx` szétbontásra került: a teljes állapotkezelés, a TanStack Query szinkron, az SSE stream dekódolás (`buffer` csomaghatár-védelemmel) és a csevegő UI a dedikált `AiAssistantChat` modulba került.
- **Könnyűsúlyú Page Wrapper ([AiAssistantPage.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/Accounty/AiAssistantPage.tsx)):** Letisztult, mindössze ~36 soros route komponens.
- **Lazy Drawer import:** Az [AiAssistantDrawer.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ai/AiAssistantDrawer.tsx) közvetlenül a chat komponenst tölti be önálló Vite chunkként (`36.79 kB`), elkerülve a teljes oldalcsomag felesleges betöltését.
- **Görgetési pozícióvédelem:** A globális `ScrollToTop` ([src/routes/shellComponents.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/routes/shellComponents.tsx)) kizárja az AI konténereket (`[data-ai-chat="true"]`), így az oldalháttér frissítése vagy navigáció nem ugrasztja fel a csevegést a kezdőpontra.

---

## 3. Következmények és Értékelés

**Pozitív következmények:**
* **Kiemelkedő sebesség:** Az SSE streaming miatt az első válaszkarakterek 1-2 másodpercen belül megjelennek a felületen.
* **Alacsony költség:** A DeepSeek integráció drasztikusan olcsóbbá teszi az üzemeltetést, miközben az OpenAI fallback garantálja az üzembiztonságot.
* **Szigorú adatvédelem:** Az RLS és az anonimizált kontextus garantálja, hogy érzékeny adatok ne szivárogjanak át más ügyfelekhez.
* **Precíz költségkontroll:** A memóriabeli rate limiting és az `llm_koltsegek` tábla teljes transzparenciát ad a vezetőségnek.

**Kompromisszumok:**
* Az in-memory felhasználói rate limit Edge Function instance újraindulásakor törlődik. Mivel ez ritkán történik és a cél elsősorban a spamelés megelőzése, a gyorsaság érdekében eltekintettünk a nehézkes adatbázis-alapú kérés-számlálástól.

---

## Kapcsolódó
- **BRD Döntés:** [Decision 055: eaisyBooks AI Asszisztens Chat](../../business/decisions/055-eaisybooks-ai-assistant-chat.md)
- **PRD Döntés:** [P-077: eaisyBooks AI Asszisztens Chat és Speed Dial UX](../../product/decisions/P-077-eaisybooks-ai-assistant-chat-and-speed-dial-ux.md)
- **Edge Functions Katalógus:** [docs/architecture/edge-functions.md](../edge-functions.md)
- **Adatbázis sémadokumentum:** [docs/architecture/database/18-eaisybooks-ai.md](../database/18-eaisybooks-ai.md)
