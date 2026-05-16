# Decision 008: Dokumentum Feldolgozási Pipeline

**Status:** Decided

**Category:** Architektúra & Infrastruktúra

**Question:** Hogyan történik a dokumentumok (számlák, bérjegyzékek, tranzakciók, futár riportok) automatikus feldolgozása?

**Decision:** PGMQ-alapú aszinkron feldolgozás Python worker-rel:

1. **Számla pipeline:** Upload → Supabase Storage → Edge Function trigger → PGMQ → Worker → OCR (Textract/MarkItDown) → LLM extraction → DB mentés + GL osztályozás
2. **Tranzakció pipeline:** CSV upload → Edge Function → PGMQ → Worker → CSV parsing → AI matching számlákhoz
3. **Bérjegyzék pipeline:** Upload (document_category='payroll') → Edge Function → PGMQ → Worker → LLM extraction → salary records
4. **Futár riport pipeline:** CSV upload → Worker → Report extraction → NAV/tranzakció matching
5. **GL osztályozás:** Minden entitáson (számla, NAV számla, tranzakció) AI-alapú főkönyvi szám hozzárendelés

**Rationale:** A PGMQ queue biztosítja a megbízható, skálázható feldolgozást. A Python worker Docker container-ben fut, ami lehetővé teszi a nehéz AI/ML könyvtárak használatát. A feldolgozás aszinkron, így a felhasználó nem vár a hosszú AI műveletre. Az LLM költségeket a llm_koltsegek tábla rögzíti.
