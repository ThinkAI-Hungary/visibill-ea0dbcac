

## Számlák valós idejű frissítése Supabase Realtime-mal

### Megoldás

A `src/pages/InvoicesPage.tsx` fájlban egy `useEffect`-ben feliratkozunk a Supabase Realtime csatornára, amely figyeli az `invoices` és `nav_invoices` táblák INSERT/UPDATE/DELETE eseményeit. Amikor változás történik, automatikusan meghívjuk a meglévő `fetchData()` függvényt.

### Implementáció

Egy új `useEffect` blokk hozzáadása a meglévő `fetchData` useEffect mellé (sor ~300):

```typescript
// Real-time subscription for invoices
useEffect(() => {
  if (!selectedCompany) return;

  const channel = supabase
    .channel(`invoices-realtime-${selectedCompany.id}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'invoices',
      filter: `company_id=eq.${selectedCompany.id}`
    }, () => {
      fetchData();
    })
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'nav_invoices',
      filter: `company_id=eq.${selectedCompany.id}`
    }, () => {
      fetchData();
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [selectedCompany]);
```

### Supabase konfiguráció

A Supabase Realtime alapból engedélyezett a projekten. Az `invoices` és `nav_invoices` tábláknál engedélyezni kell a Realtime-ot (ha még nincs), ami egy egyszerű migration:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE nav_invoices;
```

### Eredmény
- Amikor bármely forrásból (email, manuális feltöltés, NAV szinkron) új számla érkezik, a táblázat automatikusan frissül
- Nem kell manuálisan újratölteni az oldalt
- A csatorna cleanup-je biztosított a `useEffect` return-ben

