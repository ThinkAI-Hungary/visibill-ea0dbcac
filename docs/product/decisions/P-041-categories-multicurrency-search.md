# P-041 — Kategóriák: Multi-currency összeg megjelenítés + dual-table keresés

> **Státusz:** ✅ Decided  
> **Dátum:** 2026-06-26  
> **Implementálva:** `CategoryAccordionItem.tsx`, `Onboarding.tsx`

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

---

## Kapcsolódó fájlok

- `src/components/CategoryAccordionItem.tsx`
- `src/pages/Onboarding.tsx`
- Táblák: `nav_invoices`, `invoices`, `categories`
