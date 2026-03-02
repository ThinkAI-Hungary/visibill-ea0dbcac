

## Plan: ON DELETE CASCADE hozzáadása a `nav_invoice_items` foreign key-hez

**Cél**: Ha egy `nav_invoices` rekordot törölsz, az összes hozzá tartozó `nav_invoice_items` sor automatikusan törlődjön.

### Megvalósítás

Egyetlen SQL migráció:
1. Meglévő foreign key constraint törlése a `nav_invoice_items.nav_invoice_id` oszlopról
2. Új constraint létrehozása `ON DELETE CASCADE` opcióval

```sql
ALTER TABLE nav_invoice_items
  DROP CONSTRAINT nav_invoice_items_nav_invoice_id_fkey;

ALTER TABLE nav_invoice_items
  ADD CONSTRAINT nav_invoice_items_nav_invoice_id_fkey
  FOREIGN KEY (nav_invoice_id) REFERENCES nav_invoices(id) ON DELETE CASCADE;
```

Kódmódosítás nem szükséges -- ez tisztán adatbázis-szintű változás.

