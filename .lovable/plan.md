

## Plan: Tévesen fizetve státuszú NAV számlák visszaállítása

### Vizsgálat eredménye

9 NAV számla van `paid=true` státusszal. Ebből **3 tévesen fizetve**:

| Bizonylatsorszám | Vevő | Bruttó | Kiállítás |
|---|---|---|---|
| E-TXLG-2026-8 | GASZTROKER Konyhatechnika Kft. | 203 200 Ft | 2026-01-06 |
| E-TXLG-2026-10 | Golden Döner Kft. | 165 100 Ft | 2026-01-06 |
| E-TXLG-2026-31 | RAHIMI Kft. | 31 750 Ft | 2026-01-20 |

Ezekhez nincs beküldött számla (`submitted=false`) és nincs párosított tranzakció sem. A fennmaradó 6 bejövő számla jogosan fizetve (van beküldött számla + tranzakció párosítás).

### Teendő

Egyetlen SQL UPDATE futtatása az alábbi 3 rekordra:

```sql
UPDATE nav_invoices
SET paid = false
WHERE id IN (
  '164a1139-fa38-4c25-bac3-25104a03bfcb',
  '86cd632f-1d32-4a4b-97ae-8cb59c9d46f3',
  '383b72dc-3be4-42b2-bacd-337a56386f00'
);
```

Ez nem igényel semmilyen frontend változtatást -- a UI automatikusan "Nyitott" státuszt fog mutatni a `paid=false` értékű soroknál.

