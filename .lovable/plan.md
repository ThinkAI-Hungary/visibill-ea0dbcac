

## Plan: Kimenő NAV sorok zöld csak tranzakció párosítás esetén

### Probléma
Kimenő (OUTBOUND) NAV számlák némelyike `paid=true` státuszú lehet anélkül, hogy valódi tranzakció párosítás tartozna hozzá (korábbi hibás adatok).

### Megoldás

**1. Adatbázis migráció — backfill cleanup**

Minden kimenő NAV számlánál ellenőrizzük, hogy tényleg van-e párosított tranzakció. Ha nincs, `paid` visszaáll `false`-ra:

```sql
UPDATE nav_invoices ni
SET paid = false
WHERE ni.invoice_direction = 'OUTBOUND'
  AND ni.paid = true
  AND NOT EXISTS (
    SELECT 1
    FROM invoices i
    JOIN transactions t ON t.matched_invoice_id = i.id
    WHERE i.bizonylatsorszam = ni.invoice_number
      AND i.company_id = ni.company_id
  );
```

**2. Frontend — nincs változás szükséges**

A jelenlegi logika (`paid === true` → zöld, egyébként piros) már helyes mindkét irányra. A triggerek (`match_nav_invoice_on_insert`, `mark_nav_invoice_paid_on_transaction_match`) biztosítják, hogy `paid` csak tranzakció párosítás esetén legyen `true`. A backfill cleanup kijavítja a régi hibás adatokat.

### Érintett fájlok
| Fájl | Változás |
|---|---|
| Új migráció SQL | Backfill: outbound `paid=false` ahol nincs tranzakció |

