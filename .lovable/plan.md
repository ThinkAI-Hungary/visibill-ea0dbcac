

## Oldalméret: 20 eltávolítása, 50 legyen az alapértelmezett

### Változások

**1. `src/components/ui/unified-pagination.tsx`** (~30. sor)
- Default `pageSizeOptions` változás: `[20, 50, 100]` → `[50, 100]`

**2. `src/pages/InvoicesPage.tsx`** (~257-258. sorok)
- `useState(20)` → `useState(50)` mindkét pageSize state-nél

**3. `src/pages/TransactionsPage.tsx`** (~144. sor)
- `useState(20)` → `useState(50)`

**4. `src/pages/SalariesPage.tsx`** (~110. sor)
- `useState(20)` → `useState(50)`

