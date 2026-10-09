# P-035: Hibajegy UI és Workflow

**Status:** Decided  
**Category:** Ügyfélszolgálat & Support  
**BRD Reference:** Decision 036 (Hibajegy rendszer)  
**Utolsó frissítés:** 2026-10-09 (Tárgymező, Kezelőkonzol Ergonómia, Markdown és Vágólap Támogatás)

**Question:** Hogyan néz ki a hibajegy rendszer felülete?

**Decision:** Beépített in-app ticket rendszer, elérhető a fő app-ból és az Accounty-ból is.

**Current Implementation:**
- `FeedbackDialog.tsx` — Lebegő gyorsgombból és menükből elérhető visszajelzés beküldő modal:
  - Szélesség: `sm:max-w-[720px]`, asztali nézeten reszponzív grid a választómezőkhöz (Cég, Szolgáltatás, Típus, Prioritás és opcionális Kategória `TicketCategorySelect`)
  - **Önálló Tárgymező (`subject`):** Külön dedikált beviteli mező, amellyel a felhasználó rövid, velős címet adhat a jegynek (nem szükséges a szövegtörzsből levágni)
  - Rich Text szerkesztő (`RichTextEditor`): formázott szövegbevitel (félkövér, dőlt, listák, címsorok, idézet, kód)
  - **Közvetlen Vágólap (Ctrl+V) & Drag-and-Drop:** Képek és fájlok közvetlen beillesztése és behúzása vágólapról és intézőből, modál fókuszvédelemmel és 4-szintű duplikáció-szűréssel
  - Állapotkezelés: automatikus `resetForm` és `editorKey` léptetés az `open` prop változásakor (megelőzve a korábbi form vagy confirmation beragadást)
  - Beküldés utáni megerősítés: zöld pipás siker ablak, ahol a „Bezárás” mellett elérhető az „Újabb visszajelzés” gomb is közvetlen sorozatos beküldéshez
- `TicketsPage.tsx` — több route-ról elérhető:
  - `/:companyId/:dateRange/tickets/:ticketId?` (fő app)
  - `/accounty/tickets/:ticketId?` (Accounty)
  - `/tickets/:ticketId?` (standalone)
  - `/management?view=tickets` (Management Dashboard, beágyazva)
- Management hibajegy nyitás ügyfél nevében (`ManagementCreateTicketDialog.tsx`): a Management Dashboard felületén a sub-tabs sávból indítható `+ Új hibajegy nyitása`, amellyel a support admin célfelhasználó nevében rögzíthet jegyet auto-fill cégválasztással, formázott leírással, dedikált tárgymezővel és vágólapos/húzott csatolmányokkal (részletek: [P-070](./P-070-management-impersonated-ticket-creation-ux.md), [A-089](../../architecture/decisions/A-089-management-ticket-creation-on-behalf-of-user.md))
- Ticket típusok: Hibajelentés (bug), Visszajelzés (feedback), Kérdés (question)
- Ticket státuszok (5 szintű életciklus — új színpaletta & kapszula badge-ek):
  - **Nyitott** (`created` / legacy `new`, `open`): beérkezett hibajegy, még nincs felelőse (égszínkék • Sky Blue, `bg-sky-500/10 text-sky-600 border-sky-500/25`)
  - **Hozzárendelt** (`assigned`): felelős support munkatárs kijelölve (királykék / kobalt • Royal Cobalt Blue, `bg-blue-600/15 text-blue-600 border-blue-500/30`)
  - **Folyamatban** (`in_progress`): aktív munka és megoldás folyamatban (pávakék / zöldeskék • Teal, `bg-teal-500/10 text-teal-600 border-teal-500/30`)
  - **Visszaigazolásra vár** (`waiting_confirmation`): a support admin elkészült a megoldással és megerősítést kért az ügyféltől (borostyánsárga • Amber, `bg-amber-500/10 text-amber-600 border-amber-500/30 whitespace-nowrap px-3 py-0.5`)
  - **Megoldva** (`resolved`): a hibajegy sikeresen megoldva és lezárva (smaragdzöld • Emerald, `bg-emerald-500/10 text-emerald-600 border-emerald-500/25`)
  - *Automatikus státuszváltás:* Nyitott jegyhez rendelt felelős esetén automatikusan Hozzárendelt státuszra vált; felelős visszavonásakor visszatér Nyitott státuszra. Ügyfél általi megerősítéskor automatikusan Megoldva státuszra vált.
  - *Státusz és Prioritás badge-ek kialakítása:* Letisztult, kapszula (`rounded-full`) forma. A Kezelőkonzolban a prioritás egy diszkrét színes pontként jelenik meg egyedi Radix `CustomTooltip`-pel.
  - *Szekciók & Táblázat forma:* Felhasználói oldalon a táblázat és a jegy részletes nézetének (`TicketDetailView`) kártyái, szekciói éles, szögletes (`rounded-none shadow-none`) formavilágot követnek.
- Ticket prioritás: alacsony/közepes/magas/kritikus — user választhatja beküldéskor
- Ticket lista & Táblázatos ergonómia:
  - **Egysoros Tárgymegjelenítés:** A tárgy (`ticket.subject` vagy fallback kivonat) szigorúan egyetlen sorban jelenik meg sortörés nélkül (`truncate whitespace-nowrap`), garantálva a kompakt sor-magasságot.
  - **Görgetés-megszüntetés & Gap optimalizáció:** A jegyszám és a típus oszlop közötti felesleges margók csökkentésével a táblázat vízszintes görgetés nélkül elfér a képernyőn.
  - **Egyszerűsített Bejelentő oszlop:** A Bejelentő és Cég oszlopok összevonásával a táblázatban kizárólag a bejelentő személye látható, a cég pedig a részletes jegynézetben tekinthető meg.
  - **Olvasatlan jegyek rendezése (`sortTicketsByUnreadAndDate`):** A hibajegyek listájában mindig az **olvasatlan üzenetet tartalmazó jegyek (`has_unread === true`) jelennek meg legfelül**, egymás között a legfrissebb aktivitás/komment szerint csökkenő sorrendben.
  - Olvasatlan jegyek vizuális kiemelése: az olvasatlan sorok finom elsődleges színkiemelést (`bg-primary/[0.06] hover:bg-primary/[0.12]`) és pulzáló pontot kapnak.
  - Oszlop-elrendezés és középre igazítás: A `Státusz` és `Prioritás` oszlopok fejlécei és adatcellái tökéletesen szimmetrikusan középre zártak (`text-center flex justify-center items-center`).
  - Felelős oszlop: fix szélességű (`w-[180px] min-w-[170px]`), megtiltva a nevek sortörését (`whitespace-nowrap`).
  - Keresés (`matchTicketSearch`): támogatja a kettőskereszttel (`#EB-0094`) vagy anélkül (`EB-0094`) beírt jegyszámokat, a tiszta szövegre (`stripHtml`) tisztított leírást, tárgyat, felhasználónevet, email címet, cégnevet és a kijelölt felelőst.
- Pagináció: 15 jegy/oldal (sima user), 25 jegy/oldal (support admin)
- Multi-status szűrő: egyszerre több státusz szűrhető (Nyitott, Hozzárendelt, Folyamatban, Megoldva) — Popover + Checkbox UI
- Ticket részletek (`TicketDetailView.tsx`):
  - Megoldás-visszaigazolási Munkafolyamat (`TicketResolutionBanner.tsx`):
    - Ha a support jóváhagyást kér a klienstől (`waiting_for_user_confirmation = true`), a jegy tetején megjelenik a letisztult megerősítő banner.
    - Két egyértelmű opció a kliensnek: „Igen, a probléma megoldódott” (zöld kiemelt gomb) és „Nem, további segítségre van szükségem” (másodlagos gomb, indoklás bekérő modállal).
    - Jóváhagyáskor a rendszer automatikusan Megoldva státuszba helyezi a hibajegyet, megerősítő audit bejegyzést rögzít, és elhelyezi a hivatalos záró rendszerkommentet.
  - Törölt / Nem létező hibajegy 404 kezelése (`TicketNotFoundView`): Törölt azonosító esetén letisztult 404 képernyő jelenik meg.
  - Üzenet és hozzászólás megjelenítés: formázott HTML renderelés (`RichTextContent`), Tailwind typography stílusokkal és plain text fallbackkel
  - Hozzászólás szerkesztő: `RichTextEditor` (`Ctrl+Enter` gyorsbillentyűvel azonnali beküldés)
  - **Mellékletek & Markdown Támogatás:** Képek mellett dokumentumok (PDF, CSV, XLS, XLSX, XML) és Markdown (`*.md`) fájlok is csatolhatók a jegyhez.
  - **Közvetlen Vágólap & Drag-and-Drop:** Ctrl+V vágólap-beillesztés és fájlhúzás közvetlenül a szerkesztőbe duplikáció-mentes állapotkezeléssel.
  - Új prémium előnézeti kártyák: négyzetes képnézet, lebegő kapszulás eszköztár (`Eye` előnézet és `Trash2` törlés), fájlnév felirat, dokumentum jelvények
  - Egységes App Tooltip Rendszer: natív HTML `title="..."` buborékok helyett az app egységes Radix/shadcn `<Tooltip>` komponensei az eszköztárban, kártyákon, linkeken és műveletgombokon
  - Fullscreen galéria: Portal-alapú overlay (z-index: 9999), teljes képernyős képnézegető billentyűzet-navigációval (Escape, Nyilak) és letöltési funkcióval
- Unread badge & Realtime: `useUnreadTicketCount` hook és `feedback_ticket_reads` valós idejű szinkronizáció
- Kezelőkonzol (Console View): Support munkatársak számára optimalizált 2-hasábos osztott nézet (`TicketsPage.tsx`).
  - **Függőben lévő jegyek szűrése & „Összes jegy” kapcsoló:** Alapértelmezetten a gazdátlan és a saját kezelt jegyeket listázza; az „Összes jegy” kapcsolóval kiterjeszthető.
  - **Pont-indikátoros Prioritás:** A prioritás nem foglal el felesleges helyet: kisméretű színes pont jelzi (`TicketPriorityBadge`), amelyre rámutatva egyedi `CustomTooltip` írja ki a fokozatot (alapértelmezett fekete böngésző tooltip és kurzor melletti `?` jel nélkül).
  - **Zajmentes Kártyák:** A kategória jelvény elrejtésre került a kártyákról az áttekinthetőség növelésére.
  - **SLA Jelvény Pozíció & Minimalizmus:** Az SLA figyelmeztető badge (`TicketSlaBadge`) a státusz mögött helyezkedik el, letisztult felkiáltójel ikonnal (`AlertTriangle`) és `CustomTooltip`-pel, amely csak a lejárat óta eltelt időt jelzi.
  - **Ergonómia & Elrendezés:** Bal oldalon a szűrhető, kereshető queue (max-h korlátozott, dedikált belső scrollal `max-h-[calc(100vh-16rem)] min-h-0`), jobb oldalon a jegy tartalom (8 oszlop) és mellette a Részletek kártya alatta az Idővonallal (4 oszlop, max 50vh scrollal).
- **Megoldott Jegyek Alapértelmezett Elrejtése (`ACTIVE_TICKET_STATUSES`):**
  - Mind a normál felhasználók, mind a könyvelőirodai tagok és management operátorok felületén alapértelmezetten kizárólag a függőben lévő, nyitott jegyek (`created`, `assigned`, `in_progress`) jelennek meg. A megoldott (`resolved`) jegyek nem terhelik a listát, és bármikor visszakereshetők a státusz szűrő vagy a szabadszavas kereső segítségével.
- **Kollégális Olvasatlansági Izoláció (Unread Privacy):**
  - Ha egy kolléga által nyitott jegyre válasz érkezik, a rendszer csak a konkrét bejelentő számára emeli ki olvasatlanként a jegyet és csak az ő oldalsávjában növeli az olvasatlan számlálót (`canBeUnreadForUser`), megkímélve az iroda többi tagját a félrevezető értesítésektől.
- **Kollaboratív Jóváhagyás és Versenyhelyzet Védelem:**
  - A jegyet kezelő iroda bármely tagja jóváhagyhatja a megoldást a `TicketResolutionBanner`-en keresztül. Az adatbázis tárolt eljárása (`respond_to_ticket_resolution`) tranzakciós szinten védi a párhuzamos jóváhagyási kísérleteket, megakadályozva a versenyhelyzeteket és a duplikált audit naplóbejegyzéseket.
- **eaisyWorks Feladat Szinkronizáció (`EaisyWorksSyncCard`):**
  - **Elhelyezés:** A Management Dashboard jegyrészletező felületén (`TicketDetailView`), a jobb oldali sávban a Kategória kártya alatt kapott helyet.
  - **Művelet:** Egykattintásos "eaisyWorks hibajegy létrehozása" gomb aszinkron töltés- és hibaállapottal (`useEaisyWorksSync`).
  - **Szinkronizált állapot:** Ha a feladat már létrejött a külső rendszerben, a kártya kiemelt kék `ExternalLink` gombbal jeleníti meg a feladatkulcsot (pl. `EB-103`), amely új lapon (`target="_blank"`) közvetlenül megnyitja a feladatot az eaisyWorks munkaterületén, és mutatja az utolsó szinkronizáció pontos időpontját.

**Rationale:** Egy beépített ticket rendszer gyorsabb visszajelzési ciklust biztosít mint az email, és kontextust ad a fejlesztőknek (melyik oldalon, melyik cég kontextusban keletkezett a hiba). Az ügyfél általi megerősítő folyamat garantálja, hogy egyetlen hibajegy se záródjon le a felhasználó valós jóváhagyása nélkül. A könyvelőirodai hibrid megosztás és a céges keresősáv megszünteti az irodán belüli információs silókat anélkül, hogy a kollégákat felesleges unread értesítésekkel árasztaná el. A közvetlen eaisyWorks szinkronizáció áthidalja az ügyfélszolgálati kommunikáció és a fejlesztői sprint feladatkezelés közötti szakadékot.

## Kapcsolódó
- [A-148: Könyvelőirodai Hibajegy Megosztás és Hibrid RLS](../../architecture/decisions/A-148-accounting-firm-ticket-sharing-and-hybrid-access.md)
- [A-018: Hibajegy Rendszer Architektúra](../../architecture/decisions/A-018-ticket-system.md)
- [P-070: Management Dashboard Hibajegy Létrehozás Felhasználó Nevében UX](./P-070-management-impersonated-ticket-creation-ux.md)
