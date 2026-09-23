# Decision 003: Lokalizáció, Nemzetközi Piacok & Multi-Jurisdiction Stratégia

**Status:** Decided

**Category:** Célpiac & Üzleti Modell

**Kapcsolódó ADR:** [A-109: Horvát Lokalizáció](../../architecture/decisions/A-109-eaisybill-i18n-croatia-localization-and-route-architecture.md), [A-140: Multi-Jurisdiction és Horvát Számlatükör](../../architecture/decisions/A-140-multi-jurisdiction-and-croatian-chart-of-accounts.md)  
**Kapcsolódó PRD:** [P-081: Horvát UX](../../product/decisions/P-081-eaisybill-croatia-localization-and-demo-ux.md), [P-106: Horvát Főkönyv és Dinamikus Devizák](../../product/decisions/P-106-croatian-general-ledger-and-multicurrency-views.md)

**Question:** A Visibill kizárólag magyar nyelvű marad, vagy támogatja a nemzetközi (különösen a CEE / horvát) piacokat is? Szükséges-e i18n keretrendszer és cég-szintű joghatóság kezelése?

**Decision:** A Visibill többpiacos (Multi-Jurisdiction) platformként működik:
1. **Elsődleges piacok:** Magyarország (`country_code = 'HU'`, alapértelmezett devizanem: `HUF`) és Horvátország (`country_code = 'HR'`, alapértelmezett devizanem: `EUR`).
2. **Nyelvkezelés:** `i18next` alapú, 100%-os mélységi kulcsparitással karbantartott kétnyelvű (`hu`, `hr`) felület. A felület nyelve az útvonalból (`/hr/`) és a kiválasztott cég joghatóságából determinisztikusan következik.
3. **Számviteli és Adózási Joghatóság:**
   - Adóazonosító: Magyarországon 8-1-2 formátumú Adószám, Horvátországban 11 számjegyű OIB.
   - Számlatükör: Magyar cégeknél a magyar standard számlatükör, horvát cégeknél a beépített horvát kontóterv (`számla_hr`) 10 számlaosztállyal (`RAZRED KONTA`) és 55 csoporttal.
   - Pénznemek: Dinamikusan a cég joghatóságának megfelelő devizajelzés (`EUR` vs `Ft`) és számformátum (`hr-HR` vs `hu-HU`).

**Rationale:** A Visibill CEE régiós terjeszkedése megköveteli a horvát leányvállalatok és ügyfelek zökkenőmentes kiszolgálását. A joghatóság-tudatos architektúra biztosítja a NAV és az európai adószabályok egyidejű, izolált működését.
