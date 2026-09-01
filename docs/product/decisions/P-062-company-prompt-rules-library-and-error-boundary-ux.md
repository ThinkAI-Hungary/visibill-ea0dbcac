# P-062: Könyvelési Szabályok (Prompt Library) Felület és Hibahatár UX

**Status:** Decided  
**Category:** UI / Workflow / Error Handling  
**Question:** Hogyan tehetjük lehetővé a könyvelők számára a cégspecifikus AI kontírozási szabályok kezelését, és hogyan biztosítható, hogy egy aloldali hiba ne blokkolja a teljes eaisyBooks navigációt?  
**Decision:**  
1. **Könyvelési Szabályok Felület (`PromptsPage`):**  
   - Kétpaneles elrendezés: bal oldalon az aktív/inaktív szabályok kártyalistája és az új szabály hozzáadása dialógus; jobb oldalon az 1-kattintásos gyors sablonok (Szoftver licencek, Kisértékű eszközök, Üzemanyag, Könyvelési díjak) és a hatékony szabályírási tippek.
   - Azonnali státuszváltás Switch komponenssel (nincs szükség szerkesztési modalra a ki/be kapcsoláshoz).
   - Üres állapot fallback, ha nincs kiválasztott cég.
2. **Reszponzív Hibahatár Visszaállítás:**  
   - Ha egy aloldal meghibásodik, az inline ErrorBoundary hibaüzenetet és Újrapróbálás / Vissza gombokat jelenít meg.
   - Az oldalsávban bármely másik menüpontra kattintva a felület azonnal kilép a hibaállapotból és megjeleníti a kiválasztott oldalt.

**Current Implementation:**  
- `src/pages/Accounty/AccountyLayout.tsx` (`<AccountyErrorBoundary key={location.pathname}>`)
- `src/pages/Accounty/PromptsPage.tsx` (`effectiveCompanyId`, `effectiveCompanyName`, CRUD mutációk, gyors sablonok)

**Rationale:**  
A könyvelők számára kritikus, hogy a visszatérő vagy speciális tételeket ne kelljen havonta manuálisan javítaniuk, hanem egyszeri természetes nyelvű szabállyal taníthassák az AI-t. A dinamikus hibahatár-reset pedig megakadályozza, hogy egy esetleges hiba miatt a felhasználó kizáródjon az eaisyBooks teljes menürendszeréből.

---

## Kapcsolódó

- [A-079: Accounty ErrorBoundary Route-Scoped Reset és Client-Scoped Prompt Szabályok](../../architecture/decisions/A-079-accounty-errorboundary-route-reset-and-prompt-rules-scoping.md)
- [047: Egyedi Céges Könyvelési Szabályok](../../business/decisions/047-company-prompt-rules-ai-classification.md)
- [P-031: eaisyBooks layout & navigáció](./P-031-accounty-layout.md)
