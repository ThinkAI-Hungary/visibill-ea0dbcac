# Decision 027: LLM Költség Kezelés

**Status:** Partially Decided

**Category:** Integrációk & Jövő

**Question:** Hogyan kezeljük az AI/LLM költségeket? Van-e felső limit felhasználónként/cégenként? Be kell-e építeni a subscription tierekbe? Melyik modellt használjuk?

**Decision:**

**Jelenlegi implementáció:**
- llm_koltsegek tábla — minden AI hívás naplózása (113 log a production-ben)
- Rögzített adatok: input/output tokens, modell neve, becsült költség (USD), feldolgozási idő, pipeline típus
- Jelenleg nincs limit — minden felhasználó korlátlanul használhatja az AI funkciókat
- llm_tracker.py a worker-ben kezeli a naplózást

**Nyitott kérdés:** Kell-e per-user/per-company LLM költség limit? Ha igen, hogyan integrálódjon a subscription tierekbe?

**Rationale:** A költségek nyomon követése kész, de a limitálás és az üzleti modellbe való beépítés még nyitott.
