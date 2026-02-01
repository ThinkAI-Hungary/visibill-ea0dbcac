
# Módosított Terv: Szállító-Projekt Alapértelmezett Hozzárendelés

## A módosítások összefoglalása

A terv 3 lényeges ponton változik az eredeti tervhez képest:

1. **Partner ID alapú mapping** (nem tax_number) - Külföldi partnerek kezelése
2. **Post-upsert UPDATE** művelet prefetch helyett - Hatékonyabb, egyszerűbb
3. **Javított hibakezelés** - Project ID + név a trigger üzenetben

---

## 1. Adatbázis Séma Módosítások

### 1.1 Partners tábla bővítése

```sql
-- Alapértelmezett projekt mező
ALTER TABLE partners 
ADD COLUMN default_project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX idx_partners_default_project 
ON partners(default_project_id) WHERE default_project_id IS NOT NULL;
```

### 1.2 Nav_invoices tábla bővítése - ÚJ: supplier_partner_id

```sql
-- Szállító partner ID (INBOUND számlákhoz)
ALTER TABLE nav_invoices 
ADD COLUMN supplier_partner_id UUID REFERENCES partners(id) ON DELETE SET NULL;

CREATE INDEX idx_nav_invoices_supplier_partner 
ON nav_invoices(supplier_partner_id) WHERE supplier_partner_id IS NOT NULL;
```

### 1.3 Javított trigger - Project ID + név a hibaüzenetben

```sql
CREATE OR REPLACE FUNCTION enforce_invoice_single_project()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_project_name TEXT;
BEGIN
  IF OLD.project_id IS NOT DISTINCT FROM NEW.project_id THEN
    RETURN NEW;
  END IF;
  
  IF OLD.project_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  IF NEW.project_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  SELECT name INTO v_existing_project_name
  FROM projects
  WHERE id = OLD.project_id;
  
  -- JAVÍTÁS: ID és név is benne van az üzenetben
  RAISE EXCEPTION 'INVOICE_ALREADY_ASSIGNED::%::%', 
    OLD.project_id,
    COALESCE(v_existing_project_name, 'Ismeretlen projekt');
END;
$$;
```

---

## 2. Import Logika Módosítása (Edge Functions)

### 2.1 Supplier Partner ID beállítása upsert során

A `cachePartnersFromInvoices` függvény után visszaadjuk a partner ID-kat, és az upsert-nél beállítjuk a `supplier_partner_id`-t:

```typescript
// nav-query-outbound-invoices/index.ts és nav-auto-sync/index.ts

// 1. Partner cache visszaadja a tax_number -> partner_id map-ot
const partnerIdMap = await cachePartnersFromInvoices(...);
// partnerIdMap: Map<string, string> = { "12345678": "uuid-1", "87654321": "uuid-2" }

// 2. Invoices upsert a supplier_partner_id-vel
const invoicesToInsert = allInvoices.map(inv => ({
  // ... meglévő mezők ...
  supplier_partner_id: direction === 'INBOUND' && inv.supplierTaxNumber 
    ? partnerIdMap.get(inv.supplierTaxNumber) || null 
    : null
}));
```

### 2.2 Post-upsert UPDATE a project_id beállításához

Az upsert UTÁN futtatunk egy UPDATE-et, ami beállítja a `project_id`-t ahol:
- A `project_id` NULL (új vagy korábban nem hozzárendelt számla)
- A szállító partnernek van `default_project_id`-ja

```typescript
// Az upsert után:
if (direction === 'INBOUND') {
  // Set project_id from supplier's default_project_id
  // Only for invoices where project_id is still NULL
  const { error: projectAssignError } = await serviceClient.rpc(
    'assign_supplier_default_projects',
    { p_company_id: companyId }
  );
  
  if (projectAssignError) {
    console.error('[NAV-QUERY] Error assigning default projects:', projectAssignError);
  } else {
    console.log('[NAV-QUERY] Default project assignment completed');
  }
}
```

### 2.3 Új RPC függvény a project assignment-hez

```sql
CREATE OR REPLACE FUNCTION assign_supplier_default_projects(p_company_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  UPDATE nav_invoices ni
  SET project_id = p.default_project_id
  FROM partners p
  WHERE ni.company_id = p_company_id
    AND ni.project_id IS NULL
    AND ni.invoice_direction = 'INBOUND'
    AND ni.supplier_partner_id = p.id
    AND p.default_project_id IS NOT NULL;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$$;
```

---

## 3. Frontend Módosítások

### 3.1 PartnersPage.tsx - Alapértelmezett projekt választó

```typescript
// Új state és query a projektekhez
const { data: projects } = useQuery({
  queryKey: ["projects", selectedCompany?.id],
  queryFn: async () => {
    const { data } = await supabase
      .from("projects")
      .select("id, name")
      .eq("company_id", selectedCompany?.id)
      .order("name");
    return data || [];
  },
  enabled: !!selectedCompany?.id,
});

// Form bővítése
const [formData, setFormData] = useState({
  name: "",
  tax_number: "",
  address: "",
  partner_type: "both",
  default_project_id: null as string | null,  // ÚJ
});

// Dialog-ban új mező (csak supplier/both típusnál)
{(formData.partner_type === 'supplier' || formData.partner_type === 'both') && (
  <div className="space-y-2">
    <Label>Alapértelmezett projekt (opcionális)</Label>
    <Select
      value={formData.default_project_id || "none"}
      onValueChange={(v) => setFormData({...formData, default_project_id: v === "none" ? null : v})}
    >
      <SelectTrigger>
        <SelectValue placeholder="Nincs" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Nincs</SelectItem>
        {projects?.map(p => (
          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
    <p className="text-xs text-muted-foreground">
      Ha beállítod, az ettől a szállítótól érkező új számlák 
      automatikusan ehhez a projekthez rendelődnek.
    </p>
  </div>
)}
```

### 3.2 PartnersPage.tsx - Tábla bővítése

Új oszlop: "Alap. projekt" - megmutatja a projekt nevét, ha van

```typescript
// Partner interface bővítése
interface Partner {
  // ... meglévő mezők ...
  default_project_id: string | null;
  projects?: { name: string } | null;  // Join-ból
}

// Query módosítása
const { data, error } = await supabase
  .from("partners")
  .select("*, projects:default_project_id(name)")
  .eq("company_id", selectedCompany.id)
  .order("name");

// Tábla oszlop
<TableHead className="w-[15%]">Alap. projekt</TableHead>
...
<TableCell>
  {partner.projects?.name ? (
    <Badge variant="outline" className="text-xs">
      {partner.projects.name}
    </Badge>
  ) : (
    <span className="text-muted-foreground/50">—</span>
  )}
</TableCell>
```

### 3.3 InvoicesPage.tsx - Javított hibakezelés

```typescript
const handleProjectChange = async (invoiceId: string, projectId: string | null) => {
  try {
    const { error } = await supabase
      .from('nav_invoices')
      .update({ project_id: projectId === 'none' ? null : projectId })
      .eq('id', invoiceId);

    if (error) {
      // JAVÍTOTT: ID és név kinyerése az üzenetből
      if (error.message?.includes('INVOICE_ALREADY_ASSIGNED::')) {
        const parts = error.message.split('::');
        // parts[1] = project_id, parts[2] = project_name
        const existingProjectName = parts[2] || parts[1] || 'Ismeretlen projekt';
        
        toast.error(`Ez a számla már hozzá van rendelve`, {
          description: `A számla a "${existingProjectName}" projekthez tartozik. Először távolítsd el onnan.`
        });
        return;
      }
      throw error;
    }

    // Sikeres frissítés...
    setInvoices(prev => prev.map(inv => 
      inv.id === invoiceId ? { ...inv, project_id: projectId === 'none' ? null : projectId } : inv
    ));
    toast.success('Projekt hozzárendelve');
  } catch (error) {
    console.error('Error updating project:', error);
    toast.error('Hiba a projekt hozzárendelésekor');
  }
};
```

### 3.4 SupplierInvoiceAssignment.tsx - Javított hibakezelés

Ugyanez a logika alkalmazandó a projekt hozzárendelési panelben is.

---

## 4. Teljes SQL Script (manuális futtatás)

```sql
-- ============================================
-- 1. PARTNERS TÁBLA BŐVÍTÉSE
-- ============================================
ALTER TABLE partners 
ADD COLUMN IF NOT EXISTS default_project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_partners_default_project 
ON partners(default_project_id) WHERE default_project_id IS NOT NULL;

-- ============================================
-- 2. NAV_INVOICES TÁBLA BŐVÍTÉSE
-- ============================================
ALTER TABLE nav_invoices 
ADD COLUMN IF NOT EXISTS supplier_partner_id UUID REFERENCES partners(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_nav_invoices_supplier_partner 
ON nav_invoices(supplier_partner_id) WHERE supplier_partner_id IS NOT NULL;

-- ============================================
-- 3. ALAPÉRTELMEZETT PROJEKT HOZZÁRENDELŐ FÜGGVÉNY
-- ============================================
CREATE OR REPLACE FUNCTION assign_supplier_default_projects(p_company_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  UPDATE nav_invoices ni
  SET project_id = p.default_project_id
  FROM partners p
  WHERE ni.company_id = p_company_id
    AND ni.project_id IS NULL
    AND ni.invoice_direction = 'INBOUND'
    AND ni.supplier_partner_id = p.id
    AND p.default_project_id IS NOT NULL;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$$;

-- ============================================
-- 4. JAVÍTOTT SZÁMLA-PROJEKT VÉDELEM TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION enforce_invoice_single_project()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_project_name TEXT;
BEGIN
  IF OLD.project_id IS NOT DISTINCT FROM NEW.project_id THEN
    RETURN NEW;
  END IF;
  
  IF OLD.project_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  IF NEW.project_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  SELECT name INTO v_existing_project_name
  FROM projects
  WHERE id = OLD.project_id;
  
  -- ID és név is benne van az üzenetben
  RAISE EXCEPTION 'INVOICE_ALREADY_ASSIGNED::%::%', 
    OLD.project_id,
    COALESCE(v_existing_project_name, 'Ismeretlen projekt');
END;
$$;

-- Trigger újra-létrehozása (ha változott a függvény)
DROP TRIGGER IF EXISTS trg_enforce_invoice_single_project ON nav_invoices;
CREATE TRIGGER trg_enforce_invoice_single_project
  BEFORE UPDATE OF project_id ON nav_invoices
  FOR EACH ROW
  EXECUTE FUNCTION enforce_invoice_single_project();
```

---

## 5. Edge Function Módosítások Összefoglalása

### nav-query-outbound-invoices/index.ts

1. Módosítsd a `cachePartnersFromInvoices` függvényt, hogy visszaadja a `tax_number -> partner_id` map-ot
2. Az upsert-nél add hozzá a `supplier_partner_id` mezőt az INBOUND számláknál
3. Upsert után hívd meg az `assign_supplier_default_projects` RPC-t

### nav-auto-sync/index.ts

Ugyanazok a módosítások, mint a manuális sync-nél.

---

## Implementációs Sorrend

1. **Adatbázis**: SQL script futtatása (partnerek, nav_invoices, trigger, RPC)
2. **Edge Functions**: Partner ID visszaadás és supplier_partner_id beállítás
3. **Edge Functions**: Post-upsert RPC hívás a projekt assignment-hez
4. **PartnersPage.tsx**: Alapértelmezett projekt választó és táblázat oszlop
5. **InvoicesPage.tsx**: Javított hibakezelés a trigger üzenethez
6. **SupplierInvoiceAssignment.tsx**: Ugyanaz a hibakezelés
7. **Tesztelés**: Partner szerkesztés, számla import, projekt hozzárendelés
