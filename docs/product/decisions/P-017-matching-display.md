# P-017: AI Párosítás Megjelenítés

**Status:** Decided  
**Category:** Tranzakció & Párosítás

**Question:** Hogyan jelenítjük meg az AI párosítás eredményét?

**Decision:** Confidence score + match type + gl_reasoning DB-ben tárolva, részletek a TransactionDetailsDialog-ban.

**Jelenlegi állapot:**
- `confidence_score` — DB-ben létezik (transactions tábla)
- `match_type` — DB-ben létezik (transactions tábla)
- `gl_reasoning` — DB-ben létezik (transactions + invoices tábla)
- `is_verified` — DB-ben létezik, manuális jóváhagyás flag
- Részletek dialógusban megtekinthetők (TransactionDetailsDialog.tsx)

**TODO:** Lista nézetben vizuális confidence megjelenítés (confidence bar, szín kódolás) implementálás.

**Rationale:** Az AI adatok DB-ben tárolva, a dialógusban megtekinthetők. A lista nézetben a vizuális megjelenítés még fejlesztendő.
