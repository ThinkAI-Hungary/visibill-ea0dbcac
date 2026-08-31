# A-073: Defensive Prop Normalization & Settings Component Resilience

**Status:** Decided  
**Date:** 2026-08-31  
**Category:** Frontend & Hibatűrés  
**Related Decisions:** [A-014](./A-014-react-query-cache.md), [A-069](./A-069-frontend-error-reporting-and-context-inspection.md), [P-025](../../product/decisions/P-025-settings-structure.md)

---

## 1. Context

A beállítások cégadatok tabján (`/:companyId/:dateRange/settings/business`, `BusinessSection.tsx`) egy aszinkron betöltési állapot során a felhasználói felület összeomlott:
`Uncaught TypeError: Cannot read properties of undefined (reading 'trim') at BusinessSection.tsx:249`.

A vizsgálat kimutatta, hogy amikor a parent komponensből (`Settings.tsx` / `ProfileSettingsPage.tsx`) érkező `companyName` kezdetben `undefined` vagy `null` volt, a `!companyName.trim()` ellenőrzés futásidejű hibát váltott ki. Hasonlóképpen, a React controlled input mezők kontrollálatlan állapotba kerülhettek volna, ha az `undefined` értékek nem rendelkeznek string fallbackkel.

---

## 2. Decision

1. **Defensive String Handling:**
   - Minden string-manipuláció (`trim()`, `toLowerCase()`) előtt kötelező az opcionális láncolás (`companyName?.trim()`) vagy a fallback (`(val || '').trim()`) használata.
2. **Controlled Input Garancia:**
   - Minden űrlapmezőben explicit `value={val || ''}` fallbacket alkalmazunk a React warningok és hibák elkerülésére.
3. **Telephely Form Hibatűrés:**
   - Az új telephely űrlap submit és disabled logikájában a whitespace-only és `undefined` értékeket egyaránt szűrjük.

---

## 3. Consequences

### Pozitív:
- A beállítások oldal minden cégváltáskor és aszinkron adatbetöltéskor 100%-ban stabil marad.
- Megszűnnek az `undefined.trim()` típusú runtime hibák a beállítások alrendszerben.
