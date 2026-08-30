# P-017: AI Párosítás & Kapcsolódó Tranzakciók Megjelenítése

**Status:** Decided  
**Category:** Tranzakció & Párosítás

**Question:** Hogyan jelenítjük meg az AI és manuális párosítás eredményét a tranzakciók és számlák felületén?

**Decision:** 
1. **Tranzakciók nézet:** Confidence score + match type + reason DB-ben tárolva, részletek a `TransactionDetailsDialog`-ban és az `ExpandedInvoiceRow`-ban.
2. **Számlák nézet (Lenyitott számlasor):** A számlák táblázatában (`InvoicesPage`) a sor lenyitásakor az `ExpandedInvoiceRow` azonnal (0ms) megjeleníti a párosított tranzakció kártyáját (összeg, dátum, leírás, AI párosítási indoklás, Jóváhagyás és Párosítás megszüntetése gombok).

**Jelenlegi állapot:**
- `confidence_score` — DB-ben tárolva (transactions tábla)
- `match_type` — DB-ben tárolva (transactions tábla: `exact`, `amount_date`, `ai_suggested`, `manual`)
- `reason` / `gl_reasoning` — DB-ben tárolva, magyarázat a párosítás miértjére
- `is_verified` — Manuális jóváhagyás flag
- **ExpandedInvoiceRow:** Mind a NAV, mind a feltöltött számlák lenyitásakor azonnal rendereli a párosított banki tranzakciókat és a feltöltött számlaképeket.
- Részletek dialógusban megtekinthetők (`TransactionDetailsDialog.tsx`).

## Kapcsolódó
- [P-054: Scalable Server-Side Invoice Pagination & Page-Level Batch Matching UX](./P-054-server-side-invoice-pagination-and-kpi-filters-ux.md)
- [A-014: React Query Cache Stratégia](../../architecture/decisions/A-014-react-query-cache.md)
- [P-018: Manuális párosítás felülírás](./P-018-manual-matching.md)
