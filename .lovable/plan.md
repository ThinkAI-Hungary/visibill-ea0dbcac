

# Audit: "record 'old' has no field 'status'" hiba

## Gyökérok

A hibát egy trigger-láncolat okozza:

```text
n8n INSERT → invoices tábla
  └─ trg_mark_invoice_upload_completed (AFTER INSERT)
       └─ UPDATE invoice_uploads SET processing_status = 'completed'
            └─ audit_update_processed_func (BEFORE/AFTER UPDATE)
                 └─ OLD.status ← HIBA! invoice_uploads-ban nincs "status" oszlop
```

Az `audit_update_processed_func` függvény ezt tartalmazza:

```sql
IF (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'processed') THEN
```

De az `invoice_uploads` táblában a mező neve **`processing_status`**, nem `status`. A `salary_files` táblában viszont valóban `status` a mező neve — tehát a függvény a `salary_files`-ra íródott, de az `invoice_uploads`-ra is rá lett kötve.

Ugyanez a probléma vonatkozik a `global_audit_trigger_func`-ra is, amelynek UPDATE ága szintén `OLD.status`-t ellenőriz az `invoice_uploads`/`salary_files` tábláknál.

## Érintett függvények és problémáik

| Függvény | Probléma |
|---|---|
| `audit_update_processed_func` | `OLD.status` / `NEW.status` hivatkozás — `invoice_uploads`-ban `processing_status` a mező |
| `global_audit_trigger_func` | Ugyanaz: UPDATE ágban `OLD.status` / `NEW.status` hivatkozás, ami `invoice_uploads`-on crashel |
| `audit_insert_delete_func` | Nem érintett (INSERT/DELETE, nem használ `OLD.status`-t) |

## Javítási terv

### 1. `audit_update_processed_func` újraírása
A függvénynek tábla-specifikusan kell kezelnie a mező nevét:
- `invoice_uploads` → `OLD.processing_status` / `NEW.processing_status`, és `'completed'` a cél (nem `'processed'`)
- `salary_files` → `OLD.status` / `NEW.status`

### 2. `global_audit_trigger_func` UPDATE ágának javítása
Ugyanaz a logika: táblanév alapján eldönteni, melyik mezőt kell vizsgálni:
- `invoice_uploads` → `processing_status` mező, `'completed'` érték
- `salary_files` → `status` mező, `'processed'` érték
- `invoices` → `statusz` mező (ez már helyes a kódban)

### 3. Migration SQL

Egyetlen migration, amely mindkét függvényt `CREATE OR REPLACE`-szel frissíti a helyes mezőnevekkel. Trigger-ek újrakötése nem szükséges — a függvény cseréje elegendő.

### Érintett fájlok

| Elem | Változás |
|---|---|
| Új migration SQL | `audit_update_processed_func` és `global_audit_trigger_func` javítása `processing_status` használatra `invoice_uploads` esetén |

