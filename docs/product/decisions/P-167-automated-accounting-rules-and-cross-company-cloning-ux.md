# P-167: Automatikus Könyvelési Szabályok Konfigurációs Felülete és Cégek Közötti Másolás (EB-0256)

**Státusz:** ✅ Decided  
**Dátum:** 2026-10-08  
**Kategória:** UX / Könyvelési Szabályok / eaisyBooks / ÁFA / Árfolyam-különbözet / Kerekítés  
**Ügyféligény:** EB-0256 (Lendvai Ádám · Ván Iroda / Kolos Transport Kft., spec: `tests/docs/lendvai_feature/256.pdf`)  
**Kapcsolódó ADR:** [A-228: Automatikus Könyvelési Szabályok Konfigurációs Felülete és Cégek Közötti Klónozása](../../architecture/decisions/A-228-automated-accounting-rules-configuration-and-cross-company-cloning.md)  
**Kapcsolódó korábbi döntések:** [P-138: Egységes Könyvelési Szabályok Kezelőfelület](./P-138-unified-accounting-rules-and-prompt-library-ux.md), [P-156: Könyvelési Szabályok Elérése az ÁFA Bevallás és Napló Alól](./P-156-accounting-rules-integration-in-vat-and-journals.md)

---

## 1. Döntési Kontextus és Problémafelvetés

A könyvelőirodák napi munkájában számos olyan gazdasági esemény fordul elő, amelyet a számviteli törvény és a jóváhagyott számviteli politika szerint automatikus technikai számlákon kell átvezetni:
1. **Pénzforgalmi ÁFA átvezetése:** Amíg egy számla pénzügyileg nincs rendezve, a fizetendő ÁFA-t technikai elszámolási számlán (pl. `47911` vagy `47993`), a levonható ÁFA-t pedig technikai követelés kontón (pl. `36911` vagy `3689`) kell nyilvántartani.
2. **Bruttó előleg ÁFA:** Előleg számlák bruttó ÁFA tartalmának átvezetése (pl. `36914`).
3. **Eltérő havi és évek közötti ÁFA:** Ha a teljesítés kelte és az ÁFA megállapításának időpontja eltérő hónapra (pl. `47912` / `36912`) vagy eltérő üzleti évre esik (`47913` / `36913`).
4. **Realizált és nem realizált árfolyam-különbözetek:** Devizás számlák banki kiegyenlítésekor, illetve év végi fordulónapi értékelésekor keletkező nyereség (`9779` / `9762`) és veszteség (`8755` / `8762`) tételek a hozzárendelt vegyes naplóban.
5. **Kerekítési különbözetek:** Banki utalások és számlakövetelések pár forintos eltéréseinek rendezése (`9699` / `8699`), szigorúan felügyelt forint értékhatárral (pl. max. 10 vagy 50 Ft).

**Korábbi korlátok:**
* Ezek a főkönyvi számok korábban részben fixen be voltak égetve a háttérkódokba vagy heurisztikus kereséssel próbáltak illeszkedni. Ha egy könyvelőiroda eltérő számlatükröt használt, a generált javaslatok pontatlanok lehettek.
* Nem létezett központi felület, ahol a könyvelő 1 helyen áttekinthette és testreszabhatta volna a szabályokat.
* Nem volt lehetőség arra, hogy egy könyvelőiroda 1 kattintással átmásolja a bevált beállításait a többi kezelt cégére.

---

## 2. A Döntés és Felületi Specifikáció (UX Architecture)

### 2.1 Elhelyezés és Navigáció
* **Dedikált első fül a Könyvelési szabályok oldalán:** A Könyvelési szabályok (`/accounting-rules`, `PromptsPage.tsx`) felületen az új **„Automata könyvelés”** (`auto_rules`) lapfül kapta a kiemelt első helyet (a korábbi *Számlatétel szabályok* és *AI Prompt könyvtár* előtt).
* **Közvetlen Route:** A `/:companyId/:dateRange/auto-accounting-rules` útvonal közvetlenül az automata könyvelési szabályok nézetre irányít, megőrizve az aktív cég- és dátumtartomány-kontextust.
* **Oldalsáv elérhetőség:** A bal oldali menüből a Könyvelés csoporton keresztül közvetlenül nyitható.

### 2.2 Kártyás Struktúra és Felületi Részek
A felület 4 letisztult, Tailwind és Shadcn/UI alapú kártyára (`Card`) tagolódik:

1. **ÁFA átvezetési szabályok kártya (`VatTransferRulesCard`):**
   * Pénzforgalmi ÁFA: Fizetendő (`47911`) és Levonható (`36911`) számlák.
   * Bruttó előleg ÁFA (`36914`).
   * Éven belüli eltérő havi átvezetés: Fizetendő (`47912`) és Levonható (`36912`).
   * Évek közötti átvezetés: Fizetendő (`47913`) és Levonható (`36913`).
2. **Realizált árfolyam-különbözet kártya (`FxDifferenceRulesCard`):**
   * Kapcsolódó Vegyes napló kiválasztó (`Select`).
   * Árfolyamnyereség főkönyvi szám (`9779`).
   * Árfolyamveszteség főkönyvi szám (`8755`).
3. **Nem realizált árfolyam-különbözet kártya:**
   * Kapcsolódó Vegyes napló választó.
   * Nem realizált nyereség (`9762`) és veszteség (`8762`) számlák év végi átértékeléshez.
4. **Kerekítési szabályok kártya (`RoundingRulesCard`):**
   * Kerekítési többlet / nyereség számla (`9699`).
   * Kerekítési veszteség számla (`8699`).
   * **Maximális kerekítési határ HUF-ban:** Numerikus beviteli mező (alapértelmezetten 10 Ft, de a könyvelő tetszőleges értékre, pl. 25 vagy 50 Ft-ra állíthatja).

### 2.3 Kereshető Számlaválasztó Ajánlott Jelölőkkel (`GlAccountCombobox`)
* A mezők nem sima szabadszöveges bevitelt használnak, hanem a cég aktív számlatükrére szűrt, intelligens `Popover` + `Command` keresőt.
* **Ajánlott jelvény (Recommended Badge):** A leggyakoribb standard magyar kontók (pl. 47911, 36911, 9779, 8755, 9699, 8699) kiemelt címkével jelennek meg a lista tetején, így a könyvelőnek nem kell keresgélnie.

### 2.4 Cégek Közötti 1-Kattintásos Másolás (`CopyCompanyRulesModal`)
* A fejlécben elhelyezett **„Szabályok másolása másik cégre”** gomb megnyitja a klónozó modált.
* A felhasználó kiválasztja a célcéget (ahol be van kapcsolva az eaisyBooks modul).
* A háttérben futó eljárás (`acc_copy_auto_accounting_rules`) a forrás cég számlaszámai (`gl_number`) és naplókódjai (`code`) alapján automatikusan megkeresi és hozzárendeli a cél cég saját számláit.
* Ha a cél cég számlatükréből hiányzik egy számla, a felület világos figyelmeztetést ad a hiányzó elemekről.

### 2.5 Lebegő Mentési Sáv és Reaktív Dirty Tracking
* A felhasználói élmény maximális biztonsága érdekében a módosítások nem mentődnek azonnal, hanem aktív dirty tracking működik.
* Ha bármely mező értéke megváltozik, alul megjelenik a **lebegő mentési panel** (Mentés / Módosítások elvetése gombokkal).
* Mentéskor az adatok azonnal perzisztálódnak a `company_auto_accounting_rules` relációs táblában, zöld toast visszaigazolást adva.

---

## 3. Felhasználói Élmény és Eredmények

1. **Rugalmasság és Irodai Standardizáció:** A könyvelőirodák egyetlen sablon beállításával tetszőleges számú cégre felmásolhatják a kontírozási szabályokat.
2. **Háttérmotorok Összhangja:** A generált könyvelési javaslatok (`acc_generate_drafts_from_ledger`) és az analitikai kerekítési leírások (`write_off_subledger_difference`) a felhasználó által beállított szabályok szerint futnak le.
3. **Zéró Regresszió:** Ha egy céghez még nem rögzítettek egyedi szabályokat, a rendszer intelligens számlatükör fallbackkel garantálja a hibátlan és folytonos működést.
