# Decision 025: Munkaidő & Szabadság Modul Scope

**Status:** Partially Decided

**Category:** HR & Munkaidő

**Question:** Mi a munkaidő és szabadság modul pontos scope-ja? Csak nyilvántartás vagy integráció a bérszámfejtéssel? A munkaidő alapú óradíj kalkuláció automatikus?

**Decision:**

**Jelenlegi implementáció:**
- **Munkaidő:** time_entries tábla (napi órák, projekt hozzárendelés, draft→submitted→approved workflow, absence_type)
- **Szabadság:** leave_requests (pending→approved/rejected, admin megjegyzés, felülvizsgáló)
- **Cég beállítások:** company_settings (munkaidő 09:00-17:00, admin deadline 20:00, 168 óra/hó)
- **Employee rates:** óradíj és havi bér az alkalmazottakhoz

Jelenleg 0 rekord mindkét táblában (time_entries, leave_requests) — funkció implementálva de még nem használva aktívan.

**Nyitott kérdés:** A munkaidő adatokból automatikusan számolja-e a rendszer a bérköltséget (óradíj × ledolgozott órák)?

**Rationale:**
