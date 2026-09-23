# A-140: Multi-Jurisdiction Cégkezelés (country_code), Horvát Rendszerszintű Számlatükör Hierarchia (számla_hr) és Dinamikus Főkönyvi Devizanem-Kezelés

**Státusz:** Elfogadva (Decided)  
**Dátum:** 2026-09-23  
**Kapcsolódó PRD:** [P-106: Horvát Főkönyvi Kivonat és Nézetek Teljes Lokalizációja, Dinamikus Pénznem és Novo Konto UX](../../product/decisions/P-106-croatian-general-ledger-and-multicurrency-views.md), [P-081: Eaisybill Horvát Lokalizáció](../../product/decisions/P-081-eaisybill-croatia-localization-and-demo-ux.md)  
**Kapcsolódó ADR:** [A-109: Horvát Lokalizáció és Route Architektúra](./A-109-eaisybill-i18n-croatia-localization-and-route-architecture.md), [A-003: Multi-tenancy RLS](./A-003-multi-tenancy-rls.md), [A-137: Főkönyv és Nyitó Import](./A-137-general-ledger-and-opening-import-normalization.md)  
**Kapcsolódó BRD:** [003: Lokalizációs és Nemzetközi Cégkezelési Stratégia](../../business/decisions/003-localization-strategy.md)  
**Érintett komponensek:** `public.companies`, `public.chart_of_accounts_presets`, `public.gl_accounts`, `useCompanyJurisdiction.ts`, `CompanyContext.tsx`, `useActivePreset.ts`, `GeneralLedgerPage.tsx`, `GeneralLedgerTable.tsx`, `GeneralLedgerComparisonTable.tsx`, `JournalView.tsx`, `PartnerLedgerCardView.tsx`, `glUtils.ts`

---

## 1. Kontextus és Problémafelvetés

A Visibill korábbi nemzetközi nyitása (lásd [A-109](./A-109-eaisybill-i18n-croatia-localization-and-route-architecture.md)) bevezette a `/hr/` route-prefix alapú felületi lokalizációt és szótárakat. Ugyanakkor az üzleti és számviteli logikában három mélyebb strukturális korlát maradt:

1. **Joghatóság (Jurisdiction) hiánya a cégmodellben:** A `companies` táblában nem volt országkód (`country_code`). A rendszer implicit módon feltételezte, hogy minden cég magyar (HUF alappénznem, 8-1-2 formátumú magyar adószám, NAV kötelezettség). Emiatt egy horvát cég (pl. `D-INVOICE D.O.O`, OIB: 11 számjegy, EUR alap) kezelésekor a validációk elbuktak, és az adatok magyar forintban (`Ft`) jelentek meg.
2. **Számlatükör Sablon (Preset) Szeparáltság és Skálázhatóság:** A `'számla_hr'` sablon egyedi céghez kötött (`type = 'custom'`) sablonként létezett, miközben minden horvát cég számára kötelező beépített alapként kellene működnie. Emellett a sablon 1917 analitikus számlát tartalmazott szülő osztályok (`0.`-`9.`) és 2-számjegyű csoportok nélkül, ami a fa-alapú kibontást használhatatlanná és lassúvá tette.
3. **Hardkódolt Magyar Devizajelzések és Fordítási Elmaradások:** A Főkönyv (`/general-ledger`) aloldalain (Összehasonlítás, Naplófőkönyv, Kartonok) több helyen fixen a magyar forint (`Ft`) és `hu-HU` formátum volt beégetve, valamint a vezérlőgombok (pl. `+ Új főkönyvi szám`) és szűrők nem rendelkeztek horvát fordítással.

---

## 2. Architekturális Döntések

### 2.1 Adatbázis Séma Bővítés: Multi-Country Cégek és Sablonok
- **`public.companies` tábla:** Bővítve `country_code VARCHAR(2) NOT NULL DEFAULT 'HU'` oszloppal (`supabase/migrations/20260923113000_add_country_code_to_companies.sql`).
- **`public.chart_of_accounts_presets` tábla:** Bővítve `country_code VARCHAR(2) NOT NULL DEFAULT 'HU'` oszloppal.
- **Rendszerszintű Horvát Sablon (`számla_hr`):**
  - Beállítva: `type = 'generic'`, `country_code = 'HR'`, `company_id = NULL`.
  - Ezzel a `'számla_hr'` a magyar beépített sablonnal egyenrangú, védett, multi-tenant sablonná vált.

### 2.2 Hierarchikus Horvát Kontó Fa-struktúra Beszúrása (`gl_accounts`)
Hogy az 1917 analitikus tétel azonnal, fa-hierarchiában működjön:
- Beszúrásra került a **10 hivatalos horvát számlaosztály** mint legfelső szint:
  - `0. RAZRED KONTA: DUGOTRAJNA IMOVINA`
  - `1. RAZRED KONTA: NOVAC, KRATKOTRAJNA FINANCIJSKA IMOVINA I POTRAŽIVANJA`
  - `2. RAZRED KONTA: OBVEZE`
  - `3. RAZRED KONTA: ZALIHE`
  - `4. RAZRED KONTA: TROŠKOVI PREMA VRSTAMA`
  - `5. RAZRED KONTA: TROŠKOVI POSLOVANJA (MJESTA I NOSITELJI)`
  - `6. RAZRED KONTA: PROIZVODNJA, GOTOVI PROIZVODI I ROBA`
  - `7. RAZRED KONTA: RASHODI I PRIHODI`
  - `8. RAZRED KONTA: FINANCIJSKI REZULTAT`
  - `9. RAZRED KONTA: KAPITAL, PRIČUVE I IZVANBILANČNI ZAPISI`
- Beszúrásra került az **55 darab 2-számjegyű számlacsoport** (`00.`, `01.`, ..., `40. Materijalni troškovi`, `41.`, ..., `99.`).
- Ennek köszönhetően a prefix-alapú fa-építő motor azonnal 10 sorra aggregál, és tetszőleges szinten (osztály $\rightarrow$ csoport $\rightarrow$ szintetikus $\rightarrow$ analitikus) nyitható/csukható.

### 2.3 Központi Joghatóság Motor: `useCompanyJurisdiction`
Létrehoztuk a [`src/hooks/useCompanyJurisdiction.ts`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useCompanyJurisdiction.ts) hookot:
- **Forrás:** A kiválasztott cég (`selectedCompany.country_code`) és az URL (`/hr` prefix) hibrid vizsgálata. Ha a cég horvát VAGY az útvonal `/hr`, a joghatóság Horvátország (`isCroatia: true`).
- **Szolgáltatások:**
  - `countryCode`: `'HR'` | `'HU'`.
  - `defaultCurrency`: `'EUR'` (HR) vagy `'HUF'` (HU).
  - `currencyLabel`: `'EUR'` vagy `'Ft'`.
  - `taxIdName`: `'OIB'` vagy `'Adószám'`.
  - `locale`: `'hr-HR'` vagy `'hu-HU'`.

### 2.4 Sablonkezelés Scoping: `useActivePreset`
A [`src/hooks/useActivePreset.ts`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/hooks/useActivePreset.ts) hook országalapon szűri a sablonokat:
- Horvát cég (`country_code === 'HR'`) esetén az alapértelmezett beépített sablon a `'számla_hr'`.
- A sablonválasztóban horvát cég csak a horvát beépített és a saját egyedi sablonjait látja; magyar cég a magyar beépítettet és saját sablonjait.
- Öngyógyító migráció: ha a kliens `localStorage`-ban korábban eltérő ország sablonja ragadt be, a hook automatikusan kijavítja azt az ország megfelelő beépített sablonjára.

### 2.5 Horvát Számlatükör Megnevezések Védelme (`glUtils.ts`)
A [`src/lib/glUtils.ts`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/lib/glUtils.ts) kibővült:
- A `getLocalizedGlAccountName` védi a natív horvát számlaneveket és osztályokat (`RAZRED KONTA:`), megakadályozva, hogy a magyar standard szótár véletlenül magyar szövegre írja át a horvát kontókat.
- Új segédfüggvény: `getLocalizedGlItemType` — determinisztikusan fordítja a tranzakció- és bizonylattípusokat mindkét nyelvre (`Nyitó tétel` $\leftrightarrow$ `Početna stavka`, `Banki tranzakció` $\leftrightarrow$ `Bankovna transakcija`, `Számla` $\leftrightarrow$ `Račun` stb.).
- Új segédfüggvény: `getLocalizedGlItemDescription` — a számlatükör nyitó tételek formázott leírásait (`[NYITO-2026] Nyitó egyenleg (1000)`) horvátra fordítja (`[NYITO-2026] Početno stanje (1000)`).

### 2.6 Dinamikus Devizakezelés a Főkönyvben
Minden főkönyvi komponensből kivezetésre kerültek a fix `Ft` string literálok:
- [`GeneralLedgerPage.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/pages/GeneralLedgerPage.tsx): KPI kártyák fejléce (`Duguje (EUR)` / `Tartozik (Ft)`), eszköztár gomb (`t('accounting:general_ledger.toolbar.add_account')` $\rightarrow$ `Novo konto`).
- [`GeneralLedgerTable.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerTable.tsx): Tétellista sheet összeg és árfolyam formázás.
- [`GeneralLedgerComparisonTable.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/GeneralLedgerComparisonTable.tsx): Statisztikai sor, oszlopfejlécek (`Odstupanje (EUR)`), táblázatcellák.
- [`JournalView.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/JournalView.tsx): Szűrősáv, összesítők (`Duguje: X EUR | Potražuje: X EUR | Neto: X EUR`), soronkénti egyenleg.
- [`PartnerLedgerCardView.tsx`](file:///d:/ThinkAI/Visibill/eaisybill-prod/src/components/general-ledger/PartnerLedgerCardView.tsx): Korosítási sáv, táblázatfejlécek (`Fakturirano bruto (EUR)`), partner- és státuszjelvények.

---

## 3. Következmények és Előnyök

1. **Valódi Multi-Jurisdiction Támogatás:** A Visibill mostantól nemcsak nyelvi felületében, hanem adatmodelljében, pénznemében, számlatükrében és adószám-kezelésében is natívan többországos.
2. **Kiemelkedő Főkönyvi Teljesítmény:** A 10 osztály és 55 csoport közvetlen adatbázis-szintű tárolása miatt a fa-hierarchia azonnal, felesleges kliensoldali késleltetés nélkül jelenik meg.
3. **100%-os Kulcsparitás & Regresszióvédelem:** A `src/test/generalLedgerI18n.test.ts` és `src/test/i18n.test.ts` tesztek garantálják a kulcsparitást és a jövőbeli elcsúszások megelőzését.
