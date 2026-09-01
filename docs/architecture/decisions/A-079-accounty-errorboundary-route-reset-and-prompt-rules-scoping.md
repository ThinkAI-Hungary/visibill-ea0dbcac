# A-079: Accounty ErrorBoundary Route-Scoped Reset és Client-Scoped Prompt Szabályok

**Status:** Decided  
**Date:** 2026-09-01  
**Utoljára frissítve:** 2026-09-01  

## Context

Az eaisyBooks modul (`/eaisybooks/*`) egy perzisztens layoutot (`AccountyLayout.tsx`) használ, amely az oldalsávot, fejlécet és a globális segédeszközöket szolgáltatja az aloldalak (`<Outlet />`) számára.

Két összefüggő architekturális probléma merült fel:
1. **Sticky ErrorBoundary állapot:**  
   Az `<AccountyErrorBoundary>` nem rendelkezett útvonalkulccsal. Ha bármely belső aloldal renderelési vagy inicializálási hibát dobott, a hibahatár belső állapota `hasError = true` maradt. Mivel a layout nem unmountolódott a menüpontok közötti navigáció során, a hibaüzenet beragadt, és az oldalsáv többi gombjára kattintva sem lehetett kilépni belőle (kivéve az eaisybill főmodulba történő átlépéssel).
2. **Hiányzó URL Client-Scoped kontextus a PromptsPage-en:**  
   Az eaisyBooks scoped útvonala `/eaisybooks/:companyId/:dateRange/prompts`. A `PromptsPage` azonban csak a fő app `useCompany()` hookjának `selectedCompany` állapotára támaszkodott, ami eaisyBooks környezetben üres lehetett vagy eltérhetett a kiválasztott ügyféltől.

---

## Decision

1. **Deklaratív ErrorBoundary Reset (`key={location.pathname}`):**  
   Az `AccountyLayout.tsx`-ben az `<AccountyErrorBoundary>` elemet `key={location.pathname}` prop-pal láttuk el. Ez biztosítja, hogy bármely aloldalváltáskor a React unmountolja a korábbi példányt és tiszta, hiba-mentes (`hasError: false`) belső állapottal mountolja újra a komponenst.
2. **Hibrid Client-Scoped Cégkontextus Feloldás:**  
   A `PromptsPage.tsx`-ben bevezettük a hibrid feloldási mechanizmust:
   ```typescript
   const { companyId } = useParams<{ companyId: string }>();
   const { selectedCompany } = useCompany();
   const { data: client } = useAccountyClient(companyId);

   const effectiveCompanyId = companyId || selectedCompany?.id;
   const effectiveCompanyName = client?.name || selectedCompany?.name || 'Kiválasztott cég';
   ```
3. **Konzisztens Query & Mutation Invalidation:**  
   A `company_prompt_rules` lekérdezései, mutációi (`insert`, `update`, `delete`) és a TanStack Query cache invalidációk szigorúan az `effectiveCompanyId` kulcsot használják.

---

## Consequences

**Pozitív:**
- Megszűnt az ErrorBoundary menüpontok közti globális beragadása. A felhasználó az oldalsáv segítségével azonnal és szabadon navigálhat.
- A `PromptsPage` mind az eaisyBooks kliens-szintű útvonalakon (`/eaisybooks/:companyId/:dateRange/prompts`), mind eaisybill főmodul alatti beágyazásban pontosan a célcég szabályait kezeli.
- Multi-tenancy RLS védelem sértetlen maradt (`company_id` szűrés).

**Negatív / Költségek:**
- A `key={location.pathname}` miatt az aloldalak közötti váltáskor az ErrorBoundary mindig újrainicializálódik (ez azonban kívánatos és elhanyagolható költségű).

---

## Kapcsolódó

- [P-062: Könyvelési Szabályok Felület & ErrorBoundary UX](../../product/decisions/P-062-company-prompt-rules-library-and-error-boundary-ux.md)
- [047: Egyedi Céges Könyvelési Szabályok](../../business/decisions/047-company-prompt-rules-ai-classification.md)
- [A-003: Multi-tenancy RLS alapon](./A-003-multi-tenancy-rls.md)
- [A-013: Scoped URL routing](./A-013-scoped-routing.md)
