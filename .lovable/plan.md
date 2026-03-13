

## Plan: ATM készpénzfelvét tranzakciók automatikus párosítottként kezelése

### Probléma
Az "atm készpénzfelvét" (és hasonló készpénzes) tranzakciók pirosak (nem párosított), pedig soha nem lesz hozzájuk számla pár. Ezeket automatikusan zöldnek (párosítottnak) kellene jelölni.

### Megoldás

Egyetlen fájl módosítása: **`src/pages/TransactionsPage.tsx`**

1. Új helper függvény létrehozása, amely azonosítja a készpénzes tranzakciókat, amelyeknek nem kell számla pár:

```typescript
const isCashTransactionType = (transaction: Transaction): boolean => {
  const cashTypes = [
    'atm készpénzfelvét',
    'pénztári kp felvét',
    'pénztári kp befizetés',
    'kp befizetés atm-en keresztül',
  ];
  return !!transaction.type && cashTypes.includes(transaction.type.toLowerCase());
};
```

2. A `getMatchStatus` függvényben a `no_match_category` mellé beilleszteni ezt az ellenőrzést -- ha a tranzakció típusa készpénzes, akkor `'matched'` státuszt kap.

3. A `getRowBackgroundClass` függvényben szintén figyelembe venni ezt az új feltételt, hogy zöld hátteret kapjanak.

Ez pontosan ugyanazt a mintát követi, mint a már meglévő `isNoCategoryMatch` logika.

