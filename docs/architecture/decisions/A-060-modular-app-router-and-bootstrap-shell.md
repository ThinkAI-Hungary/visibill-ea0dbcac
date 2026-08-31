# ADR A-060: Moduláris App Router & Platform Bootstrap Architektúra

## Státusz
Elfogadva (Decided) — 2026-08-31

## Kontextus és Probléma
A korábbi implementációban a [`src/App.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/App.tsx) egy 1 011 soros (72.8 KB) monolit fájl volt, amelyben szorosan összekeveredett:
1. A pre-render szinkron auth hash elkapási és átirányítási logika (`handleEmailChangeHash`).
2. A `QueryClient` példányosítása és a PostgREST hiba-deszerializációs lekezelő (`extractErrorInfo`, `QueryCache`, `MutationCache`).
3. 7+ darab inline redirect wrapper és segédkomponens (`RootRedirect`, `AccountyRootRedirect`, `LegacyRedirect`, `AccountyLegacyClientRedirect`, `PayrollLegacyRedirect`, `MissingInvoicesLegacyRedirect`, `PasswordRecoveryRedirect`, `ProtectedPage`, `RemoveInitialLoader`, `ScrollToTop`).
4. 200+ darab `<Route>` regisztráció 3 független üzleti alrendszerre (*eaisybill*, *Accounty/eaisybooks*, *HRTSPED shipments*).

Ez a struktúra megnehezítette a kód átláthatóságát, megnövelte a merge conflictok kockázatát, és gátolta a routing döntési logikák headless egységtesztelését.

## Döntés
1. **Platform Bootstrap & QueryClient Leválasztás (`src/app/`):**
   - Létrehoztuk a [`src/app/bootstrap.ts`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/app/bootstrap.ts) modult a pre-render platform-inicializációk (`initAuthHashHandler`) és hiba-információ parser (`extractErrorInfo`) kezelésére.
   - Létrehoztuk a [`src/app/queryClient.ts`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/app/queryClient.ts) modult az egységes React Query kliens és a globális error logging koordinálására.

2. **Konszolidált Redirect Motor (`src/routes/redirects.tsx`):**
   - Egyetlen mély modulba szerveztük a szerepkör-, impersonation- és jogosultság-alapú átirányítási logikákat (`RootRedirect`, `AccountyRootRedirect`, `LegacyRedirect`, `PasswordRecoveryRedirect`, `AccountyLegacyClientRedirect`, `PayrollLegacyRedirect`, `MissingInvoicesLegacyRedirect`).

3. **Domain Route Manifestek (`src/routes/`):**
   - **`authRoutes.tsx`**: Publikus autentikációs, jelszó-visszaállítási, regisztrációs és management útvonalak.
   - **`eaisybillRoutes.tsx`**: Scoped eaisybill útvonalak (`/:companyId/:dateRange/*`), fallbackek és legacy flat átirányítások.
   - **`accountyRoutes.tsx`**: eaisybooks (Accounty) portfólió, bérszámfejtés, EV, TAO és admin modul útvonalak.
   - **`shipmentRoutes.tsx`**: Fuvarozási és eszkalációs útvonalak.
   - **`shellComponents.tsx`**: `ProtectedPage`, `RemoveInitialLoader`, `ScrollToTop` komponensek.

4. **Deklaratív Root Orchestrator (`src/App.tsx`):**
   - Az [App.tsx](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/App.tsx) 1 011 sorról **<65 sorra** csökkent. Kizárólag a kontextus providereket köti össze a domain route manifestekkel.

## Következmények & Előnyök
- **Locality:** Bármely alrendszer (pl. Accounty vagy Fuvarozás) útvonal-módosítása teljesen izolált marad a saját manifestjében.
- **Tesztelhetőség:** A route manifestek és a bootstrap logika headless környezetben, Vitest-tel másodpercek alatt tesztelhetők (60/60 tesztfájl PASS).
- **Fejlesztői Élmény & AI-Navigáció:** A monolit megszűnésével a routing azonnal átlátható, a Vite HMR és build ciklus stabil és gyors.
