# P-012: Számla Szerkesztés

**Status:** Decided  
**Category:** Számla Kezelés

**Question:** Hogyan szerkeszthet a felhasználó egy feldolgozott számlát?

**Decision:** 2 dialógus rendszer:

1. **InvoiceEditDialog** — Egyedi mező gyors javítása (pl. összeg, partner, dátum)
2. **InvoiceFullEditDialog** — Teljes számla szerkesztés beleértve a tételek szerkesztését, valamint a csatolt számlakép/fájl törlését

**Rationale:** Két szint elegendő: gyors javítás a leggyakoribb esetekre, teljes szerkesztés a ritkább, összetett esetekre. A tétel szerkesztés a teljes szerkesztés részeként érhető el, nem külön dialógusban.

---

## Számlakép Törlése Funkció (2026-09-06)

Az `InvoiceFullEditDialog` alsó láblécében helyet kapott egy piros, destruktív **"Számlakép törlése"** gomb (Trash2 ikonnal), amely csak akkor kattintható, ha az adott számlához van csatolt kép vagy fájl (`image_url`, `melleklet_url` vagy `invoice_uploads_id`).

### UX Flow
1. Felhasználó rákattint a "Számlakép törlése" gombra a lábléc bal oldalán.
2. Megnyílik egy figyelmeztető `AlertDialog` ("Kijelölt számlakép törlése").
3. A felhasználó két opció közül választhat:
   - **1. Csak a számlasor törlése:** A számla sora törlődik a relációs nyilvántartásból, de a korábban feltöltött dokumentum megmarad az adatbázisban és tárhelyen.
   - **2. Számlasor és feltöltött fájl törlése:** A számla sora és az eredetileg feltöltött fizikai fájl is véglegesen törlődik a Supabase Storage-ból és az `invoice_uploads` táblából.
4. Törlés után automatikusan frissülnek a cache-elt lekérdezések (`invoices`, `submittedInvoices`, `filteredSubmittedInvoices`, `invoiceKpis`), a dialógus bezárul és a felület toast értesítést ad.
