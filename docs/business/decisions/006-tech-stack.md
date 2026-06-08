# Decision 006: Tech Stack

**Status:** Decided

**Category:** Architektúra & Infrastruktúra

**Question:** Milyen technológiai stacket használ a Visibill?

**Decision:**

| Réteg | Technológia |
|-------|-------------|
| Frontend | React + Vite + TypeScript + shadcn/ui |
| Backend DB | Supabase (PostgreSQL) |
| Serverless Functions | Supabase Edge Functions (Deno) |
| Dokumentum Feldolgozó | Python Worker (Docker, PGMQ queue) |
| OCR | AWS Textract + MarkItDown |
| AI/LLM | OpenAI GPT modellek |
| Email | Mailgun (bejövő webhook + kimenő) |
| NAV | NAV Online Számla API v3 |
| Hosting | Supabase Cloud |

**Prod sidebar menüpontok** (19 oldal):
Irányítópult, Kategóriák, Projektek, Partnertörzs, Számlák, Kintlévőség, Tranzakciók, Főkönyv, Eredménykimutatás, Mérleg, Beszámoló, Feltöltés, Bérek/járulékok, Munkaidő, Házipénztár, TENY, Integrációk, Árfolyamok, Előfizetés

**Prod support:** FeedbackDialog (FAB gomb) — egyszerű visszajelzési űrlap, NEM teljes ticket rendszer.

**Rationale:** Supabase-t választottuk a gyors fejlesztés, beépített auth, RLS, és realtime képességek miatt. A Python worker külön Docker container-ben fut, mert az AI/ML ökoszisztéma Pythonban a legerősebb. Edge Functions-t használunk a könnyű serverless logikákhoz (NAV sync, email küldés).

## Kapcsolódó Architekturális Döntések
- [A-001: Három rétegű architektúra](../../architecture/decisions/A-001-system-architecture.md)
- [A-002: Supabase mint BaaS](../../architecture/decisions/A-002-supabase-baas.md)
- [A-005: Edge Functions](../../architecture/decisions/A-005-edge-functions.md)
