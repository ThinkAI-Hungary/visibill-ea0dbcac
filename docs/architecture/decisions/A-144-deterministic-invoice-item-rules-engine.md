# A-144: Determinisztikus Számlatétel Szabály Motor (`invoice_item_rules`) és Kötegelt Illesztési Architektúra

**Státusz:** ✅ Elfogadva  
**Dátum:** 2026-09-24  
**Döntéshozó:** Antigravity Architect  
**Kapcsolódó Termékdöntés:** [P-109: Determinisztikus Számlatétel Szabály Motor és Quick Save UX](../../product/decisions/P-109-invoice-item-rules-and-quick-save-ux.md)  
**Kapcsolódó Hibajegy:** EB-0178  
**Adatbázis Migrációk:**
- [`20260924120000_create_invoice_item_rules.sql`](file:///d:/ThinkAI/Visibill/eaisybill-prod/supabase/migrations/20260924120000_create_invoice_item_rules.sql)
- [`20260924130000_update_invoice_item_rules_rpc_tax_and_escape.sql`](file:///d:/ThinkAI/Visibill/eaisybill-prod/supabase/migrations/20260924130000_update_invoice_item_rules_rpc_tax_and_escape.sql)

---

## 1. Architektúrális Háttér & Indoklás

A számlák főkönyvi osztályozására a Visibill korábban két fő mechanizmust biztosított:
1. **Mesterséges intelligencia (LLM prompt rules via `company_prompt_rules`):** Természetes nyelvű szabályok alapján a háttér-worker dolgozta fel a számlákat.
2. **Kézi egyedi felülbírálás (`override_gl_classifications_batch`):** Egyedi rekordmódosítás az `InvoiceItemsDialog` felületéről, amely a `gl_classifications` JSONB mezőt frissítette.

Hiányzott azonban egy olyan **determinisztikus, szabályalapú réteg**, amely:
- Közvetlenül a relációs adatbázisban tárolja a feltételeket (`invoice_item_rules`).
- NULL token költséggel, mikroszekundumok alatt illeszti a számlatételeket a megnevezésük (`line_description`) alapján.
- Együtt tudja kezelni a cél **főkönyvi számot** (`target_gl_number`) és a cél **áfakódot** (`target_vat_code_id`).
- Támogatja a több-bérlős (`company` vs. `tenant`) jogosultságkezelést.

---

## 2. Adatmodell & Séma Specifikáció

### `public.invoice_item_rules` Tábla

| Mező | Típus | Leírás |
|---|---|---|
| `id` | `UUID PRIMARY KEY` | Rekord egyedi azonosító |
| `company_id` | `UUID REFERENCES companies(id)` | Cég azonosító (NULL ha `scope = 'tenant'`) |
| `user_id` | `UUID REFERENCES auth.users(id)` | Létrehozó felhasználó / könyvelő |
| `name` | `TEXT` | Szabály elnevezése |
| `description_pattern` | `TEXT` | Keresendő szövegminta a `line_description`-ben |
| `pattern_type` | `TEXT` | `'contains'` \| `'exact'` \| `'regex'` |
| `direction` | `TEXT` | `'INBOUND'` \| `'OUTBOUND'` \| `'ALL'` |
| `partner_tax_number` | `VARCHAR(32)` | Opcionális adószámos szűrés |
| `partner_name` | `TEXT` | Opcionális partnernév kijelzéshez |
| `target_gl_number` | `VARCHAR(16)` | Cél főkönyvi szám |
| `target_gl_account_id`| `UUID REFERENCES gl_accounts(id)` | Cél számlatükör elem azonosító |
| `target_vat_code_id` | `UUID REFERENCES vat_codes(id)` | Cél áfakód azonosító |
| `target_vat_code` | `VARCHAR(32)` | Cél áfakód szöveges kódja (denormalizált) |
| `scope` | `TEXT` | `'company'` \| `'tenant'` \| `'global'` |
| `is_active` | `BOOLEAN` | Szabály aktív státusza |
| `priority` | `INTEGER` | Lefutási prioritás (alapértelmezett: 100) |
| `created_at` / `updated_at` | `TIMESTAMPTZ` | Időbélyegek |

### Indexelés & RLS
- Fedő indexek az idegen kulcsokra és szűrési mezőkre: `(company_id, is_active)`, `(scope, user_id)`, `target_gl_number`, `target_gl_account_id`, `target_vat_code_id`, `partner_tax_number`.
- RLS policy-k a 4 CRUD műveletre, garantálva, hogy a bérlők és irodák adatai szigorúan elszigeteltek maradjanak.
- `REVOKE ALL ON TABLE public.invoice_item_rules FROM anon;`

---

## 3. Kötegelt Végrehajtási Motor (`apply_invoice_item_rules`)

A létrehozott tárolt eljárás (`SECURITY DEFINER SET search_path = public`):
```sql
public.apply_invoice_item_rules(
    p_company_id UUID,
    p_preset_id UUID,
    p_user_id UUID DEFAULT NULL,
    p_only_unclassified BOOLEAN DEFAULT true
) RETURNS JSONB
```

**Működési mechanizmus és robusztussági védelmek:**
1. **Adószám Normalizálás:**
   - Magyar adószámok esetén a rendszer a nem numerikus karaktereket eltávolítja, és az első 8 számjegyű törzsszámot hasonlítja össze (`SUBSTRING(REGEXP_REPLACE(tax, '[^0-9]', '', 'g') FROM 1 FOR 8)`). Ez garantálja, hogy a kötőjeles (`12345678-2-42`), egybeírt (`12345678242`) és 8 jegyű formátumok megbízhatóan illeszkednek egymásra.
   - Külföldi / EU-s adószámoknál szóköz- és kötőjelmentesített nagybetűs összehasonlítást végez.
2. **SQL Joker Karakter Védelem:**
   - A mintában (`description_pattern`) szereplő `%` és `_` karakterek automatikusan escape-elésre kerülnek (`REPLACE(...) ESCAPE '\'`), megelőzve, hogy egy pl. „20% akció” leírás joker karakterként nem kívánt tételeket fedjen le.
3. **Prioritás és Hatókör Rendezés:**
   - A szabályokat prioritás (`priority ASC, created_at DESC`) szerint futtatja le, a cég-specifikus szabályok előnyt élveznek az irodai szabályok felett.
4. **Atomi és Visszamenőleges Végrehajtás:**
   - Végigpásztázza mind a beküldött számlatételeket (`invoice_items`), mind a NAV tételeket (`nav_invoice_items`).
   - Ha a számla iránya, a partner adószáma és a tételleírás mintája illeszkedik, atomi UPDATE-tel frissíti a `gl_classifications` JSONB mezőt (`is_manual = false`, `rule_id`, `reasoning`), és ha a szabály áfakódot is tartalmaz, beállítja a `vat_code_id`-t és `vat_code`-ot is.
5. **Eredmény Visszajelzés:**
   - JSON formátumban visszaadja a módosított tételek darabszámát (`total_updated`, `updated_invoice_items`, `updated_nav_items`).
