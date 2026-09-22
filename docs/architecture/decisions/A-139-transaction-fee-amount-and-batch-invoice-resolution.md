# A-139: Tranzakciós jutalék (fee_amount) és kötegelt számlaszám-feloldás

**Státusz:** Elfogadva  
**Dátum:** 2026-09-22  
**Érintett komponensek:** `public.transactions`, `visibill-worker` (`transaction_extractor.py`, `transaction_models.py`, `worker.py`), `useTransactionData.ts`, `TransactionTable.tsx`  

---

## 1. Technikai Háttér
1. **SimplePay CSV Import:**
   - A SimplePay riportok fejlécében a `Tranzakciós jutalék` oszlop tartalmazza az elszámolt bankkártyás kezelési díjat.
   - A korábbi parser ezt a mezőt nem mentette a `transactions` táblába.
2. **Adatmodell Bővítés:**
   - A `public.transactions` tábla kiegészült a `fee_amount numeric DEFAULT NULL` mezővel.
   - Migráció: `20260922180000_add_fee_amount_to_transactions.sql`.
   - Visszamenőleges backfill futtatva az archív SimplePay uploadokra.
3. **Worker Pipeline:**
   - `RawTransaction` modell kiegészítve `fee_amount: Optional[float] = None` mezővel.
   - `_extract_from_csv` felismeri a jutalék fejléceket (`jutalék`, `tranzakciós jutalék`, `fee`) és kinyeri az összeget.
   - `worker.py` átadja a `pending_rows` dict-be mentéskor.
4. **Kötegelt Számlaszám Feloldás (Zero N+1):**
   - Az exportáláskor (`handleExport` és `handleBulkExport`) az érintett tranzakciók `matched_invoice_id` gyűjteményét egy kötegben, párhuzamos lekérdezéssel oldjuk fel az `invoices` (`bizonylatsorszam`) és `nav_invoices` (`invoice_number`) táblákból (500-as batch mérettel chunkolva).
   - Nincs N+1 hálózati overhead.
