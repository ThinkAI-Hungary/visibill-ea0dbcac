# P-052: Tárgyi Eszközök Projektekhez Rendelése (TENY Project Assignment) UX

**Status:** Decided  
**Category:** UI / Workflow  
**Question:** Hogyan rendelhet a felhasználó tárgyi eszközöket projektekhez, és hol jelennek meg a kapcsolódó adatok a felületen?  

## Decision
1. **Aktiválási Űrlap (`AssetActivationDialog`):**
   - A számlatételekből történő eszközaktiváláskor megjelenik a **Projekt** lenyíló mező (`useProjectList`).
   - Ha a forrásszámla már hozzá volt rendelve egy projekthez, az aktiváló ablak automatikusan előtölti azt a mezőt, de a felhasználó tetszőlegesen átállíthatja vagy hagyhatja projekt nélkül.

2. **TENY Részletlap (`AssetDetailPanel`):**
   - A metaadatok között külön sort kap a **Projekt**, színes projekt-kód és név-badge formátumban.
   - Az eszköz idővonalán megjelennek a `Projekt hozzárendelés` (`project_transfer`) események egyedi `FolderKanban` ikonnal és részletes leírással.

3. **Áthelyezési Dialógus (`TransferDialog`):**
   - A dialógus kibővült mind a Telephely, mind a Projekt módosításának támogatásával.
   - A felhasználó egy lépésben vagy külön-külön módosíthatja az eszköz helyszínét és projekt-allokációját.

4. **TENY Lista Táblázat (`AssetListTable`):**
   - Új **Projekt** oszlop mutatja az allokált projektet kis badge-dzsel.
   - A táblázat feletti keresőmező azonnal szűr a projekt nevére és kódjára is.

5. **Projektek Oldal (`Projects`):**
   - A projekt kártyákon megjelent az **Eszközök (db)** fül, amely listázza az adott projekthez kapcsolt eszközöket (leltári szám, státusz, név, érték).
   - Az eszköz sorára kattintva közvetlen navigáció érhető el a TENY modulba (`/teny?asset=<id>`).
   - Az **Áttekintés** fülön összefoglaló kártya jelzi az allokált eszközök számát és összesített bekerülési értékét.

6. **QR Címke Nyomtatás (`QrLabelDialog`):**
   - A nyomtatási címkesablon és az SVG előnézet tartalmazza a hozzárendelt projekt nevét.

## Current Implementation
- `src/components/AssetActivationDialog.tsx`
- `src/components/fixed-assets/AssetDetailPanel.tsx`
- `src/components/fixed-assets/TransferDialog.tsx`
- `src/components/fixed-assets/AssetListTable.tsx`
- `src/components/fixed-assets/QrLabelDialog.tsx`
- `src/pages/Projects.tsx`

## Rationale
A projektmenedzsment és az eszközgazdálkodás összekapcsolása megkönnyíti a projektköltségek teljes körű áttekintését és az eszközök pontos elszámolását a vállalaton belül.

## Kapcsolódó
- [A-053: Tárgyi Eszközök Projektekhez Rendelése ADR](../../architecture/decisions/A-053-fixed-assets-project-assignment.md)
- [023-fixed-assets: Tárgyi Eszközök BRD](../../business/decisions/023-fixed-assets.md)
- [P-050: Projekt Folyamatábra UX](./P-050-project-flowchart-ux.md)
