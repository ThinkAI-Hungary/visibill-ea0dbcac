# A-067: Projects Oldal Lekérdezés Párhuzamosítás és Parciális Indexelés

**Status:** Decided  
**Date:** 2026-08-31  
**Utoljára frissítve:** 2026-08-31

## Context
A `/projects` oldal első betöltése észrevehetően hosszú ideig tartott (loading skeleton / spinner késleltetés). 
A mélyreható teljesítmény-analízis 3 fő szűk keresztmetszetet tárt fel:
1. **Szekvenciális Lekérdezési Lánc (Waterfall):** A `Projects.tsx` `queryFn`-je egymás után, sorosan hívta le a `projects` táblát, a `nav_invoices` táblát (while lapozással) és a `nav_invoice_items` táblát (while lapozással és inner joinnal). Ez 3 egymást megváró hálózati kört jelentett.
2. **Hiányzó Index a Tételeken:** A `nav_invoice_items` táblán a `project_id` mezőre nem létezett index, ami lassította a PostgREST inner join feloldását.
3. **Monolitikus JavaScript Bundle:** A `ProjectFlowchart` komponens és a teljes `recharts` diagramkönyvtár szinkron módon be volt importálva a `Projects.tsx`-be, feleslegesen növelve az oldal kezdeti letöltési méretét.

## Decision
Háromlépcsős átfogó optimalizációt valósítottunk meg:

1. **Adatbázis Parciális Index (`nav_invoice_items`):**
   ```sql
   CREATE INDEX IF NOT EXISTS idx_nav_invoice_items_project_id 
   ON public.nav_invoice_items (project_id) 
   WHERE (project_id IS NOT NULL);
   ```
2. **Aszinkron Párhuzamosítás (`Promise.all`):**
   - A `Projects.tsx` `queryFn`-ben a `fetchProjects`, `fetchDirectlyLinkedInvoices` és `fetchLineItemAssignments` párhuzamosan indul el `Promise.all()` használatával.
   - A hálózati várakozási idő a korábbi harmadára csökkent.
3. **Kód-szétválasztás & Dinamikus Lazy Loading:**
   - A `ProjectFlowchart` komponenst és a `recharts` diagramcsomagot dinamikus `lazy()` importra és `<Suspense>` határolóra állítottuk át.
   - A `Projects` belépési JavaScript chunk mérete 72.87 kB-ról 41.77 kB-ra (gzip: 10.96 kB) csökkent.

## Consequences
**Pozitív:**
- Drasztikusan gyorsabb első oldalbetöltés és azonnali renderelés a `/projects` felületen.
- Kisebb kezdeti JavaScript méret és memóriaigény.
- Hatékonyabb adatbázis terhelés a parciális indexnek köszönhetően.

**Negatív / Trade-off:**
- A folyamatábra nézet első megnyitásakor egy minimális aszinkron betöltés történik a diagrammotor letöltéséig.

## Kapcsolódó
- [A-022: Kategóriák és projektek dual-table szinkronizációja](./A-022-categories-projects-sync.md)
- [A-053: Tárgyi Eszközök Projektekhez Rendelése](./A-053-fixed-assets-project-assignment.md)
- [P-050: Projekt Interaktív Folyamatábra UX](../../product/decisions/P-050-project-flowchart-ux.md)
