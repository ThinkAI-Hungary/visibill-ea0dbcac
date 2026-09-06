# A-097: Multi-Tenant nav_invoice_items Denormalizáció, GL Statement Timeout Felszámolása és RLS Optimalizálás

**Status:** Decided  
**Date:** 2026-09-06  
**Utoljára frissítve:** 2026-09-06  

## Context
A PostgreSQL adatbázisban a háttér-worker által végzett főkönyvi (General Ledger) automatikus besorolási folyamat (`db.py` -> `get_gl_context`) során ismétlődő adatbázis-időtúllépések jelentkeztek:
```
canceling statement due to statement timeout (13:24:03, 13:24:12, 13:24:22)
```

### Gyökérok Elemzés
A worker és a frontend (`Projects.tsx`, `useNotesData.ts`) a `nav_invoice_items` tételeket PostgREST lateral join segítségével kérdezte le (`nav_invoices!inner(...)` szűrve `nav_invoices.company_id`-ra).
Mivel a `nav_invoice_items` tábla **126 394 sort** tartalmazott, és szigorúan 3NF normalizált formában csak a szülő számlára (`nav_invoice_id`) hivatkozott, közvetlen `company_id` oszlop és tenánsindex nélkül:
1. **PostgREST Lateral Join Csapda:** A PostgREST által generált SQL lekérdezés:
   ```sql
   FROM nav_invoice_items 
   INNER JOIN LATERAL (
     SELECT ... FROM nav_invoices 
     WHERE nav_invoices.company_id = $1 AND nav_invoices.id = nav_invoice_items.nav_invoice_id 
     LIMIT 1
   )
   ```
   A `LIMIT 1` miatt a PostgreSQL lekérdezéstervező nem tudta ellapítani (decorrelate) a csatolást, így a teljes 126 394 tételen szekvenciális pásztázást (`Seq Scan on nav_invoice_items`) hajtott végre soronként kiértékelve a szubquery-t (~7 756 – 10 000+ ms), ami túllépte a Supabase 8-10 másodperces `statement_timeout` limitjét.
2. **RLS Soronkénti Terhelés:** A `nav_invoice_items` RLS szabálya minden lekérésnél összekapcsolta a `nav_invoices` és `company_members` táblákat, ami a frontend lekérdezéseknél jelentős tervezési és I/O terhelést okozott.
3. **Könyvelésből Kizárt Tételek Besorolása:** A korábbi worker logika nem szűrte a `exclude_from_accounting = true` jelölésű számlákat és tételeket, felesleges LLM token- és API-költséget okozva kizárt tételekre.

---

## Decision

1. **`company_id` Denormalizáció a `nav_invoice_items` Táblán:**
   - Oszlop bevezetése idegen kulccsal: `ALTER TABLE public.nav_invoice_items ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;`
   - Mind a 126 394 meglévő tételsor azonnali feltöltése (backfill) a szülő `nav_invoices.company_id` értékével.
   - B-fa index létrehozása: `idx_nav_invoice_items_company_id ON public.nav_invoice_items(company_id)`.
   - Parciális index létrehozása a teljesen új tételekhez: `idx_nav_invoice_items_company_unclassified ON public.nav_invoice_items(company_id) WHERE (gl_classifications IS NULL)`.

2. **Kétirányú Adatbázis-Trigger Védőháló (Defense in Depth):**
   - **Öröklési Trigger (`trg_set_nav_invoice_items_company_id`):** `BEFORE INSERT OR UPDATE OF nav_invoice_id, company_id ON public.nav_invoice_items`. Ha egy beszúrt tételnél a `company_id` nincs megadva, automatikusan lekérdezi és kitölti a szülő `nav_invoices` cégazonosítójával.
   - **Szülő Szinkronizációs Trigger (`trg_sync_nav_invoice_items_company_id`):** `AFTER UPDATE OF company_id ON public.nav_invoices`. Ha egy számla cég-hozzárendelése megváltozik, automatikusan átvezeti az új `company_id`-t az összes alatta lévő tételsorra.
   - **Alkalmazásréteg Védelem:** A `NavIngestionService` Edge Function tételsor-mentése explicit módon átadja a `company_id: dbInvoice.company_id` értéket.

3. **Nagy Sebességű `get_unclassified_gl_items` RPC:**
   - Létrehoztunk egy dedikált `SECURITY DEFINER` tárolt eljárást (`get_unclassified_gl_items(p_company_id uuid, p_preset_id text)`).
   - Egyetlen hívásban, szerveroldalon fésüli össze a 3 forrástáblát (`nav_invoice_items`, `invoice_items`, `transactions`).
   - Kifejezett `AND nii.company_id = p_company_id` feltétellel a PostgreSQL azonnal Hash Joinra vált az indexelt tételeken.
   - Beépítettük a `COALESCE(exclude_from_accounting, false) = false` feltételt számla és tétel szinten is.

4. **RLS Policy Optimalizálás:**
   - A `nav_invoice_items` tábla RLS szabályát (`Members can manage nav invoice items`) frissítettük:
   - A `nav_invoices` join helyett közvetlenül a `company_members` táblán ellenőrzi a jogosultságot, és az `auth.uid()`-t gyorsítótárazza a scalar `(SELECT auth.uid())` subquery segítségével.

5. **Frontend & Worker Hívók Optimalizálása:**
   - A `Projects.tsx` és `useNotesData.ts` szűréseit közvetlen `.eq('company_id', selectedCompany.id)` formára állítottuk.
   - A worker `db.py` mostantól elsődlegesen az optimalizált RPC-t hívja, és a fallback ágban is közvetlenül a `company_id`-ra szűr.

---

## Consequences

### Pozitív
- **Statement Timeout Megszűnése:** A korábbi >8 000 ms-os timeout helyett a teljes unclassified lekérdezés **109 ms alatt** lefut (> 73x gyorsulás).
- **Közvetlen Céges Tételszűrés:** 7 756 ms helyett **0.172 ms** (> 45 000x gyorsulás).
- **RLS Tervezési Idő:** 12.08 ms-ról **2.27 ms-ra** csökkent (> 5x gyorsulás), az I/O terhelés több mint felével esett vissza (897 -> 363 buffer).
- **Költségmegtakarítás:** Az `exclude_from_accounting` szűréssel kizárt számlákra nem fogy felesleges LLM token.
- **Skálázhatóság & Particionálhatóság:** A tábla mostantól több millió sorig stabil $O(\log N)$ B-fa mélységgel, és szükség esetén felkészült a PostgreSQL deklaratív particionálására.

### Negatív / Trade-offok
- **Redundáns tárolás:** A `company_id` tárolása többlethelyet igényel soronként (16 bájt UUID + index), ami 126k sornál elhanyagolható (~5 MB), de óriási teljesítményelőnyt nyújt.
- **Trigger overhead beszúráskor:** A `BEFORE INSERT` trigger minimális mikromásodperces késleltetést jelent, amit ellensúlyoz a garantált adatkonzisztencia.

---

## Kapcsolódó
- [A-016: Főkönyvi Aszinkron Besorolás & PGMQ Worker Architektúra](./A-016-gl-classification-worker-architecture.md)
- [A-096: Hivatalos NAV Tételsor Védőháló és Szinkronizáció](./A-096-authoritative-nav-line-items-crosscheck-and-sync-guard.md)
- [05-nav.md Database Spec](../database/05-nav.md)
