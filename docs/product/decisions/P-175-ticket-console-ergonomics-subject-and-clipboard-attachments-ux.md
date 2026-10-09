# P-175: Hibajegy Kezelőkonzol Ergonómia, Tárgymező, Markdown Csatolmányok és Vágólap-Támogatás UX

**Status:** Decided  
**Date:** 2026-10-09  
**Category:** Ügyfélszolgálat & Support UI/UX  
**Kapcsolódó döntések:** [P-035: Hibajegy UI és Workflow](./P-035-ticket-system.md), [A-018: Hibajegy Rendszer Architektúra](../../architecture/decisions/A-018-ticket-system.md)

---

## 1. Kontextus és Problémafelvetés

A korábbi hibajegy-kezelő felületen az alábbi ergonómiai és funkcionális korlátok nehezítették a napi support munkát és a hibabejelentést:

1. **Hiányzó önálló tárgymező és zavaró sortörések:** A jegyeknek nem volt különálló `subject` adatbázis-mezője, a felület a hosszú formázott üzenetből vágott ki előnézetet. A táblázatban és a Kezelőkonzolon a címek több sorba törtek, ami egyenetlen sortávolságot és vizuális rendezetlenséget okozott.
2. **Kezelőkonzol vizuális zaja:** A bal oldali jegyqueue kártyáin a teljes szöveges prioritás badge és a kategória badge túl sok helyet foglalt, miközben az SLA jelvény zavaró módon a státusz badge előtt helyezkedett el. A kurzor felett a böngésző natív fekete tooltipje és egy kérdőjeles kurzor (`cursor-help`) jelent meg.
3. **Táblázat horizontális görgetése:** A jegyszám és a típus oszlop közötti indokolatlanul nagy távolság (gap) miatt normál felbontáson vízszintes görgetősáv jelent meg. A bejelentő és cég két külön oszlopban túl sok helyet foglalt.
4. **Csatolmány korlátozások:** Nem lehetett Markdown (`*.md`) dokumentációkat vagy hibajegyzeteket feltölteni, és hiányzott a képek vágólapról történő közvetlen beillesztése (Ctrl+V), valamint a fogd-és-vidd (Drag & Drop) lehetőség.
5. **Kettős beillesztés hibajelenség (Double Paste):** A vágólapról történő képbeillesztés a szerkesztő és a szülő modál eseménybuborékolása miatt duplán fűzte hozzá a képeket.

---

## 2. Termékdöntések és Felületi Élmény (UX)

### 2.1. Önálló Tárgymező (`subject`) és Egysoros Megjelenítés
- **Beküldési felület (`FeedbackDialog`, `ManagementCreateTicketDialog`):** Külön dedikált "Tárgy" beviteli mező érhető el a leírás felett.
- **Egysoros megjelenítés:** A jegylistában és a konzol kártyákon a tárgy szigorúan egyetlen sorban, ellipsis tördeléssel jelenik meg (`truncate whitespace-nowrap`), garantálva az egységes kártyamagasságot.

### 2.2. Kezelőkonzol Vizuális Letisztítás
- **Pont-indikátoros prioritás (`TicketPriorityBadge`):** A terjedelmes prioritás badge helyett egy diszkrét, lekerekített színes pont (`rounded-full w-2.5 h-2.5`) jelzi a súlyosságot (piros: kritikus, narancs: magas, sárga: közepes, zöld: alacsony).
- **Egységes Radix `CustomTooltip`:** A prioritás pont fölé mozgatva az egérmutatót a platform prémium sötét tooltipje jelenik meg (pl. „Kritikus prioritás”). A zavaró kérdőjeles egérmutató (`cursor-help`) és a böngésző alapértelmezett fekete `title` ablaka eltávolításra került.
- **Kategória badge elrejtése:** A kezelőkonzol kártyákról eltávolítottuk a kategória jelvényt, így kizárólag a legfontosabb döntéstámogató elemek maradtak láthatók.
- **SLA Jelvény pozíció és ikon:** Az SLA túllépési jelvény (`TicketSlaBadge`) a státusz mögé került, egyszerű háromszög figyelmeztető ikonnal (`AlertTriangle`) és `CustomTooltip`-pel, amely csak a lejárat óta eltelt időt jelzi.

### 2.3. Táblázat Ergonómia és Görgetésmentesítés
- **Gap csökkentés:** A jegyszám és a típus oszlop közötti margók és a minimális oszlopszélességek finomhangolásával megszűnt a felesleges vízszintes görgetés.
- **Összevont Bejelentő oszlop:** A táblázatban a „Bejelentő és Cég” helyett kizárólag a „Bejelentő” oszlop szerepel a beküldő nevével; az ügyfélcég neve a jegy megnyitásakor a jobb oldali adatlap fejlécében látható.

### 2.4. Markdown és Vágólapos Csatolmányok (Ctrl+V & Drag & Drop)
- **Markdown formátum:** A `*.md` kiterjesztésű fájlok (`text/markdown`) mostantól teljes körűen támogatottak a hibajegy csatolmányok között (input fájlválasztó, drag-drop és Supabase Storage tárolás).
- **Vágólap (Ctrl+V) & Drag-and-Drop:** Mind a hibajegy felvételi modálban, mind a hozzászólás szerkesztőben a felhasználó egyszerűen beillesztheti a vágólapra másolt képernyőképet vagy behúzhatja a fájlokat.
- **4-szintű duplikáció-védelem:** A ProseMirror bubbling megállítása, a modál szintű esemény-elkülönítés és az állapot szintű méret+típus deduplikáció garantálja, hogy egy képbeillesztés pontosan 1 csatolmánykártyát hozzon létre.

---

## 3. Érintett Komponensek

| Komponens | Módosítás |
|---|---|
| `src/pages/TicketsPage.tsx` | Egysoros tárgymegjelenítés, SLA pozíció a státusz mögött, Bejelentő oszlop egyszerűsítés, táblázat gap csökkentés |
| `src/components/tickets/TicketPriorityBadge.tsx` | Pont alakú prioritás jelző, CustomTooltip, `cursor-help` és natív címke eltávolítása |
| `src/components/tickets/TicketSlaBadge.tsx` | Letisztult háromszög ikon, CustomTooltip natív title helyett |
| `src/components/FeedbackDialog.tsx` | Tárgymező bekérés, vágólap és drag-drop csatolmánykezelés, modál fókuszvédelem |
| `src/features/management/components/tickets/ManagementCreateTicketDialog.tsx` | Tárgymező, vágólapos képbeillesztés és deduplikáció |
| `src/components/tickets/TicketDetailView.tsx` | Hozzászólás szerkesztő vágólap és drag-drop kezelése duplikáció-védelemmel |
| `src/components/ui/rich-text-editor.tsx` | TipTap handlePaste / handleDrop esemény-terjedés megállítása |
| `src/lib/upload-ticket-image.ts` | Markdown `.md` MIME típus felismerés, vágólap- és drop-fájl kinyerés deduplikációval |

---

## 4. Következmények és Eredmények

- **Gyorsabb áttekinthetőség:** A Kezelőkonzolban a support operátorok egy pillantással, vizuális zaj nélkül átlátják a kritikus jegyeket és az SLA státuszokat.
- **Modern képernyőkép-csatolás:** Nincs szükség képernyőképek lementésére és tallózására, a standard Ctrl+V billentyűkombináció azonnal működik duplikáció nélkül.
- **Kompakt nézet:** A táblázatban a sorok magassága szimmetrikus maradt, a felesleges vízszintes görgetés megszűnt.
