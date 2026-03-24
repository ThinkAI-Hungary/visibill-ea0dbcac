

# Főbb Táblák Audit — Inkonzisztenciák és Problémák

## Összefoglaló

| Prior. | Probléma | Tábla | Típus |
|---|---|---|---|
| **P0** | `invoice_type` DEFAULT vs CHECK constraint eltérés | `invoices` | Adatintegritás |
| **P0** | `invoices` UNIQUE constraint `user_id` alapú, nem `company_id` | `invoices` | Multi-tenancy |
| **P0** | `nav_invoices` UNIQUE constraint `user_id` alapú, nem `company_id` | `nav_invoices` | Multi-tenancy |
| **P1** | `global_audit_trigger_func` nincs tábla-hoz kötve (árva függvény) | Nincs trigger | Felesleges kód |
| **P1** | 3 SECURITY DEFINER függvény `search_path` nélkül | Audit functions | Biztonság |
| **P1** | `nav_invoices.transaction_id` — hiányzó index | `nav_invoices` | Teljesítmény |
| **P1** | `salary.user_id` — hiányzó index | `salary` | Teljesítmény |
| **P1** | `transactions.upload_id` — hiányzó index | `transactions` | Teljesítmény |
| **P2** | `invoices.project_id` — nincs FK constraint | `invoices` | Adatintegritás |

---

## P0 — Kritikus

### 1. `invoices.invoice_type`: DEFAULT vs CHECK ütközés

A CHECK constraint ezeket engedélyezi:
```
sima_szla, egyszerusitett_szla, dijbekero_proforma, dijbekero, vegszamla
```

A column DEFAULT viszont `'sima_szamla'` — ami **nem szerepel** a CHECK listában.

**Következmény**: Bármilyen INSERT, ami nem ad meg explicit `invoice_type`-ot, azonnal `CHECK constraint violation` hibával elszáll. Az n8n vagy más automatizáció, ami nem állítja be ezt a mezőt, hibázni fog.

**Javítás**: A default-ot `'sima_szla'`-ra kell cserélni (a CHECK-hez igazítva).

### 2. `invoices` UNIQUE constraint: `(user_id, bizonylatsorszam)` — hibás

Multi-tenant rendszerben a számlaszám egyedisége **cég-szintű**, nem felhasználó-szintű kell legyen. Ha két tag ugyanabban a cégben van, az egyikük által feltöltött számla nem akadályozza meg a másikat ugyanazzal a számlaszámmal — de **másik cégben** igen, ami hibás.

**Javítás**: `UNIQUE (company_id, bizonylatsorszam)` kell legyen.

### 3. `nav_invoices` UNIQUE constraint: `(user_id, invoice_number)` — hibás

Ugyanaz a probléma. A NAV számlák cég-szintűek, nem user-szintűek.

**Javítás**: `UNIQUE (company_id, invoice_number)` kell legyen.

---

## P1 — Fontos

### 4. `global_audit_trigger_func` — árva függvény

A `global_audit_trigger_func` létezik és karbantartjuk, de **egyetlen trigger sem használja**. Az `audit_insert_delete_func` és `audit_update_processed_func` végzik a tényleges munkát. A `global_audit_trigger_func` feleslegesen foglal helyet és zavart okoz.

**Javítás**: Törlés (`DROP FUNCTION`).

### 5. Hiányzó `search_path` — 3 SECURITY DEFINER függvény

A következő SECURITY DEFINER funkciók nem állítják be a `search_path`-ot, ami biztonsági kockázat (search_path hijacking):
- `audit_insert_delete_func`
- `audit_update_processed_func`  
- `global_audit_trigger_func` (ha nem töröljük)

**Javítás**: `SET search_path TO 'public'` hozzáadása.

### 6. Hiányzó indexek FK oszlopokon

Három FK oszlop indexeletlen — ezeket triggerek is használják WHERE-ben:
- `nav_invoices.transaction_id` — `reset_paid_on_transaction_delete` és `reset_paid_on_transaction_unmatch` triggerek `WHERE transaction_id = OLD.id` lekérdezéssel keresnek
- `salary.user_id` — RLS policy-k használják
- `transactions.upload_id` — FK a `transaction_uploads`-ra

**Javítás**: `CREATE INDEX` mindháromra.

---

## P2 — Alacsony prioritás

### 7. `invoices.project_id` — nincs FK constraint

A `project_id` oszlop létezik, de nincs rá FK constraint. Ha egy projektet törölnek, az invoice-on maradt `project_id` árva UUID-ra mutat.

**Javítás**: `ADD CONSTRAINT ... FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL`.

---

## Javítási terv — Egyetlen Migration

Egyetlen SQL migration a következő 7 változtatással:

1. `ALTER TABLE invoices ALTER COLUMN invoice_type SET DEFAULT 'sima_szla'`
2. `DROP CONSTRAINT invoices_user_id_szamlaszam_key` → `ADD UNIQUE (company_id, bizonylatsorszam)`
3. `DROP CONSTRAINT nav_invoices_user_id_invoice_number_key` → `ADD UNIQUE (company_id, invoice_number)`
4. `DROP FUNCTION global_audit_trigger_func`
5. `CREATE OR REPLACE` az `audit_insert_delete_func` és `audit_update_processed_func`-ra `SET search_path TO 'public'` hozzáadásával
6. `CREATE INDEX` a 3 hiányzó FK indexre
7. `ADD CONSTRAINT invoices_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL`

### Érintett kódfájlok

A UNIQUE constraint változás (`user_id` → `company_id`) miatt ellenőrizni kell:
- `src/hooks/useInvoiceData.ts` — nincs közvetlen hatás (már `company_id`-t használ a lekérdezésekben)
- Supabase Edge Functions, amelyek `invoices`-ba INSERT-álnak (n8n webhook-ok) — győződjünk meg, hogy `company_id` mindig ki van töltve
- `src/pages/ManualUpload.tsx` — az upload logika már `company_id`-t küld

A `invoice_type` default javítás **azonnali hatású** — nincs kód módosítás, csak DB szintű.

