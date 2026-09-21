# A-136: Számlatételek Áfakód Szerkeszthetősége és Gépi Tanulási (Machine Learning) Memória

**Státusz:** Elfogadva  
**Dátum:** 2026-09-21  
**Érintett komponensek:** `public.nav_invoice_items`, `public.invoice_items`, `public.vat_code_overrides_log`, `override_vat_code_batch()`, `VatCodeConfigTab.tsx`, `InvoiceItemsDialog.tsx`, `vatCodeMatching.ts`

---

## 1. Kontextus és Problémafelvetés

1. **Áfakód Szerkesztés Igénye a Számlák Nézetében:**  
   Bár az A-135-ös döntés bevezette a konvencionális könyvelői kódokat és az automatikus heurisztikus felismerést, a könyvelőknek és operátoroknak szüksége van arra, hogy a számlatételek nézetében (`InvoiceItemsDialog`) közvetlenül felülbírálhassák a tételhez rendelt áfakódot egyedi vagy tömeges (bulk) kijelöléssel.
2. **Gépi Tanulás (ML / Few-Shot Feedback Loop) Hiánya:**  
   Ha egy felhasználó módosított egy tételt (pl. egy adott beszállító acéltermékét vagy egy speciális adómentes szolgáltatást), a rendszer a következő számlánál újra az általános heurisztikát alkalmazta volna, ismételt kézi korrekcióra kényszerítve a felhasználót. Szükség volt egy öntanuló mechanizmusra, amely megjegyzi a partner és tétel szintű döntéseket, és automatikusan felajánlja / alkalmazza azokat a jövőben.
3. **Áfa Kód Beállítások Modal Túlcsordulási Hiba:**  
   Az új vagy szerkesztendő áfakód modáljában (`VatCodeDialog` a `VatCodeConfigTab.tsx`-ben) a célrendszer választó sorok flexbox túlcsordulása miatt a modális ablak jobb széle bizonyos képernyőméreteknél kilógott a képernyőről.

---

## 2. Döntések

### 2.1 Adatbázis Séma és Migráció (`20260921160000_vat_code_overrides_and_learning.sql`)

1. **Tételszintű Áfakód Perzisztencia:**
   - `public.nav_invoice_items`:
     - `vat_code_id UUID REFERENCES public.vat_codes(id) ON DELETE SET NULL`
     - `vat_code TEXT`
     - `is_vat_code_manual BOOLEAN NOT NULL DEFAULT false`
   - `public.invoice_items`:
     - `vat_code_id UUID REFERENCES public.vat_codes(id) ON DELETE SET NULL`
     - `vat_code TEXT`
     - `is_vat_code_manual BOOLEAN NOT NULL DEFAULT false`
   - B-tree indexek a gyors joinokhoz és lekérdezésekhez (`idx_nav_invoice_items_vat_code_id`, `idx_invoice_items_vat_code_id`).

2. **Gépi Tanulási Szabálytár (`public.vat_code_overrides_log`):**
   - Rögzíti a felülbírálások kontextusát:
     - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
     - `company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE`
     - `partner_tax_number TEXT`: A partner adószáma (első 8 számjegy tisztítva a párosításhoz)
     - `partner_name TEXT`: Partner neve audit célból
     - `item_description TEXT NOT NULL`: A számlatétel megnevezése
     - `original_vat_rate TEXT`: Eredeti áfakulcs (pl. 27%, F.AFA)
     - `original_vat_code TEXT`: Eredeti áfakód
     - `new_vat_code_id UUID NOT NULL REFERENCES public.vat_codes(id) ON DELETE CASCADE`
     - `new_vat_code TEXT NOT NULL`: Újonnan kiválasztott áfakód (pl. BE_FORD_ACEL, 25)
     - `direction TEXT NOT NULL DEFAULT 'INBOUND'`
     - `user_id UUID REFERENCES auth.users(id)`
     - `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
   - Indexek: `(company_id, partner_tax_number)`, `(company_id, item_description)`, `(company_id, created_at DESC)`.
   - Multi-tenant RLS szabályok `company_members` ellenőrzéssel.

3. **Atomikus Könyvelési Batch RPC (`override_vat_code_batch`):**
   - `SECURITY DEFINER` és `SET search_path = public`.
   - Bemenet: `p_items JSONB` (tétel ID-k és táblatípusok `nav_invoice_items` vagy `invoice_items`), `p_new_vat_code_id UUID`, `p_company_id UUID`, `p_user_id UUID`.
   - Egyetlen tranzakcióban:
     - Érvényesíti a `p_new_vat_code_id` létezését és jogosultságát.
     - Frissíti az érintett tételeket (`vat_code_id`, `vat_code`, `is_vat_code_manual = true`).
     - Inszertálja a tanulási szabályt a `vat_code_overrides_log` táblába.

---

### 2.2 4-Szintű Kaszkád Felismerő és Tanulási Motor (`src/utils/vatCodeMatching.ts`)

A számlatételek áfakódjának meghatározása a `resolveVatCodeWithLearning()` függvénnyel történik:
1. **1. szint (Kézi felülbírálás):** Ha a tételen már be van állítva `vat_code_id` vagy `itemVatCode` (`is_vat_code_manual`), ez a legmagasabb prioritás (`source: 'manual'`).
2. **2. szint (Partner-specifikus gépi tanulás):** Ha az adott céghez létezik korábbi felülbírálás ugyanarra a partnerre (adószám első 8 számjegye alapján) és a tétel leírása (normalizált szöveg és részstring) egyezik (`source: 'learned_partner'`).
3. **3. szint (Cégszintű tétel-specifikus gépi tanulás):** Ha a leírás egyedi kulcsszavai (min. 6 karakter) egyeznek egy korábbi felülbírálással a cégnél, más partnereknél is alkalmazzuk (`source: 'learned_company'`).
4. **4. szint (Jogszabályi heurisztika):** Alapértelmezett illesztés a NAV kulcsok és fordított adózási kulcsszavak alapján (`matchItemToVatCode`, `source: 'heuristic'`).

### 2.3 Számlatételek Interaktív Kezelése (`InvoiceItemsDialog.tsx`)

- **Egyedi cellaszerkesztés:** Az Áfa kód oszlopban található badge interaktív dropdown menüvé vált. Kattintásra listázza az érvényes áfakódokat (kód, leírás, kulcs).
- **Vizuális státuszindikátorok:**
  - ✨ **Csillag ikon (Sparkles):** Gépi tanulás által felajánlott áfakód esetén sárga csillag jelenik meg mellette, a tooltipben indoklással (`✨ Gépi tanulás: a(z) Partner korábbi hasonló tételeinél ezt állítottad be`).
  - ✏️ **Ceruza ikon (Pencil):** Kézzel módosított egyedi tételnél kis ceruza jelzi az egyedi felülbírálást.
- **Tömeges (Bulk) Módosítás:** A számlatételek kijelölése után megjelenő lebegő műveleti sávban új gomb: *"Áfakód módosítása (N db)"*. Megnyitja a megerősítő modált, ahol egy kattintással az összes kijelölt tétel és azok ikerpárjai átkódolhatók és megtanulhatók.
- **Ikerpár Szinkronizáció:** A `findTwinItems()` segítségével a `nav_invoice_items` és `invoice_items` tételek szinkronban frissülnek.

---

### 2.4 Beállítások Modal Túlcsordulás Javítása (`VatCodeConfigTab.tsx`)

- A `VatCodeDialog` ablak túlcsordulását a flexbox `min-w-0` hiánya okozta a célrendszer leképezési sorokban (`w-full flex items-center justify-between gap-3`).
- A `DialogContent` kapott `w-[calc(100vw-2rem)] sm:max-w-xl max-h-[90vh] overflow-y-auto overflow-x-hidden p-6` védelmet.
- A sorokban a címke `<span className="flex-1 min-w-0 truncate">`, a select komponensek pedig fix `shrink-0` szélességet kaptak (`w-24 shrink-0` és `w-20 shrink-0`), megszüntetve a kilógást.

---

## 3. Konzekvenciák és Eredmények

- **Minimális manuális munka:** A könyvelőnek csak egyszer kell korrigálnia egy tétel áfakódját; a rendszer azonnal megtanulja és a következő számlán már automatikusan felajánlja.
- **Transzparens működés:** A felhasználó mindig pontosan látja (badge ikonok és tooltip segítségével), hogy az áfakód kézi döntésből, gépi tanulásból vagy jogszabályi heurisztikából származik.
- **Reszponzív, hibamentes beállítások modal:** Bármely képernyőméreten hibátlanul használható a kódok konfigurálása.
