# P-044: Külföldi partner megjelenítés

**Status:** Decided
**Category:** UI / Data Display
**Question:** Hogyan jelenjenek meg a külföldi (VAT nélküli) partnerek a partnertörzs UI-ban?
**Decision:** A szintetikus `FOREIGN:` adószámot elrejtjük és „Külföldi" badge-et mutatunk helyette. A számla-partner matching név-alapú.
**Current Implementation:** `isForeignPartner()` + `displayTaxNumber()` helperek a `PartnersPage.tsx`-ben

## Részletek

A worker `FOREIGN:<normalized_name>` formátumú szintetikus adószámot generál külföldi partnereknek (pl. Anthropic, OpenAI). Ez a belső azonosító a deduplikációhoz szükséges, de a felhasználónak **nem szabad látnia** — félrevezető lenne.

### Megjelenítés a táblázatban

Az adószám oszlopban kék „Külföldi" badge jelenik meg:

```tsx
{isForeignPartner(partner.tax_number) ? (
  <span className="... bg-blue-500/10 text-blue-400 ...">Külföldi</span>
) : (
  partner.tax_number
)}
```

### Megjelenítés a detail panelben

Az „Adószám" mező alatt „Külföldi partner" felirat jelenik meg (nem a FOREIGN:xxx).

### Szerkesztő form

Külföldi partner szerkesztésekor:
- Az adószám mező **szerkeszthető** — placeholder: „Külföldi partner – írd be az adószámot ha ismert"
- Ha a user beír valós adószámot → felülírja a `FOREIGN:` szintetikus ID-t
- Ha üresen hagyja → a `FOREIGN:` érték megmarad a DB-ben
- A csillag (*) eltűnik a label-ről — nem kötelező mező
- A validáció engedi az üres adószámot külföldi partnereknél

### Számla-partner matching (név-alapú fallback)

A `FOREIGN:` partnereknél a számla count és a detail panel **nem adószám-alapú**, hanem **név-alapú**:

**Számla count:**
- `invoices` tábla: `elado_nev ILIKE '%<partner.name>%' OR vevo_nev ILIKE '%<partner.name>%'`
- `nav_invoices` tábla: `supplier_name ILIKE '%<partner.name>%' OR customer_name ILIKE '%<partner.name>%'`

**Detail panel számlák:**
- Ugyanaz a név-alapú keresés, rendezve dátum szerint DESC, limit 50

Ez biztosítja, hogy a meglévő VAT nélküli számlák (pl. Anthropic, DeepSeek) azonnal megjelennek a partner alatt.

### Keresés

A keresési filter kizárja a `FOREIGN:` prefixet a text-matching-ből — a felhasználó nem tud rákeresni a szintetikus ID-re.

### Egyszeri backfill (2026-06-29)

SQL script létrehozta a hiányzó külföldi partnereket a meglévő számlákból:
- 13 partner létrehozva (9 Think AI Kft, 2 másik cég, 2 további)
- Logika: `DISTINCT ON (normalized_name, company_id)` a `FOREIGN:` generáláshoz

## Rationale

- A `FOREIGN:` prefix **belső azonosító**, nem valós adószám
- Félrevezető lenne „FOREIGN:anthropicpbc" adószámot kiírni
- A „Külföldi" badge **informatív** — egyértelmű hogy miért nincs adószám
- A **manuális adószám felülírás** lehetőségét megtartjuk — ha a user később megtalálja a VAT ID-t

## Kapcsolódó
- [A-024: Partner Upsert Strategy](../../architecture/decisions/A-024-partner-upsert-strategy.md) — szintetikus ID logika
- [P-040: Partnertörzs](./P-040-partners-invoice-panel.md) — Partner UI alap

