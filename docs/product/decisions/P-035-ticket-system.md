# P-035: Hibajegy UI és Workflow

**Status:** Decided  
**Category:** Ügyfélszolgálat & Support  
**BRD Reference:** Decision 036 (Hibajegy rendszer)  
**Utolsó frissítés:** 2026-09-11

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
- Ticket státuszok (5 szintű életciklus — új színpaletta & kapszula badge-ek):
  - **Nyitott** (`created` / legacy `new`, `open`): beérkezett hibajegy, még nincs felelőse (égszínkék • Sky Blue, `bg-sky-500/10 text-sky-600 border-sky-500/25`)
  - **Hozzárendelt** (`assigned`): felelős support munkatárs kijelölve (királykék / kobalt • Royal Cobalt Blue, `bg-blue-600/15 text-blue-600 border-blue-500/30`)
  - **Folyamatban** (`in_progress`): aktív munka és megoldás folyamatban (pávakék / zöldeskék • Teal, `bg-teal-500/10 text-teal-600 border-teal-500/30`)
  - **Visszaigazolásra vár** (`waiting_confirmation`): a support admin elkészült a megoldással és megerősítést kért az ügyféltől (borostyánsárga • Amber, `bg-amber-500/10 text-amber-600 border-amber-500/30 whitespace-nowrap px-3 py-0.5`)
  - **Megoldva** (`resolved`): a hibajegy sikeresen megoldva és lezárva (smaragdzöld • Emerald, `bg-emerald-500/10 text-emerald-600 border-emerald-500/25`)
  - *Automatikus státuszváltás:* Nyitott jegyhez rendelt felelős esetén automatikusan Hozzárendelt státuszra vált; felelős visszavonásakor visszatér Nyitott státuszra. Ügyfél általi megerősítéskor automatikusan Megoldva státuszra vált.
  - *Státusz és Prioritás badge-ek kialakítása:* Letisztult, ikon nélküli kapszula (`rounded-full`) forma tökéletesen összehangolt színvilággal. A visszaigazolásra váró badge megnövelt paddingot és sortörés-védelmet (`whitespace-nowrap`) kapott.
  - *Szekciók & Táblázat forma:* Felhasználói oldalon a táblázat és a jegy részletes nézetének (`TicketDetailView`) kártyái, szekciói éles, szögletes (`rounded-none shadow-none`) formavilágot követnek.
- Ticket prioritás: alacsony/közepes/magas/kritikus — user választhatja beküldéskor
- Ticket lista: kereshető (jegyszám, üzenet, cég, email), szűrhető (multi-status: Nyitott, Hozzárendelt, Folyamatban, Megoldva, prioritás, platform)
  - Olvasatlan jegyek vizuális kiemelése: az olvasatlan sorok finom elsődleges színkiemelést (`bg-primary/[0.06] hover:bg-primary/[0.12]`) és pulzáló pontot kapnak.
  - Oszlop-elrendezés és középre igazítás: A `Státusz` és `Prioritás` oszlopok fejlécei és adatcellái tökéletesen szimmetrikusan középre zártak (`text-center flex justify-center items-center`). A `Státusz` oszlop `w-[170px] min-w-[165px]` szélességet kapott, biztosítva, hogy a hosszabb badge-ek is kényelmesen, egy sorban, pontosan a felirat alatt helyezkedjenek el.
  - Felelős oszlop: fix szélességű (`w-[180px] min-w-[170px]`), megtiltva a nevek sortörését (`whitespace-nowrap`).
  - Keresés (`matchTicketSearch`): támogatja a kettőskereszttel (`#EB-0094`) vagy anélkül (`EB-0094`) beírt jegyszámokat, a tiszta szövegre (`stripHtml`) tisztított leírást, tárgyat, felhasználónevet, email címet, cégnevet és a kijelölt felelőst. Mind a táblázat, mind a konzol keresőmezője azonnali törlés (`X`) gombbal van ellátva.
  - Tárgy és előnézet formázás: `getTicketSummary(ticket.message)` intelligens szóhatár-tördelést (~55 karakter) és bekezdés-összevonást alkalmaz, megszüntetve a nyers HTML tagek (`<p>`, `</p>`, `<ol>`, `<li>`, entitások) megjelenését és a szavak félbevágását a táblázatban, Kezelőkonzol oldalsávban és a Terhelés & Elosztás nézetben
- Pagináció: 15 jegy/oldal (sima user), 25 jegy/oldal (support admin)
- Multi-status szűrő: egyszerre több státusz szűrhető (Nyitott, Hozzárendelt, Folyamatban, Megoldva) — Popover + Checkbox UI
- Ticket részletek (`TicketDetailView.tsx`):
  - Megoldás-visszaigazolási Munkafolyamat (`TicketResolutionBanner.tsx`):
    - Ha a support jóváhagyást kér a klienstől (`waiting_for_user_confirmation = true`), a jegy tetején megjelenik a letisztult megerősítő banner.
    - Két egyértelmű opció a kliensnek: „Igen, a probléma megoldódott” (zöld kiemelt gomb) és „Nem, további segítségre van szükségem” (másodlagos gomb, indoklás bekérő modállal).
    - Jóváhagyáskor a rendszer automatikusan Megoldva státuszba helyezi a hibajegyet, megerősítő audit bejegyzést rögzít, és elhelyezi a hivatalos záró rendszerkommentet: *"Az ügyfél megerősítette: a probléma megoldódott. A hibajegy automatikusan lezárásra került."*
    - Support adminisztrátori nézetben a banner finom borostyánsárga információs jelvényként mutatja, hogy az ügyfél visszajelzésére várunk.
    - A support fejlécében elérhető a „Megoldás jóváhagyás kérése” műveleti gomb.
  - Törölt / Nem létező hibajegy 404 kezelése (`TicketNotFoundView`): Ha a hibajegy törlésre került az adatbázisból vagy a megadott azonosító nem létezik, a felület nem ragad be végtelenített skeleton loader állapotba, hanem egy letisztult, sötét módhoz illeszkedő belső 404 hibaoldal (`TicketNotFoundView`) fogadja a felhasználót `TicketX` ikonnal, leírással és egy kattintásos „Vissza a hibajegyekhez” navigációval.
  - Üzenet és hozzászólás megjelenítés: formázott HTML renderelés (`RichTextContent`), Tailwind typography stílusokkal és plain text fallbackkel
  - Hozzászólás szerkesztő: `RichTextEditor` (félkövér, dőlt, listák, címsorok, idézet, kód, `Ctrl+Enter` gyorsbillentyűvel azonnali beküldés)
  - Közvetlen csatolmánykezelés a nyitott jegyhez: a fejlécben lévő `+ Csatolmány hozzáadása` gombbal utólag is csatolhatók képek és dokumentumok (PDF, CSV, XLS, XLSX) a jegyhez, illetve jogosultsággal törölhetők
  - Új prémium előnézeti kártyák: négyzetes képnézet, lebegő kapszulás eszköztár (`Eye` előnézet és `Trash2` törlés), fájlnév felirat, dokumentum jelvények
  - Egységes App Tooltip Rendszer: natív HTML `title="..."` buborékok helyett az app egységes Radix/shadcn `<Tooltip>` komponensei az eszköztárban, kártyákon, linkeken és műveletgombokon
  - Clipboard paste: Ctrl+V a hozzászólás mezőben képet csatol vágólapról
  - Fullscreen galéria: Portal-alapú overlay (z-index: 9999), teljes képernyős képnézegető billentyűzet-navigációval (Escape, Nyilak) és letöltési funkcióval
- Unread badge & Realtime: `useUnreadTicketCount` hook — nemcsak az új kommentekre, hanem a megoldás-visszaigazolás kérésére és állapotváltozásaira is azonnal jelez a felhasználónak (+1 a sidebar-ban, kiemelés a listában)
- Felelős kijelölés: support admin hozzárendelhet support agentet, változás logolódik a timeline-ban
- Jegy történet (Timeline):
  - Folyamatos, elemenkénti összekötő vonal struktúra, amely dinamikus tartalom és görgetés esetén is stabilan összeköti az eseményeket
  - Eseménytípusok: státusz változás, felelős változás, kommentek, megoldás kérése (`resolution_requested`), megerősítése (`resolution_confirmed`) és elutasítása (`resolution_rejected`)
  - Duplikáció-szűrés: az automatikus záró kommenthez kapcsolódó `comment_added` esemény rejtve marad, így nem jelenik meg zavaró "Üzenetet írt" bejegyzés a megerősítés mellett
- Kezelőkonzol (Console View): Support munkatársak számára optimalizált 2-hasábos osztott nézet (`TicketsPage.tsx`). Bal oldalon a szűrhető, kereshető queue (max-h korlátozott, dedikált belső scrollal `max-h-[calc(100vh-16rem)] min-h-0`), jobb oldalon a jegy tartalom (8 oszlop) és mellette a Részletek kártya alatta az Idővonallal (4 oszlop, max 50vh scrollal).
- ThinkAI márka jelvény (`ThinkAiBadge`): A kezdeményező ThinkAI support operátorok neve mellett diszkrét, modern SVG monogram (`T`) jelenik meg `iconOnly` módban, jelezve a hivatalos support minőséget felesleges szöveges ismétlés nélkül.

**Rationale:** Egy beépített ticket rendszer gyorsabb visszajelzési ciklust biztosít mint az email, és kontextust ad a fejlesztőknek (melyik oldalon, melyik cég kontextusban keletkezett a hiba). Az ügyfél általi megerősítő folyamat garantálja, hogy egyetlen hibajegy se záródjon le a felhasználó valós jóváhagyása nélkül.
