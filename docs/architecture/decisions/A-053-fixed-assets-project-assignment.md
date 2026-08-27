# A-053: Tárgyi Eszközök Projektekhez Rendelése (Fixed Assets Project Assignment)

**Status:** Decided  
**Date:** 2026-08-27  
**Utoljára frissítve:** 2026-08-27  

## Context
A Visibill felhasználói a projektek költségeit és erőforrásait eddig számlák és munkadíjak / bérek szintjén tudták nyomon követni. A céges beruházások, eszközbeszerzések és tárgyi eszközök (TENY) azonban nem voltak közvetlenül projekthez köthetők, így nem volt biztosított a projekt-alapú eszközallokáció és az eszközök projektek közötti átadásának naplózása.

Szükségessé vált:
1. Tárgyi eszközök és projektek közötti reláció kialakítása.
2. Eszköz aktiválásakor a számla projektjének automatikus öröklése / kézi kiválasztása.
3. Eszköz életútjában a projektek közötti átadások / hozzárendelések pontos naplózása (`asset_events`).
4. Projektek oldal integráció (allokált eszközök, darabszám, összérték).

## Decision
1. **Adatmodell (1:N FK reláció):**
   - `public.fixed_assets` táblához `project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL` oszlop került hozzáadásra.
   - Létrehoztuk az `idx_fixed_assets_project_id` B-tree indexet az FK keresések és join-ok gyorsítására.
   - Nem alkalmaztunk N:M kapcsolótáblát, mivel az eszközök egy adott időpillanatban egyetlen projekthez (vagy központi infrastruktúrához) vannak dedikálva.

2. **Életút és Audit Naplózás (`asset_events`):**
   - Új eseménytípus: `project_transfer` (vagy kombinált `transfer` telephely és projekt egyidejű változásakor).
   - Esemény rögzítése: `old_values: { project: ... }`, `new_values: { project: ... }` és leíró szöveg formájában.

3. **Lekérdezési és UI Stratégia:**
   - PostgREST join: `project:projects(id, name, project_code, color, icon)`.
   - `useProjectList` hook kibővítése `project_code` mezővel a könnyűsúlyú lenyílókhoz.
   - `useProjectFixedAssets` dedikált hook a projekthez tartozó eszközök listázására a Projects oldalon.

## Consequences
**Pozitív:**
- Teljes összhang a számlák, bérek és tranzakciók meglévő 1:N projekt-modelljével.
- Automatizált számla → tárgyi eszköz aktiválási adatfolyam.
- Valós idejű eszközérték-összesítés a projekt adatlapokon.
- Részletes auditálhatóság az eszközök áthelyezésekor.

**Negatív / Trade-off:**
- Egyidejűleg egy eszköz nem osztható meg százalékosan több projekt között (a magyar számviteli gyakorlatban ritka, szükség esetén átadással kezelhető).

## Kapcsolódó
- [P-052: Tárgyi Eszközök Projektekhez Rendelése UX](../../product/decisions/P-052-fixed-assets-project-assignment-ux.md)
- [023-fixed-assets: Tárgyi Eszközök BRD](../../business/decisions/023-fixed-assets.md)
- [10-assets: Tárgyi Eszközök DB Séma](../database/10-assets.md)
- [A-016: PostgreSQL Query Stratégia](./A-016-postgresql-query-strategy.md)
