# P-112: In-App Fejlesztői Napló és Patchnotes Idővonal UX

**Status:** Decided  
**Category:** UI / Terméktájékoztatás  
**Utolsó frissítés:** 2026-09-25  

**Question:** Hogyan jelenítsük meg a felhasználók számára a napi javításokat és fejlesztéseket közvetlenül az eaisybill felületén, biztosítva az elcsúszásmentes navigációt és a kényelmes belső görgetést?

**Decision:** Letisztult, lineáris vertikális idővonal (Linear/Raycast Timeline), amely a bal oldali menüsávban (AppSidebar) kap helyet a Tudástár és a Hibajegyek között, rögzített szűrőfejléccel és belső görgetősávval ellátott tartalomterülettel.

**Current Implementation:**
- **Sidebar integráció ([AppSidebar.tsx](../../../src/components/AppSidebar.tsx)):**
  - Elhelyezkedés: Pontosan a `Tudástár` (`/knowledge-base`) és a `Hibajegyek` (`/tickets`) között.
  - Ikon: Lucide `Sparkles` (szigorúan emoji-mentes).
  - Megnevezés: `Fejlesztői napló`
  - Újdonság figyelmeztető: Ha új bejegyzés született az utolsó látogatás óta, pulzáló zöld `ÚJ` kapszulajelvény figyelmezteti a klienst.
- **Oldalstruktúra ([ChangelogPage.tsx](../../../src/pages/ChangelogPage.tsx)):**
  - **Rögzített Fejléc ([ChangelogHeader.tsx](../../../src/components/changelog/ChangelogHeader.tsx)):**
    - Keresőmező azonnali szöveges szűréssel és törlés gombbal.
    - Kategória szűrő gombok Lucide ikonokkal: `Összes` (`Layers`), `Új funkciók` (`Sparkles`), `Javítások` (`Wrench`), `Fejlesztések` (`Zap`).
      - Statikus feliratok és `transition-colors`: nincs layout shift és badge-ugrálás a szűrés váltásakor.
    - Modul szűrő segmented tabok: `Mindkét modul`, `eaisyBill`, `eaisyBooks`.
      - Állandó 1px border és egységes `font-medium` betűsúly, így váltáskor a tabok dobozmérete stabil marad.
  - **Dinamikus Belső Görgetésű Idővonal ([ChangelogTimeline.tsx](../../../src/components/changelog/ChangelogTimeline.tsx)):**
    - **Függetlenített belső scroll:** A főoldal nem görög el, a fejléc stabilan rögzítve marad; kizárólag a timeline kap `overflow-y-auto`-t vékony, modern görgetősávval (`[scrollbar-width:thin]`).
    - **Valós idejű görgetéskövetés (Scroll-spy):** Az aktív bejegyzés lágy zöld szegéllyel és halvány árnyékkal emelkedik ki, felesleges "Aktuális" szövegcímkék nélkül.
    - Bal oldali dátumoszlopa relatív időmeghatározással (`Ma`, `Tegnap`, `2026. szeptember 24.`), kattintható sima odagörgetéssel.
    - Vertikális összekötő vonal és pulzáló állapotjelző pontok.
    - Részletes kártyák ([ChangelogEntryCard.tsx](../../../src/components/changelog/ChangelogEntryCard.tsx)):
      - Verziószám és kategóriajelvények kizárólag Lucide ikonokkal (emojik nélkül).
      - 1-2 mondatos, közérthető összefoglaló szöveg.
      - Strukturált bullet pontok egyértelmű Lucide ikonokkal (Új funkció: `Plus`, Javítás: `CheckCircle2`, Sebesség: `Zap`).
  - **Betöltési Állapot ([ChangelogTimelineSkeleton.tsx](../../../src/components/changelog/ChangelogTimelineSkeleton.tsx)):**
    - Shimmer effektes animált csontváz-placeholder, amely megakadályozza a hirtelen tartalomugrást (layout shift).
- **Adatvezérelt működés:**
  - `changelog_entries` Supabase tábla tárolja az adatokat, így az AI publikációs skill (`visibill-patchnote`) kódmódosítás nélkül, azonnal tud új rekordokat közzétenni.

**Rationale:** Az ügyfelek bizalmát és elköteleződését nagymértékben növeli, ha látják a szoftver folyamatos karbantartását és a napi javításokat. A játékokból ismert patchnote megfogalmazás közelebb hozza a terméket a felhasználóhoz, elkerülve az elidegenítő mérnöki commit szövegeket. A rögzített fejléc és a belső scroll garantálja a professzionális, asztali app-élményt.

## Kapcsolódó
- [A-149: In-App Fejlesztői Napló Rendszer](../../architecture/decisions/A-149-in-app-changelog-and-patchnotes-system.md)
- [P-035: Hibajegy Rendszer UX](./P-035-ticket-system.md)
- [P-078: Tudástár UX](./P-078-knowledge-base-ux-and-navigation.md)
