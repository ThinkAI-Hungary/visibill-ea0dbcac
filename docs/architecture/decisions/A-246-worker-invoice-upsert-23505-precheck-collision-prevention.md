# A-246: Worker Invoice Upsert Idempotencia és Postgres 23505 Pre-Check Ütközésvédelem (Többoldalas és Kötegelt Feltöltések)

**Dátum:** 2026-10-10  
**Státusz:** Elfogadva és implementálva  
**Kapcsolódó ADR-ek:** ADR-074 (Idempotens Partner Upsert), ADR-079 (Duplex PDF Darabolás), A-225 (Duplex PDF Splitting)  
**Érintett komponensek:** Python Worker (`db.py`, `test_invoice_upsert_concurrency.py`), PostgreSQL `invoices` tábla  

---

## 1. Kontextus és Problémafelvetés

A 2026-10-10 20:58:00 CEST (18:58:00 UTC) éles vizsgálat során a Supabase PostgreSQL log stream-ben (`query_logs`) az alábbi kritikus hiba jelentkezett:
```text
23505: duplicate key value violates unique constraint "invoices_company_id_bizonylatsorszam_key"
Key (company_id, bizonylatsorszam)=(6eb38ea9-c201-4bca-95a9-f446e5ab6b19, A05704280/0767/00001) already exists.
```
A hibát kiváltó SQL utasítás:
```sql
WITH pgrst_source AS (
    UPDATE "public"."invoices" 
    SET "adoalap_osszesen" = ..., "bizonylatsorszam" = "pgrst_body"."bizonylatsorszam", ... 
    WHERE "public"."invoices"."id" = $2
)
```

### Gyökérok Elemzés
1. **Check 1 Vak UPDATE:** Az `upsert_invoice()` (`db.py`) Check 1 ágában, amikor egy feltöltés re-processing vagy egyedi módba lépett, a `.limit(1)` lekérdezés megtalálta a feltöltéshez tartozó meglévő (vagy korábbi csonka) rekordot (`invoice_id`), és előzetes ellenőrzés nélkül kísérelt meg egy `UPDATE invoices SET ... bizonylatsorszam = $1 WHERE id = invoice_id` módosítást.
2. **Kötegelt és Többoldalas Számlák Ütközése:** Amikor egy többoldalas számlát a daraboló több chunkra bontott, vagy a felhasználó egyszerre több számlaképet / blokkot töltött fel (pl. Tesco pénztárgépi nyugták és egyszerűsített számlák), mindkét chunk vagy rekord ugyanarra a számlaszámra hivatkozott.
3. **Zombi Rekordok Képződése:** Amikor a Check 1 UPDATE 23505 hibát dobott a PostgreSQL-ben, a Python oldali exception handler biztonsági hálója elkapta a hibát és frissítette a győztes számlát (`a8a45085-6e74-47ad-b844-35bf7dd0ae99`). Azonban az eredeti rekord (`540cf145-082b-4f62-975c-d519c2ecb4e2`) üres, 0 Ft-os, "Ismeretlen eladó" zombi számlaként az adatbázisban maradt, a PostgreSQL szervernaplóban pedig megjelent az ERROR szintű 23505 hiba.
4. **Több-számlás Feltöltések Önkényes `.limit(1)` Választása:** Ha egy feltöltéshez korábban több számla is tartozott, a Check 1 korábban nem számlasorszám alapján keresett rájuk, hanem önkényesen az első találatot vette, és megpróbálta átnevezni a másik számla sorszámára.

---

## 2. Döntés és Architektúrális Védelmi Vonalak

1. **Check 1 Sorszám-prioritású Illesztés:**
   Ha a kinyert `bizonylatsorszam` ismert, a Check 1 először mindig az `(invoice_uploads_id, bizonylatsorszam)` kompozit feltételre keres rá, így azonnal a megfelelő számlát frissíti, nem pedig egy másik chunk rekordját nevezi át.
2. **Check 1 Pre-Check Ütközésvédelem (Zero 23505 Invariant):**
   Mielőtt a meglévő `invoice_id` rekordra lefutna az UPDATE, a worker lekérdezi:
   ```sql
   SELECT id FROM invoices 
   WHERE company_id = :company_id AND bizonylatsorszam = :bizonylatsorszam AND id != :invoice_id 
   LIMIT 1;
   ```
   - **Ha másik számla (`winning_id`) már létezik:** A worker NEM futtatja le a hibára futó UPDATE-et!
   - **Adatfúzió:** Az új adatokat összefésüli a győztes számlába (`winning_id`) a meglévő mezők védelmével (`_preserve_existing_invoice_fields`).
   - **Zombi Rekord Tisztítás:** Amennyiben az `invoice_id` rekord egy üres placeholder volt (0 Ft végösszeg, "Ismeretlen eladó"), a rendszer automatikusan törli (`DELETE FROM invoices WHERE id = invoice_id`).
3. **Check 3 Harmadik Számla Ütközésvédelem:**
   A fuzzy duplikátum-felismerés és sorszám-korrekció során ellenőrizzük, hogy a javított sorszám nem ütközik-e egy harmadik számlával a cégnél.
4. **Safety Net Mezővédelem:**
   A 23505 kivételkezelő biztonsági hálóban is integrálásra került a `_preserve_existing_invoice_fields()`, megakadályozva, hogy a meglévő partneradatok felülíródjanak.

---

## 3. Verifikáció és Tesztek

A megoldást a `worker/test/unit_test/test_invoice_upsert_concurrency.py` tesztcsomag automatizáltan validálja:
- `test_upsert_invoice_check1_precheck_prevents_23505_collision`: Igazolja, hogy a Check 1 pre-check megakadályozza a 23505 hibát, összefésüli az adatokat és kitisztítja a csonka placeholder rekordot.
- `test_upsert_invoice_check1_prefers_matching_sorszam_when_upload_has_multiple_invoices`: Igazolja a sorszám-prioritású illesztést multi-invoice feltöltések újrafeldolgozásakor.
- A teljes 147 darabos worker tesztcsomag hibátlanul (100% zöld) lefutott.
