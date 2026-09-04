# P-055: Könyvelési Napló (Accounting Journals) UX

**Status:** Decided  
**Date:** 2026-08-27  
**Category:** UI / General Ledger / Workflow  

---

## Question

Hogyan jelenjen meg a Könyvelési Napló (Accounting Journals) felülete az eaisybill felületén, hogyan navigálhat a felhasználó a naplók között, és milyen interakciókkal kezelheti a kézi és automatikus tételeket, valamint a sztornózási műveleteket?

## Decision

1. **Oldal Elhelyezkedés és Navigáció:**
   - Útvonal: `/:companyId/:dateRange/journals`
   - A sidebar **Könyvelés** (`BookOpen` ikon) csoportjában kapott helyet „Napló” néven.
   - A modulhoz való hozzáférést a `useEaisybillPermissions` `journals` kulcsa szabályozza (csak megfelelő jogosultságú felhasználóknak elérhető).

2. **Nézet Felépítése (`JournalsPage.tsx`):**
   - **Fejléc & KPI Sáv:** Aktív könyvelési év és időszak kijelzése, egyensúly ellenőrző kártyák (Összes tétel, Könyvelt tételek összege, Piszkozatok, Zárt időszak jelző), breadcrumb és cégindikátor.
   - **Akciógombok:** Időszakzárás (`variant="outline"`), Javaslatok generálása (`border-indigo-500/30`), és a kiemelt Új vegyes bizonylat CTA (`Button` design token sötét és világos módban optimalizált kontraszttal).
   - **Napló Választó (Horizontal Scroll Tabs):** Váltás a 9 napló (Vevő, Szállító, Bank HUF/EUR, Házipénztár, Vegyes, Bérfeladás, Nyitó, Záró) vagy az Összesített Napló (Munkalista) nézet között.
   - **Kereső & Szűrősáv:** Bizonylatszám, leírás, partner, dátumtartomány, státusz (`PISZKOZAT`, `KONYVELT`, `SZTORNOZOTT`) és könyvelési év szűrők.

3. **Táblázat Architektúra & Layout Stabilitás (2026-09-03):**
   - **Kettős Paginálás (`UnifiedPagination`):** A táblázat tetején és alján egyaránt elérhető egységes pagináció oldalméret-választóval (`[50, 100, 200]`).
   - **Oszlop-elugrálás elleni védelem (`table-fixed`):** Determinisztikus oszlopszélességek (`w-[44px]`, `w-[95px]`, `w-[110px]`, `w-[150px]`, `w-[180px]`, `w-[150px]`, `w-[100px]`, `w-[130px]`, `w-[120px]`), míg a *Megnevezés* oszlop rugalmasan (`w-auto min-w-[200px]`) tölti ki a teret tooltip-pel kiegészítve. Lapozáskor az oszlopok nem mozdulnak el.
   - **Vertikális elmozdulás elleni védelem (`TablePlaceholderRows`):** Ha az utolsó oldalon vagy szűréskor kevesebb elem található, láthatatlan helykitöltő sorok tartják a táblázat fix magasságát.
   - **Konzisztens Ikonográfia:** A korábbi emojik helyett standard Lucide SVG ikonok és állapot-jelvények jelennek meg a tétel forrásának jelölésére (`Receipt` Számla, `Landmark` Bank, `Bot` Rendszer, `FileText` Vegyes, `Sparkles` AI javaslat, `History` Audit/Sztornó).
   - **1-Kattintásos Másolás (`CopyableCell`):** A bizonylatszám és a partner neve közvetlenül másolható a vágólapra feedback toasttal.
   - **Üres és Töltési Állapotok:** Szabványos `TableSkeleton` és `TableEmptyState` komponensek.
   - **Sötét Mód CTA Optimalizáció:** Az "Új vegyes bizonylat" gomb finom sötét szürke/fehér gradienssel és kontrasztos szegéllyel jelenik meg, elkerülve a vakító fehér kiégést sötét témában.

4. **Többdevizás Összeg Megjelenítés & Napi MNB Árfolyam (2026-09-03):**
   - **Összeg Oszlop Kétszintű Megjelenítés:** Nem HUF tételeknél (pl. USD, EUR) az elsődleges sorban a devizaösszeg látható a pénznemmel (pl. `80,01 USD`), alatta pedig kisbetűs diszkrét stílusban zárójelben a teljesítés napján érvényes MNB hivatalos árfolyammal átszámított forintérték (pl. `(25 301 Ft)`).
   - **Interaktív Napi Árfolyam Tooltip:** A zárójeles HUF összeg fölé víve a kurzort a rendszer tooltipben megjeleníti az alkalmazott hivatalos MNB devizaárfolyamot és a dátumot: `Napi MNB árfolyam (2026.09.01): 1 USD = 316,22 Ft`.
   - **Részletező Drawer (SheetContent):** A bizonylatra kattintva felnyíló oldalsó panelen az összefoglaló fejléc kártyán külön sorban jelenik meg a `Napi MNB árfolyam`, a kontírozott tételek táblázatában pedig minden tétel sornál külön kiírásra kerül a devizaösszeg és a zárójeles forintösszeg.

5. **Tétel Kezelés & Dialógusok:**
   - **Új tétel rögzítése:** Kétoldalú könyvelési tétel szerkesztő felület (`Debit` / `Credit` sorok dinamikus hozzáadása, automatikus egyenleg-különbözet kijelzés).
   - **Könyvelés gomb (`PostEntry`):** Validálja az egyensúlyt (`T = K`), ellenőrzi a zárt időszakot, és véglegesíti a tételt a következő folyósorszámmal.
   - **Sztornó művelet (`StornoDialog`):** Indoklás megadásával automatikusan elkészíti az ellentétes előjelű sztornó tételt és megnyitja a javító piszkozatot.
   - **Naplókivonat Export:** CSV és nyomtatható nézet a tételekről.

6. **Nyitó Tétel Varázsló és Kézi Bizonylatrögzítés UX Modernizáció (2026-09-04):**
   - **Kétszintes Fejléc-architektúra (`OpeningJournalWizardModal.tsx`):**
     - **Felső sáv:** Lekerekített `BookOpen` könyv ikon stílusos áttetsző zöld kerettel és háttérrel (`bg-primary/10 border-primary/20 shadow-2xs`), tiszta `Nyitó tételek rögzítése & Varázsló` főcím, különálló `Badge` az `Sztv. 491` jelöléshez és diszkrét alcím a mérlegfolytonosságról.
     - **Alsó sáv (4-oszlopos kártyás Progress Stepper):** `grid grid-cols-4 gap-2.5` rács, kör alakú állapotjelzőkkel (aktuális lépésszám, elvégzett lépéseknél zöld pipa `✓`), „1. LÉPÉS” mikrotipográfiával és interaktív visszanavigálással a korábbi fázisokra.
   - **Form és Beviteli Mező Modernizációk:**
     - **Dátumválasztó (`DatePicker`):** A nyers HTML dátummezők helyett az egységes dizájn token alapú `DatePicker` komponens került be. Évfordulós nyitásnál (`EVFORDULOS`) automatikusan az adóév első napjára (`01-01`) zárolódik, míg évközi áttérésnél szabadon módosítható.
     - **Egyedi Számbevitel (`NumberInput`):** Rendszerszintű numerikus beviteli mező finom léptető nyilakkal és fix szélességű `tabular-nums` számformázással a sorösszegeknél.
     - **Partner Keresősáv (`AddManualJournalEntryModal.tsx`):** A korábbi szimpla select helyett kereshető combobox popup (`Popover` + `CommandInput`) gyorspartner-kereséssel.
     - **Kiemelt Fókuszkeret:** Minden beviteli mező, select és popover gomb egységes `focus:border-primary` vizuális visszajelzést kap billentyűzetes Tab navigáció során.
     - **Teljes Tooltip Fedettség:** Minden műveleti ikonon (törlés, megjegyzés, ellenszámla) kontextuális magyarázó címke található.
   - **Viewport-túlcsordulás elleni Védelem:**
     - Belső táblázatgörgetés (`max-h-[clamp(200px,calc(85vh-420px),420px)]`) rögzített (`sticky top-0`) fejléccel. A táblázat a modálon belül önállóan görgethető, így az akciógombok és a valós idejű 491-es egyenleg KPI kártya tetszőleges számú sornál is fixen a képernyőn marad.
   - **Könyvelői Gyorsított Billentyűzet-navigáció:**
     - Az összeg mezőben megnyomott Enter billentyű automatikusan a tétel leírására ugrik.
     - A táblázat utolsó sorából indított Tab vagy Enter automatikusan új könyvelési sort szúr be és azonnal a következő főkönyvi számlaválasztóra fókuszál.
   - **Automatikus Állapot-reset és Duplikáció-védelem:**
     - **Reset on Close/Finish:** A modál bezárásakor vagy a „Kész / Befejezés” gombra kattintva a varázsló teljesen visszaáll az 1. lépésre tiszta alapállapotba.
     - **Évnyitási Duplikáció-védelem:** Az 1. lépés automatikusan ellenőrzi a kiválasztott év lekönyvelt nyitó bizonylatait (`acc_journal_headers`), és létező nyitás esetén sárga figyelmeztető panellel (`AlertTriangle`) tájékoztatja a könyvelőt a duplikált egyenlegek elkerülése érdekében.

## Current Implementation

- Oldal: `src/pages/JournalsPage.tsx`
- Komponensek: `src/components/journals/*` (`OpeningJournalWizardModal.tsx`, `AddManualJournalEntryModal.tsx`, `OpeningCSVImportModal.tsx`)
- Beviteli Komponensek: `src/components/ui/number-input.tsx`, `src/components/ui/date-picker.tsx`
- Szolgáltatások: `src/features/journals/services/draftFallbackGenerator.ts`
- Hook & State: `useQuery` `.limit(10000)` a naplófejek és sorok lekérdezéséhez, optimista frissítések a könyvelési állapotokhoz.

## Rationale

- A könyvelők számára a naplózás a legfontosabb ellenőrzési felület: elengedhetetlen, hogy a bizonylatok sorszám szerint, naplónként rendezve és egyensúly-ellenőrzéssel legyenek elérhetők.
- A fix és rázkódásmentes táblázatos megjelenítés növeli a felhasználói hatékonyságot többszáz tételes listák lapozásakor és auditálásakor.
- Az automatikus állapot-reset és duplikáció-védelem meggátolja a véletlen többszörös nyitást és az Sztv. mérlegfolytonossági sérüléseit.

## Kapcsolódó
- **ADR:** [A-057: Könyvelési Napló Architektúra](../../architecture/decisions/A-057-accounting-journals-architecture.md)
- **BRD:** [043: Könyvelési Naplók](../../business/decisions/043-accounting-journals.md)
- **DB Schema:** [22-accounting-journals.md](../../architecture/database/22-accounting-journals.md)
- **Design:** [11-data-display-tables.md](../../design/11-data-display-tables.md), [12-dialogs-modals.md](../../design/12-dialogs-modals.md), [04-component-library.md](../../design/04-component-library.md)
