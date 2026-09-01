# P-035: Hibajegy UI és Workflow

**Status:** Decided  
**Category:** Ügyfélszolgálat & Support  
**BRD Reference:** Decision 036 (Hibajegy rendszer)  
**Utolsó frissítés:** 2026-09-01

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
- Ticket típusok: Hibajelentés (bug), Visszajelzés (feedback), Kérdés (question)
- Ticket prioritás: alacsony/közepes/magas/kritikus — user választhatja beküldéskor
- Ticket lista: kereshető (jegyszám, üzenet, cég, email), szűrhető (multi-status, prioritás, platform)
- Pagináció: 15 jegy/oldal (sima user), 25 jegy/oldal (support admin)
- Multi-status szűrő: egyszerre több státusz szűrhető (pl. Új + Folyamatban) — Popover + Checkbox UI
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
- Jegy történet (Timeline): státusz változás (Új → Folyamatban), felelős változás, kommentek — actor névvel

**Rationale:** Egy beépített ticket rendszer gyorsabb visszajelzési ciklust biztosít mint az email, és kontextust ad a fejlesztőknek (melyik oldalon, melyik cég kontextusban keletkezett a hiba).
