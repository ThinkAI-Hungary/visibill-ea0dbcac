# P-044: Külföldi partner megjelenítés

**Status:** Decided
**Category:** UI / Data Display
**Question:** Hogyan jelenjenek meg a külföldi (VAT nélküli) partnerek a partnertörzs UI-ban?
**Decision:** A szintetikus `FOREIGN:` adószámot elrejtjük és „Külföldi" badge-et mutatunk helyette.
**Current Implementation:** `isForeignPartner()` helper a `PartnersPage.tsx`-ben

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
- Az adószám mező **disabled**, szürke, italic szöveggel: „Külföldi partner – nincs adószám"
- A csillag (*) eltűnik a label-ről — nem kötelező mező
- A validáció engedi az üres adószámot külföldi partnereknél

### Keresés

A keresési filter kizárja a `FOREIGN:` prefixet a text-matching-ből — a felhasználó nem tud rákeresni a szintetikus ID-re.

## Rationale

- A `FOREIGN:` prefix **belső azonosító**, nem valós adószám
- Félrevezető lenne „FOREIGN:anthropicpbc" adószámot kiírni
- A „Külföldi" badge **informatív** — egyértelmű hogy miért nincs adószám

## Kapcsolódó
- [A-024: Partner Upsert Strategy](../../architecture/decisions/A-024-partner-upsert-strategy.md) — szintetikus ID logika
- [P-040: Partnertörzs](./P-040-partners-invoice-panel.md) — Partner UI alap
