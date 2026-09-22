# A-139: Tranzakciós jutalék (fee_amount) és kötegelt számlaszám-feloldás

**Státusz:** Elfogadva  
**Dátum:** 2026-09-22  
**Kapcsolódó PRD:** [P-104: Tranzakció jutalék és számlaszám exportálása](../../product/decisions/P-104-transaction-fee-and-invoice-number-export-ux.md)  
**Érintett komponensek:** `public.transactions`, `visibill-worker` (`transaction_extractor.py`, `transaction_models.py`, `worker.py`), `useTransactionData.ts`, `TransactionTable.tsx`, `TransactionExportModal.tsx`, `TransactionFilters.tsx`

---

## 1. Kontextus és Problémafelvetés

A SimplePay és egyéb online fizetési szolgáltatók (pl. Barion, Stripe) tranzakciós riportjaiban a bruttó vásárlási összeg mellett elszámolásra kerül egy tranzakciós jutalék / kártyaelfogadói díj (`Tranzakciós jutalék`). 

1. **Adatvesztés a feldolgozáskor:** A `visibill-worker` korábbi CSV parsere kizárólag a bruttó összeget, dátumot és közleményt mentette a `transactions` táblába, a jutalék összegét eldobta. Emiatt a könyvelés nem tudta egyeztetni a banki beérkezést (amely a jutalékkal csökkentett nettó összeg) az elszámoló riporttal.
2. **Hiányzó számlaszám az exportban:** A felhasználóknak és könyvelőiknek hónap végén szüksége van egy exportra, ahol a SimplePay tranzakció mellett megjelenik a számlázórendszerben kiállított, a rendszer által automatikusan vagy manuálisan párosított számla sorszáma (`bizonylatsorszam` vagy `invoice_number`).
3. **N+1 kockázat:** A tranzakciók táblában a számlakapcsolat `matched_invoice_id` UUID-ként van tárolva, amely mutathat mind beküldött számlára (`invoices`), mind NAV számlára (`nav_invoices`). Ha az export soronként kérdezné le a számlákat, az súlyos N+1 teljesítményromlást okozna.

---

## 2. Architekturális Döntés

### 2.1 Adatbázis Séma Bővítés
- A `public.transactions` tábla kiegészült a `fee_amount numeric DEFAULT NULL` mezővel.
- Migráció: `supabase/migrations/20260922180000_add_fee_amount_to_transactions.sql`.
- Visszamenőleges migráció: A korábbi Victoria Music SimplePay CSV riportok Supabase Storage-ból történő újraolvasásával a meglévő 122 tranzakció `fee_amount` értéke visszamenőleg kitöltésre került.
- A `unique_transaction_entry` (`company_id, transaction_date, description, amount`) index sértetlen maradt, biztosítva a megbízható deduplikációt.

### 2.2 Worker Pipeline Frissítés
- `transaction_models.py`: A `RawTransaction` adatmodell kiegészült az opcionális `fee_amount: Optional[float] = None` attribútummal.
- `transaction_extractor.py`: A CSV parser automatikusan felismeri a jutalék fejléceket (`jutalék`, `tranzakciós jutalék`, `fee`, `commission`) mind pontos, mind részleges egyezéssel, és kinyeri az összeget (magyar számformátum: vessző tizedesjel, szóköz ezrescsoportosítás kezelése).
- `worker.py`: A `pending_rows` összeállításakor a `fee_amount` bekerül a mentendő rekordba.

### 2.3 Kötegelt Számlaszám Feloldás (Batch Resolution, Zero N+1)
A `useTransactionData.ts` hookban megvalósított `batchResolveInvoiceNumbers` függvény:
- Kigyűjti az összes exportálandó / megjelenítendő rekord egyedi `matched_invoice_id` azonosítóit.
- 500-as kötegekben (batch chunking) párhuzamos lekérdezést indít a Supabase felé:
  - `supabase.from('invoices').select('id, bizonylatsorszam').in('id', chunk)`
  - `supabase.from('nav_invoices').select('id, invoice_number').in('id', chunk)`
- Egyetlen memóriabeli `Map<string, string>` szótárat épít, amiből O(1) időben kiolvasható a számlaszám mind a táblázatban, mind az exportgeneráláskor.

### 2.4 UI Megjelenítés és Export Dialógus
- **Táblázat (`TransactionTable.tsx`):** Külön "Jutalék / Díj" oszlop, amely amber színű badge formájában jelzi a levont jutalékot. A lenyíló részletsorban részletesen megjelenik a levont díj és a nettó összeg.
- **Összesítő sáv (Footer):** A táblázat alján megjelenik a szűrt tranzakciók összesített jutaléka is.
- **Export Modális Ablak (`TransactionExportModal.tsx`):**
  - Választható formátum: Excel (.xlsx) vagy CSV (.csv).
  - Testreszabható oszlopok: Jutalék és Kapcsolódó számlaszám be/kikapcsolható.
  - Élő statisztikák: Bruttó összeg, Összes jutalék, Nettó jóváírás.

---

## 3. Következmények és Előnyök

- **Megbízhatóság:** Az online kártyás fizetések elszámolása 100%-ban transzparens, könyvelésre azonnal alkalmas formátumban áll elő.
- **Skálázhatóság:** A kötegelt számlaszám-feloldás révén még több tízezer tranzakció exportja sem terheli túl a Supabase adatbázist N+1 lekérdezésekkel.
- **Adatkonzisztencia:** A jövőbeli és múltbeli SimplePay feltöltések azonos struktúrában, díjakkal felvértezve érhetők el.
