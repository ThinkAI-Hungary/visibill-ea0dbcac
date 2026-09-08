-- ==============================================================================
-- Migration: 20260907190000_audit_and_complete_knowledge_base.sql
-- Description: Teljes eaisyBill menü- és funkció audit: a hiányzó menüpontok
--              (Projektek, Partnertörzs, Tudástár önkiszolgáló, Analitika)
--              felvétele, valamint a meglévő cikkek valós kódbázis-alapú
--              szakmai kiegészítése (bankok, futárok, SZÉP kártya, Pro Rata).
-- ==============================================================================

-- 1. Kategóriák frissítése (basics és system leírás pontosítása)
UPDATE public.knowledge_base_categories
SET description = 'Kezdő lépések, felület megismerése, cégváltás, vezérlőpult, projektek, partnertörzs és tudástár'
WHERE id = 'basics';

UPDATE public.knowledge_base_categories
SET description = 'NAV Online Számla, Számlázz.hu, MNB árfolyamok, analitika, jegyzetek, beállítások és hibajegyek'
WHERE id = 'system';

-- 2. Cikkek felvétele és frissítése
INSERT INTO public.knowledge_base_articles (id, category_id, title, summary, content, menu_path, tags, icon, estimated_read_time, order_num)
VALUES
  -- ── 1. basics: Új és frissített cikkek ──
  (
    'projects-and-cost-centers',
    'basics',
    'Projektek, költséghelyek és fedezetszámítás',
    'Projektek kezelése, bevételek, közvetlen költségek és bérköltségek allokációja, költségvetés-követés és folyamatábra.',
    '# Projektek és költséghelyi nyilvántartás

A **Projektek** menüpont a vállalkozás projektjeinek, munkaszámainak és önálló költséghelyeinek pénzügyi és szakmai követésére szolgál.

### 1. Projekt életciklus és státuszok
- **Tervezett:** Előkészítés vagy árajánlatadás alatt álló projekt.
- **Aktív:** Folyamatban lévő megbízás aktív költség- és bevételrögzítéssel.
- **Lezárt:** Befejezett projekt véglegesített pénzügyi elszámolással.
- **Felfüggesztett:** Átmenetileg leállított munkaszám.
- Minden projekthez egyedi színkód, Lucide ikon és céges partner rendelhető.

### 2. Pénzügyi allokáció és fedezetszámítás
- **Kimenő számlák (Bevételek):** A vevői számlák tételei közvetlenül adott projekthez rendelhetők.
- **Szállítói számlák (Közvetlen anyag- és alvállalkozói költségek):** Beszerzési számlák projekt-alapú elszámolása.
- **Munkaerő-költségek allokációja:** A munkatársak jelenléti ívén rögzített munkaórák és bruttó bérköltségeik alapján a rendszer automatikusan kalkulálja a projektre eső bérköltséget.
- **Költségvetés figyelés (Budget vs Actual):** Tervezett keretösszeg és tényköltések összevetése valós idejű fedezeti mutatóval.

### 3. Projekt folyamatábra (ProjectFlowchart)
- A projekt részleteiben interaktív folyamatábrán és mérföldkő-diagramon követhetők a részfeladatok és teljesítési szakaszok.',
    '/projects',
    ARRAY['projekt', 'költséghely', 'fedezet', 'bérköltség', 'költségvetés', 'flowchart'],
    'FolderKanban',
    '4 perc',
    3
  ),
  (
    'partners-master-data-and-rankings',
    'basics',
    'Partnertörzs, adószám-ellenőrzés és forgalmi rangsor',
    'Vevők és szállítók adatlapja, adószám-formátumok, kapcsolt vállalkozások (TAO), TOP partnerek és számlatörténet.',
    '# Partnertörzs és partner analitika

A **Partnertörzs** menüpont a vevők, szállítók és üzleti partnerek központi adatbázisa.

### 1. Partner törzsadatok és validáció
- **Partnertípusok:** Vevő, Szállító, vagy Mindkettő besorolás.
- **Magyar adószám ellenőrzés:** 8-1-2 formátumú adószám strukturális és ellenőrzőösszeg validálása a NAV szabvány szerint.
- **Külföldi partnerek kezelése:** Külföldi adószámok támogatása szintetikus azonosítóval.
- **Kapcsolt vállalkozási státusz:** Kapcsolt fél jelölése, amely a társasági adó (TAO) transzferár nyilvántartásához és a közzétételi szabályokhoz elengedhetetlen.
- **Könyvelésből kizárás:** Opcionálisan kizárhatók a magánjellegű vagy reprezentációs partnerek a főkönyvi automatizmusokból.

### 2. Forgalmi rangsor és analitika
- **TOP Partner Rangsor:** Automatikus forgalmi rangsorolás nettó és bruttó volumen szerint a legjelentősebb partnerek azonosítására.
- **Számlatörténet:** Bármely partnerre kattintva megjelenik a partner összes korábbi számlája, kiegyenlítettsége és átlagos fizetési határideje.',
    '/partners',
    ARRAY['partner', 'vevő', 'szállító', 'adószám', 'kapcsolt vállalkozás', 'rangsor'],
    'Users',
    '3 perc',
    4
  ),
  (
    'knowledge-base-and-self-service',
    'basics',
    'Tudástár használata és önkiszolgáló segítségnyújtás',
    'Hogyan használd a Tudástárat: gyorskeresés, funkció-ugrás mélylinkek, kategóriaszűrés és hibajegy eszkaláció.',
    '# A Tudástár használata és önkiszolgáló kalauz

A **Tudástár** menüpont az eaisyBill és eaisyBooks rendszer összes funkciójának, menüpontjának és számviteli logikájának interaktív tudásbázisa.

### 1. Keresés és kategóriák
- **Azonnali keresés (0ms):** A fejlécben található keresőmezőbe gépelve azonnal szűrhetsz a cikkek címeiben, összefoglalóiban, címkéiben és teljes szövegében.
- **10 hierarchikus kategória:** A témaszűrő fülek segítségével egyetlen kattintással szűkíthetsz területekre (Bizonylatok, Könyvelés, Bérszámfejtés, eaisyBooks stb.).

### 2. Funkció-ugrás és megosztás
- **Ugrás a funkcióhoz gomb:** Minden funkcionális cikk tartalmaz egy közvetlen ugrás gombot, amely az olvasott útmutatóból azonnal az érintett munkaterületre navigál.
- **Megosztható URL:** Minden cikk egyedi azonosítóval rendelkezik, így a link közvetlenül másolható és megosztható munkatársakkal.

### 3. Hibajegy híd
- Ha egy specifikus kérdésre nem találsz választ, a cikkek alján található "Nem találtad meg a választ?" blokkból közvetlenül nyitható fejlesztői hibajegy a hiba pontos kontextusával.',
    '/knowledge-base',
    ARRAY['tudástár', 'segítség', 'funkciókalauz', 'keresés', 'hibajegy', 'önkiszolgáló'],
    'BookOpen',
    '2 perc',
    5
  ),
  (
    'roles-and-permissions',
    'basics',
    'Felhasználói szerepkörök és jogosultságok',
    'Ismerd meg a rendszer többszintű szerepkör-kezelését és az egyedi modul jogosultságokat.',
    '# Jogosultsági szintek az eaisyBill rendszerben

A rendszer szigorú, többlépcsős szerepkör-alapú hozzáférés-vezérlést biztosít a vállalkozási adatok védelmére.

### Szerepkörök hierarchiája:
1. **Tulajdonos (Owner):** Teljes hozzáférés a cég összes pénzügyi, banki és számlázási adatához, valamint a számlázási előfizetéshez.
2. **Adminisztrátor (Admin):** Kezelheti a csapattagokat, integrációkat, számlákat és pénzügyi beállításokat.
3. **Munkatárs (Member):** Számlák és tranzakciók rögzítése, megtekintése és jóváhagyása.
4. **Asszisztens (Assistant):** Bizonylatok feltöltése, hiányzó számlák pótlása korlátozott pénzügyi rálátással.
5. **Megtekintő (Viewer):** Csak olvasható hozzáférés riportokhoz és kimutatásokhoz.
6. **Munkavállaló (Employee):** Kizárólag a saját munkaidejét és jelenlétét rögzítheti a Munkaidő felületen.',
    '/settings',
    ARRAY['jogosultság', 'szerepkör', 'admin', 'owner', 'biztonság'],
    'Shield',
    '3 perc',
    6
  ),

  -- ── 2. transactions: Kódbázis-alapú valós kiegészítés (Bankok, Futárok, SZÉP kártya) ──
  (
    'bank-transactions-and-matching',
    'transactions',
    'Banki tranzakciók, intelligens párosítás és futár riportok',
    '15+ bank támogatása, kivonatok betöltése, 3 szintű számlapárosítás, futár riportok és SZÉP kártya elszámolás.',
    '# Banki tranzakciók, számlapárosítás és futárok

A **Tranzakciók** menüpont a vállalkozás pénzforgalmának digitális vezérlőpultja.

### 1. Támogatott pénzintézetek és formátumok
- **Hazai bankok:** OTP, CIB, Raiffeisen, K&H, Erste, UniCredit, MagNet, Gránit, MBH, MKB, Binx, Oberbank.
- **Fintech és nemzetközi szolgáltatók:** Wise, Revolut, PayPal.
- **Fájlformátumok:** Nemzetközi szabványos CAMT.053 XML, banki export CSV és szöveges/PDF kivonatok. Duplikáció-szűrés a banki tranzakcióazonosító alapján.

### 2. Háromszintű intelligens párosítás
1. **Pontos egyezés (Zöld):** Közleménybeli számlaszám és forintra egyező összeg esetén azonnali automatikus jóváhagyás.
2. **Intelligens javaslatok (Sárga):** Partnernév-hasonlóság és összegazonosság alapján algoritmikus javaslat.
3. **Kézi és részösszegű párosítás:** Tranzakció összekapcsolása több részszámlával vagy előlegszámlával.

### 3. Futár riportok kezelése (GLS, MPL, Mixpack, DPD)
- A webáruházas csomagküldésnél a futárcégek által átutalt egyösszegű utánvételt a rendszer automatikusan felbontja csomagszám és bizonylat szerint, levonva a futárszolgálati díjat.

### 4. SZÉP Kártya alszámlák
- Vendéglátás, szálláshely és szabadidő zsebek elkülönített nyilvántartása és forgalmi elszámolása.',
    '/transactions',
    ARRAY['bank', 'tranzakció', 'matching', 'párosítás', 'kivonat', 'futár', 'gls', 'szép kártya'],
    'Landmark',
    '4 perc',
    1
  ),

  -- ── 3. accounting: Kódbázis-alapú kiegészítés (ÁFA Pro Rata) ──
  (
    'vat-return-and-nav65',
    'accounting',
    'ÁFA bevallás kalkuláció, Pro Rata és NAV ÁNYK 2665 export',
    'Havi, negyedéves és éves ÁFA pozíció, ÁFA Pro Rata arányosítás, levonható és fizetendő egyenleg, XML export.',
    '# ÁFA bevallás és hatósági kimutatás

A **Könyvelés / ÁFA Bevallás** felület a NAV felé benyújtandó 65-ös bevallás előkészítését és kalkulációját végzi.

### 1. Fizetendő és levonható ÁFA analitika
- A rendszer a lekönyvelt számlák alapján tételesen összesíti az értékesítés fizetendő ÁFA tartalmát és a beszerzések levonható ÁFA összegét a NAV 65 sorai szerint.
- Automatikusan kezeli a belföldi fordított adózást (FAD) és az EU-s közösségi termékbeszerzést.
- Figyelmeztet a törvényi levonási korlátozásokra (személygépkocsi üzemanyag, reprezentáció, telefonköltség ÁFA hányad).

### 2. ÁFA Pro Rata (Arányosításos levonás)
- Tárgyi adómentes és adóköteles tevékenységet párhuzamosan végző vállalkozások esetén a rendszer automatikusan kiszámítja az érvényesíthető levonási hányadost az éves bevételek arányában.

### 3. NAV ÁNYK 2665 és ONYA XML export
- Egyetlen kattintással előállítható a NAV Általános Nyomtatványkitöltő (ÁNYK) és az Online Nyomtatványkitöltő Alkalmazás (ONYA) által elfogadott hivatalos XML állomány.',
    '/vat-return',
    ARRAY['áfa', 'bevallás', 'nav65', 'pro rata', 'ányk', 'onya', 'xml'],
    'Calculator',
    '3 perc',
    7
  ),

  -- ── 4. system: Új Analitika cikk és kiegészített Integrációk / Beállítások ──
  (
    'financial-analytics-and-charts',
    'system',
    'Pénzügyi analitika és idősoros kimutatások',
    'Havi árbevételek, szállítói ráfordítások és bérköltségek grafikonos elemzése, nettó/bruttó nézet és ÁFA bontás.',
    '# Pénzügyi analitika és vizualizáció

Az **Analitika** menüpont a vállalkozás bevételeinek, költségeinek és bérköltségeinek dinamikus idősoros elemzőfelülete.

### 1. Havi trendek és diagramok
- **Interaktív grafikonok:** Bevételek, kifizetett számlák és bérköltségek havi alakulása terület- és oszlopdiagramokon.
- **Nettó és bruttó váltókapcsoló:** Egyetlen kattintással válthatsz az ÁFA-val növelt bruttó cash-flow szemlélet és a nettó számviteli szemlélet között.

### 2. ÁFA kulcsonkénti megoszlás
- A forgalom megoszlása ÁFA kulcsok szerint (27%, 18%, 5%, 0%, AAM), azonnal kimutatva az adóteher koncentrációját.

### 3. Időszaki összehasonlítás
- Az aktuális hónap eredményei összevethetők az előző hónappal, vagy a bázisév azonos időszakával (YoY összehasonlítás).
- A devizás bizonylatok automatikusan a teljesítéskori MNB árfolyamon kerülnek konszolidálásra.',
    '/analytics',
    ARRAY['analitika', 'kimutatás', 'grafikon', 'idősor', 'árbevétel', 'költségek'],
    'BarChart3',
    '3 perc',
    4
  ),
  (
    'nav-online-szamla-sync',
    'system',
    'Rendszerintegrációk: NAV Online Számla, Számlázz.hu és email fiók',
    'Hogyan kösd össze vállalkozásodat a NAV-val, számlázóprogramokkal és állíts be egyedi számlafogadó email címet.',
    '# Rendszerintegrációk

Az **Integrációk** menüpontban konfigurálhatók a külső adatkapcsolatok a bizonylatok automatikus beérkezéséhez.

### 1. NAV Online Számla szinkronizáció
- Technikai felhasználó azonosító, jelszó, XML aláírókulcs és cserekulcs beállítása.
- Automatikus óránkénti számlaszinkronizáció kimenő és bejövő irányban, státuszkövetéssel és hibajelzéssel.

### 2. Számlázz.hu Agent integráció
- Közvetlen API összeköttetés a Számlázz.hu rendszerrel kibocsátott számlák azonnali átvételéhez.

### 3. Cégszintű számlafogadó e-mail alias
- Minden cég egyedi számlafogadó email címet kap (pl. `cegnev@eaisybill.hu`), amelyre a partnerek közvetlenül küldhetik a számlákat, automatikus feldolgozással.

### 4. Relax könyvelőprogram adatimport
- Korábbi könyvelési adatok és partnerállományok importálása Relax XML és DMP állományokból.',
    '/integrations',
    ARRAY['nav', 'online számla', 'számlázz.hu', 'email alias', 'relax', 'integráció'],
    'Wrench',
    '3 perc',
    1
  ),
  (
    'company-settings-and-profile',
    'system',
    'Cégprofil, bankszámlák és biztonsági beállítások',
    'Vállalkozás törzsadatai, bankszámlaszámok, csatlakozási kód, csapattagok meghívása és jogosultsági mátrix.',
    '# Cégprofil és beállítások

A **Beállítások** menüpontban szabhatók testre a vállalkozás működési paraméterei.

### 1. Cégadatok és adózási mód
- Cégnév, székhely, adószám, cégjegyzékszám és ÁFA alanyisági besorolás (VatRegime).
- Hivatalos bankszámlaszámok rögzítése devizanemmel és IBAN formátummal.

### 2. Csatlakozási kód és meghívók
- **Egyszeri csatlakozási token:** 10 percig érvényes biztonságos 6 karakteres kód generálása külső könyvelő vagy munkatárs azonnali összekapcsolásához.
- **Csapattagok meghívása:** Új felhasználók felvétele szerepkörökkel (Admin, Member, Assistant, Viewer, Employee) és moduláris jogosultsági panellel.',
    '/settings',
    ARRAY['beállítások', 'cégprofil', 'meghívó', 'bankszámla', 'felhasználók', 'jogosultság'],
    'Wrench',
    '3 perc',
    5
  ),
  (
    'tickets-and-support',
    'system',
    'Hibajegyek beküldése és felhasználói támogatás',
    'Hogyan jelents be hibát, küldj képernyőképet és kövesd a fejlesztői csapat visszajelzéseit.',
    '# Hibajegyek és terméktámogatás

Ha kérdésed van a rendszer működésével kapcsolatban vagy észrevételt tennél, a **Hibajegyek** menüpontban közvetlenül kapcsolatba léphetsz a fejlesztőkkel.

### 1. Hibajegy beküldése
- A képernyő jobb alsó sarkában található funkciógombra kattintva válaszd a **Hibabejelentés** lehetőséget.
- Add meg a tárgyat és a hiba leírását.
- Képernyőképet vagy dokumentumot is csatolhatsz a bejelentéshez.

### 2. Állapotok követése
- A Hibajegyek oldalon valós időben látod a bejelentésed státuszát: *Új*, *Folyamatban*, *Megválaszolva*, vagy *Lezárva*.',
    '/tickets',
    ARRAY['hibajegy', 'support', 'visszajelzés', 'hiba', 'támogatás'],
    'TicketCheck',
    '2 perc',
    6
  )
ON CONFLICT (id) DO UPDATE SET
  category_id = EXCLUDED.category_id,
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  content = EXCLUDED.content,
  menu_path = EXCLUDED.menu_path,
  tags = EXCLUDED.tags,
  icon = EXCLUDED.icon,
  estimated_read_time = EXCLUDED.estimated_read_time,
  order_num = EXCLUDED.order_num;
