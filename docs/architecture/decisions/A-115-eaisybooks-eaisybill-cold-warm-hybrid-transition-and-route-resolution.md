# Architecture Decision Record (ADR)

# A-115: eaisyBooks ↔ eaisyBill Szimmetrikus Hideg/Meleg (Cold/Warm) Hibrid Életciklus Átmenet és Szinkron Útvonal Feloldás

**Státusz:** ✅ Decided  
**Dátum:** 2026-09-13  
**Kategória:** Frontend & Navigációs Architektúra  
**Kapcsolódó döntések:** [A-114](./A-114-collapse-dual-mode-navigation-shell.md), [A-013](./A-013-scoped-routing.md), [A-060](./A-060-modular-app-router-and-bootstrap-shell.md), [P-083](../../product/decisions/P-083-eaisybooks-eaisybill-app-mode-switcher-and-cold-warm-transition-ux.md)

---

## 1. Kontextus és Problémafelvetés

A Visibill platform két fő alkalmazást egyesít egyetlen SPA-ban (Single Page Application):
1. **eaisyBill:** Operatív számlázó, banki tranzakció párosító, PnL, mérleg és számlavezetési rendszer (`/:companyId/:dateRange/*`).
2. **eaisyBooks:** Könyvelői irodai modul, portfólió felügyelet, ÁFA és bérszámfejtési ciklusok (`/eaisybooks/*`).

A két alkalmazás közötti váltás során az alábbi vizuális és szinkronizációs hibák jelentkeztek:
1. **Villanó üres fejléc és portfólió ugrás:** Amikor a felhasználó eaisyBill-ről eaisyBooks-ra váltott, a navigációs sáv egyetlen frame erejéig a portfólió nézetet mutatta ("Teljes Portfólió"), mielőtt az aszinkron `CompanyContext` és ügyféllista lekérés feloldotta volna a kiválasztott céget.
2. **Üres cégválasztó trigger:** eaisyBooks-ról eaisyBill-re navigáláskor, amíg a kiválasztott cég és az irányítópult lazy chunk-ja betöltődött, a felső `CompanySelector` mező üresen állt vagy az alapértelmezett választási feliratot mutatta.
3. **Törékeny `localStorage` átmenet-jelzők:** A korábbi implementáció `visibill_switch_pending` localStorage kulcsot használt. Ha a felhasználó egy adott nézeten nyomott frissítést (F5), az átirányítások és a layout kapuk nem tudták megkülönböztetni az explicit app-váltást a frissítéstől, így F5 után hiányzott a védő spinner, a felület félkész állapotban renderelődött.
4. **Mindenkori lassú betöltés vs. villódzás dilemmája:** Ha minden egyes váltásnál mesterséges teljes képernyős loading spinnert alkalmazunk, a felület lassúnak, nehézkesnek érződik. Ha viszont egyáltalán nincs spinner, a kezdeti betöltéskor és frissítéskor (Cold start) elkerülhetetlen a layout villódzás.

---

## 2. A Döntés

Elfogadtuk és bevezettük a **Szimmetrikus Hideg/Meleg (Cold vs Warm) Hibrid Életciklus és Szinkron Útvonal Feloldás** modellt mindkét alkalmazásban:

### 2.1. Memória-alapú Életciklus Flag-ek (Session Lifecycle Flags)
A törékeny és perzisztens `localStorage` helyett modul-szintű, memóriában élő session jelzőket vezettünk be:
- `hasEaisybillInitialized`: az eaisyBill alkalmazás első sikeres felépülését követi.
- `hasAccountyInitialized`: az eaisyBooks alkalmazás első sikeres felépülését követi.

**Működés:**
- **Hidegindítás (Cold Start):** Amikor a felhasználó frissíti az oldalt (F5) vagy először lép be az adott appba a munkamenet során, a flag értéke `false`. Ilyenkor a gyökér layout (`ProtectedLayout` vagy `AccountyLayout`) teljes képernyős [`LoadingSpinner`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/ui/loading-spinner.tsx) komponenssel fedi le a felületet (`"eaisyBill betöltése..."` vagy `"eaisyBooks betöltése..."`), amíg a hitelesítés, cégadatok, jogosultságok és lazy route chunkok stabilizálódnak.
  - A felület 400ms-os grace buffert kap a tiszta vizuális megjelenésért.
  - 4 másodperces biztonsági időtúllépés (safety timeout) garantálja, hogy hálózati késés esetén se ragadhasson be a felület.
  - Sikeres betöltés után a flag `true` értékre vált.
- **Meleg váltás (Warm Switch):** További navigációk és váltások során a flag már `true`. Az alkalmazás **azonnali (0ms) SPA váltást** hajt végre, mesterséges teljes képernyős spinner nélkül. Az esetleges aszinkron adatlekéréseket a kártyák és táblázatok lokális skeletonjai fedik le.

### 2.2. Közvetlen Célzott Útvonal Képzés (`AppModeSwitcher`)
Az [`AppModeSwitcher.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/AppModeSwitcher.tsx) intelligens, közvetlen URL-eket generál:
- **`billTarget`:** Prioritásként az eaisyBooks-ban éppen megtekintett céget (`activeBooksCompanyId`) célozza meg `/:companyId/:dateRange/` formátumban, elkerülve a közbenső gyökér átirányításokat.
- **`booksTarget`:** Prioritásként az eaisyBill-ben kijelölt céget vagy az utoljára megtekintett jogosult céget célozza meg `/eaisybooks/:companyId/:dateRange/overview` formátumban.
- Megszüntettük a `visibill_switch_pending` localStorage írásokat.

### 2.3. Szinkron Útvonal-Paraméter Feloldás (`effectiveCompany`)
A [`CompanySelector.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/CompanySelector.tsx) a React Router `useParams()` és `useLocation()` hookjaiból közvetlenül kiolvassa a pillanatnyi `:companyId`-t:
```tsx
const effectiveCompany = useMemo(() => {
  if (selectedCompany) return selectedCompany;
  if (urlCompanyId && companies.length > 0) {
    return companies.find((c) => c.id === urlCompanyId) || null;
  }
  return null;
}, [selectedCompany, urlCompanyId, companies]);
```
Ennek köszönhetően a legelső renderelési tickben is azonnal a valós cégnév renderelődik a lenyíló gombban, megelőzve az üres mezőt vagy a placeholder villanását.

### 2.4. Scoped Layout Szinkronizáció
A `ProtectedLayout` az `useEffect` hookban azonnal szinkronizálja a `urlCompanyId`-t a `selectedCompany` állapottal a háttérben a spinner mögött, mielőtt a `ScopedLayout` és az alútvonalak felépülnének.

---

## 3. Következmények és Előnyök

1. **Prémium, Zökkenőmentes Felhasználói Élmény:**
   - Nincs többé villanó fejléc, nincs egyetlen frame-ig tartó üres mező vagy helytelen "Teljes Portfólió" ugrás.
   - Első betöltéskor elegáns branded loader védi a felületet.
   - Váltáskor instant SPA sebesség és kényelem.
2. **Determinisztikus Állapotkezelés:**
   - A memóriában kezelt életciklus flag-ek pontosan lefedik az F5 és a munkameneten belüli váltások eltérő igényeit anélkül, hogy a böngésző tárolójában beragadó szemét keletkezne.
3. **Automata Védőháló (Regression Tests):**
   - Létrehoztuk a [`src/test/navigation/eaisybooksTransition.test.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/test/navigation/eaisybooksTransition.test.tsx) tesztcsomagot, amely izolált környezetben garantálja, hogy a `CompanySelector` route paraméter alapján azonnal helyesen renderel.
