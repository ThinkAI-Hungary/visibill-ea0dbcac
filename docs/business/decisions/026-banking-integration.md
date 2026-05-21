# Decision 026: Banki Integráció Jövője

**Status:** Open

**Category:** Integrációk & Jövő

**Question:** A banki adatok kezelése továbbra is manuális CSV import marad, vagy tervezünk Open Banking (PSD2) integrációt? Ha igen, mely bankokkal? Szükséges-e real-time tranzakció monitoring?

**Decision:**

**Jelenlegi implementáció:**
- bank_statements / bank_transactions / bank_statement_uploads táblák léteznek
- trigger-bank-statement-processing Edge Function kész
- Jelenleg 0 rekord — a funkció még nem aktívan használt
- A fő tranzakció import a transaction_uploads → transactions pipeline-on keresztül történik (CSV)

**Rationale:**
