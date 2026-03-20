

# Implementacios terv: Query key egysegesites + linkedInvoices RPC + InvoicesPage szetbontas

## Jelenlegi allapot attekintese

Az `InvoicesPage.tsx` 2246 sor, 3 fo gyengeseggel:
1. `['recentInvoices', companyId]`, `['dashboardPettyCash', companyId]`, `['uploadHistory', ...]` inline stringek nem a `queryKeys` factory-bol jonnek
2. `linkedInvoicesPool` query kliens-oldali BFS loop (max 20 iteracio, minden iteracioban kulon Supabase query)
3. A fajl tul nagy — adat, szuro logika, mutaciok es render mind egyetlen komponensben

---

## 1. lepcs: Query key egysegesites

**Fajlok:** `src/lib/queryKeys.ts`, `src/pages/Index.tsx`, `src/components/UploadHistory.tsx`

Uj factory-k a `queryKeys.ts`-ben:
```typescript
recentInvoices: (companyId: string) => ['recentInvoices', companyId] as const,
dashboardPettyCash: (companyId: string) => ['dashboardPettyCash', companyId] as const,
uploadHistory: (companyId: string, activeTab: string, dateFrom: string, dateTo: string, refreshKey?: number) =>
  ['uploadHistory', companyId, activeTab, dateFrom, dateTo, refreshKey] as const,
```

Majd az `Index.tsx` es `UploadHistory.tsx` inline key-eket lecsereljuk az uj factory hivasokra. A `useRealtimeInvalidation` megtartja a string prefix-es invalidaciot (az `invalidateQueries` prefix-match-et hasznal, tehat `['recentInvoices', companyId]` invalidalja a `queryKeys.recentInvoices(companyId)` kulcsot is) — igy NEM kell a hookot modositani.

---

## 2. lepcs: linkedInvoices rekurziv query → DB RPC

**Jelenlegi problema:** A `linkedInvoicesPool` useQuery 1-20 Supabase query-t futtat egymas utan (BFS loop), hogy megtalija az osszekapcsolt szamlakat a `reference_number ↔ bizonylatsorszam` lancon.

**Megoldas:** Egyetlen PostgreSQL recursive CTE fuggveny.

**Uj DB migration:**
```sql
CREATE OR REPLACE FUNCTION public.get_linked_invoices(
  p_company_id uuid,
  p_seed_bizonylat text[],
  p_seed_reference text[],
  p_exclude_ids uuid[]
)
RETURNS TABLE(
  id uuid,
  bizonylatsorszam text,
  kibocsatas_datuma date,
  teljesites_datuma date,
  elado_nev text,
  vevo_nev text,
  adoalap_osszesen numeric,
  brutto_vegosszeg numeric,
  afa_osszeg_osszesen numeric,
  penznem text,
  category_id uuid,
  project_id uuid,
  image_url text,
  melleklet_url text,
  invoice_direction text,
  reference_number text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH RECURSIVE chain AS (
    -- Seed: invoices linked to the known set
    SELECT i.id, i.bizonylatsorszam, i.kibocsatas_datuma, i.teljesites_datuma,
           i.elado_nev, i.vevo_nev, i.adoalap_osszesen, i.brutto_vegosszeg,
           i.afa_osszeg_osszesen, i.penznem, i.category_id, i.project_id,
           i.image_url, i.melleklet_url, i.invoice_direction, i.reference_number,
           1 AS depth
    FROM invoices i
    WHERE i.company_id = p_company_id
      AND i.id != ALL(p_exclude_ids)
      AND (
        i.reference_number = ANY(p_seed_bizonylat)
        OR i.bizonylatsorszam = ANY(p_seed_reference)
      )
    UNION
    -- Recurse: follow links in both directions
    SELECT i.id, i.bizonylatsorszam, i.kibocsatas_datuma, i.teljesites_datuma,
           i.elado_nev, i.vevo_nev, i.adoalap_osszesen, i.brutto_vegosszeg,
           i.afa_osszeg_osszesen, i.penznem, i.category_id, i.project_id,
           i.image_url, i.melleklet_url, i.invoice_direction, i.reference_number,
           c.depth + 1
    FROM invoices i
    JOIN chain c ON (
      (i.reference_number IS NOT NULL AND lower(i.reference_number) = lower(c.bizonylatsorszam))
      OR (i.bizonylatsorszam IS NOT NULL AND lower(i.bizonylatsorszam) = lower(c.reference_number))
    )
    WHERE i.company_id = p_company_id
      AND i.id != ALL(p_exclude_ids)
      AND c.depth < 20
  )
  SELECT DISTINCT ON (chain.id) chain.id, chain.bizonylatsorszam, chain.kibocsatas_datuma,
         chain.teljesites_datuma, chain.elado_nev, chain.vevo_nev, chain.adoalap_osszesen,
         chain.brutto_vegosszeg, chain.afa_osszeg_osszesen, chain.penznem, chain.category_id,
         chain.project_id, chain.image_url, chain.melleklet_url, chain.invoice_direction,
         chain.reference_number
  FROM chain;
$$;
```

**Frontend csere** (`InvoicesPage.tsx` ~310-358. sorok):
A jelenlegi 40+ soros BFS loop lecserelodik egyetlen RPC hivasra:
```typescript
const { data: linkedInvoicesPool = [] } = useQuery({
  queryKey: queryKeys.linkedInvoices(companyId, dateFromFormatted, dateToFormatted),
  queryFn: async () => {
    const seedBizonylat = submittedInvoices.map(i => i.bizonylatsorszam).filter(Boolean);
    const seedReference = submittedInvoices.map(i => i.reference_number).filter(Boolean);
    if (seedBizonylat.length === 0 && seedReference.length === 0) return [];
    const excludeIds = submittedInvoices.map(i => i.id);
    const { data, error } = await supabase.rpc('get_linked_invoices', {
      p_company_id: companyId,
      p_seed_bizonylat: seedBizonylat,
      p_seed_reference: seedReference,
      p_exclude_ids: excludeIds,
    });
    if (error) throw error;
    return (data || []) as SubmittedInvoice[];
  },
  enabled: enabled && !submittedLoading,
});
```

**Case-insensitive egyezes:** A CTE `lower()` fuggvenyt hasznal a bizonylatsorszam/reference_number osszehasonlitashoz, ahogy a kliens-oldalon is `.toUpperCase()` volt — ez megfelel a jelenlegi viselkedesnek.

---

## 3. lepcs: InvoicesPage szetbontas

A 2246 soros komponenst 3 custom hookra es 3 UI komponensre bontjuk. **Minden meglevo feature es viselkedes valtozatlan marad.**

### 3a. `src/hooks/useInvoiceData.ts` — Adat lekerdezesek
Tartalom (az InvoicesPage 274-459. soraibol):
- Osszes useQuery hook: navInvoices, submittedInvoices, linkedInvoicesPool, partners, categories, projects, allTransactions, navCredentials
- `matchedInvoiceIds` useMemo
- `invalidateInvoiceData` function
- `loading` computed flag
- Minden interface tipus (NavInvoice, SubmittedInvoice, Partner, Category, Project, TransactionRecord)

Export:
```typescript
export function useInvoiceData(companyId: string, enabled: boolean, dateFromFormatted: string, dateToFormatted: string, selectedCompanyId?: string)
```
Visszater: `{ invoices, submittedInvoices, linkedInvoicesPool, partners, categories, projects, allTransactions, matchedInvoiceIds, loading, credentialsExist, invalidateInvoiceData }`

### 3b. `src/hooks/useInvoiceFilters.ts` — Szurok, rendezes, paginacio
Tartalom (az InvoicesPage 119-143, 249-272, 664-910. soraibol):
- NavFilters es SubmittedFilters interface-ek es useState-ek
- `filteredAndSortedNavInvoices` useMemo
- `filteredAndSortedSubmittedInvoices` useMemo
- Paginacio logika (navPageSize, submittedPageSize, currentPage-ek, paginated useMemo-k, totalPages)
- Helper fuggvenyek: `getInvoicePartnerName`, `getPartnerName`, `getPartnerTaxNumber`, `getCategoryName`, `getProjectName`, `getPaymentMethodLabel`
- Rendezesi logika: `sortField`, `sortDirection`, `handleSort`
- Clear filter fuggvenyek

Export:
```typescript
export function useInvoiceFilters(invoices, submittedInvoices, partners, categories, projects, activeTab)
```

### 3c. `src/hooks/useInvoiceMutations.ts` — Muveletek
Tartalom (az InvoicesPage 474-625, 1091-1249. soraibol):
- `handleSync` — teljes NAV szinkronizacio logika
- `handleProjectChange`, `handleCategoryChange`, `handleToggleSubmitted`
- `handleExport`, `handleExportNav`, `handleExportSubmitted`, `exportToFile`
- Cooldown logika (serverLastSyncTime, cooldownSeconds, canSync, formatCooldown, checkServerCooldown)
- `syncing` state

Export:
```typescript
export function useInvoiceMutations(companyId, selectedCompany, invalidateInvoiceData, ...)
```

### 3d. `src/components/invoices/NavInvoiceFilters.tsx`
A szuro UI grid (1370-1494. sorok) — kereso mezo, penznem, fizetve, bekuldve, kategoria, projekt, fiz. mod szelektorok + torles gomb.

### 3e. `src/components/invoices/NavInvoiceTable.tsx`
A NAV tabla renderelese (1507-1812. sorok) — tabla fejlec, sorok, checkbox, expanded row, pagination. Props-kent kapja az osszes szukseges adatot es callback-et.

### 3f. `src/components/invoices/SubmittedInvoiceTable.tsx`
A bekuldott tabla renderelese (1900-2166. sorok) — tabla fejlec, sorok, muveletek, expanded row, pagination.

### Az eredmeny InvoicesPage.tsx (~250-300 sor):
```typescript
const InvoicesPage = () => {
  // Context hooks
  // useInvoiceData() — data
  // useInvoiceFilters() — filters & sorting
  // useInvoiceMutations() — sync, export, category/project change
  // Dialog states (imageDialogOpen, editDialogOpen, itemsDialogOpen)
  // Row expansion state
  // Tab state
  // Lookup maps (navToSubmittedMap, submittedToNavMap, etc.)
  // getNavInvoiceMatches, getSubmittedInvoiceMatches, getLinkedInvoices

  return (
    <Card>
      <CardHeader>...</CardHeader>
      <Tabs>
        {isNavTab && <NavInvoiceFilters ... />}
        {isNavTab && <NavInvoiceTable ... />}
        {isSubmittedTab && <SubmittedInvoiceTable ... />}
      </Tabs>
      <InvoiceImageDialog ... />
      <InvoiceFullEditDialog ... />
      <InvoiceItemsDialog ... />
    </Card>
  );
};
```

---

## Implementacios sorrend es kockazatkezeles

1. **Query key egysegesites** — legkisebb kockazat, nincs funkcionalis valtozas
2. **linkedInvoices RPC migration** — DB function + egyetlen queryFn csere
3. **InvoicesPage szetbontas** — lepcsozetes: eloszor hookokat szervezzuk ki (adatfolyam nem valtozik), majd UI komponenseket

**Biztonsagi garanciak:**
- A recursive CTE ugyanazt a `company_id` szurest alkalmazza, mint a jelenlegi kliens-oldali kod
- A `SECURITY DEFINER` + `SET search_path` biztositja, hogy az RLS policy-k megfelelo szinten ervenyesulnek
- Minden interface es tipus valtozatlan marad — a hookbol ugyanazok a tipusok jonnek ki
- A lookup map-ek (navToSubmittedMap, submittedIdToTransactionsMap, linkedInvoicesMap) es a match fuggvenyek az InvoicesPage-ben maradnak (nem a hookokban), mert szorosan kapcsolodnak a renderhez

