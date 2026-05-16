# Decision 007: Multi-instance Stratégia

**Status:** Open

**Category:** Architektúra & Infrastruktúra

**Question:** Miért fut két külön Supabase projekt (visibill + visibill-vsweb)? Mi a pontos céljuk? Staging vs. production? Különböző ügyfeleknek? Hosszú távon marad-e ez a struktúra?

**Decision:**

**Jelenlegi implementáció:** Két Supabase projekt létezik azonos sémával:
- **visibill** — 28 user, 12 company, 7026 NAV számla, 1034 tranzakció
- **visibill-vsweb** — 6 user, 2 company, 8437 NAV számla, 72 tranzakció

Mindkettőhöz azonos frontend (VSWEB) csatlakozik. Mindkettőn azonos Edge Functions futnak.

**Rationale:**
