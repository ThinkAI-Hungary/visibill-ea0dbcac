# Decision 021: Főkönyvi Rendszer (General Ledger)

**Status:** Decided

**Category:** Pénzügyi Modulok

**Question:** Hogyan működik a főkönyvi számlakeret és az AI-alapú osztályozás?

**Decision:**
- Számlatükör sablonok (chart_of_accounts_presets): generic / custom típusok
- Hierarchikus GL számlák (gl_accounts, parent_id) — 1,804 számla a production-ben
- AI-alapú GL osztályozás minden entitáson: invoices, nav_invoices, transactions, invoice_items, nav_invoice_items
- Manuális felülbírálás (gl_is_manually_overridden) + override napló (gl_overrides_log)
- Confidence score + reasoning az AI döntésekhez
- Tétel-szintű GL osztályozás (gl_classifications JSONB)
- **Devizás és Többdevizás Főkönyvi Számlák (EB-0182):** A főkönyvi számokhoz dedikált devizanem (`currency`) vagy többdevizás gyűjtő jelölés (`is_multicurrency`) rendelhető.
- **Bankszámla Deviza Védelem:** Céges bankszámla rögzítésekor a rendszer megköveteli a devizális egyezőséget a hozzárendelt főkönyvi számmal.
- **Többdevizás Kimutatások:** A számlakartonon és partneri analitikában a forint mellett az eredeti devizaegyenlegek (nyitó, forgalom, záró) is megjelennek képernyőn és PDF exportban egyaránt.
- **PROCONT Szabványú Főkönyvi Kivonat és Kétoldalas Egyezőség-számítás:** A magyar könyvvizsgálói és könyvelői gyakorlatnak megfelelően a rendszer A4 álló PDF és Excel formátumban biztosítja a PROCONT mintájú (`PRCNT FŐKÖNYV.pdf`) 3 szintű (osztály, szintetika, analitika) kivonatot a forgalom és egyenleg oszlopokkal, valamint a záró Mérleg (1-4) vs. Eredménykimutatás (5-9) számszaki egyezőség-számítással (0 Ft különbözet).

**Rationale:** A hierarchikus számlatükör és az AI-alapú osztályozás lehetővé teszi, hogy a rendszer automatikusan könyvelje a tételeket, miközben a felhasználó felülbírálhatja a döntéseket. Az override log biztosítja az auditálhatóságot. A devizás számlák és kimutatások támogatása pedig garantálja a nemzetközi és devizás banki/partneri forgalom számviteli pontosságát. A PROCONT export támogatása biztosítja a harmadik feles auditok és asztali szoftverek felé való zökkenőmentes adatszolgáltatást.

## Kapcsolódó
- **ADR:** [A-143: Devizás Főkönyvi Számlakezelés és Partner Analitika](../../architecture/decisions/A-143-multicurrency-chart-of-accounts-and-general-ledger.md)
- **ADR:** [A-239: PROCONT Főkönyvi Kivonat Export és Egyezőség-számítás Architektúra](../../architecture/decisions/A-239-procont-general-ledger-export-and-reconciliation-architecture.md)
- **PRD:** [P-108: Devizás Főkönyvi Számlakezelés és GL Karton UX](../../product/decisions/P-108-multicurrency-chart-of-accounts-and-gl-card-ux.md)
- **PRD:** [P-177: PROCONT Főkönyvi Kivonat A4 PDF és Excel Export UX](../../product/decisions/P-177-procont-general-ledger-export-and-reconciliation-ux.md)
- **Adatbázis Séma:** [docs/architecture/database/07-general-ledger.md](../../architecture/database/07-general-ledger.md)
