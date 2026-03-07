

## A "→" badge rossz kontextust mutat

### A probléma

Amikor a **D-THINK-84** (díjbekérő) sort lenyitod, a kapcsolt bizonylat az **E-THINK-2025-85** (előlegszámla). A badge `→ D-THINK-84`-et mutat, ami az E-THINK-2025-85 saját `reference_number` mezője — tehát önmagadra mutat vissza. Ez félrevezető.

### A megoldás

A badge-nek a **kapcsolat irányát** kell mutatnia, nem vakon a `reference_number`-t:

- **Ha a kapcsolt számla hivatkozik rám** (gyerek): `← E-THINK-2025-85 hivatkozik erre`  
- **Ha én hivatkozok a kapcsolt számlára** (szülő): `→ Hivatkozás: D-THINK-84`

### Változás

**`src/components/ExpandedInvoiceRow.tsx`**:
- A `LinkedInvoice` interfészhez hozzáadunk egy opcionális `relationDirection` mezőt (`'parent' | 'child'`)
- A badge megjelenítés a direction alapján változik:
  - `parent`: "Hivatkozott bizonylat" (erre mutat az aktuális számla)
  - `child`: "Hivatkozó bizonylat" (ez mutat az aktuális számlára)

**`src/pages/InvoicesPage.tsx`**:
- A `getLinkedInvoices` függvényben a parent és child találatoknál a visszaadott objektumokhoz hozzáadjuk a `relationDirection` mezőt (`'parent'` vagy `'child'`)

### Eredmény

D-THINK-84 lenyitásakor:
- E-THINK-2025-85 → badge: **"Hivatkozó bizonylat"** (mert az előlegszámla hivatkozik a díjbekérőre)

E-THINK-2025-85 lenyitásakor:  
- D-THINK-84 → badge: **"Hivatkozott bizonylat"** (mert az előlegszámla hivatkozik rá)

