

# Bérek/járulékok — Inkonzisztencia audit és javítási terv

## Talált problémák

### 1. „Összes kifizetés" KPI kártya — hibás logika
**Jelenlegi viselkedés** (`useSalaryData.ts`, 58-60. sor):
```typescript
const totalPayments = salaryItems
  .filter((item) => (item.tipus === 'bér' || item.tipus === 'járulék') && !!item.transaction_id)
  .reduce((sum, item) => sum + Number(item.összeg), 0);
```
Ez **csak** a `transaction_id`-vel rendelkező bér+járulék tételeket összegzi. Az adatbázisban a tételek `statusz` mezője „Függő", és csak 2-nek van `transaction_id`. A készpénzes kifizetéseknél (`fizetesi_mod: 'készpénz'`) viszont nincs `transaction_id`, de a `statusz` „Kifizetve" — ezek **kimaradnak** a KPI-ból.

**Kért logika**: Csak azokat a tételeket számoljuk, amelyek **ténylegesen ki vannak fizetve** — vagyis amelyeknek VAN `transaction_id` (banki párosítás) VAGY `fizetesi_mod` = 'készpénz' (készpénzes kifizetés, ami definíció szerint fizetve).

### 2. `matched_invoice_id` vs `transaction_id` — architekturális tisztázás

A **`salary` tábla** NEM tartalmaz `matched_invoice_id` oszlopot — ez helyes, ez a `transactions` tábla mezője.

Az adatfolyam:
- `transactions.matched_invoice_id` → mutat egy `salary.id`-re (vagy `invoices.id`-re, vagy `nav_invoices.id`-re)
- Amikor egy tranzakció párosítódik, a `mark_nav_invoice_paid_on_transaction_match` trigger beállítja a `salary.transaction_id = transactions.id` értéket
- Tehát `salary.transaction_id` IS NOT NULL = fizetve (banki úton)

Ez az architektúra **konzisztens** az app többi részével (invoices, nav_invoices). Nincs inkonzisztencia a két mező között — más-más táblákon vannak, és a trigger gondoskodik a szinkronizációról.

### 3. Készpénzes kifizetések kezelése — hiányzó logika

A `addMutation`-ban (`useSalaryData.ts`, 86-91. sor) a KP kifizetés `statusz: 'Kifizetve'` és `fizetesi_mod: 'készpénz'` értékkel kerül be, DE `transaction_id` nélkül. Mivel a KPI kártya kizárólag `transaction_id`-t néz, ezek a ténylegesen kifizetett tételek **nem jelennek meg** az „Összes kifizetés"-ben.

### 4. EmployeeAccordion `getAllPaid` — hibás `allNavPaid` OR logika

```typescript
const getAllPaid = (items: SalaryItem[]) =>
  allNavPaid || items.every(item => !!item.transaction_id);
```
Ez azt mondja: ha az összes NAV tétel fizetett, AKKOR minden dolgozó is fizetett? Ez logikailag hibás — a NAV tételek fizetési státusza nem határozza meg a dolgozók kifizetési státuszát. Ráadásul a készpénzes fizetéseket itt sem veszi figyelembe.

---

## Javítási terv

### 1. Univerzális `isPaid` segédfüggvény (`salary-helpers.ts`)
```typescript
export function isSalaryItemPaid(item: SalaryItem): boolean {
  return !!item.transaction_id || item.fizetesi_mod === 'készpénz';
}
```

### 2. `useSalaryData.ts` — metrics javítás
- `totalPayments`: `isSalaryItemPaid()` szűrés `transaction_id` helyett
- `allNavPaid`: szintén `isSalaryItemPaid()`

### 3. `EmployeeAccordion.tsx` — `getAllPaid` javítás
- Töröljük az `allNavPaid` OR logikát
- Helyette: `items.every(item => isSalaryItemPaid(item))`

### 4. Globális ellenőrzés eredménye
Az app többi részén a `transaction_id`-alapú computed status **helyes**:
- `invoices` és `nav_invoices`: mindig banki párosításon alapul, nincs készpénz-specifikus kérdés
- `TransactionDetailsDialog`: `matched_invoice_id` a transactions tábláról jön, ez a transactions oldali mező — helyes
- `useComputedStatus.ts`: univerzális, `transaction_id`-t néz — a salary oldalon kell kiegészíteni a készpénzes logikával

### Érintett fájlok
1. `src/lib/salary-helpers.ts` — új `isSalaryItemPaid` export
2. `src/hooks/useSalaryData.ts` — `metrics.totalPayments` + `allNavPaid` javítás
3. `src/components/salaries/EmployeeAccordion.tsx` — `getAllPaid` javítás, `allNavPaid` prop eltávolítása
4. `src/pages/SalariesPage.tsx` — `allNavPaid` prop eltávolítása

