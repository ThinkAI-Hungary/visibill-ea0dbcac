# A-129: Partner-történeti Többségi Szabályú Számlakategorizálás & DB Triggerek

> **Státusz:** Decided  
> **Dátum:** 2026-09-20  
> **Szerző:** ThinkAI / Morfi  
> **Érintett komponensek:** `invoices`, `nav_invoices`, `auto_categorize_jobs`, `auto-categorize-invoices` (Edge Function), Python Worker (`category_classifier.py`)  
> **Kapcsolódó:** [BRD 059](../../business/decisions/059-partner-history-majority-categorization.md), [PRD P-096](../../product/decisions/P-096-auto-categorize-invoices-batch-progress-and-toast-ux.md), [ADR A-130](./A-130-nav-auto-sync-dawn-load-staggering.md)  

---

## Context (Kontextus)

Az automatikus számlakategorizáció korábban kizárólag az LLM modell meghívásával történt a manuális gomb megnyomásakor vagy a Python worker utófeldolgozó lépéseként.
Ez a megközelítés skálázódási és költségproblémákat vetett fel:
1. **Redundáns AI hívások és token-költség:** Ha egy cég havonta tucatnyi számlát kap ugyanattól a partnertől (pl. Telekom, DigitalOcean, Google Cloud, OMV), az AI minden egyes számlára újra és újra lefutott, holott a partner tevékenysége és besorolása állandó.
2. **Kiszámíthatóság és következetesség:** Az LLM alapú besorolás néha ingadozhatott azonos partner eltérő tételsorai esetén, míg a felhasználó elvárása az, hogy ha egy partnert már besoroltak (vagy korábban a számlái többsége egy kategóriába került), az új számlák automatikusan oda essenek.
3. **Versenyhelyzet és aszinkronitás:** Hosszabb számlalisták esetén a frontend blokkolódott vagy elfelejtődött a háttérben futó kategorizálás státusza, és a párhuzamos módosítások felülírhatták egymást.

---

## Decision (Döntés)

Egy intelligens, **kétfázisú és trigger-vezérelt partner-történeti többségi kategorizálási rendszert** vezettünk be az adatbázisban, az Edge Functionben és a Python workerben.

### 1. Adatbázis Trigger és Szigorú Többségi Szabály (Phase 1 / Mentéskori besorolás)
* **`public.get_partner_majority_category(p_company_id uuid, p_supplier_name text, p_tax_number text DEFAULT NULL) RETURNS uuid`:**
  * Egyesíti az adott cég korábbi `invoices` és `nav_invoices` bejövő (`INBOUND`) számláit.
  * **1. Prioritás (Partner Név):** A partner nevét `lower(trim(name))` formában normalizálja és többségi szavazást futtat (`top_cnt > second_cnt`).
  * **2. Prioritás (Adószám Törzsszám Fallback):** Ha a név alapján nincs egyértelmű többség vagy a partner neve kis mértékben eltér (pl. „Telekom Magyarország Zrt.” vs „Magyar Telekom Nyrt.”), de a partner 8 számjegyű adószáma ismert (`p_tax_number` / `elado_vat_id` / `supplier_tax_number`), a rendszer a magyar törzsszám (első 8 számjegy) alapján futtatja le a többségi szavazást.
  * **Döntetlen / Új partner védelem:** Ha holtverseny van (pl. 2 db IT vs 2 db Iroda), vagy a partner teljesen új (0 korábbi számla), a függvény `NULL`-t ad vissza, így nem találgat, hanem átengedi a döntést az AI-nak.
* **Valós idejű `BEFORE INSERT` triggerek:**
  * `trg_auto_categorize_invoices_on_insert` az `invoices` táblán (`NEW.elado_nev`, `NEW.elado_vat_id`).
  * `trg_auto_categorize_nav_invoices_on_insert` a `nav_invoices` táblán (`NEW.supplier_name`, `NEW.supplier_tax_number`).
  * Új számla feltöltésekor vagy NAV szinkronkor a számla **0 ms késleltetéssel és 0 AI token-felhasználással azonnal megkapja a kategóriát**, ha van név vagy adószám-alapú partner-történeti többség.

### 2. Kétfázisú Edge Function (`auto-categorize-invoices`)
* **Phase 1 — Partner többségi előszűrés (Név + Adószám törzsszám):**
  * Egyetlen SQL hívással (`public.get_company_partner_majority_categories`) lekéri a cég összes partnerének többségi kategóriáját név (`supplier_name`) és 8 jegyű adószám törzsszám (`tax_core`) szerint.
  * A kategorizálatlan számlák közül azonnal besorolja a partner-történettel lefedett tételeket.
  * Ha az összes számla lefedett, az AI inicializálása teljesen elmarad.
* **Phase 2 — AI kötegelt feldolgozás (Batching + Retry):**
  * Kizárólag a holtversenyes és új partnerek számláit küldi el az AI-nak 20-as kötegekben, exponenciális visszalépéses (retry) hibatűréssel.
* **Aszinkron Job Tracking & 5 Perces Idempotencia Retesz:**
  * `auto_categorize_jobs` táblában nyomon követett haladás (`processed`, `errors`, `total_invoices`, `rule_categorized_count`, `ai_categorized_count`).
  * **Párhuzamosság-védelem:** Az Edge Function és a frontend hook az indítás előtt ellenőrzi, hogy van-e már `pending` vagy `processing` job az elmúlt 5 percben. Ha igen, nem indít redundáns új háttérmunkát, hanem a meglévő aktív folyamathoz csatolja a klienst, megakadályozva a duplikált AI hívásokat.
  * Minden frissítésnél szigorú `.is('category_id', null)` feltétel garantálja, hogy már kategorizált számla soha ne íródjon felül véletlenül.

### 3. Worker Integráció (`category_classifier.py`)
* A Python worker az invoice mentése után futtatja a `category_classifier.py`-t.
* Első lépésként ellenőrzi a számla meglévő `category_id`-ját az adatbázisban (`get_invoice_category`).
* Ha a fenti DB trigger a partner-előzmények alapján már kitöltötte a kategóriát, a worker **azonnal átugorja az AI hívást**, megspórolva az LLM költséget és elkerülve a téves felülírást.
* A `set_invoice_category` frissítésbe bekerült a `.is_("category_id", "null")` feltétel.

---

## Consequences (Következmények)

### Pozitív
- **0 Token Költség a visszatérő partnereknél:** A rendszer az ismert partnerek (Telekom, DigitalOcean, rezsi, rendszeres beszállítók) számláit 100%-ban AI hívás nélkül sorolja be.
- **Azonnali felhasználói élmény:** A feltöltött számla azonnal a helyes kategóriában jelenik meg, nincs várakozási idő.
- **Koherencia a csatornák között:** Az e-mailben érkező számla, a manuális feltöltés, a NAV szinkron és a felületi gomb pontosan ugyanazt az adatbázis-szintű többségi szabályt alkalmazza.

### Kockázatok és Kezelésük
- *Kockázat:* Mi van, ha a partner korábban tévesen lett besorolva?  
  *Kezelés:* A felhasználó manuálisan bármikor átsorolhatja a számlát. Amint a helyes kategóriájú számlák száma meghaladja a téveseket, a többségi szabály automatikusan átbillen a helyes kategóriára.

---

## Implementation Details (Implementációs részletek)
* Migráció: [`supabase/migrations/20260920130000_partner_history_auto_categorization.sql`](file:///d:/ThinkAI/Visibill/eaisybill-prod/supabase/migrations/20260920130000_partner_history_auto_categorization.sql)
* Job migráció: [`supabase/migrations/20260920120000_create_auto_categorize_jobs.sql`](file:///d:/ThinkAI/Visibill/eaisybill-prod/supabase/migrations/20260920120000_create_auto_categorize_jobs.sql)
* Kategória duplikáció védelem: [`supabase/migrations/20260920100000_fix_categories_deduplication_and_constraint.sql`](file:///d:/ThinkAI/Visibill/eaisybill-prod/supabase/migrations/20260920100000_fix_categories_deduplication_and_constraint.sql)
* Edge Function: [`supabase/functions/auto-categorize-invoices/index.ts`](file:///d:/ThinkAI/Visibill/eaisybill-prod/supabase/functions/auto-categorize-invoices/index.ts)
* Worker modul: [`worker/category_classifier.py`](file:///d:/ThinkAI/Visibill/worker/category_classifier.py)
* Teszt suite: [`src/test/accounty/partnerMajorityCategorization.test.ts`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/test/accounty/partnerMajorityCategorization.test.ts)
