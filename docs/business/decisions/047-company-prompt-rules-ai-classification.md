# Decision 047: Egyedi Céges Könyvelési Szabályok és AI Kontírozási Házirend

**Status:** Decided  
**Category:** Business Rule / AI Classification / Accounting Customization  
**Question:** Hogyan tehetik a könyvelők és vállalkozók cégre szabottá az AI automatikus számlakontírozási és főkönyvi besorolási logikáját?  

**Decision:**  
1. **Természetes Nyelvű Szabálytár:**  
   Minden ügyfélcéghez (`company_id`) létrehozható egy egyedi szabálykönyvtár (`company_prompt_rules`), amelyben a könyvelő magyar nyelven fogalmazhat meg kontírozási direktívákat (pl. melyik partner vagy tételleírás melyik főkönyvi számra kerüljön).
2. **Kiemelt Prioritás az AI Feldolgozásban:**  
   A céghez tartozó aktív szabályok (`is_active = true`) a legmagasabb prioritással, felülbíráló instrukcióként (Override / High-Priority System Prompt) injektálódnak a feldolgozó motorba (Worker / LLM GL classification).
3. **Multi-Tenant Izoláció & Jogosultság:**  
   A szabályok szigorúan cégenként izoláltak. Az adott céghez rendelt könyvelők és a cég adminisztrátorai jogosultak a szabályok rögzítésére, módosítására, ki/bekapcsolására és törlésére.

**Rationale:**  
A könyvelési gyakorlatban minden vállalkozásnak vannak speciális számlatükör-elemei, belső értékhatárai vagy egyedi preferenciái. Az egyedi szabályok lehetővé teszik a könyvelőiroda számára, hogy automatizálja a speciális döntéseket anélkül, hogy minden egyes tételt manuálisan kellene korrigálnia.

---

## Kapcsolódó

- [A-079: Accounty ErrorBoundary Route-Scoped Reset és Client-Scoped Prompt Szabályok](../../architecture/decisions/A-079-accounty-errorboundary-route-reset-and-prompt-rules-scoping.md)
- [P-062: Könyvelési Szabályok Felület & ErrorBoundary UX](../../product/decisions/P-062-company-prompt-rules-library-and-error-boundary-ux.md)
- [031: eaisyBooks modul scope](./031-accounty-module.md)
- [034: Worker pipeline](./034-worker-pipeline.md)
