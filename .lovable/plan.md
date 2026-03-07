

## Meglévő közvetlen párosítások javítása - egyszeri adatmigráció

### Probléma

15+ OUTBOUND NAV számla rendelkezik közvetlenül párosított tranzakcióval (`transactions.matched_invoice_id` → `nav_invoices.id`), de a `paid` mező `false` maradt, mert a triggerjavítás csak az új párosításokra vonatkozik.

### Megoldás

Egyetlen SQL migráció, amely frissíti a meglévő közvetlen párosításokat:

```sql
-- Fix existing direct matches: transactions.matched_invoice_id -> nav_invoices.id
UPDATE nav_invoices ni
SET paid = true
FROM transactions t
WHERE t.matched_invoice_id = ni.id
  AND (ni.paid IS NULL OR ni.paid = false);
```

### Érintett fájlok

| Fájl | Változás |
|------|----------|
| Új SQL migráció | Egyszeri UPDATE a meglévő közvetlen párosítások `paid` mezőjének javítására |

### Hatás
- ~15+ OUTBOUND NAV számla státusza `paid = true` lesz
- A frontend azonnal zöld színnel fogja megjeleníteni ezeket a sorokat
- A lenyitáskor a tranzakciók már most is megjelennek (az előző frontend fix miatt)

