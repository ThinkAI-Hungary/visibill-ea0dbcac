

## Több sor egyidejű lenyitásának engedélyezése

### Változás

**`src/pages/InvoicesPage.tsx`**:

1. **State típus**: `expandedRowId: string | null` → `expandedRowIds: Set<string>`
2. **handleRowClick**: toggle logika Set-tel (add/delete)
3. **Reset**: tab/company váltáskor `new Set<string>()`
4. **Összes hivatkozás** (~12 hely): `expandedRowId === invoice.id` → `expandedRowIds.has(invoice.id)`

