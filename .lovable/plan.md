

## Kapcsolt bizonylat hivatkozás irányának javítása

### Probléma

A `→` badge jelenleg `inv.bizonylatsorszam`-ot mutatja (sor 146), ami magának a kártyán megjelenített számlának a sorszáma. Ehelyett az `inv.reference_number`-t kellene mutatnia — vagyis azt a bizonylatsorszámot, **amire az adott számla hivatkozik**.

Példa D-THINK-84 lenyitásakor:
- Jelenlegi: `→ E-THINK-2025-85` (a kártyán lévő számla saját sorszáma — értelmetlen)
- Helyes: `→ D-THINK-84` (amire az E-THINK-2025-85 hivatkozik)

### Megoldás

**`src/components/ExpandedInvoiceRow.tsx`** — sor 144-148:

A `→` badge-nél `inv.bizonylatsorszam` helyett `inv.reference_number`-t jelenítünk meg. Továbbá mindkét irány esetén (child és parent) megjelenítjük, ha van `reference_number`:

```tsx
{inv.reference_number && (
  <Badge variant="outline" className="text-[10px] h-5">
    → {inv.reference_number}
  </Badge>
)}
```

### Eredmény
- **D-THINK-84** lenyitása → E-THINK-2025-85 kártyán: `Hivatkozó bizonylat → D-THINK-84`
- **D-THINK-84** lenyitása → E-THINK-2026-11 kártyán: `Hivatkozó bizonylat → E-THINK-2025-85`

