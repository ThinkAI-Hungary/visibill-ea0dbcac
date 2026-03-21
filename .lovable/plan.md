

# Invoice CASCADE törlés + cleanup triggerek

## Összefoglalás
Két BEFORE DELETE trigger létrehozása az `invoices` táblán, amely biztosítja a teljes törlés→újrafeltöltés ciklust, plusz a meglévő build hibák javítása.

## 1. Migráció: Két új trigger

### P1: NAV submitted visszaállítás
```sql
CREATE OR REPLACE FUNCTION reset_nav_submitted_on_invoice_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE nav_invoices
  SET submitted = false
  WHERE invoice_number = OLD.bizonylatsorszam
    AND company_id = OLD.company_id
    AND submitted = true;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trigger_reset_nav_submitted_on_invoice_delete
  BEFORE DELETE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION reset_nav_submitted_on_invoice_delete();
```

### P2: Transaction match cleanup
```sql
CREATE OR REPLACE FUNCTION clear_transaction_match_on_invoice_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE transactions
  SET matched_invoice_id = NULL, is_verified = false, match_type = NULL, confidence_score = NULL
  WHERE matched_invoice_id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trigger_clear_transaction_on_invoice_delete
  BEFORE DELETE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION clear_transaction_match_on_invoice_delete();
```

**Kaszkád hatás**: A `transactions` UPDATE kiváltja a meglévő `reset_paid_on_transaction_unmatch` triggert → `nav_invoices.paid = false, transaction_id = NULL` automatikusan.

## 2. Build hibák javítása

### LoadingSpinner `message` prop (9 hely)
A `LoadingSpinner` komponenshez hozzáadni egy opcionális `message` propot:
- `src/components/ui/loading-spinner.tsx` — prop hozzáadása az interface-hez + megjelenítés

### ThemeContext `"system"` típus (Settings.tsx:364)
- `src/pages/Settings.tsx` — a `setTheme` hívás előtt szűrni: ha `"system"`, akkor a `prefers-color-scheme` alapján `"dark"` vagy `"light"`-ra konvertálni

## Törlés→Újrafeltöltés ciklus igazolása

```text
TÖRLÉS:
  invoice DELETE
    → trigger: clear_transaction_match → transactions.matched_invoice_id = NULL
      → trigger: reset_paid_on_transaction_unmatch → nav_invoices.paid=false, transaction_id=NULL
    → trigger: reset_nav_submitted → nav_invoices.submitted=false

ÚJRAFELTÖLTÉS:
  invoice INSERT
    → trigger: mark_nav_invoice_as_submitted → nav_invoices.submitted=true
    → trigger: set_invoice_feldolgozva_on_upload_link → statusz='feldolgozott'
  transaction re-match (n8n/manual)
    → trigger: mark_nav_invoice_paid_on_transaction_match → nav_invoices.paid=true
```

