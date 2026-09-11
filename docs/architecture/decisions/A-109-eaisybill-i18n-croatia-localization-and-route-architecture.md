# A-109: Eaisybill Horvát Lokalizáció, /hr/ Scoped Route Architektúra és Helyi Tároló Mentes Nyelvkezelés

**Status:** Decided  
**Date:** 2026-09-11  
**Utoljára frissítve:** 2026-09-11  

---

## Context
A cég nemzetközi terjeszkedésének első lépéseként felmerült az igény az **Eaisybill modul teljes frontend lokalizációjára horvát nyelvre (`hr`)**, kifejezetten értékesítési és ügyfél-demonstrációs célokra.

A fejlesztés során három kritikus architekturális kihívás jelentkezett:
1. **Navigáció és Route Izoláció:** A meglévő URL struktúra mélyen beágyazott scoped routingot használ (`/:companyId/:dateRange/<page>/:tab?`). A horvát demonstrációnak tisztán, determinisztikusan egy `/hr/` prefixszel kell futnia mind a publikus autentikációs felületen (`/hr/auth`), mind a bejelentkezett nézetekben (`/hr/:companyId/:dateRange/...`).
2. **Nyelvi Perzisztencia Beragadási Csapda (LocalStorage Trap):** A standard `i18next-browser-languagedetector` alapértelmezésben a böngésző `localStorage`-ába mentette a választott nyelvet (`visibill_lang: 'hr'`). Ennek következtében ha a felhasználó egyszer meglátogatta a `/hr/auth` oldalt, majd a böngésző címsorából kitörölte a `/hr`-t és visszalépett a normál `/auth` vagy `/` címre, a rendszer továbbra is a `localStorage`-ból olvasta a horvát nyelvet, beragadva a horvát felületre.
3. **Pénznem és Numerikus Adatok Lokalizációja:** Horvát nyelvű környezetben az elvárás az Euró (€) alapú megjelenítés, a magyar forint (Ft) helyett, miközben az aggregált adatoknak (pl. ÁFA kimutatás, KPI kártyák) matematikai és devizaváltási szempontból precíznek kell maradniuk.

---

## Decision

### 1. i18next & react-i18next Keretrendszer Névterekkel (Namespaces)
A lokalizációt az `i18next` és a `react-i18next` segítségével valósítottuk meg. A szótárakat moduláris, per-funkció JSON állományokra bontottuk szét (`src/locales/hu/*.json` és `src/locales/hr/*.json`):
- `common`, `navigation`, `dashboard`, `invoices`, `receivables`, `transactions`, `pettyCash`, `transfers`, `accounting`, `hr`, `settings`, `tickets`, `categories`, `projects`, `partners`, `auth`.
- TypeScript típusdefinícióval (`src/types/i18next.d.ts`) biztosítottuk a típusbiztos fordítási kulcsokat és az automatikus kiegészítést.

### 2. Tiszta Útvonal-Vezérelt Nyelvmeghatározás (Zero LocalStorage Persistence)
A nyelvi állapotot 100%-ban az URL útvonala határozza meg, kizárva a böngésző tárhelyének perzisztenciáját:
- **`src/lib/i18n.ts`:**
  - Egyedi `pathDetector` implementálva: ha a `window.location.pathname` kezdete `/hr` vagy `/hr/`, a nyelv `'hr'`, minden más esetben azonnal visszavált `'hu'`-ra.
  - A `cacheUserLanguage()` függvény no-op lett (nem ír a `localStorage`-ba).
  - A detektor konfigurációjából töröltük a `localStorage` cache-t (`caches: []`).
  - Inicializáláskor automatikusan meghívódik a `localStorage.removeItem('visibill_lang')`, hogy a korábban beragadt kulcsok se okozzanak anomáliát.
- **`LanguageRouteSync` Router Integráció (`src/App.tsx`):**
  - A `<BrowserRouter>` gyökerébe beépítettünk egy reaktív komponenst, amely a `useLocation()` hook segítségével kliensoldali route-váltáskor azonnal meghívja az `i18n.changeLanguage('hr')` vagy `i18n.changeLanguage('hu')` függvényt.

### 3. Route Wrapperek és Redirect Stratégia
- **Auth útvonalak (`src/routes/authRoutes.tsx`):**
  - Létrehoztuk a `/hr/auth` és `/hr/auth/callback` útvonalakat `<LanguageRouteWrapper language="hr">` védőburok alatt.
  - A `ProtectedLayout` nem hitelesített felhasználó esetén a `/hr/...` prefix meglétekor automatikusan a `/hr/auth` oldalra irányít át.
- **Eaisybill Scoped útvonalak (`src/routes/eaisybillRoutes.tsx`):**
  - A meglévő scoped routing mellett regisztráltuk a `/hr/:companyId/:dateRange/*` útvonalakat is ugyanazon komponensekkel, biztosítva a teljes funkcionális paritást.
- **Redirect tisztítás (`src/routes/redirects.tsx`):**
  - A `RootRedirect` kódjából kikerült a korábbi nyelvi állapot alapú automatikus átirányítás, így a `/` mindig a standard gyökérre visz.

### 4. Pénznem és Dátumkezelés Adaptációja
- **`src/lib/utils.ts` (`formatCurrency`):**
  - Ha a pénznem nincs explicit megadva és az aktív nyelv `hr`, az automatikus fallback `EUR` és a horvát pénznemszimbólum (`€`), míg magyar nyelv esetén `HUF` (`Ft`).
- **`src/lib/locale/dateLocale.ts`:**
  - A dátumformázók dinamikusan váltanak a `date-fns/locale/hu` és `date-fns/locale/hr` között.
- **ÁFA Kimutatás (`VatSection.tsx`):**
  - Javításra került a devizaösszegek konverziója: a `navVatData` nyers objektumának átadása helyett a `vatBreakdown` tételeiből aggregált összegek kerülnek átváltásra, így elkerülhető a `NaN Ft` hiba, a fizetendő és visszaigényelhető ÁFA pedig dinamikusan jelenik meg.

### 5. Nyelvválasztó Kivezetése az Oldalsávról
- A felhasználói felület tisztasága érdekében a `LanguageSwitcher` komponenst kivezettük a sidebar-ból. A demó tisztán és kizárólag a `/hr/` route beírásával és linkelésével mutatható be.

### 6. Mérleg és Éves Beszámoló Lokalizáció & Automata Regressziós Tesztelés
- **Mérleg (`BalanceSheet.tsx`, `BalanceSheetWidgets.tsx`):**
  - A korábbi maradvány magyar szövegek átkerültek az `accounting:balance_sheet.*` névtérbe.
  - Lokalizált komponensek: Mérleg-hinta widget (egyensúly és eltérés állapotok, összegzők), Egyezőségi Diagnosztika (besorolatlan számlák dinamikus riasztása, diagnosztikai jelentés dialógus), Likviditási Mutatók (arányok, minősítési skálák, célértékek), nézetvezérlő eszköztár (hivatalos nézet, nullás sorok, hagyományos nézet, deviza konszolidáció, export menü), táblázatfejlécek és hozzárendelés (mapping) fül.
- **Éves Beszámoló Varázsló (`AnnualReportContainer.tsx`, `Step1Alapadatok.tsx`, `Step2Adatimport.tsx`, `Step3Validacio.tsx`):**
  - Az `accounting:annual_report.*` névtérbe kerültek a lépéskapszulák (1–6. lépés címek és leírások), az előrehaladás-számláló, az 1. lépés cég- és képviselő űrlapjai, a 2. lépés dinamikus zárási dátumú adatbefagyasztó felülete és befagyasztott pénzügyi kártyái, valamint a 3. lépés validációs őrszem vezérlői.
- **Automatizált Kulcsparitás és Regresszióvédelem (`src/test/i18n.test.ts`):**
  - Vitest tesztcsomag bővítve: rekurzív `findMissingKeys` motor ellenőrzi a `hu` és `hr` szótárak közötti 100%-os mélységi egyezést minden névtérre.
  - Dedikált regressziós tesztek futnak az `accounting:balance_sheet` és `accounting:annual_report` kulcsaira, meggátolva a fordítási kulcsok elcsúszását vagy hiányát a jövőbeli fejlesztések során.

---

## Consequences

### Pozitív
- **Értékesítési Készség:** A teljes Eaisybill felület bemutatható horvát nyelven az ügyfeleknek a `/hr/` útvonalon.
- **Nincs Beragadás:** Az URL-ből a `/hr` törlésével a felület determinisztikusan és azonnal visszavált a standard magyar működésre.
- **Típusbiztonság:** A fordítási kulcsok TypeScript definícióval támogatottak, elkerülve az elírásokat.
- **Nulla Adatbázis Változás:** A megoldás tiszta kliensoldali route- és i18n-réteg, nem igényel backend migrációt vagy adatbázis sémamódosítást.

### Negatív / Kötöttségek
- Új UI elemek, oldalak vagy űrlapmezők fejlesztésekor kötelező a szövegeket a `src/locales/hu/*.json` és `src/locales/hr/*.json` szótárakba is felvenni.

---

## Kapcsolódó
- [P-081: Eaisybill Horvát Lokalizáció és Demó UX](../../product/decisions/P-081-eaisybill-croatia-localization-and-demo-ux.md)
- [A-013: Scoped URL Routing](./A-013-scoped-routing.md)
- [A-060: Moduláris App Router Architektúra](./A-060-modular-app-router-and-bootstrap-shell.md)
- [Information Architecture](../../product/information-architecture.md)
