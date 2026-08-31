# Decision 045: Számla Feature Szelet Üzleti Követelményei és Integritása

**Status:** Decided  
**Category:** Business Rule / Modular Architecture / Audit Trail  
**Question:** Milyen üzleti szabályoknak és adatintegritási garanciáknak kell érvényesülniük a számlakezelő modulban (NAV számlák és feltöltött/beküldött számlák párhuzamos kezelése, kizárás a könyvelésből, kompenzálás, fizetési állapotok és tömeges módosítások)?  
**Decision:**
1. **Adatforrás Elkülönítés és Szinkron:**
   - A NAV Online Számla rendszerből érkező számlák a `nav_invoices` táblában élnek.
   - A manuálisan beküldött vagy emailen keresztül feltöltött számlák az `invoices` táblában élnek.
   - A két forrás közötti összerendelés automatikusan a normalizált bizonylatsorszám és a partner adószám / név egyezősége alapján történik.
2. **Kizárás a Könyvelésből (`exclude_from_accounting`):**
   - Mind a NAV, mind a beküldött számlák szintjén lehetővé kell tenni a számla kizárását a könyvelési és ÁFA bevallási számításokból. A kizárási állapot azonnal szinkronizálódik a Supabase adatbázisban.
3. **Kompenzálási Figyelmeztetés (Netting Detection):**
   - Amennyiben egy adott partnerrel az adott teljesítési hónapban kimenő és bejövő számlák is keletkeztek, a rendszer vizuális jelzéssel és részletes lebegő kártyával figyelmeztet a kompenzálási lehetőségre.
4. **Tömeges Módosítások Jogosultsága:**
   - Tömeges kategória- és projekt-hozzárendelést, valamint beküldött számlák törlését kizárólag írási jogosultsággal (`writable`) rendelkező felhasználók végezhetnek el. Törlés előtt kötelező megerősítő párbeszédablakot megjeleníteni.

**Rationale:** A hazai számviteli előírásoknak megfelelő, auditálható és hibaálló működés biztosítása, megakadályozva a téves könyvelési tételek bekerülését és a jogosulatlan adatvesztést.

## Kapcsolódó
- ADR: [A-062: Invoices Feature Slice Modularization](../../architecture/decisions/A-062-invoices-feature-slice-modularization.md)
- PRD: [P-057: Invoices Feature Slice UX](../../product/decisions/P-057-invoices-feature-slice-ux.md)
- Business Decision: [012: Invoice Types](./012-invoice-types.md)
- Business Decision: [040: Invoice Relations & Matching](./040-invoice-relations-matching.md)
