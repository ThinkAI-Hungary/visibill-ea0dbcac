

## Bizonylatlánc teljes megjelenítése (rekurzív kapcsolat feloldás)

### Probléma

A `getLinkedInvoices` függvény (sor 948-960) csak **közvetlen** (egy szintű) kapcsolatokat old fel:

- **D-THINK-84** lenyitásakor: csak E-THINK-2025-85 jelenik meg (közvetlen gyermek), de E-THINK-2026-11 nem (unoka)
- **E-THINK-2026-11** lenyitásakor: csak E-THINK-2025-85 jelenik meg (közvetlen szülő), de D-THINK-84 nem (nagyszülő)

A lánc: `D-THINK-84 ← E-THINK-2025-85 ← E-THINK-2026-11`, de a kód nem járja be rekurzívan.

### Megoldás

**`src/pages/InvoicesPage.tsx`** — a `getLinkedInvoices` függvény átírása rekurzív lánc-bejárásra:

1. **Felfelé bejárás (szülők lánca)**: Az aktuális számla `reference_number`-jétől indulva megkeressük a szülőt, majd annak a szülőjét, egészen addig amíg van `reference_number`. Mindegyiket `'parent'` irányjelzővel adjuk hozzá.

2. **Lefelé bejárás (gyermekek lánca)**: Az aktuális számla `bizonylatsorszam`-ától indulva megkeressük a rá hivatkozó számlákat, majd azok gyermekeit is rekurzívan. Mindegyiket `'child'` irányjelzővel adjuk hozzá.

3. **Végtelen ciklus védelem**: Egy `visited` Set-tel biztosítjuk, hogy körkörös hivatkozás esetén ne fusson végtelenségig.

```typescript
const getLinkedInvoices = (invoice: SubmittedInvoice) => {
  const linked = [];
  const visited = new Set([invoice.id]);
  
  // Walk up: follow reference_number chain
  let currentRef = invoice.reference_number;
  while (currentRef) {
    const parents = linkedInvoicesMap.byBizonylat.get(currentRef.toUpperCase()) || [];
    const parent = parents.find(p => !visited.has(p.id));
    if (!parent) break;
    visited.add(parent.id);
    linked.push({ ...parent, relationDirection: 'parent' });
    currentRef = parent.reference_number;
  }
  
  // Walk down: follow children recursively (BFS)
  const queue = [invoice.bizonylatsorszam];
  while (queue.length > 0) {
    const bizSorszam = queue.shift();
    if (!bizSorszam) continue;
    const children = linkedInvoicesMap.byReference.get(bizSorszam.toUpperCase()) || [];
    for (const child of children) {
      if (visited.has(child.id)) continue;
      visited.add(child.id);
      linked.push({ ...child, relationDirection: 'child' });
      if (child.bizonylatsorszam) queue.push(child.bizonylatsorszam);
    }
  }
  
  return linked;
};
```

### Eredmény
- **D-THINK-84** lenyitásakor: megjelenik E-THINK-2025-85 (gyermek) és E-THINK-2026-11 (gyermek)
- **E-THINK-2026-11** lenyitásakor: megjelenik E-THINK-2025-85 (szülő) és D-THINK-84 (szülő)
- **E-THINK-2025-85** lenyitásakor: megjelenik D-THINK-84 (szülő) és E-THINK-2026-11 (gyermek)

