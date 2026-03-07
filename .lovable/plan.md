

## Számlák párosítás - Audit eredmények

### Talált probléma

A tranzakciók **kétféleképpen** párosulhatnak számlákhoz:
- **A)** `transactions.matched_invoice_id` → `invoices.id` (beküldött számlához)
- **B)** `transactions.matched_invoice_id` → `nav_invoices.id` (közvetlenül NAV számlához)

Az adatbázisban **mindkét típus létezik** (20 tranzakcióból 8 közvetlenül NAV számlához van párosítva).

**A hiba**: A `getNavInvoiceMatches` függvény a NAV sor lenyitásakor **csak a beküldött számlákon keresztül** keresi a tranzakciókat (NAV → submitted via `invoice_number` → transactions via `matched_invoice_id`). A **közvetlenül NAV számlához párosított tranzakciók nem jelennek meg** a lenyitott sorban.

### Érintett kódrészletek

1. **`getNavInvoiceMatches`** (InvoicesPage.tsx ~916-924): Nem veszi figyelembe a közvetlen NAV-tranzakció párosítást.

2. **`matchedInvoiceIds` Set** (InvoicesPage.tsx ~588): A zöld sor jelzés a beküldött füleknél helyes (csak `invoices` tábla ID-kat tartalmaz), de a NAV fülön a `paid` mező alapján történik a színezés, ami szintén problémás lehet.

3. **DB trigger `mark_nav_invoice_paid_on_transaction_match`**: Csak akkor jelöli a NAV számlát fizetettnek, ha a tranzakció egy **beküldött** számlához van párosítva és az `invoice_number` egyezik. Ha a tranzakció **közvetlenül** a NAV számlához van párosítva, a trigger nem fut le → a `paid` mező nem frissül.

### Javítási terv

#### 1. Frontend: `getNavInvoiceMatches` kiegészítése
A NAV invoice ID-t is keresni kell a `submittedIdToTransactionsMap`-ben (ami valójában `matchedInvoiceIdToTransactionsMap`), mivel az a `matched_invoice_id` szerint indexel, és a NAV ID-k is lehetnek benne:

```typescript
const getNavInvoiceMatches = (navInvoice: NavInvoice) => {
  const matchedSubmitted = navToSubmittedMap.get(navInvoice.invoice_number) || [];
  const matchedTx: TransactionRecord[] = [];
  // Transactions matched via submitted invoices
  matchedSubmitted.forEach(sub => {
    const txs = submittedIdToTransactionsMap.get(sub.id) || [];
    matchedTx.push(...txs);
  });
  // Transactions matched DIRECTLY to this NAV invoice
  const directTxs = submittedIdToTransactionsMap.get(navInvoice.id) || [];
  directTxs.forEach(tx => {
    if (!matchedTx.some(t => t.id === tx.id)) matchedTx.push(tx);
  });
  return { matchedSubmitted, matchedTransactions: matchedTx, matchedNav: [] };
};
```

#### 2. DB trigger: közvetlen NAV párosítás kezelése
Új trigger vagy a meglévő `mark_nav_invoice_paid_on_transaction_match` bővítése: ha a `matched_invoice_id` közvetlenül egy `nav_invoices` rekordra mutat, akkor azt is jelölje `paid = true`.

```sql
-- Add direct nav_invoices match handling
IF v_bizonylatsorszam IS NULL THEN
  UPDATE nav_invoices
  SET paid = true
  WHERE id = NEW.matched_invoice_id
    AND (paid IS NULL OR paid = false);
END IF;
```

### Fájlok

| Fájl | Változás |
|------|----------|
| `src/pages/InvoicesPage.tsx` | `getNavInvoiceMatches` bővítése közvetlen NAV-tranzakció kereséssel |
| DB migration | `mark_nav_invoice_paid_on_transaction_match` trigger bővítése |

