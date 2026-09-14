# P-084: Hierarchikus Útvonalkövető (Breadcrumbs) Rendszer és Automatikus Route Resolver UX

**Status:** ✅ Decided  
**Date:** 2026-09-14  
**Category:** Navigation / UX  
**Source:** [page-header.tsx](../../src/components/ui/page-header.tsx) · [useAccountyBreadcrumbs.ts](../../src/hooks/useAccountyBreadcrumbs.ts) · [AccountyApp.tsx](../../src/pages/Accounty/AccountyApp.tsx)  
**Kapcsolódó:** [P-031 eaisyBooks Layout](./P-031-accounty-layout.md) · [P-076 Dual-Mode Navigation & Company Switcher](./P-076-eaisybooks-dual-mode-navigation-and-company-switcher-ux.md) · [05 Layout & Navigáció](../../design/05-layout-navigation.md)

---

## Context

Az eaisyBooks platformon a könyvelők gyakran több szint mélységben navigálnak az ügyfél-specifikus aloldalak (pl. Pénztárkönyv, Számlák, NAV Bevallások, Foglalkoztatottak) és az időszakos bérszámfejtési ciklusok (`/payroll/cycle/:cycleId`) között. 

Korábban a felületek fejléce (`PageHeader`) csupán egy statikus, egyszintű stringet jelenített meg (`companyName` vagy `breadcrumb`), amely nem volt kattintható, nem tükrözte a navigációs hierarchiát, és a felhasználónak a böngésző vissza gombjára vagy az oldalsávra kellett hagyatkoznia, hogy visszajusson a szülő szintekre.

---

## UX Kérdés & Problémafelvetés

Hogyan tehető azonnal átláthatóvá és egyetlen kattintással visszanavigálhatóvá az eaisyBooks hierarchikus útvonala anélkül, hogy minden egyes aloldalon bonyolult, redundáns útvonal-összerakó kódot kellene karbantartani, és a meglévő oldalfejlécek tönkremennének?

---

## Döntés (Decision)

1. **Egységesített `PageHeader` Breadcrumb API:**
   * A `src/components/ui/page-header.tsx` komponens kibővült a `breadcrumbs?: Array<BreadcrumbItem | string>` és `autoBreadcrumbs?: boolean` (alapértelmezett: `true`) tulajdonságokkal.
   * A `BreadcrumbItem` objektum specifikációja: `{ label: string; href?: string }`.
   * **100% visszamenőleges kompatibilitás:** Ha egy oldal továbbra is a legacy `companyName` vagy `breadcrumb` propot adja át (vagy explicit breadcrumb listát határoz meg), a komponens zökkenőmentesen konvertálja azt, megőrizve a meglévő viselkedést.

2. **Központi Tiszta Útvonal Feloldó (`getAccountyBreadcrumbs` & `useAccountyBreadcrumbs`):**
   * Új hook és tiszta segédfüggvény jött létre a `src/hooks/useAccountyBreadcrumbs.ts` modulban.
   * A `getAccountyBreadcrumbs(pathname, clientName)` tiszta függvényként működik, így tetszőleges URL-t és kliensnevet Router kontextus nélkül, unit tesztekben is determinisztikusan képes feloldani.
   * A `useAccountyBreadcrumbsOptional()` biztonságos wrapper: ha a komponens az eaisyBooks-on kívül vagy Router hiányában renderelődik, nem dob hibát, hanem kecsesen `null`-t ad vissza.

3. **Hierarchikus Rétegek és Navigációs Szintek:**
   * **1. szint — Portfólió:** `Portfólió` (`/eaisybooks`).
   * **2. szint — Ügyfél áttekintés:** `[Kliens Neve]` (`/eaisybooks/:companyId/:dateRange/overview`). Direct bookmark és hideg URL betöltés esetén `allClients` aszinkron feloldásáig elegáns `'Ügyfél'` szöveges fallback biztosított.
   * **3. szint — Ügyfél aloldal:** Pl. `Pénztárkönyv`, `Számlák`, `Foglalkoztatottak`, `Bérszámfejtés`.
   * **4. szint — Ciklus / Mély aloldal:** Pl. `2026. március` vagy `Új havi ciklus`.

4. **Vizuális Megjelenés & Ergonómia:**
   * Modern, finom Linear/SaaS esztétika: modern `/` elválasztó (`text-muted-foreground/40`).
   * Szülő elemek: kattintható `<Link>` hivatkozások `hover:text-foreground transition-colors` effekttel.
   * Utolsó (aktív) elem: nem kattintható, kiemelt `font-medium text-foreground` stílussal.
   * Responsiveness: `flex flex-wrap items-center gap-1.5` elrendezés kis képernyőkön töréssel.

---

## Verifikáció és Tesztek

* **Dedikált tesztfájl:** `src/test/accounty/pageHeaderBreadcrumbs.test.tsx` (13/13 sikeres teszt).
* Portfólió gyökér és aloldalak, ügyfél szintű és bérszámfejtési mély útvonalak, egyedi felülbírálások, router-mentes védőháló mind automatikusan ellenőrizve.
