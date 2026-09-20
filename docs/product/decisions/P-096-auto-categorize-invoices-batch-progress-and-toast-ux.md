# P-096: Számlák Kötegelt Automatikus Kategorizálása, Valós Idejű Progress és Toast UX

**Status:** Decided  
**Category:** UI / AI / UX  
**Question:** Hogyan biztosítható transzparens, valós idejű és vizuálisan tiszta felhasználói visszajelzés a számlák kötegelt automatikus kategorizálása során, elkerülve a blokkoló felugró ablakokat és a felületi ugrálásokat, miközben a felhasználó pontos visszajelzést kap a szabályalapú (partner-történeti) és AI alapú besorolások arányáról?  
**Decision:**

1. **Integrált Header Akció és Valós Idejű Köteg-Progress:**
   - Az automatikus kategorizálás gomb a számlák oldal fejléceszköztárában helyezkedik el.
   - Futás közben a gomb nem tűnik el és nem dob fel blokkoló modalt: helyette in-place progress állapotba vált (`isPending` / `isPolling`), letiltva a duplikált beküldést (double-submit védelem).
   - A gomb felirata és tooltipje folyamatosan frissül: `Kategorizálás... (x / y köteg)` vagy a feldolgozott számlák aránya jelenik meg egy finom pulzáló animációval.

2. **Nem-blokkoló Aszinkron Háttérmunka (`useAutoCategorizeJob` Hook):**
   - Az `auto-categorize-invoices` Edge Function hívásakor a háttérben egy aszinkron job jön létre az `auto_categorize_jobs` táblában.
   - A frontend a `useAutoCategorizeJob` React hookon keresztül diszkréten poll-ozza a job állapotát. Ez lehetővé teszi, hogy a felhasználó a háttérben futó kategorizálás alatt szabadon folytassa a munkáját (szűrés, számlák megtekintése, fülek közötti navigáció), a UI soha nem fagy le.

3. **Informatív Kétfázisú Eredmény-Toast:**
   - A job lefutásakor a rendszer nem egy semmitmondó "Sikeres művelet" üzenetet ad, hanem egy részletes, sikerességet jelző Sonner toast értesítést küld:
     - Pontosan megjelöli a besorolt számlák számát, valamint a partner-történeti (szabályalapú) és az AI általi kategorizálások bontását:
       * *Példa:* *"Sikeres kategorizálás: 45 számla besorolva (38 partner-szabály alapján, 7 mesterséges intelligenciával)."*
     - Részleges siker vagy kihagyott számlák esetén egyértelmű útmutatást ad: *"x számla besorolva, y partnernél nem áll rendelkezésre egyértelmű kategória."*

4. **Automatikus Cache Érvénytelenítés és Villanásmentes Adatfrissítés:**
   - A job sikeres státuszának elérésekor a TanStack Query automatikusan invalidálja az érintett cég számlalekérdezéseit (`invoices`, `nav_invoices`, `categories`).
   - A táblázat a háttérben újratöltődik, a frissen hozzárendelt színes kategória-badge-ek zökkenőmentesen és villanásmentesen jelennek meg a sorokban.

**Current Implementation:**
- [useAutoCategorizeInvoices.ts](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/hooks/useAutoCategorizeInvoices.ts)
- [InvoiceActions.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/features/invoices/components/filters/InvoiceActions.tsx)
- [auto-categorize-invoices/index.ts](file:///d:/ThinkAI/Visibill/eaisybill-prod/supabase/functions/auto-categorize-invoices/index.ts)
- [20260920120000_partner_majority_categorization.sql](file:///d:/ThinkAI/Visibill/eaisybill-prod/supabase/migrations/20260920120000_partner_majority_categorization.sql)

**Rationale:** A könyvelési és számlázási felületeken a transzparencia a legfontosabb bizalmi tényező. A felhasználónak látnia kell, hogy a rendszer miért és milyen alapon sorolta be a számlákat. A szabályalapú és AI alapú bontás megmutatja a cégnek, hogy a rendszer tanul a korábbi szokásaikból, ami csökkenti a felülvizsgálatra fordított időt és növeli a platformba vetett bizalmat.

## Kapcsolódó
- [A-129: Partner-történeti Többségi Szabályú Számlakategorizálás & DB Triggerek](../../architecture/decisions/A-129-partner-history-majority-categorization.md)
- [BRD 059: Partner-történeti Többségi Számlakategorizálás](../../business/decisions/059-partner-history-majority-categorization.md)
- [P-015: Bulk Actions UX](./P-015-bulk-actions.md)
- [P-041: Kategóriák és Többvalutás Keresés](./P-041-categories-multicurrency-search.md)
