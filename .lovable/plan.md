

# Terv: Projektek Oldal Frissítések (Módosított)

## Összefoglaló

A Projektek oldal bővítése az alábbi funkciókkal:
1. Ügyfél neve legördülő keresőmező a partners táblából
2. Projekt típus (egyszeri/ismétlődő)
3. **Automatikus projektkód generálás szerver oldalon (Supabase trigger)**
4. Szállító számlák hozzárendelési panel **adatbázis szintű védelmmel**

---

## 1. Ügyfél Kiválasztás Legördülő Menüből

### Működés
- Az "Ügyfél neve" input mező helyett kereshető legördülő (Combobox)
- Adatforrás: `partners` tábla (NAV-ból és számlákból importált partnerek)
- Keresés név és adószám alapján
- **"Új partner" létrehozás eltávolítva a felületről**
- Segédszöveg megjelenítése:
  *"Ha nem látod a partnert a listában, akkor küldj be/tölts fel egy olyan számlát, amin az új partner szerepel."*

---

## 2. Projekt Típus Mező

### Működés
- Új mező a projekthez: `project_type`
- Értékek: `one_time` (Egyszeri) vagy `recurring` (Ismétlődő)
- Alapértelmezett: `one_time`
- Radio button vagy Select komponens a UI-on

---

## 3. Projektkód Generálás - Szerver Oldali (Race Condition Mentes)

### Működés
- **A projektkód a Supabase-ben generálódik trigger segítségével**
- Formátum: `PRJ-{YYYYMM}-{XXX}` (pl. `PRJ-202602-001`)
- A trigger az INSERT művelet BEFORE fázisában fut
- Sequence használata az egyediség garantálásához
- A frontend csak megjeleníti a kódot (read-only szürke mező + másolás ikon)

### Adatbázis megoldás

```sql
-- 1. Projektkód oszlop hozzáadása
ALTER TABLE projects 
ADD COLUMN project_code TEXT UNIQUE;

-- 2. Sequence a sorszámhoz (globálisan egyedi, nem hónap alapú)
CREATE SEQUENCE projects_code_seq START 1;

-- 3. Trigger függvény a projektkód generálásához
CREATE OR REPLACE FUNCTION generate_project_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year_month TEXT;
  v_seq_num INTEGER;
BEGIN
  -- Ha már van project_code, ne változtasd
  IF NEW.project_code IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  -- Év-hónap formátum
  v_year_month := to_char(NOW(), 'YYYYMM');
  
  -- Következő sorszám a sequence-ből (atomi művelet, nincs race condition)
  v_seq_num := nextval('projects_code_seq');
  
  -- Projektkód generálása
  NEW.project_code := 'PRJ-' || v_year_month || '-' || lpad(v_seq_num::TEXT, 4, '0');
  
  RETURN NEW;
END;
$$;

-- 4. Trigger a projects táblára
CREATE TRIGGER trg_generate_project_code
  BEFORE INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION generate_project_code();
```

### Miért biztonságos ez?
- A `nextval()` atomi művelet - két párhuzamos INSERT garantáltan különböző értéket kap
- A BEFORE INSERT trigger biztosítja, hogy a kód már a sor létrehozása előtt megvan
- UNIQUE constraint az adatbázisban is védi a duplikációt

---

## 4. Szállító Számlák Hozzárendelés - Adatbázis Szintű Védelem

### 1 Számla → 1 Projekt szabály

A `nav_invoices.project_id` mezőt csak akkor lehet beállítani, ha:
- A jelenlegi érték NULL, VAGY
- Az új érték megegyezik a jelenlegi értékkel

### Adatbázis megoldás

```sql
-- Trigger függvény az "1 számla → 1 projekt" szabály érvényesítéséhez
CREATE OR REPLACE FUNCTION enforce_invoice_single_project()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_project_name TEXT;
BEGIN
  -- Ha a project_id nem változik, engedélyezzük
  IF OLD.project_id IS NOT DISTINCT FROM NEW.project_id THEN
    RETURN NEW;
  END IF;
  
  -- Ha a régi project_id NULL volt, engedélyezzük az új beállítást
  IF OLD.project_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Ha a project_id-t NULL-ra állítják (eltávolítás), engedélyezzük
  IF NEW.project_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Ha már van project_id és mást akarnak beállítani: HIBA
  SELECT name INTO v_existing_project_name
  FROM projects
  WHERE id = OLD.project_id;
  
  RAISE EXCEPTION 'INVOICE_ALREADY_ASSIGNED::%', 
    COALESCE(v_existing_project_name, 'Ismeretlen projekt');
END;
$$;

-- Trigger a nav_invoices táblára
CREATE TRIGGER trg_enforce_invoice_single_project
  BEFORE UPDATE OF project_id ON nav_invoices
  FOR EACH ROW
  EXECUTE FUNCTION enforce_invoice_single_project();
```

### Frontend hibakezelés

```typescript
// Amikor a Supabase update hibát dob
if (error?.message?.includes('INVOICE_ALREADY_ASSIGNED::')) {
  const projectName = error.message.split('::')[1];
  toast({
    variant: "destructive",
    title: "Hozzárendelés sikertelen",
    description: `Ez a számla már a "${projectName}" projekthez van rendelve.`
  });
}
```

---

## Manuális SQL Script (futtatandó a Supabase SQL Editorban)

```sql
-- ============================================
-- 1. PROJEKT TÍPUS OSZLOP
-- ============================================
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS project_type TEXT NOT NULL DEFAULT 'one_time';

-- ============================================
-- 2. PROJEKTKÓD OSZLOP ÉS GENERÁLÁS
-- ============================================
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS project_code TEXT UNIQUE;

-- Sequence a sorszámhoz
CREATE SEQUENCE IF NOT EXISTS projects_code_seq START 1;

-- Trigger függvény
CREATE OR REPLACE FUNCTION generate_project_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year_month TEXT;
  v_seq_num INTEGER;
BEGIN
  IF NEW.project_code IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  v_year_month := to_char(NOW(), 'YYYYMM');
  v_seq_num := nextval('projects_code_seq');
  NEW.project_code := 'PRJ-' || v_year_month || '-' || lpad(v_seq_num::TEXT, 4, '0');
  
  RETURN NEW;
END;
$$;

-- Trigger létrehozása (ha még nincs)
DROP TRIGGER IF EXISTS trg_generate_project_code ON projects;
CREATE TRIGGER trg_generate_project_code
  BEFORE INSERT ON projects
  FOR EACH ROW
  EXECUTE FUNCTION generate_project_code();

-- ============================================
-- 3. SZÁMLA-PROJEKT HOZZÁRENDELÉS VÉDELEM
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
  
  RAISE EXCEPTION 'INVOICE_ALREADY_ASSIGNED::%', 
    COALESCE(v_existing_project_name, 'Ismeretlen projekt');
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_invoice_single_project ON nav_invoices;
CREATE TRIGGER trg_enforce_invoice_single_project
  BEFORE UPDATE OF project_id ON nav_invoices
  FOR EACH ROW
  EXECUTE FUNCTION enforce_invoice_single_project();
```

---

## Frontend Komponensek

### 1. PartnerCombobox (`src/components/PartnerCombobox.tsx`)
- Kereshető legördülő a partners táblából
- Props: `value`, `onChange`, `companyId`
- Szűrés: partner_type = 'customer' vagy 'both'
- Nincs "Új partner" gomb

### 2. Projects.tsx Módosítások
- PartnerCombobox az "Ügyfél neve" input helyett
- Segédszöveg megjelenítése a partner selector alatt
- Projekt típus Select/RadioGroup hozzáadása
- Projektkód read-only megjelenítés (szürke mező + CopyableCell)
- A projektkód csak mentés után jelenik meg (a szerver generálja)

### 3. SupplierInvoiceAssignment (`src/components/SupplierInvoiceAssignment.tsx`)
- Panel a szállító számlák projekthez rendeléséhez
- Keresés, szűrés (számlaszám, szállító név)
- Hozzárendelés gomb minden sornál
- Hibakezelés: ha már van projekt, mutatja a projekt nevét
- Hozzárendelt számlák listája külön

---

## Vizuális Terv

```text
┌─────────────────────────────────────────────────────────┐
│ Új projekt létrehozása                                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ Projekt neve *                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ pl. Weboldal fejlesztés                             │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Ügyfél *                                                │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🔍 Partner keresése...                           ▼  │ │
│ └─────────────────────────────────────────────────────┘ │
│ ℹ️ Ha nem látod a partnert a listában, akkor küldj    │
│    be/tölts fel egy olyan számlát, amin az új partner  │
│    szerepel.                                            │
│                                                         │
│ Projektkód              │ Típus           │ Státusz     │
│ ┌─────────────────┐ 📋  │ ┌─────────────┐ │ ┌─────────┐ │
│ │ (Mentés után)   │     │ │ Egyszeri  ▼ │ │ │ Aktív ▼ │ │
│ └─────────────────┘     │ └─────────────┘ │ └─────────┘ │
│ (automatikusan generált)                                │
│                                                         │
│ Leírás                                                  │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Projekt részletei...                                │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│                                     [Mégse]  [Mentés]   │
└─────────────────────────────────────────────────────────┘

--- Meglévő projekt szerkesztése (projektkód látható) ---

│ Projektkód              │ Típus           │ Státusz     │
│ ┌─────────────────┐ 📋  │ ┌─────────────┐ │ ┌─────────┐ │
│ │ PRJ-202602-0001 │     │ │ Egyszeri  ▼ │ │ │ Aktív ▼ │ │
│ └─────────────────┘     │ └─────────────┘ │ └─────────┘ │
│ (nem szerkeszthető)                                     │

--- Költségszámlák hozzárendelése panel ---

│ ┌─ Költségszámlák hozzárendelése ────────────────────┐  │
│ │ 🔍 Keresés számlaszám vagy szállító alapján...     │  │
│ │                                                    │  │
│ │ Hozzárendelhető számlák:                           │  │
│ │ ┌────────────────────────────────────────────────┐ │  │
│ │ │ SZL-2025-001 │ Szállító Kft. │ 150k Ft │ [+] │ │  │
│ │ │ SZL-2025-002 │ Beszállító Bt.│ 75k Ft  │ [+] │ │  │
│ │ └────────────────────────────────────────────────┘ │  │
│ │                                                    │  │
│ │ Már hozzárendelve (ehhez a projekthez):            │  │
│ │ ┌────────────────────────────────────────────────┐ │  │
│ │ │ SZL-2025-003 │ Partner Zrt.  │ 200k Ft │ [✓] │ │  │
│ │ └────────────────────────────────────────────────┘ │  │
│ └────────────────────────────────────────────────────┘  │
```

---

## Implementációs Lépések

1. **Adatbázis**: SQL script manuális futtatása a Supabase SQL Editorban
2. **PartnerCombobox**: Új komponens létrehozása cmdk alapon
3. **Projects.tsx**: Form frissítése (partner selector, projekt típus, projektkód read-only)
4. **SupplierInvoiceAssignment**: Számla-hozzárendelési panel hibakezeléssel
5. **Tesztelés**: Új projekt létrehozása, projektkód ellenőrzése, számla hozzárendelés tesztelése

