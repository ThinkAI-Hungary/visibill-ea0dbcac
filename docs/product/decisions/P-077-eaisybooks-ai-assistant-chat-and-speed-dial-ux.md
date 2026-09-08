# P-077: [eaisyBill & eaisyBooks] Kettős Lebegő Akciógomb (Dual FAB) és AI Asszisztens Chat UX

**Status:** Decided (Updated)  
**Category:** UI Workflow & AI Integration  
**Kapcsolódó döntések:** [P-031: eaisyBooks Layout](./P-031-accounty-layout.md), [P-035: Ticket System](./P-035-ticket-system.md), [Decision 055](../../business/decisions/055-eaisybooks-ai-assistant-chat.md), [A-104](../../architecture/decisions/A-104-eaisybooks-ai-chat-streaming-and-edge-architecture.md)

**Question:** Hogyan biztosítsuk, hogy az AI könyvelői asszisztens és a hibabejelentő funkció bármely eaisyBill és eaisyBooks munkafolyamatból azonnal, közvetlenül (további kinyitó kattintások nélkül) elérhető legyen, miként helyezzük el a két különálló buborékot, és hogyan működjön a fiók megnyitásakor az elrendezés animációja?

**Decision:**

1. **Kettős Lebegő Akciógomb (Dual FAB) Architektúra:**
   - Mind az **eaisyBill**, mind az **eaisyBooks** felületen két önálló, közvetlenül kattintható lebegő gomb kapott helyet a jobb alsó sarokban vertikálisan elrendezve (`fixed bottom-6 z-50 flex flex-col items-end gap-3`):
     1. **Felső buborék — AI Chat Asszisztens (`#ai-assistant-fab`):**
        - Zárt állapotban fintech teal gradiens háttér (`bg-gradient-to-br from-teal-500 via-teal-600 to-emerald-600`), `Bot` ikonnal és finoman pulzáló fényudvarral.
        - Kattintásra azonnal megnyitja / becsukja a slide-over [AiAssistantDrawer.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ai/AiAssistantDrawer.tsx) fiókot.
        - **Nyitott drawer állapotban tokenizált stílus:** A bezáró gomb az alkalmazás hivatalos design tokenjeit veszi fel (`bg-card text-foreground border border-border/80 shadow-lg shadow-black/5 dark:shadow-black/30 hover:border-primary/50 hover:bg-primary/5 hover:text-primary`), a benne lévő `X` ikon diszkrét `text-muted-foreground`, amely rávitelkor elfordul 90 fokkal és fintech teal kiemelést kap. Tooltip: *„AI bezárása”*.
     2. **Alsó buborék — Visszajelzés küldése (`#feedback-fab`):**
        - Visibill primary kék háttér (`bg-primary text-primary-foreground`), `MessageSquareText` ikonnal.
        - Kattintásra közvetlenül megnyitja a [FeedbackDialog.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/FeedbackDialog.tsx) hibajegybeküldő modalt.
        - **Nyitott AI fiók esetén:** A visszajelzés gomb automatikusan rejtve van (`isAiOpen && "hidden"`), így kizárólag a letisztult bezáró gomb lebeg a fiók mellett, megelőzve a vizuális zajt és a félrekattintást.
   - **Dinamikus animáció nyitott fiók esetén:**
     - Amikor az AI fiók kinyílik (440 px szélesség), a gomb asztali képernyőn zökkenőmentes animációval balra tolódik (`md:right-[456px]`, illetve kinyitott előzmény flyout esetén `md:right-[736px]`), így nem takarja ki a csevegő felületet.
     - Mobilon a fiók kitölti a képernyőt, a lebegő gombok pedig automatikusan rejtve maradnak a zavartalan csevegés érdekében.

2. **Kettős Megjelenítési Mód (Drawer & Full Page):**
   - **Slide-over fiók (Drawer mód):**
     - Bármely `/eaisybooks/*` oldalon megnyitható anélkül, hogy a könyvelő elveszítené az aktuális munkaterületét vagy űrlapadatait.
     - 420 px (sm) / 440 px (md) széles, jobbról becsúszó panel (`bg-card border-l border-border shadow-[-8px_0_24px_-4px_rgba(0,0,0,0.12)]`).
     - Fejlécében helyet kap a bezáró `X`, a fiók törzsében pedig lazy-loadolva jelenik meg a dedikált [AiAssistantChat.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ai/AiAssistantChat.tsx).
   - **Dedikált Teljes Képernyős Oldal (Full Page mód):**
     - Elérhető a `/eaisybooks/ai-assistant` útvonalon, valamint az eaisyBooks Sidebar *AI Asszisztens* menüpontjából.
     - Teljes magasságú képernyő (`h-[calc(100vh-120px)]`), amely kényelmes olvasási felületet biztosít hosszú jogszabály-elemzésekhez és táblázatokhoz.

3. **Többmenetes Beszélgetéskezelés (Conversation Sidebar):**
   - A chat felület bal oldalán egy összehúzható előzmény panel (`ConversationSidebar`) kapott helyet.
   - **Funkciók:**
     - Új beszélgetés indítása a `+` gombbal (lazy munkamenet indítás az első kérdés elküldésekor).
     - Korábbi beszélgetések listázása relatív időbélyeggel (pl. *„most”*, *„12 perce”*, *„tegnap”*).
     - Beszélgetések közötti váltáskor skeleton loader (`ChatMessagesSkeleton`, `SidebarSessionsSkeleton`).
     - Beszélgetés törlése a tételen lebegő kuka (`Trash2`) ikonnal.
     - **Automatikus elnevezés:** Az első elküldött kérdésből a rendszer automatikusan címet generál (50 karakternél levágva).
     - **Kontextus-megőrzés:** Az aktív munkamenet ID-je a `localStorage`-ben tárolódik (`eaisybooks_active_chat_session_id`), így navigáció után azonnal folytatható a csevegés.

4. **Szakmai Gyorsműveletek (Quick Action Kártyák):**
   - Üres beszélgetés indításakor a képernyő közepén 4 előre definiált, egykattintásos szakmai prompt kártya jelenik meg:
     - **Családi kedvezmény optimalizáció** (`Zap` ikon) — 2026-os szabályok és szülők közötti optimális megosztás.
     - **Bér anomália-detekció** (`BarChart3` ikon) — Havi bérszámfejtési hibák és eltérések ellenőrzése beküldés előtt.
     - **KIVA vs TAO adótervezés** (`FileCheck` ikon) — Kisvállalati adó választási szempontok elemzése.
     - **2608-as bevallás ellenőrzés** (`BookOpen` ikon) — Havi járulékbevallási hibák megelőzése.

5. **Streaming, Biztonság és Ergonómia:**
   - **Valós idejű token streaming:** SSE olvasó segítségével folyamatosan jelenik meg a válasz szövege, csomaghatár-biztos `buffer` feldolgozással.
   - **Leállítási lehetőség:** Generálás közben a küldés gomb helyén egy piros leállító gomb (`Square`) jelenik meg, amellyel a stream azonnal megszakítható (`AbortController`).
   - **Másolás vágólapra:** Az asszisztens üzeneteinek jobb felső sarkában lebegő másolás gomb található, amely azonnali toast visszajelzést ad.
   - **Válasz visszajelzés (Feedback Widget):** Beépített [MessageFeedbackWidget.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ai/MessageFeedbackWidget.tsx) minden lezárt válasz alján ("Hasznos volt?"), gyorscímkékkel és RAG tuning jelentésekkel.
   - **Biztonsági Markdown renderelés:** A renderelő függvény HTML sanitization lépést végez (`&lt;`, `&gt;` stb. csere) az XSS injekciók ellen, majd támogatja a félkövér, dőlt, kódblokk (`code`), kiemelt címsor (`h3`) és számozott/pontozott listákat.
   - **GDPR figyelmeztető sáv:** A chat terület tetején fix sárga sáv jelzi: *„Az AI válaszok tájékoztató jellegűek, nem minősülnek jogi tanácsadásnak.”*
   - **Kliens oldali flood védelem:** 2 másodpercen belüli ismételt küldés esetén figyelmeztető hibaüzenetet kap a felhasználó.

**Current Implementation:**
- [src/components/FeedbackFab.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/FeedbackFab.tsx) — Kettős lebegő buborék (Dual FAB) token-alapú zárógombbal és intelligens elrejtéssel.
- [src/components/ai/AiAssistantDrawer.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ai/AiAssistantDrawer.tsx) — Slide-over AI fiók konténer közvetlen moduláris lazy importtal.
- [src/components/ai/AiAssistantChat.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ai/AiAssistantChat.tsx) — Kiszervezett önálló csevegő komponens, streaming reader, quick actions és sidebar.
- [src/components/ai/MessageFeedbackWidget.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ai/MessageFeedbackWidget.tsx) — Visszajelző modul.
- [src/pages/Accounty/AiAssistantPage.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/Accounty/AiAssistantPage.tsx) — Letisztult routing wrapper.
- [src/hooks/useAiChatSessions.ts](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useAiChatSessions.ts) — React Query perzisztencia hook optimista frissítésekkel.

**Rationale:** A könyvelők és vállalkozók számára a kontextusvesztés a legnagyobb hatékonysággyilkos tényező. A közvetlenül kattintható két lebegő gombnak köszönhetően nincs szükség előzetes menünyitogatásra: a felhasználó egyetlen kattintással hibát jelenthet be vagy szakmai segítséget kérhet az AI-tól. A slide-over fiók segítségével az adó- vagy bérszabályok ellenőrzése anélkül végezhető el, hogy el kellene hagyni az aktuálisan szerkesztett céget vagy bizonylatot.

---

## Kapcsolódó
- **BRD Döntés:** [Decision 055: eaisyBooks AI Asszisztens Chat](../../business/decisions/055-eaisybooks-ai-assistant-chat.md)
- **ADR:** [A-104: eaisyBooks AI Chat Streaming és Edge Architektúra](../../architecture/decisions/A-104-eaisybooks-ai-chat-streaming-and-edge-architecture.md)
- **Adatbázis sémadokumentum:** [docs/architecture/database/18-eaisybooks-ai.md](../../architecture/database/18-eaisybooks-ai.md)
