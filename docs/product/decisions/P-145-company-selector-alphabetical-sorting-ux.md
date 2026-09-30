# P-145: Ügyféllista és Cégválasztók ABC Sorrendezése UX

**Status:** Decided  
**Date:** 2026-09-30  
**Category:** Navigation / Company Selection / UX  
**Question:** Hogyan jelenjenek meg a cégek és ügyfelek a fejléc cégválasztójában és az Accounty ügyféllistákban sok ügyfél esetén?  
**Decision:** Minden cégválasztóban (`CompanySelector.tsx`, `CompanySwitcher.tsx`, `AccountyCompanySelector.tsx`) és a központi `CompanyContext`-ben a cégek listája szigorúan növekvő magyar ábécé szerint (`localeCompare('hu', { sensitivity: 'base' })`) kerül rendezésre, megőrizve a pinelt / aktív cég kiemelését.  
**Current Implementation:** A `src/contexts/CompanyContext.tsx` központi `useCompanies` query-je automatikusan rendezi az aktív és elérhető cégeket. A lenyíló listákban az ügyfelek azonnal és megbízhatóan megtalálhatók név szerint görgetve vagy keresve.  
**Rationale:** Sok cég (50+ ügyfél) esetén a véletlenszerű vagy létrehozási dátum szerinti sorrend megnehezítette az ügyfelek gyors kiválasztását. A magyar ábécé szerinti rendezés (beleértve az ékezetes karakterek, pl. Á, É, Ö helyes kezelését) alapvető ergonómiai elvárás a könyvelők részéről.

## Kapcsolódó
- [P-076: eaisyBooks Dual Mode Navigation & Company Switcher UX](./P-076-eaisybooks-dual-mode-navigation-and-company-switcher-ux.md)
- [P-085: eaisyBooks Portfolio Navigation Grouping UX](./P-085-eaisybooks-portfolio-navigation-grouping-ux.md)
