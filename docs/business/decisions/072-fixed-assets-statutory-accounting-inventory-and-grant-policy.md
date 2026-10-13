# Decision 072: Tárgyi Eszköz Analitika, Sztv. és Tao Értékcsökkenés, Leltározási, Kivezetési és Pályázati PIE Számviteli Szabályzat

**Status:** Decided  
**Date:** 2026-10-13  
**Category:** Statutory Accounting, Asset Management, Grants, Tax Compliance  

## Context

A vállalkozások eszközei a gazdasági tevékenységet tartósan (egy éven túl) szolgáló vagyontárgyak. A számviteli törvény (2000. évi C. törvény – Sztv.), a társasági adóról szóló törvény (1996. évi LXXXI. törvény – Tao tv.) és a munka törvénykönyve (2012. évi I. törvény – Mt.) szigorú, összetett előírásokat támaszt a tárgyi eszközök beszerzésével, aktiválásával, telephelyi nyilvántartásával, személyi felelősségvállalásával, terv szerinti és terven felüli értékcsökkenésével, év végi fordulónapi leltározásával, a selejtezéssel és kivezetéssel, a fejlesztési tartalékból megvalósuló beruházásokkal, valamint a vissza nem térítendő pályázati támogatások elszámolásával szemben.

A korábbi működésben az analitika és a főkönyv szétvált, a kivezetések jóváhagyás nélkül történtek, a támogatott eszközök nem rendelkeztek komponens-bontással, és a támogatások ÉCS-arányos passzív időbeli elhatárolásának (PIE) feloldása nem volt automatizálva.

## Question

Milyen kötelező számviteli, adózási és belső ellenőrzési szabályrendszer garantálja a tárgyi eszközök könyvviteli mérlegegyezőségét, a törvényes fizikai leltározást és a pályázati elszámolási integritást?

## Decision

### 1. Főkönyvi Egyezőség és `fixed_asset_id` Kötelezettség
- Minden tárgyi eszközhöz kapcsolódó könyvelési tétel (aktiválás 161 → 1x, időszaki ÉCS 5711 → 1x9, kivezetés és PIE feloldás 483 → 964) közvetlenül és kötelezően hivatkozik a tételsoron a `fixed_asset_id` azonosítóra.
- A mérlegegyezőség (11x-14x bruttó, 119-149 halmozott ÉCS, 161 befejezetlen beruházás) rekonciliációja szerveroldalon (`reconcile_fixed_assets_with_gl` RPC) történik, biztosítva az analitika és a főkönyv fillérre pontos egyezőségét.

### 2. Kétlépcsős, Jóváhagyás-alapú Kivezetési Rend (Maker–Checker)
- Tárgyi eszköz kivezetése a könyvekből közvetlenül nem hajtható végre. A felületen a felhasználó kizárólag kivezetési kérelmet (`request_asset_disposal`) indíthat a 4 törvényes jogcím egyikén:
  1. *Értékesítés* (használt eszköz eladás)
  2. *Selejtezés* (műszaki elavulás, tönkremenetel)
  3. *Leltárhiány* (káresemény, lopás, leltározási hiány)
  4. *Térítés nélküli átadás* (adomány, apport)
- A jóváhagyásra kizárólag könyvelői vagy cégvezetői jogosultsággal (`ledger_write`) rendelkező személy jogosult (`approve_asset_disposal` RPC).
- A jóváhagyás egyetlen atomi tranzakcióban:
  - Pótlólagos időarányos ÉCS-t számol el a kivezetés fordulónapjáig (T 5711 → K 1x9).
  - Kivezeti a halmozott ÉCS-t a bruttó értékkel szemben (T 1x9 → K 1x).
  - A könyv szerinti nettó maradványértéket egyéb ráfordításként könyveli (értékesítésnél: T 861 → K 1x, selejtezésnél és egyéb jogcímnél: T 869 → K 1x).

### 3. Tárolóhelyi Hierarchia és Mt. 179. § Szerinti Dolgozói Felelősségvállalás
- A vállalkozás telephelyein belül tetszőleges mélységű fastruktúrában tarthatók nyilván a fizikai tárolóhelyek (`company_sub_locations`: épület, emelet, iroda, raktár, polc).
- Eszköz dolgozóhoz történő rendelésekor vagy átadásakor kötelező az Mt. 179. § szerinti kétnyelvű (magyar/angol) **Átadás-átvételi jegyzőkönyv** kiállítása, amelyben a felelős személy elismeri a vagyontárgy sértetlen átvételét és visszaszolgáltatási kötelezettségét.

### 4. Törvényes Fordulónapi Analitikus Leltározás (Sztv. 69. §)
- A vállalkozás évente legalább egyszer köteles tételes fizikai leltározást végezni.
- A rendszer mobilbarát, optikai vonalkód- és QR-kód olvasást biztosít ipari Code 128B formátummal.
- A leltározás zárásakor Sztv. 69. § szerinti hivatalos analitikus leltárív exportálható Excel és aláírható PDF formátumban, kötelező 3 fős leltározási bizottsági aláírási záradékkal.

### 5. Fejlesztési Tartalék (Tao tv. 7. § (15)) és Késedelmi Pótlék Riasztás
- A fejlesztési tartalékból megvalósuló beruházások 5 évig elidegenítési tilalom alá esnek. Ha az eszközt ezen időn belül kivezetik, a rendszer figyelmeztető riasztást küld.
- A 3. és 4. adóévben fel nem használt fejlesztési tartalékra a rendszer automatikus adófizetési kötelezettség (9% Tao) és késedelmi pótlék (jegybanki alapkamat + 5 százalékpont) kalkulációt végez, proaktívan védve a vállalkozást az adóbírságtól.

### 6. Pályázati Beruházások és ÉCS-arányos PIE Feloldás (Sztv. 45. § (2), 77. § (3))
- A vissza nem térítendő támogatásból megvalósuló eszközök esetén a támogatás összegét passzív időbeli elhatárolásként (PIE, 483-as számla) kell elszámolni a folyósításkor.
- Az eszköz terv szerinti értékcsökkenésének elszámolásával párhuzamosan, az elszámolt ÉCS és a támogatási intenzitás szorzataként kalkulált támogatási arányt passzív időbeli elhatárolás feloldásaként egyéb bevételként kell jóváírni:
  **PIE feloldás = Időszaki ÉCS × Támogatási intenzitás**
  *Többéves kerekítési fegyelem:* A számított időszaki feloldás felső korlátja a még fel nem oldott elhatárolás (`remaining_deferral`). Az eszköz utolsó leírási időszakában (`isFinalPeriod`) a teljes fennmaradó elhatárolási egyenleg feloldásra kerül, hogy a forintkerekítési torzulások miatt ne maradjon bent elfelejtett maradványösszeg.
  **Könyvelési kontírozás:** **Tartozik 483 (PIE) → Követel 964 (Egyéb támogatási bevétel)**. A könyveléshez a számlatükörben meglévő 483-as és 964-es alszámlák közül az ügyfél/könyvelő szabadon választhat a feloldási dialógusban.
- A feloldást az automatikus `post_grant_deferral_release_to_gl` RPC végzi idempotens módon a Vegyes naplóba, címkézve a tárgyi eszközt és a pályázati projektet.
- A támogatási projekt fenntartási időszaka alatt kísérelt kivezetés esetén a rendszer elidegenítési és visszafizetési tilalmi riasztást ad.

### 7. Pályázati Projektek Törlési Védelme és Komponens Életciklus Garanciák
- **Adatintegritási és audit védelem:** Pályázati projekt nem törölhető a rendszerből, amennyiben ahhoz tárgyi eszköz vagy részegység (komponens) kapcsolódik, vagy ha már főkönyvi PIE feloldási bizonylat született hozzá. A védelmet a szoftver mind a felhasználói felületen (inaktív törlés gomb és figyelmeztető kártya), mind az adatbázis szintjén kötelező `BEFORE DELETE` triggerrel (`trg_prevent_delete_grant_project_with_usage`) kikényszeríti.
- **Kivezetett eszközök komponens-zárolása:** Amennyiben egy tárgyi eszköz állapota nem aktív (selejtezett, értékesített vagy leltárhiányként kivezetett), az eszköz részegységeinek listája véglegesen zárolódik. Új komponens rögzítése, meglévő módosítása vagy törlése szigorúan tilos, garantálva a kivezetési állapot visszamenőleges megváltoztathatatlanságát.

## Rationale

Ez a szabályzat biztosítja, hogy a VisiBill és eaisyBooks rendszert használó vállalkozások és könyvelőirodák:
1. Teljes körűen megfeleljenek a magyar Számviteli törvény és a Társasági adó törvény szigorú előírásainak.
2. Kizárják a jogosulatlan vagy ellenőrizetlen kivezetésekből eredő könyvviteli hiányosságokat.
3. Biztosítsák a pályázati auditok és a NAV / Magyar Államkincstár ellenőrzések során a hibátlan 4-oldalú egyezőséget és az időbeli elhatárolások szabályszerűségét.

## Kapcsolódó
- ADR: [A-251](../../architecture/decisions/A-251-fixed-assets-gl-linkage-reconciliation-and-disposal-workflow.md), [A-252](../../architecture/decisions/A-252-fixed-assets-phase2-and-phase3-inventory-grants-components-pie.md)
- PRD: [P-185](../../product/decisions/P-185-fixed-assets-reconciliation-disposal-approval-and-reserve-alerts-ux.md), [P-186](../../product/decisions/P-186-fixed-assets-phase2-and-phase3-ux.md)
- Adatbázis séma: [docs/architecture/database/10-assets.md](../../architecture/database/10-assets.md)
- Felhasználói tudásbázis: [docs/knowledge-base/eaisybill/18-teny.md](../../knowledge-base/eaisybill/18-teny.md)
