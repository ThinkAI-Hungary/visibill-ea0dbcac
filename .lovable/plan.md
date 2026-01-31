
# Terv: Szállító-Projekt Automatikus Hozzárendelés és Költségszámla Projektcímkézés

## Összefoglaló

Két funkció implementálása:
1. **Szállító-Projekt összerendelés**: Egy szállítót (partner) összerendelhetsz egy projekttel, és a rendszer a jövőben automatikusan hozzárendeli az adott szállító összes bejövő számláját ehhez a projekthez.
2. **Manuális projekt-hozzárendelés bejövő számlákhoz**: A "Bejövő" fülön egyesével tudod hozzárendelni a költségszámláidat projektekhez (ez a funkció már részben működik, de kiterjesztjük és javítjuk).

---

## Funkció 1: Szállító-Projekt Automatikus Összerendelés

### Működés

A "Projektek" oldalon minden projektkártyán megjelenik egy "Szállító hozzáadása" gomb vagy dropdown. Kiválasztod a szállítót (partner), és a rendszer elmenti az összerendelést. Ezután minden új bejövő számlánál, ahol az adott szállító szerepel, a rendszer automatikusan beállítja a projekt_id-t.

### Szükséges változtatások

**Adatbázis módosítás:**
Új tábla létrehozása a szállító-projekt kapcsolatokhoz:

```text
partner_project_mappings tábla:
- id (uuid, primary key)
- partner_tax_number (text, kötelező) - szállító adószáma
- project_id (uuid, FK projects.id)
- company_id (uuid, FK companies.id)
- user_id (uuid, kötelező)
- created_at, updated_at
```

**Frontend módosítások:**
- Projects.tsx: Új "Szállító hozzáadása" gomb minden projektkártyán
- Dialog a szállító kiválasztásához (dropdown a meglévő partnerekből, ahol partner_type = 'supplier' vagy 'both')
- Lista a már hozzárendelt szállítókról a projektkártyán

**Backend logika:**
- nav-query-outbound-invoices edge function módosítása: új INBOUND számla érkezésekor ellenőrzi a partner_project_mappings táblát, és ha talál egyezést a supplier_tax_number alapján, beállítja a project_id-t

---

## Funkció 2: Költségszámlák Manuális Projektcímkézése

### Jelenlegi állapot

A "Bejövő" (INBOUND) fülön már van "Projekt" oszlop dropdownnal, de ez jelenleg csak az OUTBOUND fülön volt igazán kihasználva.

### Szükséges változtatások

A funkció már működik! A "Bejövő" fülön a "Projekt" oszlop dropdownja használható a költségszámlák manuális hozzárendelésére projektekhez. Ellenőrzés után nincs szükség módosításra - a `handleProjectChange` függvény már mindkét irányú számlánál működik.

---

## Technikai Részletek

### 1. Adatbázis migráció

```sql
CREATE TABLE partner_project_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_tax_number TEXT NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(partner_tax_number, project_id, company_id)
);

-- RLS policies
ALTER TABLE partner_project_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own mappings" ON partner_project_mappings
  FOR ALL USING (auth.uid() = user_id);
```

### 2. Projects.tsx módosítások

- Új state: `partnerMappings` a projekt-szállító kapcsolatok tárolásához
- Új query: lekérdezi a `partner_project_mappings` táblát
- Új UI elem: minden projektkártyán "Szállító hozzáadása" gomb
- Dialog komponens: szállító kiválasztó dropdown + mentés/törlés

### 3. Edge Function módosítás (nav-query-outbound-invoices)

A INBOUND számlák mentésekor:
```text
1. Lekérdezi partner_project_mappings táblát a supplier_tax_number alapján
2. Ha talál egyezést és a számla project_id-je NULL:
   - Beállítja a project_id-t az összerendelés alapján
```

---

## Vizuális terv

A projektkártyán:
```text
┌─────────────────────────────────┐
│ Projekt neve            [Aktív] │
│ Ügyfél: Példa Kft.              │
│                                 │
│ Bevétel: +500,000 Ft            │
│ Kiadás:  -200,000 Ft            │
│ Eredmény: +300,000 Ft           │
│                                 │
│ ┌─ Hozzárendelt szállítók ────┐ │
│ │ ○ Szállító A Kft. [✕]       │ │
│ │ ○ Szállító B Kft. [✕]       │ │
│ │ [+ Szállító hozzáadása]     │ │
│ └─────────────────────────────┘ │
│                                 │
│ [Szerkesztés]              [✕]  │
└─────────────────────────────────┘
```

---

## Implementációs Lépések

1. **Adatbázis:** `partner_project_mappings` tábla és RLS létrehozása
2. **Projects.tsx:** Szállító-hozzárendelés UI és logika
3. **Edge function:** Automatikus projekt-hozzárendelés INBOUND számláknál
4. **Tesztelés:** Új szállító hozzárendelése projekthez, majd számla szinkronizálás

