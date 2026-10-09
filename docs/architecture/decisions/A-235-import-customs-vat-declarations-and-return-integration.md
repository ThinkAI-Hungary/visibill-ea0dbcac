# A-235: Termékimport és Vámhatározatok ÁFA Integrációja

**Status:** Decided  
**Date:** 2026-10-09  
**Utoljára frissítve:** 2026-10-09  

---

## 🏛️ Context
Harmadik országból történő termékbehozatal esetén a beszerzés nem szerepel a NAV Online Számla rendszerben (mivel a külföldi eladó nem magyar adóalany, így nem küld számlaadat-szolgáltatást a NAV-nak). A forgalomba helyezés adójogi bizonylata a vámhatóság által kibocsátott vámhatározat (határozat szabad forgalomba bocsátásról / egységes vámokmány).

Korábban a rendszer kizárólag a `nav_invoices` és `invoices` táblákból táplálta az ÁFA bevallás (NAV 2665) kalkulációs motorját. Emiatt a termékimport előzetesen felszámított forgalmi adóját (70–72. sorok), valamint az önadózási engedéllyel rendelkező importőrök fizetendő import áfáját (18–20. sorok) nem lehetett rendszerszinten kezelni és automatikusan kiszámítani.

---

## 💡 Decision

### 1. Vámhatározatok Adatbázis Modellje (`import_customs_declarations`)
Önálló entitásként létrehozásra került az `import_customs_declarations` tábla a multi-tenant adatbázisban:
```sql
CREATE TABLE public.import_customs_declarations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    declaration_number TEXT NOT NULL,
    customs_office_id TEXT,
    issue_date DATE NOT NULL,
    due_date DATE,
    tax_point_date DATE NOT NULL,
    seller_name TEXT,
    seller_country_code TEXT,
    is_self_assessed BOOLEAN NOT NULL DEFAULT false,
    tax_base NUMERIC(15,2) NOT NULL DEFAULT 0,
    vat_code TEXT NOT NULL,
    vat_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    customs_duty_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    is_paid BOOLEAN NOT NULL DEFAULT false,
    payment_date DATE,
    notes TEXT,
    attachment_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 2. Rendszerszintű Áfakódok Bővítése
A rendszer ÁFA kód katalógusa (`vat_codes`) 4 új, dedikált import gyűjtőkóddal egészült ki:
- `IMPORT_27`: 27%-os normál kulcsú termékimport
- `IMPORT_18`: 18%-os kedvezményes kulcsú termékimport
- `IMPORT_5`: 5%-os kedvezményes kulcsú termékimport
- `IMPORT_MENTES`: Törvényileg adómentes termékimport

### 3. ÁFA Számítási Motor Bővítése (`calculate_hungarian_vat_return`)
A `calculate_hungarian_vat_return` adatbázis-függvény aggregálja az adott adómegállapítási időszakra (`tax_point_date`) eső vámhatározatokat:
1. **Levonható import ÁFA (sorok 70–72):**
   - Minden olyan tétel esetén, ahol a levonhatóság törvényi feltételei teljesülnek (kivetéses esetén `is_paid = true`, vagy önadózói import):
     - `row70_base` és `row70_tax`: 27%-os import
     - `row71_base` és `row71_tax`: 18%-os import
     - `row72_base` és `row72_tax`: 5%-os import
2. **Önadózói fizetendő import ÁFA (sorok 18–20):**
   - Ha `is_self_assessed = true`:
     - `row18_base` és `row18_tax`: 27%-os önadózói import
     - `row19_base` és `row19_tax`: 18%-os önadózói import
     - `row20_base` és `row20_tax`: 5%-os önadózói import
3. **Elszámolandó adó egyenleg:** A fizetendő adók és levonható adók különbsége (`line61` / `line73`) pontosan tartalmazza az import tételeket.

### 4. Biztonság és Jogosultság (RLS)
- Sor-szintű biztonság (`ROW LEVEL SECURITY`) garantálja, hogy a vámhatározatokat kizárólag az adott céghez rendelt felhasználók láthatják vagy módosíthatják (`is_company_member(company_id)`).
- Anonim elérés és közvetlen jogosulatlan API hívások tiltva.

---

## ⚡ Consequences

### Pozitív
- **100%-os NAV 2665 Nyomtatvány Megfelelőség:** A 65-ös bevallás import sorai (18–20 és 70–72) automatikusan kitöltődnek.
- **Transzparens nyilvántartás:** Nem keverednek a belföldi és külföldi számlák a hatósági vámokmányokkal.
- **Audit-biztonság:** A vámhatározat iktatószáma, kelte és pénzügyi teljesítése bármely adóellenőrzés során azonnal felmutatható.

### Negatív & Kockázatok
- Az import tételeket manuálisan kell rögzíteni (a vámhatóságtól nincs közvetlen M2M XML stream a vámhatározatokra). Az egyszerűsített rögzítő dialógus (`ImportCustomsDeclarationDialog`) minimalizálja ezt a terhet.

---

## 🔗 Kapcsolódó
- **BDR:** [066: Termékimport és Vámhatározatok ÁFA Elszámolása](../../business/decisions/066-import-customs-vat-declarations.md)
- **PRD:** [P-173: Termékimport és Vámhatározatok Rögzítése és Megjelenítése UX](../../product/decisions/P-173-import-customs-vat-declarations-ux.md)
- **Adatbázis Séma:** [15-eaisybooks-tax-legal.md](../../architecture/database/15-eaisybooks-tax-legal.md)
