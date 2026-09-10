# P-035: Hibajegy UI és Workflow

**Status:** Decided  
**Category:** Ügyfélszolgálat & Support  
**BRD Reference:** Decision 036 (Hibajegy rendszer)  
**Utolsó frissítés:** 2026-09-03

**Question:** Hogyan néz ki a hibajegy rendszer felülete?

**Decision:** Beépített in-app ticket rendszer, elérhető a fő app-ból és az Accounty-ból is.

**Current Implementation:**
- `FeedbackDialog.tsx` — Lebegő gyorsgombból és menükből elérhető visszajelzés beküldő modal:
  - Szélesség: `sm:max-w-[720px]`, asztali nézeten 2 oszlopos reszponzív grid a választómezőkhöz (Cég, Szolgáltatás, Típus, Prioritás)
  - Rich Text szerkesztő (`RichTextEditor`): formázott szövegbevitel (félkövér, dőlt, listák, címsorok, idézet, kód)
  - Állapotkezelés: automatikus `resetForm` és `editorKey` léptetés az `open` prop változásakor (megelőzve a korábbi form vagy confirmation beragadást)
  - Beküldés utáni megerősítés: zöld pipás siker ablak, ahol a „Bezárás” mellett elérhető az „Újabb visszajelzés” gomb is közvetlen sorozatos beküldéshez
- `TicketsPage.tsx` — több route-ról elérhető:
  - `/:companyId/:dateRange/tickets/:ticketId?` (fő app)
  - `/accounty/tickets/:ticketId?` (Accounty)
  - `/tickets/:ticketId?` (standalone)
  - `/management?view=tickets` (Management Dashboard, beágyazva)
- Management hibajegy nyitás ügyfél nevében (`ManagementCreateTicketDialog.tsx`): a Management Dashboard felületén a sub-tabs sávból indítható `+ Új hibajegy nyitása`, amellyel a support admin célfelhasználó nevében rögzíthet jegyet auto-fill cégválasztással, formázott leírással és csatolmányokkal (részletek: [P-070](./P-070-management-impersonated-ticket-creation-ux.md), [A-089](../../architecture/decisions/A-089-management-ticket-creation-on-behalf-of-user.md))
- Ticket típusok: Hibajelentés (bug), Visszajelzés (feedback), Kérdés (question)
- Ticket státuszok (4 szintű életciklus — új színpaletta & kapszula badge-ek):
  - **Nyitott** (`created` / legacy `new`, `open`): beérkezett hibajegy, még nincs felelőse (égszínkék • Sky Blue, `bg-sky-500/10 text-sky-600 border-sky-500/25`)
  - **Hozzárendelt** (`assigned`): felelős support munkatárs kijelölve (királykék / kobalt • Royal Cobalt Blue, `bg-blue-600/15 text-blue-600 border-blue-500/30`)
  - **Folyamatban** (`in_progress`): aktív munka és megoldás folyamatban (pávakék / zöldeskék • Teal, `bg-teal-500/10 text-teal-600 border-teal-500/30`)
  - **Megoldva** (`resolved`): a hibajegy sikeresen megoldva és lezárva (smaragdzöld • Emerald, `bg-emerald-500/10 text-emerald-600 border-emerald-500/25`)
  - *Automatikus státuszváltás:* Nyitott jegyhez rendelt felelős esetén automatikusan Hozzárendelt státuszra vált; felelős visszavonásakor visszatér Nyitott státuszra.
  - *Státusz és Prioritás badge-ek kialakítása:* Egységes, fix szélességű (`w-[96px]`), letisztult ikon nélküli kapszula (`rounded-full`) forma, tökéletesen összehangolt színvilággal.
  - *Szekciók & Táblázat forma:* Felhasználói oldalon a táblázat és a jegy részletes nézetének (`TicketDetailView`) kártyái, szekciói éles, szögletes (`rounded-none shadow-none`) formavilágot követnek.
- Ticket prioritás: alacsony/közepes/magas/kritikus — user választhatja beküldéskor
- Ticket lista: kereshető (jegyszám, üzenet, cég, email), szűrhető (multi-status: Nyitott, Hozzárendelt, Folyamatban, Megoldva, prioritás, platform)
  - Olvasatlan jegyek vizuális kiemelése: az olvasatlan sorok finom elsődleges színkiemelést (`bg-primary/[0.06] hover:bg-primary/[0.12]`) kapnak.
  - Felelős oszlop: fix szélességű (`w-[180px] min-w-[170px]`), megtiltva a nevek sortörését (`whitespace-nowrap`).
  - Keresés: a `stripHtml(t.message)` használatával a tiszta szövegben keres, kiszűrve a HTML tageket és stílusosztályokat a pontos találatokért
  - Tárgy és előnézet formázás: `getTicketSummary(ticket.message)` intelligens szóhatár-tördelést (~55 karakter) és bekezdés-összevonást alkalmaz, megszüntetve a nyers HTML tagek (`<p>`, `</p>`, `<ol>`, `<li>`, entitások) megjelenését és a szavak félbevágását a táblázatban, Kezelőkonzol oldalsávban és a Terhelés & Elosztás nézetben
- Pagináció: 15 jegy/oldal (sima user), 25 jegy/oldal (support admin)
- Multi-status szűrő: egyszerre több státusz szűrhető (Nyitott, Hozzárendelt, Folyamatban, Megoldva) — Popover + Checkbox UI
- Ticket részletek (`TicketDetailView.tsx`):
  - Üzenet és hozzászólás megjelenítés: formázott HTML renderelés (`RichTextContent`), Tailwind typography stílusokkal és plain text fallbackkel
  - Hozzászólás szerkesztő: `RichTextEditor` (félkövér, dőlt, listák, címsorok, idézet, kód, `Ctrl+Enter` gyorsbillentyűvel azonnali beküldés)
  - Közvetlen csatolmánykezelés a nyitott jegyhez: a fejlécben lévő `+ Csatolmány hozzáadása` gombbal utólag is csatolhatók képek és dokumentumok (PDF, CSV, XLS, XLSX) a jegyhez, illetve jogosultsággal törölhetők
  - Új prémium előnézeti kártyák: négyzetes képnézet, lebegő kapszulás eszköztár (`Eye` előnézet és `Trash2` törlés), fájlnév felirat, dokumentum jelvények
  - Egységes App Tooltip Rendszer: natív HTML `title="..."` buborékok helyett az app egységes Radix/shadcn `<Tooltip>` komponensei az eszköztárban, kártyákon, linkeken és műveletgombokon
  - Clipboard paste: Ctrl+V a hozzászólás mezőben képet csatol vágólapról
  - Fullscreen galéria: Portal-alapú overlay (z-index: 9999), teljes képernyős képnézegető billentyűzet-navigációval (Escape, Nyilak) és letöltési funkcióval
- Unread badge: `useUnreadTicketCount` hook — olvasatlan ticketek száma a sidebar-ban
- Felelős kijelölés: support admin hozzárendelhet support agentet, változás logolódik a timeline-ban
- Jegy történet (Timeline): státusz változás (Nyitott → Hozzárendelt → Folyamatban → Megoldva), felelős változás, kommentek — actor névvel
- Kezelőkonzol (Console View): Support munkatársak számára optimalizált 2-hasábos osztott nézet (`TicketsPage.tsx`). Bal oldalon a szűrhető, kereshető queue (max-h korlátozott, dedikált belső scrollal `max-h-[calc(100vh-16rem)] min-h-0`), jobb oldalon a jegy tartalom (8 oszlop) és mellette a Részletek kártya alatta az Idővonallal (4 oszlop, max 50vh scrollal).
- ThinkAI márka jelvény (`ThinkAiBadge`): A kezdeményező ThinkAI support operátorok neve mellett diszkrét, modern SVG monogram (`T`) jelenik meg `iconOnly` módban, jelezve a hivatalos support minőséget felesleges szöveges ismétlés nélkül.

**Rationale:** Egy beépített ticket rendszer gyorsabb visszajelzési ciklust biztosít mint az email, és kontextust ad a fejlesztőknek (melyik oldalon, melyik cég kontextusban keletkezett a hiba).
