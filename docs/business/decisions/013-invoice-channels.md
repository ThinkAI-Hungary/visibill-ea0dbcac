# Decision 013: Számla Beviteli Csatornák

**Status:** Decided

**Category:** Számla Kezelés

**Question:** Milyen csatornákon keresztül kerülnek be számlák a rendszerbe?

**Decision:** Három beviteli csatorna:

1. **Manuális feltöltés** — PDF/kép upload a ManualUpload oldalon → AI feldolgozás
2. **Email-alapú automatikus feldolgozás** — Mailgun email alias (cegnev@inbox.visibill.hu) → webhook → automatikus feldolgozás a worker-rel
3. **NAV szinkronizáció** — NAV Online Számla API-ból lekérdezés, bejövő és kimenő számlák

A manuális feltöltés a document_category mezővel routolható: `invoice` (alapértelmezett) → számla pipeline, `payroll` → bér pipeline.

**Rationale:** A három csatorna biztosítja, hogy a felhasználók a számukra legkényelmesebb módon adhassák hozzá a számláikat. Az email alias különösen hasznos könyvelő irodáknak, akik nagyszámú számlát kapnak emailben. A NAV szinkronizáció biztosítja a teljeskörű lefedettséget.
