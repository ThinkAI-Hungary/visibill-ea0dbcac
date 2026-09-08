# P-077: [eaisyBooks] AI Asszisztens Chat és Speed Dial Lebegő Menü UX

**Status:** Decided  
**Category:** eaisyBooks & UI Workflow  
**Kapcsolódó döntések:** [P-031: eaisyBooks Layout](./P-031-accounty-layout.md), [P-035: Ticket System](./P-035-ticket-system.md), [Decision 055](../../business/decisions/055-eaisybooks-ai-assistant-chat.md), [A-104](../../architecture/decisions/A-104-eaisybooks-ai-chat-streaming-and-edge-architecture.md)

**Question:** Hogyan biztosítsuk, hogy az AI könyvelői asszisztens bármely eaisyBooks munkafolyamatból azonnal, kontextusvesztés nélkül elérhető legyen, miként integráljuk a meglévő hibabejelentő funkcióval a jobb alsó sarokban, és milyen felületi elemek támogassák a többmenetes beszélgetéseket és a szakmai gyorsműveleteket?

**Decision:**

1. **Lebegő Akciógomb (Speed Dial FAB) Architektúra:**
   - A jobb alsó sarokban elhelyezett [FeedbackFab.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/FeedbackFab.tsx) adaptív működésű:
     - **eaisyBill nézetben:** Egyetlen kör alakú gomb marad (`MessageSquareText` ikon), amely közvetlenül a [FeedbackDialog.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/FeedbackDialog.tsx) hibabejelentő modalt nyitja meg.
     - **eaisyBooks nézetben:** Ha a komponens megkapja az `onAiOpen` propot az [AccountyLayout.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/Accounty/AccountyLayout.tsx) layoutból, automatikusan **Speed Dial** menüként viselkedik.
   - **Kinyitott Speed Dial menüpontok:**
     1. **AI Asszisztens:** Lila-fukszia gradiens háttér (`from-violet-500 to-fuchsia-600`), `Sparkles` ikonnal. Felirata zárt drawer esetén *„AI Asszisztens”*, nyitott fiók esetén *„AI bezárása”*.
     2. **Hibabejelentés:** Borostyánsárga háttér (`bg-amber-500`), `Bug` ikonnal, amely megnyitja a hibajegybeküldő modalt.
     3. **Bezáró gomb:** A fő `+` gomb 45 fokkal elfordulva `X` állapotba lép.

2. **Kettős Megjelenítési Mód (Drawer & Full Page):**
   - **Slide-over fiók (Drawer mód):**
     - Bármely `/eaisybooks/*` oldalon megnyitható anélkül, hogy a könyvelő elveszítené az aktuális munkaterületét vagy űrlapadatait.
     - 420 px széles, jobbról becsúszó panel modern glassmorphism stílusban (`backdrop-blur-xl`, `border-l border-border/50`).
     - Fejlécében helyet kap egy **„Teljes nézet”** gomb (amely átnavigál a teljes képernyős oldalra, automatikusan becsukva a drawert) és egy bezáró `X`.
   - **Dedikált Teljes Képernyős Oldal (Full Page mód):**
     - Elérhető a `/eaisybooks/ai-assistant` útvonalon, valamint az eaisyBooks Sidebar *AI Asszisztens* menüpontjából.
     - Teljes magasságú képernyő (`h-[calc(100vh-120px)]`), amely kényelmes olvasási felületet biztosít hosszú jogszabály-elemzésekhez és táblázatokhoz.

3. **Többmenetes Beszélgetéskezelés (Conversation Sidebar):**
   - A chat felület bal oldalán egy összehúzható előzmény panel (`ConversationSidebar`) kapott helyet.
   - **Funkciók:**
     - Új beszélgetés indítása a `+` gombbal.
     - Korábbi beszélgetések listázása relatív időbélyeggel (pl. *„most”*, *„12 perce”*, *„tegnap”*).
     - Beszélgetés törlése a tételen lebegő kuka (`Trash2`) ikonnal.
     - **Automatikus elnevezés:** Az első elküldött kérdésből a rendszer automatikusan címet generál (50 karakternél levágva).
     - **Kontextus-megőrzés:** Az aktív munkamenet ID-je a `localStorage`-ben tárolódik (`eaisybooks_active_chat_session_id`), így az eaisyBooks aloldalai közötti navigáció vagy a fiók újranyitása során a csevegés azonnal visszaáll.

4. **Szakmai Gyorsműveletek (Quick Action Kártyák):**
   - Üres beszélgetés indításakor a képernyő közepén 4 előre definiált, egykattintásos szakmai prompt kártya jelenik meg:
     - **Családi kedvezmény optimalizáció** (`Zap` ikon) — 2026-os szabályok és szülők közötti optimális megosztás.
     - **Bér anomália-detekció** (`BarChart3` ikon) — Havi bérszámfejtési hibák és eltérések ellenőrzése beküldés előtt.
     - **KIVA vs TAO adótervezés** (`FileCheck` ikon) — Kisvállalati adó választási szempontok elemzése.
     - **2608-as bevallás ellenőrzés** (`BookOpen` ikon) — Havi járulékbevallási hibák megelőzése.

5. **Streaming, Biztonság és Ergonómia:**
   - **Valós idejű token streaming:** SSE olvasó segítségével folyamatosan jelenik meg a válasz szövege, a végén pulzáló lila kurzorral.
   - **Leállítási lehetőség:** Generálás közben a küldés gomb helyén egy piros leállító gomb (`Square`) jelenik meg, amellyel a stream azonnal megszakítható (`AbortController`).
   - **Másolás vágólapra:** Az asszisztens üzeneteinek jobb felső sarkában lebegő másolás gomb található, amely azonnali toast visszajelzést ad.
   - **Biztonsági Markdown renderelés:** A renderelő függvény HTML sanitization lépést végez (`&lt;`, `&gt;` stb. csere) az XSS injekciók ellen, majd támogatja a félkövér, dőlt, kódblokk (`code`), kiemelt címsor (`h3`) és számozott/pontozott listákat.
   - **GDPR figyelmeztető sáv:** A chat terület tetején fix sárga sáv jelzi: *„Az AI válaszok tájékoztató jellegűek, nem minősülnek jogi tanácsadásnak. A foglalkoztatottak személyes adatait nem küldjük a szolgáltatónak.”*
   - **Kliens oldali flood védelem:** 3 másodpercen belüli ismételt küldés esetén figyelmeztető hibaüzenetet kap a felhasználó.

**Current Implementation:**
- [src/components/FeedbackFab.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/FeedbackFab.tsx) — Speed Dial FAB logika és animációk.
- [src/pages/Accounty/AccountyLayout.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/Accounty/AccountyLayout.tsx) — Slide-over Drawer konténer és állapot.
- [src/pages/Accounty/AiAssistantPage.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/Accounty/AiAssistantPage.tsx) — Chat komponens, streaming reader, quick actions és sidebar.
- [src/hooks/useAiChatSessions.ts](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useAiChatSessions.ts) — React Query perzisztencia hook.

**Rationale:** A könyvelők számára a kontextusvesztés a legnagyobb hatékonysággyilkos tényező. A slide-over fiók segítségével az adó- vagy bérszabályok ellenőrzése anélkül végezhető el, hogy el kellene hagyni az aktuálisan szerkesztett céget vagy bizonylatot. A Speed Dial menü pedig elegánsan, egyetlen lebegő gombban egyesíti a rendszerhibák bejelentését és az intelligens szakmai segítségkérést.

---

## Kapcsolódó
- **BRD Döntés:** [Decision 055: eaisyBooks AI Asszisztens Chat](../../business/decisions/055-eaisybooks-ai-assistant-chat.md)
- **ADR:** [A-104: eaisyBooks AI Chat Streaming és Edge Architektúra](../../architecture/decisions/A-104-eaisybooks-ai-chat-streaming-and-edge-architecture.md)
- **Adatbázis sémadokumentum:** [docs/architecture/database/18-eaisybooks-ai.md](../../architecture/database/18-eaisybooks-ai.md)
