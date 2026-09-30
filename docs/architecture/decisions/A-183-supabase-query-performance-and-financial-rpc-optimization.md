# A-181: Supabase Adatbázis Teljesítmény-audit, Indexelés és Pénzügyi RPC Gyorsítás

**Státusz:** ✅ Decided  
**Dátum:** 2026-09-30  
**Érintett komponensek:** Supabase Postgres, `calculate_hungarian_vat_return`, `calculate_vat_return`, `get_gl_categorized_items`, `get_pnl_report`, `get_company_counts`, `InvoiceItemsDialog.tsx`, RLS Házirendek, Idegen kulcs indexek

---

## 1. Kontextus & Problémafelvetés

A rendszer termelési adatbázisának (`eaisybill-prod`) teljesítményvizsgálata során az alábbi kritikus szűk keresztmetszetek és anomáliák kerültek azonosításra:

1. **Lassú Lekérdezések és Hiányzó Indexek:**
   - `invoice_items` táblán a `notes IS NOT NULL` szűrés (1 362 ms) szekvenciális táblabejárást eredményezett.
   - `invoice_uploads` táblán a `(company_id, processing_status)` összetett szűrés hiányzó index miatt szintén szekvenciálisan futott.
   - Kliensoldali hiányzó filter: az `InvoiceItemsDialog.tsx` komponensben a NAV számla ikerpárok keresése `bizonylatsorszam` alapján futott `company_id` szűrő nélkül, 1 755 ms-os teljes táblabejárást generálva.
2. **Supabase Linter / Security & Performance Warnings:**
   - **32 db `auth_rls_initplan` figyelmeztetés:** Az RLS házirendekben közvetlenül hívott `auth.uid()` függvény minden egyes sorra újraértékelődött.
   - **30 db `unindexed_foreign_keys` figyelmeztetés:** Idegen kulcsok dedikált B-tree index nélkül, ami lassította a JOIN-okat és a CASCADE törléseket/zárolásokat.
3. **Nehéz Pénzügyi Tárolt Eljárások:**
   - `calculate_hungarian_vat_return` (HU ÁFA motor): Nagyobb cég esetén (4 112 számla / negyedév) **48 318 ms (48,3 másodperc)** futásidőt és **11 715 271 buffer olvasást** produkált!
   - `get_pnl_report`: Volatile jelölés és CTE nested loop újraértékelődés miatt 475–1 380 ms volt.
   - `get_gl_categorized_items`: Volatile állapot és a `needed_gl_numbers` CTE-ben hiányzó `vat_gl_number` indexek miatt 4 250 ms-ig tartott.

---

## 2. Megoldás & Architektúrális Döntések

### 2.1 Célzott Részleges és Összetett Indexelés
1. Létrehoztuk az `idx_invoice_items_notes` részleges indexet:
   ```sql
   CREATE INDEX IF NOT EXISTS idx_invoice_items_notes 
     ON public.invoice_items (company_id, invoice_id) 
     WHERE notes IS NOT NULL;
   ```
2. Létrehoztuk az `idx_invoice_uploads_status_company` összetett indexet:
   ```sql
   CREATE INDEX IF NOT EXISTS idx_invoice_uploads_status_company 
     ON public.invoice_uploads (company_id, processing_status, created_at DESC);
   ```
3. Létrehoztuk a hiányzó részleges indexeket `vat_gl_number`-re:
   ```sql
   CREATE INDEX IF NOT EXISTS idx_nav_invoices_vat_gl 
     ON public.nav_invoices (company_id, vat_gl_number) 
     WHERE vat_gl_number IS NOT NULL;

   CREATE INDEX IF NOT EXISTS idx_invoices_vat_gl 
     ON public.invoices (company_id, vat_gl_number) 
     WHERE vat_gl_number IS NOT NULL;
   ```
4. Az `InvoiceItemsDialog.tsx` komponensben hozzáadtuk a kötelező `company_id` szűrőt a NAV számla ikerpár lekérdezéshez.

### 2.2 RLS `(SELECT auth.uid())` Skalár Allekérdezés és FK Indexelés
- Mind a 32 RLS házirendet átírtuk a PostgreSQL által ajánlott `(SELECT auth.uid())` formátumra, így az InitPlan egyszer értékelődik ki tranzakciónként ahelyett, hogy soronként meghívódna.
- Mind a 30 unindexed foreign key kapcsolatra létrehoztuk a dedikált B-tree indexeket (pl. `idx_invoices_vendor_id`, `idx_invoices_customer_id`, `idx_acc_journal_lines_header_id`, stb.).

### 2.3 `calculate_hungarian_vat_return` — Lateral Join OR Csapda Megszüntetése
- **Gyökérok:** A számlákhoz tartozó banki tranzakció keresésénél a `LEFT JOIN LATERAL` záradékban lévő `OR` feltétel:
  ```sql
  WHERE (ni.transaction_id IS NOT NULL AND t1.id = ni.transaction_id)
     OR t2.matched_invoice_id = ni.id
     OR tim.invoice_id = ni.id
  ```
  miatt a PostgreSQL nem tudott indexet használni a belső ciklusban, és mind a 4 112 számlára teljes 23 222 soros szekvenciális táblabejárást végzett (összesen 95 millió sorvizsgálat).
- **Megoldás:** A laterális lekérdezést átírtuk egy `candidate_tx` allekérdezéssé `UNION ALL`-lal, ahol mind a 3 ág dedikált indexet használ (`transactions_pkey`, `idx_transactions_company_matched`, `idx_tim_invoice_id`):
  ```sql
  LEFT JOIN LATERAL (
    SELECT tx_id, transaction_date FROM (
      SELECT t1.id AS tx_id, t1.transaction_date
      FROM public.transactions t1
      WHERE ni.transaction_id IS NOT NULL AND t1.id = ni.transaction_id
      UNION ALL
      SELECT t2.id AS tx_id, t2.transaction_date
      FROM public.transactions t2
      WHERE t2.matched_invoice_id = ni.id
      UNION ALL
      SELECT t3.id AS tx_id, t3.transaction_date
      FROM public.transaction_invoice_matches tim
      JOIN public.transactions t3 ON t3.id = tim.transaction_id
      WHERE tim.invoice_id = ni.id
    ) candidate_tx
    ORDER BY transaction_date DESC NULLS LAST
    LIMIT 1
  ) t ON true
  ```

### 2.4 Pénzügyi Elemző RPC-k `STABLE` Jelölése és CTE Materializálás
- `get_pnl_report`, `get_company_counts`, `get_gl_balances`, `get_gl_categorized_items`, `get_purchase_vouchers_summary`, `get_subledger_items`, `get_subledger_item_matches`, `get_company_record_counts`, `get_croatian_eu_vat_statements` eljárásokat `STABLE`-re állítottuk, lehetővé téve a lekérdezéstervezőnek a subplan cache-elést.
- `get_pnl_report`-ban az `all_mappings` CTE-t `MATERIALIZED`-ra állítottuk, megakadályozva az N-szeres újrafuttatást a nested loop-ban.

### 2.5 Biztonsági Keményítés, Search Path és RLS Többszörös Permisszív Szabályzatok Megszüntetése
1. **Mutable `search_path` javítása:**
   - Az `override_gl_classification` és `acc_enforce_header_immutability` függvények fix `SET search_path TO 'public'` beállítást kaptak, megakadályozva a search_path eltérítéses támadásokat.
2. **Kereszt-táblás trigger védelme:**
   - Az `auto_detect_reverse_charge()` trigger (`nav_invoice_items` $\rightarrow$ `nav_invoices` írás) `SECURITY DEFINER` jogot kapott fix `search_path`-szel, garantálva a hibamentes lefutást korlátozott jogosultságú felhasználóknál is.
3. **Redundáns RLS szabályzatok eltávolítása:**
   - Töröltük a 4 db duplikált `SELECT` szabályzatot (`accounty_dividends_tenant_select`, `accounty_upo_credentials_select`, `accounty_efo_entries_select`, `Members can view company Minimax credentials`), ahol az `ALL` házirend már eleve lefedte a műveletet.
4. **Többszörös Permisszív RLS Szabályzatok Konszolidálása (18 figyelmeztetés $\rightarrow$ 0):**
   - `aggreg8_accounts` és `aggreg8_consents`: A menedzser `ALL` házirendet `INSERT`, `UPDATE`, `DELETE` ágakra bontottuk, így a `SELECT` műveletet kizárólag a tagi házirend értékeli ki egyetlen allekérdezéssel (nem duplázódik az ellenőrzés).
   - `bank_transactions`: A régebbi `bank_statements`-alapú és az új multi-tenant `company_id`-alapú `SELECT` házirendeket egyetlen optimalizált szabályzatba vontuk össze, `bank_statement_id IS NOT NULL` rövidrezárással (ami a sorok 100%-ánál elkerüli a felesleges allekérdezést).
5. **Védelem nélküli táblák és Elsődleges kulcsok:**
   - Létrehoztuk a hiányzó Primary Key kényszert az `invoices_vat_audit_backup_20260907` táblán.
   - Engedélyeztük az RLS-t és definiáltuk a `service_role` hozzáférést az `api_idempotency_keys`, `instance_forward_routes` és `invoices_vat_audit_backup_20260907` táblákon.
6. **Anonim Futtatási Jogok Visszavonása 77 Érzékeny SECURITY DEFINER RPC-ről:**
   - A PostgreSQL alapértelmezetten a `PUBLIC` pszeudo-szerepkörnek ad futtatási jogot. A `REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon;` és `GRANT TO authenticated, service_role;` lefutásával kizártuk az illetéktelen anonim hívásokat az összes pénzügyi, admin és dolgozó (worker) eljárásnál.
   - A PostgREST pre-request hook funkcióját ellátó `check_request()` eljárást szándékosan meghagytuk `anon` számára elérhetőként a bejelentkezési és publikus hívások védelmére.

---

## 3. Mért Eredmények (Evidence Before Assertions)

| Terület / Lekérdezés / Advisor | Előtte | Utána | Változás |
|---|---|---|---|
| `calculate_vat_return` (HU ÁFA motor, 4 112 számla) | **48 318 ms** (48,3s) | **995 ms** (<1s) | **48,5x gyorsulás (-97,9% I/O)** |
| `calculate_vat_return` shared buffers | 11 715 271 blokk | 248 950 blokk | **-97,9% terheléscsökkenés** |
| `get_gl_categorized_items` (teljes lista) | 4 250 ms | 998 ms | **4,2x gyorsulás** |
| `get_gl_categorized_items` (főkönyvi számra szűrve) | 1 170 ms | 65–131 ms | **9–18x gyorsulás** |
| `needed_gl_numbers` CTE feldolgozás | 369,2 ms | 5,4 ms | **68x gyorsulás** |
| `get_pnl_report` | 474,8 ms | 80,4 ms | **5,9x gyorsulás (-83,1%)** |
| `get_company_counts` | 321,0 ms | 40,8 ms | **7,8x gyorsulás (-87,3%)** |
| `InvoiceItemsDialog` NAV ikerpár lekérdezés | 1 755 ms | 0,082 ms | **~21 400x gyorsulás** |
| `invoice_items (notes)` lekérdezés | 1 362 ms | 3,9 ms | **350x gyorsulás (-99,7%)** |
| Supabase Auth RLS InitPlan figyelmeztetések | 32 db | **0 db** | **Megszüntetve** |
| Supabase Unindexed Foreign Keys figyelmeztetések | 30 db | **0 db** | **Megszüntetve** |
| Supabase Multiple Permissive Policies figyelmeztetések | 18 db | **0 db** | **Megszüntetve** |
| Supabase No Primary Key figyelmeztetések | 1 db | **0 db** | **Megszüntetve** |
| Supabase Function Search Path Mutable figyelmeztetések | 2 db | **0 db** | **Megszüntetve** |
| Supabase RLS Enabled No Policy figyelmeztetések | 3 db | **0 db** | **Megszüntetve** |
| Supabase Anon Executable Security Definer Functions | 114+ db | **1 db** (`check_request`) | **-99,1% kockázatcsökkentés** |

---

## 4. Migrációs Nyilvántartás
- `supabase/migrations/20260929234500_add_performance_indexes_invoice_items_and_uploads.sql`
- `supabase/migrations/20260929235000_optimize_auth_rls_initplan_32_policies.sql`
- `supabase/migrations/20260929235500_add_missing_foreign_key_indexes.sql`
- `supabase/migrations/20260929235800_optimize_financial_rpcs_stability_and_cte.sql`
- `supabase/migrations/20260930000500_optimize_calculate_vat_return_lateral_join.sql`
- `supabase/migrations/20260930001000_add_vat_gl_number_performance_indexes.sql`
- `supabase/migrations/20260930001500_security_search_path_rls_dedup_and_trigger_hardening.sql`
