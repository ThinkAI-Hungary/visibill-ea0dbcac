# P-041 — Kategóriák: Multi-currency összeg + arány konzisztencia + összeg kimutatás

> **Státusz:** ✅ Decided  
> **Dátum:** 2026-06-26  
> **Utoljára frissítve:** 2026-06-29  
> **Implementálva:** `CategoryAccordionItem.tsx`, `CategoryDonutChart.tsx`, `CategoryAmountSummary.tsx`, `Onboarding.tsx`

---

## Kontextus

A Kategóriák oldal az egyes GL kategóriákhoz rendelt számlákat csoportosítja.
Korábban az összegek mindig HUF-ban jelentek meg, illetve a hozzárendelési keresőmező
csak NAV számlákat ajánlott fel.

---

## Döntések

### 1. Multi-currency összeg megjelenítés

Ha egy kategóriában több devizában vannak számlák, az összeg megjelenítése:

```
886 778 Ft | 1 200 USD | 450 EUR
```

Az egyes devizák összegei `|` karakterrel elválasztva. HUF mindig elsőként.
Ha csak HUF van, csak az jelenik meg (nincs felesleges `|`).

### 2. Dual-table keresés a hozzárendelési dialógusban

Amikor a user egy számlát rendel hozzá a kategóriához, a keresőmező most mindkét forrásból
javasol számlákat:
- **NAV** (`nav_invoices`) — NAV Online Számla forrás
- **Beküldött** (`invoices`) — manuálisan feltöltött számlák

A találatok merge-elve jelennek meg, forrás badge-gel jelölve (NAV / Bek.).

### 3. Kategóriák leírás frissítése

Az Onboarding oldalon a Kategóriák szekció leírása frissítve informatívabb szövegre,
amely elmagyarázza a GL számok és a számla-hozzárendelés kapcsolatát.

### 4. Arány megjelenítés — számla darabszám alapú (2026-06-29)

**Probléma:** Az arány megjelenítés inkonzisztens volt — a donut chart legendán
HUF-only kategóriáknál %-ot mutatott, multi-currency-nél összegeket, üreseknél
gondolatjelet. A progress bar a HUF összeg arányára épült, ami multi-currency
kategóriáknál 0 volt.

**Döntés:** Minden arány megjelenítés **számla darabszám** (`invoiceCount / totalInvoiceCount`)
alapú:

- **Donut chart legenda:** `%` (invoice count arány) — minden kategóriára egységesen
- **Accordion progress bar:** invoice count arány — deviza-független
- **Üres kategóriák:** `–` (gondolatjel)

**Miért:** A donut chart szegmensek eleve invoice count alapúak, így a legenda és
progress bar is ezt követi. Ez deviza-független és konzisztens megjelenítést ad.

**Elutasított alternatívák:**
- HUF-ekvivalens (exchange rate alapú) — túl komplex, árfolyamfüggő
- Vegyes logika (% + összeg) — inkonzisztens UX

### 5. Összeg kimutatás — vízszintes sáv diagram (2026-06-29)

A donut chart (darabszám arány) alatt egy külön kártya jelenik meg:
**„Összeg kategóriánként"** — vízszintes sávok a kategória színével,
csökkenő összeg szerinti sorrendben.

- Sávok relatív mérete: HUF összeg arány (a legnagyobb kategóriához viszonyítva)
- Összeg label: multi-currency formátum (`X Ft | Y EUR`)
- Üres kategóriák (0 számla) nem jelennek meg

---

## Kapcsolódó fájlok

- `src/components/CategoryAccordionItem.tsx` — accordion sor, progress bar
- `src/components/CategoryDonutChart.tsx` — donut chart + legenda
- `src/components/CategoryAmountSummary.tsx` — összeg sáv diagram
- `src/pages/Onboarding.tsx` — Kategóriák oldal
- Táblák: `nav_invoices`, `invoices`, `categories`
