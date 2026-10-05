# Decision 013: Számla Beviteli Csatornák

**Status:** Decided

**Category:** Számla Kezelés

**Question:** Milyen csatornákon keresztül kerülnek be számlák a rendszerbe?

**Decision:** Négy beviteli csatorna:

1. **Manuális feltöltés** — PDF/kép upload a ManualUpload oldalon → AI feldolgozás
2. **Email-alapú automatikus feldolgozás** — Mailgun email alias (cegnev@inbox.visibill.hu) → webhook → automatikus feldolgozás a worker-rel
3. **NAV szinkronizáció** — NAV Online Számla API-ból lekérdezés, bejövő és kimenő számlák
4. **Közvetlen beküldött számlarögzítés (Manuális Számla Létrehozás)** — Űrlapos rögzítés a Számlák fejlécből ([ ➕ Új beküldött számla ] gomb), közvetlen számlaadat-megadással, opcionális dokumentumcsatolással (Storage), és opcionális azonnali NAV számla összerendeléssel (`submitted_invoice_id`) valamint tranzakció-párosítással (`transactions.invoice_id`).

A manuális feltöltés a document_category mezővel routolható: `invoice` (alapértelmezett) → számla pipeline, `payroll` → bér pipeline.

**Rationale:** A négy csatorna biztosítja, hogy a felhasználók a számukra legkényelmesebb módon adhassák hozzá a számláikat. Az email alias különösen hasznos könyvelő irodáknak, akik nagyszámú számlát kapnak emailben. A NAV szinkronizáció biztosítja a teljeskörű lefedettséget. A közvetlen manuális rögzítés pedig azonnali, determinisztikus számla- és bizonylatfelvitelt tesz lehetővé anélkül, hogy meg kellene várni az AI feldolgozást vagy a NAV sync ciklust.

## Kapcsolódó
- PRD: [P-157: Manuális Számlarögzítés, Dokumentum-Feltöltés és Többes Párosítás UX](../../product/decisions/P-157-manual-submitted-invoice-creation-dialog-and-pairings-ux.md)
- ADR: [A-198: Manuális Beküldött Számlarögzítés, Dokumentum Csatolás és Többes Párosítás](../../architecture/decisions/A-198-manual-submitted-invoice-creation-and-multi-pairing.md)
- Business Decision: [045: Számla Feature Szelet Üzleti Követelményei és Integritása](./045-invoices-feature-slice.md)
