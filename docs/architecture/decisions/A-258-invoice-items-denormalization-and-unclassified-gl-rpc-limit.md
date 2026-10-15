# A-258: invoice_items Multi-Tenant Denormalizáció, PostgREST Lateral Join Timeout Felszámolása és get_unclassified_gl_items Limit Védelem

**Status:** Decided  
**Date:** 2026-10-15  
**Utoljára frissítve:** 2026-10-15  

## Context
2026. október 15-én a reggeli 06:00-s (Budapest idő) időzített feladatok (5 pg_cron job, napi dev replikációs szinkronizáció) és a Python háttér-worker (GL Classifier) futása során ismétlődő adatbázis-időtúllépések (`57014 canceling statement due to statement timeout`) jelentkeztek:
```
15 Oct 26 06:00:22 57014 canceling statement due to statement timeout (get_unclassified_gl_items)
15 Oct 26 06:00:32 57014 canceling statement due to statement timeout (get_unclassified_gl_items retry)
15 Oct 26 06:00:33 57014 canceling statement due to statement timeout (nav_invoices select)
15 Oct 26 06:00:42 57014 canceling statement due to statement timeout (invoice_items lateral join)
```

### Gyökérok Elemzés

1. **`get_unclassified_gl_items` Hiányzó Limit & Memóriatúlcsordulás:**
   - A tárolt eljárás nem rendelkezett belső `LIMIT` korláttal.
   - Nagy tételszámú cégeknél (pl. Mandala Fogadó Kft. — 43 076 unclassified tétel) a PL/pgSQL motor a teljes adathalmazt memóriába gyűjtötte a 3 forrástáblából (`nav_invoice_items`, `invoice_items`, `transactions`).
   - Ez terheletlen dev adatbázison is 9 893 ms-ig tartott, ami a hajnali konkurens terhelés mellett azonnal túllépte a 10 másodperces `statement_timeout`-ot.

2. **`invoice_items` PostgREST Lateral Join Csapda:**
   - Míg az [ADR A-097](./A-097-multi-tenant-nav-items-denormalization-and-gl-optimization.md) sikeresen denormalizálta a `company_id` oszlopot a `nav_invoice_items` táblára, a manuális számlák tételtáblája (`invoice_items`, 36 716 sor) továbbra is kizárólag `invoice_id` idegen kulccsal rendelkezett.
   - Amikor a worker fallback ágra futott, vagy a frontend ([useNotesData.ts](file:///d:/ThinkAI/Visibill/eaisybill/src/hooks/useNotesData.ts)) jegyzeteket olvasott be, a PostgREST a következő SQL-t generálta:
     ```sql
     FROM invoice_items 
     INNER JOIN LATERAL (
       SELECT ... FROM invoices 
       WHERE invoices.company_id = $1 AND invoices.id = invoice_items.invoice_id 
       LIMIT 1
     )
     ```
   - Ez szekvenciális pásztázást kényszerített ki mind a 36 716 tételen soronként kiértékelve az al-lekérdezést (49 590 megosztott buffer olvasással), ami a reggeli terhelés alatt timeoutolt.
   - Az `invoice_items` RLS szabálya (`Members can manage invoice items`) szintén soronként joinolta az `invoices` és `company_members` táblákat.

---

## Decision

### 1. `get_unclassified_gl_items` Beépített Limit Védelem
- A függvény szignatúrája kibővült az opcionális `p_limit integer DEFAULT 1000` paraméterrel.
- A belső lekérdezés korlátozva lett: `LIMIT LEAST(GREATEST(COALESCE(p_limit, 1000), 1), 5000)`.
- A szűrőfeltételek kiegészültek az `invoice_items` közvetlen cégazonosító szűrésével (`AND ii.company_id = p_company_id`).

### 2. `company_id` Denormalizáció az `invoice_items` Táblán
- Oszlop bevezetése idegen kulccsal:
  ```sql
  ALTER TABLE public.invoice_items 
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
  ```
- Mind a 36 716 meglévő tétel feltöltése (backfill) a szülő `invoices.company_id` értékével (0 db NULL rekord maradt).
- Multi-tenant B-fa indexek:
  - `idx_invoice_items_company_id ON public.invoice_items(company_id)`
  - `idx_invoice_items_comp_inv ON public.invoice_items(company_id, invoice_id)`

### 3. Automatikus Szinkronizációs Triggerek (Defense in Depth)
- **`trg_set_invoice_items_company_id`:** `BEFORE INSERT OR UPDATE OF invoice_id, company_id ON public.invoice_items`. Ha a `company_id` nincs kitöltve beszúráskor, automatikusan kitölti a szülő `invoices` rekordból.
- **`trg_sync_invoice_items_company_id`:** `AFTER UPDATE OF company_id ON public.invoices`. Ha a számla cég-hozzárendelése megváltozik, átvezeti az összes alá tartozó tételsorra.

### 4. RLS Házirend és Klienshívások Optimalizálása
- Az `invoice_items` RLS szabálya (`Members can manage invoice items`) közvetlen `company_members` ellenőrzésre lett cserélve a felesleges `invoices` join elhagyásával és a gyorsítótárazott `(SELECT auth.uid())` használatával.
- A frontend `useNotesData.ts` hívója közvetlen `.eq('company_id', companyId)` szűrésre lett átállítva az `.eq('invoices.company_id', companyId)` lateral join helyett.

---

## Consequences

### Pozitív
- **`get_unclassified_gl_items` Sebesség:** 9 893 ms-ról **26,3 ms-ra** csökkent (>370x-es gyorsulás a Mandala Fogadó Kft. 43 000 tételén).
- **`invoice_items` Céges Lekérdezés:** 478 ms-ról **1,95 ms-ra** csökkent (>240x-es gyorsulás), az I/O terhelés 49 590 bufferről **258 bufferre** esett vissza (99,5%-os I/O megtakarítás).
- **Timeoutok Megszűnése:** A reggeli 06:00-s cron és worker futás alatti statement timeoutok és lateral join torlódások végleg elhárultak.
- **Teljes Séma-Paritás:** Az `invoice_items` mostantól azonos tenánsmintát és trigger-védelmet követ, mint a `nav_invoice_items` (ADR A-097).

---

## Kapcsolódó
- [A-097: Multi-Tenant nav_invoice_items Denormalizáció, GL Statement Timeout Felszámolása és RLS Optimalizálás](./A-097-multi-tenant-nav-items-denormalization-and-gl-optimization.md)
- [A-257: Főkönyvi Kivonat Pre-Aggregáció & JSON RPC](./A-257-general-ledger-balances-preaggregation-and-atomic-json-rpc.md)
- [rpc-catalog.md](../rpc-catalog.md)
