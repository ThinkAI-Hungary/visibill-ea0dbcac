# Decision 034: [Accounty] Worker Pipeline (Háttérfeldolgozás)

**Status:** Decided

**Category:** Accounty & Integrált Modulok

**Question:** Hogyan működik a dokumentumok és tranzakciók háttérfeldolgozása?

**Decision:**
- Önálló Python worker szolgáltatás (`visibill-worker`) Docker konténerben
- **PGMQ queue-alapú architektúra** — 4 független pipeline:
  1. `invoice_jobs` — Számla OCR + LLM feldolgozás (típus felismerés, adat kinyerés)
  2. `transaction_jobs` — Banki tranzakció lista feldolgozás (klasszifikáció, matching)
  3. `gl_classification_jobs` — Főkönyvi besorolás LLM-mel
  4. `report_jobs` — Futárszolgálat riport feldolgozás (3-way matching)
- **Matching pipeline** (tranzakció → számla):
  - Heurisztikus matching (szám, összeg, dátum, partner név)
  - AI fallback (LLM-alapú párosítás kontextussal)
  - Retroaktív rematch: számla feltöltés UTÁN és tranzakció batch INSERT UTÁN is fut
- **OCR backend:** Mistral (Pixtral) vagy OpenAI Vision, konfigurálható
- **LLM költség tracking:** `llm_costs` tábla, per-job költség rögzítés
- Competing consumers: több Docker instance természetesen load-balance-ol PGMQ-n

**Rationale:** A queue-alapú feldolgozás biztosítja a megbízhatóságot (üzenet nem vész el), a skálázhatóságot (több worker instance) és az aszinkronitást (felhasználó nem vár). A retroaktív rematch megoldja a race condition-t, amikor számla és tranzakció egyszerre dolgozódik fel.

## Verification & Testing
A háttérfeldolgozó pipeline-ok helyességét a Python worker teszt suite-ja ellenőrzi:
- **Fast unit tests:** `python run_tests.py` a gyors, API hívás nélküli ellenőrzésekhez.
- **Full E2E pipeline tests:** `python run_tests.py --full` a teljes AI kinyerési, OCR és feldolgozási folyamat ellenőrzéséhez.
- Lásd részletesen: [A-006: Python Worker Architektúra](../../architecture/decisions/A-006-python-worker.md), [Decision 040: Számla Kapcsolatok és Párosítási Logikák (Matching & Relations)](./040-invoice-relations-matching.md) és a [Worker unit_test README.md](../../../worker/test/unit_test/README.md).
