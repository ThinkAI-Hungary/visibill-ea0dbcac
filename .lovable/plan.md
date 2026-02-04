
# Tranzakciók oldal funkcionalitás bővítése

## Projekt összefoglaló

A Tranzakciók oldal jelentős funkcionalitás-bővítése, amely AI-alapú számlázás-párosítást, manuális korrekciót és részfizetési logikát is tartalmaz.

## Tervezett funkciók

### 1. Bővített táblázat oszlopok és szűrés

Az alábbi oszlopok lesznek láthatók és szűrhetők:

| Oszlop | Leírás | Szűrhető/Rendezhető |
|--------|--------|---------------------|
| Partner/Tétel | Párosított számla partnere vagy tranzakció leírás | Szűrhető |
| Dátum | Tranzakció dátuma | Rendezhető |
| Összeg | Teljes érték pénznemmel | Rendezhető |
| Leírás | Eredeti bankkivonat közlemény | Szűrhető |
| Típus | Kategorizált típus (pl. Kártyafizetés, ATM, Átutalás) | Szűrhető |
| Státusz | Vizuális ikon - Pipa/X/Kérdőjel | Szűrhető |
| Indoklás | AI döntés magyarázata (első 10 karakter) | Hover: tooltip |
| Művelet | Rendben gomb + manuális párosítás | - |

### 2. Vizuális visszajelzés és színkódolás

A sorok háttérszíne a párosítási státusztól függ:

```text
+--------------------------------------------------+
| Zöld háttér   | is_verified=true, matched_invoice_id létezik |
+--------------------------------------------------+
| Sárga háttér  | matched_invoice_id létezik, de is_verified=false |
+--------------------------------------------------+
| Piros háttér  | matched_invoice_id nincs |
+--------------------------------------------------+
```

Színkódok Tailwind osztályokkal:
- Zöld: `bg-success/10` 
- Sárga: `bg-warning/10`
- Piros: `bg-destructive/10`

### 3. Manuális párosítási felület

Új dialog komponens létrehozása: `TransactionMatchDialog.tsx`

Funkciók:
- Keresési mező számlák szűréséhez (partner név, számlaszám, összeg)
- Párosítatlan számlák listázása a tranzakció dátumához közeli időszakból (-30/+7 nap)
- Számla kiválasztás és mentés
- Részfizetés jelzése ha az összeg nem egyezik

### 4. AI indoklás megjelenítése

A `reason` mező a `transactions` táblában már létezik. Megjelenítés:

```text
+-------------------+------------------------------------------+
| Cellában         | Első 10 karakter + "..." ha hosszabb     |
+-------------------+------------------------------------------+
| Hover (Tooltip)  | Teljes indoklás szöveg (max 300 char)   |
+-------------------+------------------------------------------+
```

Tooltip implementáció: `TooltipProvider` + `delayDuration={0}` az instant megjelenéshez.

### 5. Részfizetési logika (One-to-Many)

Üzleti logika:
- Egy számlához több tranzakció is kapcsolható
- A rendszer nyilvántartja a már befizetett összeget
- Vizuális jelzés ha a számla még nincs teljesen kiegyenlítve

Adatbázis szempontok:
- A `matched_invoice_id` mező már támogatja ezt (több tranzakció ugyanarra a számlára mutathat)
- Új mező nem szükséges - aggregált lekérdezéssel számítható a maradék összeg

---

## Technikai részletek

### Érintett fájlok

| Fájl | Változtatás |
|------|-------------|
| `src/pages/TransactionsPage.tsx` | Táblázat bővítése, színkódolás, új oszlopok, Rendben gomb, manuális párosítás trigger |
| `src/components/TransactionMatchDialog.tsx` | **ÚJ** - Manuális párosítási dialog komponens |
| `src/components/TransactionReasonCell.tsx` | **ÚJ** - AI indoklás megjelenítő cella komponens |

### Transaction interface bővítése

```typescript
interface Transaction {
  id: string;
  transaction_date: string;
  description: string | null;
  amount: number;
  currency: string | null;
  type: string | null;
  matched_invoice_id: string | null;
  confidence_score: number | null;
  is_verified: boolean | null;
  match_type: string | null;
  reason: string | null;  // Már létezik a DB-ben
  created_at: string | null;
  company_id: string | null;
}
```

### Új API hívások

1. **Számla lekérdezés párosításhoz**:
```typescript
const { data } = await supabase
  .from('nav_invoices')
  .select('id, invoice_number, invoice_gross_amount, supplier_name, customer_name, currency, invoice_issue_date')
  .eq('company_id', selectedCompany.id)
  .is('matched_transaction_id', null) // Opcionális filter
  .order('invoice_issue_date', { ascending: false });
```

2. **Párosítás mentése**:
```typescript
await supabase
  .from('transactions')
  .update({
    matched_invoice_id: invoiceId,
    is_verified: true,
    match_type: 'manual'
  })
  .eq('id', transactionId);
```

3. **"Rendben" gomb - verifikálás**:
```typescript
await supabase
  .from('transactions')
  .update({ is_verified: true })
  .eq('id', transactionId);
```

### Szín kódolás implementáció

```typescript
const getRowBackgroundClass = (transaction: Transaction): string => {
  if (transaction.is_verified && transaction.matched_invoice_id) {
    return 'bg-success/10 hover:bg-success/15';
  }
  if (transaction.matched_invoice_id && !transaction.is_verified) {
    return 'bg-warning/10 hover:bg-warning/15';
  }
  return 'bg-destructive/10 hover:bg-destructive/15';
};
```

### TransactionMatchDialog komponens struktúra

```typescript
interface TransactionMatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction;
  companyId: string;
  onMatch: (invoiceId: string) => void;
}
```

Tartalom:
- Tranzakció adatok összefoglaló kártya
- Keresési input számla kereséséhez
- Szűrt számla lista (`nav_invoices` + `invoices` táblákból)
- Összeg összehasonlítás jelzés (egyezik / részleges)
- Párosítás gomb

### Részfizetési összesítő logika

Párosítási dialógban megjelenik ha a számla már rendelkezik más tranzakciókkal:

```typescript
// Lekérdezi az adott számlához már párosított tranzakciókat
const { data: existingMatches } = await supabase
  .from('transactions')
  .select('amount')
  .eq('matched_invoice_id', invoiceId)
  .eq('is_verified', true);

const alreadyPaid = existingMatches?.reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;
const remaining = invoiceGrossAmount - alreadyPaid;
```

### Compact table stílus

A meglévő `compact-table` CSS osztály használata, de a "reason" oszlophoz egyedi szélesség:

```css
.reason-cell {
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

---

## Implementációs sorrend

1. `TransactionsPage.tsx` - Transaction interface bővítése a `reason` mezővel
2. `TransactionsPage.tsx` - Sor háttérszín logika hozzáadása
3. `TransactionsPage.tsx` - "Indoklás" oszlop hozzáadása tooltip-pal
4. `TransactionsPage.tsx` - "Rendben" gomb implementálása verifikáláshoz
5. `TransactionMatchDialog.tsx` - Új komponens létrehozása
6. `TransactionsPage.tsx` - Manuális párosítás gomb és dialog integráció
7. `TransactionMatchDialog.tsx` - Részfizetési logika hozzáadása
8. Tesztelés és finomhangolás
