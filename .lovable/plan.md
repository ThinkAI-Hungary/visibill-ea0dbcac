
# Tranzakció feltöltés javítása - Többszöri feltöltés engedélyezése

## A probléma

A tranzakció fájl sikeres feltöltése után nem lehet új fájlt kiválasztani az oldal frissítése nélkül.

## Technikai ok

A `handleTransactionUpload` függvény törli a React state-et (`setSelectedTransactionFiles([])`), de a DOM `<input type="file">` elem `value` tulajdonsága megmarad. A böngésző ilyenkor nem triggereli az `onChange` eseményt, mert úgy érzékeli, hogy "nincs változás".

## Megoldás

A `handleTransactionUpload` függvény `finally` blokkjában (661-663. sor) hozzáadjuk az input mező értékének resetelését:

```typescript
finally {
  setUploading(false);
  // Reset file input to allow re-uploading
  const inputElement = document.getElementById('transaction-file-input') as HTMLInputElement;
  if (inputElement) {
    inputElement.value = '';
  }
}
```

## Érintett fájl

| Fájl | Változtatás |
|------|-------------|
| `src/pages/ManualUpload.tsx` | Input mező value resetelése a `finally` blokkban |

## Megjegyzés

Ez a javítás **csak** a tranzakció feltöltésre vonatkozik, a többi feltöltési típus (számlák, bankkivonatok, bérek) változatlan marad.
