

## Plan: Dinamikus párosítás NAV szinkronizáció után

### Jelenlegi helyzet

Két trigger már létezik:
1. **`mark_nav_invoice_as_submitted`** — beküldött számla érkezésekor → NAV `submitted=true`
2. **`mark_nav_invoice_paid_on_transaction_match`** — tranzakció párosításakor → NAV `paid=true, submitted=true`

**Hiányzó irány:** Amikor a NAV számla érkezik be elsőként (szinkronizáció), nem ellenőrzi, hogy van-e már hozzá beküldött számla vagy tranzakció.

### Megoldás

**1. Új DB trigger: `match_nav_invoice_on_insert`**

Trigger a `nav_invoices` táblán `AFTER INSERT OR UPDATE OF invoice_number` eseményre:
- Megnézi van-e `invoices` rekord ahol `bizonylatsorszam = NEW.invoice_number` és `company_id = NEW.company_id`
- Ha van → `submitted = true`
- Ha ennek az `invoices` rekordnak van párosított tranzakciója (`transactions.matched_invoice_id`) → `paid = true`

```sql
CREATE OR REPLACE FUNCTION public.match_nav_invoice_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invoice_id UUID;
  v_has_transaction BOOLEAN;
BEGIN
  -- Check if a submitted invoice exists with matching bizonylatsorszam
  SELECT id INTO v_invoice_id
  FROM invoices
  WHERE bizonylatsorszam = NEW.invoice_number
    AND company_id = NEW.company_id
  LIMIT 1;

  IF v_invoice_id IS NOT NULL THEN
    -- Mark as submitted
    NEW.submitted := true;

    -- Check if that invoice has a matched transaction
    SELECT EXISTS (
      SELECT 1 FROM transactions
      WHERE matched_invoice_id = v_invoice_id
    ) INTO v_has_transaction;

    IF v_has_transaction THEN
      NEW.paid := true;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_match_nav_invoice_on_insert
  BEFORE INSERT ON nav_invoices
  FOR EACH ROW
  EXECUTE FUNCTION match_nav_invoice_on_insert();
```

Ez `BEFORE INSERT` trigger, így közvetlenül a `NEW` rekordot módosítja — hatékonyabb, mint egy külön UPDATE.

**2. Backfill meglévő adatokra**

A migráció végén lefut egy egyszeri update, ami az összes meglévő NAV számlát szinkronba hozza:

```sql
-- Backfill submitted
UPDATE nav_invoices ni
SET submitted = true
FROM invoices i
WHERE i.bizonylatsorszam = ni.invoice_number
  AND i.company_id = ni.company_id
  AND (ni.submitted IS NULL OR ni.submitted = false);

-- Backfill paid
UPDATE nav_invoices ni
SET paid = true
FROM invoices i
JOIN transactions t ON t.matched_invoice_id = i.id
WHERE i.bizonylatsorszam = ni.invoice_number
  AND i.company_id = ni.company_id
  AND (ni.paid IS NULL OR ni.paid = false);
```

**3. Sor színezés logika frissítése (InvoicesPage.tsx)**

Jelenlegi logika (1486-1488. sor):
- INBOUND: zöld ha `(paid && submitted) || matchedNavInvoiceNumbers.has(...)`, piros egyébként
- OUTBOUND: mindig zöld

Új logika:
- **INBOUND és OUTBOUND is:** zöld ha `paid === true` (ami azt jelenti: NAV + tranzakció párosítva van). Piros ha nem paid.
- A `submitted` flag csak a "Beküldve" oszlop badge-jét vezérli, nem a sor színét.
- A `matchedNavInvoiceNumbers` kliens-oldali logika eltávolítható, mert a trigger mostantól szerver-oldalon kezeli.

### Érintett fájlok

| Fájl | Változás |
|---|---|
| Új migráció SQL | Trigger + backfill |
| `src/pages/InvoicesPage.tsx` | Sor színezés egyszerűsítése: zöld = `paid === true`, mindkét irányra |

### Nem változik
- A két meglévő trigger (`mark_nav_invoice_as_submitted`, `mark_nav_invoice_paid_on_transaction_match`) megmarad
- Edge function-ök nem módosulnak
- A `matchedInvoiceIds` state megmarad az ExpandedInvoiceRow-hoz

