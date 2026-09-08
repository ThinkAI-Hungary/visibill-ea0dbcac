import { KnowledgeCategory, KnowledgeArticle } from "@/types/knowledgeBase";

export const FALLBACK_KNOWLEDGE_CATEGORIES: KnowledgeCategory[] = [
  {
    "id": "basics",
    "title": "Alapok & Vezérlőpult",
    "description": "Kezdő lépések, felület megismerése, cégváltás, vezérlőpult, projektek, partnertörzs és tudástár",
    "icon": "Compass",
    "order_num": 1,
    "article_count": 6
  },
  {
    "id": "invoices",
    "title": "Bizonylatok & Számlák",
    "description": "Számlák kezelése, OCR feltöltés, sztornózás, kintlévőségek és fizetési felszólítások",
    "icon": "Receipt",
    "order_num": 2,
    "article_count": 4
  },
  {
    "id": "transactions",
    "title": "Pénzügyek & Bank",
    "description": "Banki tranzakciók, intelligens párosítás, banki utalási csomagok és házipénztár",
    "icon": "Landmark",
    "order_num": 3,
    "article_count": 3
  },
  {
    "id": "accounting",
    "title": "Könyvelés & Adózás",
    "description": "Főkönyvi kivonat, számlatükör, naplók, mérleg, eredménykimutatás, beszámoló és ÁFA bevallás",
    "icon": "BookOpen",
    "order_num": 4,
    "article_count": 7
  },
  {
    "id": "hr",
    "title": "Bérszámfejtés & HR",
    "description": "Havi bérszámfejtési ciklus, jelenléti ív, munkaidő és tárgyi eszközök nyilvántartása",
    "icon": "Users",
    "order_num": 5,
    "article_count": 3
  },
  {
    "id": "shipments",
    "title": "Szállítmányozás & Fuvarok",
    "description": "Fuvarlevelek, CMR megbízások, Excel import, számlapárosítás és eszkaláció",
    "icon": "Truck",
    "order_num": 6,
    "article_count": 3
  },
  {
    "id": "system",
    "title": "Integrációk & Rendszer",
    "description": "NAV Online Számla, Számlázz.hu, MNB árfolyamok, analitika, jegyzetek, beállítások és hibajegyek",
    "icon": "Wrench",
    "order_num": 7,
    "article_count": 6
  },
  {
    "id": "books_portfolio",
    "title": "eaisyBooks Portfólió",
    "description": "Könyvelőirodai ügyfélkezelés, portfólió áttekintés, hiányzó számlák, adónaptár, riportok és onboarding",
    "icon": "Briefcase",
    "order_num": 8,
    "article_count": 6
  },
  {
    "id": "books_modules",
    "title": "eaisyBooks Szakmai Modulok",
    "description": "Egyéni vállalkozók (EV), pénztárkönyv, értékhatárok, TAO/KIVA tervező, bérszámfejtés és bérlapok",
    "icon": "Calculator",
    "order_num": 9,
    "article_count": 6
  },
  {
    "id": "books_admin",
    "title": "eaisyBooks Adminisztráció & AI",
    "description": "Cégkapu tárhely, EGYKE képviselet, AI Asszisztens, könyvelési promptok, jóváhagyási sor, audit és GDPR",
    "icon": "Bot",
    "order_num": 10,
    "article_count": 6
  }
];

export const FALLBACK_CATEGORY_MAP = new Map<string, KnowledgeCategory>(
  FALLBACK_KNOWLEDGE_CATEGORIES.map((cat) => [cat.id, cat])
);

export const FALLBACK_KNOWLEDGE_ARTICLES: KnowledgeArticle[] = [
  {
    "id": "navigation-and-company-switching",
    "category_id": "basics",
    "title": "Kezdő lépések, navigáció és cégváltás",
    "summary": "Ismerd meg az eaisyBill modern felületét, a hierarchikus cégválasztót és a gyorsbillentyűket.",
    "content": "# Kezdő lépések az eaisyBill rendszerben\n\nAz eaisyBill egy teljes körű pénzügyi és könyveléstámogató platform vállalkozások és könyvelőik számára. A felület bal oldalán található a fő navigációs menü, felül a globális kereső és cégválasztó, középen pedig az aktív munkaterület.\n\n### 1. Cégváltás és cégprofil\n- A fejlécben vagy az oldalsáv tetején lévő **Cégválasztó** lenyíló menüvel azonnal válthatsz az általad kezelt vállalkozások között.\n- Cégváltáskor a rendszer az aktuálisan nyitott aloldalon tart (például ha a Számlák nézetben vagy, a másik cégnél is a Számlák nyílik meg).\n\n### 2. Gyorsbillentyűk (Hotkeys)\n- `Ctrl + B`: Oldalsáv (sidebar) összecsukása és kinyitása a maximális munkaterületért.\n- `Ctrl + K`: Gyorskereső és parancspaletta megnyitása bármely oldalról.\n- `Esc`: Felugró ablakok, modálok és oldalsó panelek azonnali bezárása.\n\n### 3. Sötét és világos mód\n- A felület támogatja a modern sötét módot (Dark Mode), amely az oldalsáv alsó felhasználói menüjéből vagy a profil beállításoknál aktiválható.",
    "menu_path": "/",
    "tags": [
      "navigáció",
      "cégváltás",
      "gyorsbillentyű",
      "alapok",
      "kezdés"
    ],
    "icon": "Compass",
    "estimated_read_time": "2 perc",
    "order_num": 1,
    "is_published": true
  },
  {
    "id": "dashboard-overview-and-kpis",
    "category_id": "basics",
    "title": "Irányítópult és vezérlőpulti KPI mutatók",
    "summary": "A vállalkozás pénzügyi egészségének azonnali áttekintése: bevételek, költségek, cash-flow és teendők.",
    "content": "# Irányítópult (Dashboard)\n\nAz **Irányítópult** a vállalkozás vezetői és pénzügyi információs központja, amely valós időben mutatja a legfontosabb pénzügyi mutatókat (KPI).\n\n### 1. Főbb vezérlőpulti kártyák\n- **Összes bevétel:** A kiválasztott időszakban kibocsátott és könyvelt kimenő vevői számlák nettó és bruttó összege.\n- **Összes kiadás:** A szállítói bejövő számlák, házipénztári kiadások és egyéb költségek összege.\n- **Kintlévőség egyenleg:** A vevők által még ki nem egyenlített számlák összege, külön jelölve a lejárt határidejű tartozásokat.\n- **Aktuális egyenlegek:** A szinkronizált bankszámlák és a házipénztár pillanatnyi készpénzállománya.\n\n### 2. Időszak szűrő és összehasonlítás\n- A felső dátumválasztóval vizsgálhatod az aktuális hónapot, negyedévet, az egész évet, vagy egyedi dátumtartományt.\n- A grafikonok azonnal mutatják az előző év azonos időszakához képest mért változást (YoY összehasonlítás).",
    "menu_path": "/",
    "tags": [
      "dashboard",
      "kpi",
      "bevétel",
      "kiadás",
      "cash-flow",
      "áttekintés"
    ],
    "icon": "Layers",
    "estimated_read_time": "3 perc",
    "order_num": 2,
    "is_published": true
  },
  {
    "id": "projects-and-cost-centers",
    "category_id": "basics",
    "title": "Projektek, költséghelyek és fedezetszámítás",
    "summary": "Projektek kezelése, bevételek, közvetlen költségek és bérköltségek allokációja, költségvetés-követés és folyamatábra.",
    "content": "# Projektek és költséghelyi nyilvántartás\n\nA **Projektek** menüpont a vállalkozás projektjeinek, munkaszámainak és önálló költséghelyeinek pénzügyi és szakmai követésére szolgál.\n\n### 1. Projekt életciklus és státuszok\n- **Tervezett:** Előkészítés vagy árajánlatadás alatt álló projekt.\n- **Aktív:** Folyamatban lévő megbízás aktív költség- és bevételrögzítéssel.\n- **Lezárt:** Befejezett projekt véglegesített pénzügyi elszámolással.\n- **Felfüggesztett:** Átmenetileg leállított munkaszám.\n- Minden projekthez egyedi színkód, Lucide ikon és céges partner rendelhető.\n\n### 2. Pénzügyi allokáció és fedezetszámítás\n- **Kimenő számlák (Bevételek):** A vevői számlák tételei közvetlenül adott projekthez rendelhetők.\n- **Szállítói számlák (Közvetlen anyag- és alvállalkozói költségek):** Beszerzési számlák projekt-alapú elszámolása.\n- **Munkaerő-költségek allokációja:** A munkatársak jelenléti ívén rögzített munkaórák és bruttó bérköltségeik alapján a rendszer automatikusan kalkulálja a projektre eső bérköltséget.\n- **Költségvetés figyelés (Budget vs Actual):** Tervezett keretösszeg és tényköltések összevetése valós idejű fedezeti mutatóval.\n\n### 3. Projekt folyamatábra (ProjectFlowchart)\n- A projekt részleteiben interaktív folyamatábrán és mérföldkő-diagramon követhetők a részfeladatok és teljesítési szakaszok.",
    "menu_path": "/projects",
    "tags": [
      "projekt",
      "költséghely",
      "fedezet",
      "bérköltség",
      "költségvetés",
      "flowchart"
    ],
    "icon": "FolderKanban",
    "estimated_read_time": "4 perc",
    "order_num": 3,
    "is_published": true
  },
  {
    "id": "partners-master-data-and-rankings",
    "category_id": "basics",
    "title": "Partnertörzs, adószám-ellenőrzés és forgalmi rangsor",
    "summary": "Vevők és szállítók adatlapja, adószám-formátumok, kapcsolt vállalkozások (TAO), TOP partnerek és számlatörténet.",
    "content": "# Partnertörzs és partner analitika\n\nA **Partnertörzs** menüpont a vevők, szállítók és üzleti partnerek központi adatbázisa.\n\n### 1. Partner törzsadatok és validáció\n- **Partnertípusok:** Vevő, Szállító, vagy Mindkettő besorolás.\n- **Magyar adószám ellenőrzés:** 8-1-2 formátumú adószám strukturális és ellenőrzőösszeg validálása a NAV szabvány szerint.\n- **Külföldi partnerek kezelése:** Külföldi adószámok támogatása szintetikus azonosítóval.\n- **Kapcsolt vállalkozási státusz:** Kapcsolt fél jelölése, amely a társasági adó (TAO) transzferár nyilvántartásához és a közzétételi szabályokhoz elengedhetetlen.\n- **Könyvelésből kizárás:** Opcionálisan kizárhatók a magánjellegű vagy reprezentációs partnerek a főkönyvi automatizmusokból.\n\n### 2. Forgalmi rangsor és analitika\n- **TOP Partner Rangsor:** Automatikus forgalmi rangsorolás nettó és bruttó volumen szerint a legjelentősebb partnerek azonosítására.\n- **Számlatörténet:** Bármely partnerre kattintva megjelenik a partner összes korábbi számlája, kiegyenlítettsége és átlagos fizetési határideje.",
    "menu_path": "/partners",
    "tags": [
      "partner",
      "vevő",
      "szállító",
      "adószám",
      "kapcsolt vállalkozás",
      "rangsor"
    ],
    "icon": "Users",
    "estimated_read_time": "3 perc",
    "order_num": 4,
    "is_published": true
  },
  {
    "id": "knowledge-base-and-self-service",
    "category_id": "basics",
    "title": "Tudástár használata és önkiszolgáló segítségnyújtás",
    "summary": "Hogyan használd a Tudástárat: gyorskeresés, funkció-ugrás mélylinkek, kategóriaszűrés és hibajegy eszkaláció.",
    "content": "# A Tudástár használata és önkiszolgáló kalauz\n\nA **Tudástár** menüpont az eaisyBill és eaisyBooks rendszer összes funkciójának, menüpontjának és számviteli logikájának interaktív tudásbázisa.\n\n### 1. Keresés és kategóriák\n- **Azonnali keresés (0ms):** A fejlécben található keresőmezőbe gépelve azonnal szűrhetsz a cikkek címeiben, összefoglalóiban, címkéiben és teljes szövegében.\n- **10 hierarchikus kategória:** A témaszűrő fülek segítségével egyetlen kattintással szűkíthetsz területekre (Bizonylatok, Könyvelés, Bérszámfejtés, eaisyBooks stb.).\n\n### 2. Funkció-ugrás és megosztás\n- **Ugrás a funkcióhoz gomb:** Minden funkcionális cikk tartalmaz egy közvetlen ugrás gombot, amely az olvasott útmutatóból azonnal az érintett munkaterületre navigál.\n- **Megosztható URL:** Minden cikk egyedi azonosítóval rendelkezik, így a link közvetlenül másolható és megosztható munkatársakkal.\n\n### 3. Hibajegy híd\n- Ha egy specifikus kérdésre nem találsz választ, a cikkek alján található \"Nem találtad meg a választ?\" blokkból közvetlenül nyitható fejlesztői hibajegy a hiba pontos kontextusával.",
    "menu_path": "/knowledge-base",
    "tags": [
      "tudástár",
      "segítség",
      "funkciókalauz",
      "keresés",
      "hibajegy",
      "önkiszolgáló"
    ],
    "icon": "BookOpen",
    "estimated_read_time": "2 perc",
    "order_num": 5,
    "is_published": true
  },
  {
    "id": "roles-and-permissions",
    "category_id": "basics",
    "title": "Felhasználói szerepkörök és jogosultságok",
    "summary": "Ismerd meg a rendszer többszintű szerepkör-kezelését és az egyedi modul jogosultságokat.",
    "content": "# Jogosultsági szintek az eaisyBill rendszerben\n\nA rendszer szigorú, többlépcsős szerepkör-alapú hozzáférés-vezérlést biztosít a vállalkozási adatok védelmére.\n\n### Szerepkörök hierarchiája:\n1. **Tulajdonos (Owner):** Teljes hozzáférés a cég összes pénzügyi, banki és számlázási adatához, valamint a számlázási előfizetéshez.\n2. **Adminisztrátor (Admin):** Kezelheti a csapattagokat, integrációkat, számlákat és pénzügyi beállításokat.\n3. **Munkatárs (Member):** Számlák és tranzakciók rögzítése, megtekintése és jóváhagyása.\n4. **Asszisztens (Assistant):** Bizonylatok feltöltése, hiányzó számlák pótlása korlátozott pénzügyi rálátással.\n5. **Megtekintő (Viewer):** Csak olvasható hozzáférés riportokhoz és kimutatásokhoz.\n6. **Munkavállaló (Employee):** Kizárólag a saját munkaidejét és jelenlétét rögzítheti a Munkaidő felületen.",
    "menu_path": "/settings",
    "tags": [
      "jogosultság",
      "szerepkör",
      "admin",
      "owner",
      "biztonság"
    ],
    "icon": "Shield",
    "estimated_read_time": "3 perc",
    "order_num": 6,
    "is_published": true
  },
  {
    "id": "invoices-management-and-filters",
    "category_id": "invoices",
    "title": "Számlák kezelése, szűrése és státuszai",
    "summary": "Hogyan kezeld a bejövő és kimenő számlákat, használd a többdimenziós szűrőket és kövesd a fizetettséget.",
    "content": "# Számlakezelés az eaisyBill rendszerben\n\nA **Számlák** menüpontban tekintheted át a vállalkozás összes bizonylatát egyetlen konszolidált felületen.\n\n### 1. Bejövő és kimenő nézet\n- A fenti fülek segítségével válthatsz a **Bejövő (szállítói)** és a **Kimenő (vevői)** számlák között.\n- A táblázat azonnal mutatja a számlaszámot, partnert, teljesítési és fizetési határidőt, nettó és bruttó összeget, valamint az ÁFA tartalmat.\n\n### 2. Számla státuszok\n- **Fizetett (Zöld):** A számla összege teljes mértékben kiegyenlítésre került banki vagy készpénzes tétellel.\n- **Részben fizetett (Sárga):** A számlához kapcsolódik jóváírás, de a fennmaradó összeg még kiegyenlítésre vár.\n- **Kiegyenlítetlen / Lejárt (Piros):** A fizetési határidő lejárt, a számla még nincs kifizetve.\n- **Stornózott (Szürke áthúzott):** Érvénytelenített vagy stornózott számla.\n\n### 3. Haladó szűrők és megosztható nézetek\n- Szűrés partnerre, fizetési határidőre, ÁFA kulcsra vagy összegtartományra.\n- A szűrők állapota azonnal tükröződik az URL-ben, így a szűrt lista könyvjelzőzhető vagy közvetlenül megosztható kollégákkal.",
    "menu_path": "/invoices",
    "tags": [
      "számla",
      "bejövő",
      "kimenő",
      "szűrés",
      "státusz",
      "áfa"
    ],
    "icon": "Receipt",
    "estimated_read_time": "4 perc",
    "order_num": 1,
    "is_published": true
  },
  {
    "id": "invoice-upload-and-ocr",
    "category_id": "invoices",
    "title": "Bizonylatok feltöltése és mesterséges intelligencia (OCR)",
    "summary": "Hogyan működik az automatikus számlafeldolgozás, a többoldalas PDF bontás és a látási AI (Vision OCR).",
    "content": "# Számlafeltöltés és AI adatkinyerés\n\nAz eaisyBill beépített képi mesterséges intelligencia motorja másodpercek alatt felismeri a feltöltött dokumentumok adatait.\n\n### 1. Feltöltési csatornák\n- **Húzás és ejtés (Drag & Drop):** Húzd a fájlokat közvetlenül a Feltöltés menüpontba.\n- **Email továbbítás:** Minden cég rendelkezik egy egyedi számlafogadó email címmel, ahová a szállítói számlákat közvetlenül továbbíthatod.\n- **Többoldalas PDF-ek:** Ha egyetlen PDF állományban több számla található, az automatikus lapszétválasztó funkció önálló bizonylatokra bontja azokat.\n\n### 2. Automatikus mezőfelismerés\nA rendszer automatikusan kinyeri:\n- Számla sorszáma és típusa (normál számla, végszámla, előlegszámla, díjbekérő).\n- Kibocsátó és vevő adószáma, neve, címe.\n- Teljesítés kelte, kibocsátás dátuma és fizetési határidő.\n- Nettó összeg, ÁFA kulcsok és bruttó végösszeg.\n- Tételes sorok és termékmegnevezések.",
    "menu_path": "/upload",
    "tags": [
      "feltöltés",
      "ocr",
      "ai",
      "vision",
      "pdf",
      "számlafeldolgozás"
    ],
    "icon": "Upload",
    "estimated_read_time": "3 perc",
    "order_num": 2,
    "is_published": true
  },
  {
    "id": "storno-and-corrections",
    "category_id": "invoices",
    "title": "Sztornó és helyesbítő számlák kezelése",
    "summary": "Ismerd meg a számlakorrekciók, helyesbítések és a kétlépcsős sztornó-lezárás szabályait.",
    "content": "# Sztornó és módosító bizonylatok\n\nA magyar számviteli szabályok szerint kibocsátott sztornó és helyesbítő számlák precíz adminisztrációt igényelnek.\n\n### 1. Automatikus sztornó párosítás\n- A rendszer az eredeti számla sorszáma alapján automatikusan összekapcsolja a stornó bizonylatot az alapbizonylattal.\n- A két számla nettó és bruttó egyenlege kioltja egymást, így a kintlévőségi listákban nem jelenik meg téves tartozás.\n\n### 2. Kézi sztornó lezárás\n- Ha a számla stornózása pénzmozgás nélkül történt, a számla részleteiben található \"Sztornó lezárása\" gombbal a bizonylat közvetlenül lezárható.",
    "menu_path": "/invoices",
    "tags": [
      "storno",
      "helyesbítő",
      "módosítás",
      "kioltás"
    ],
    "icon": "RotateCcw",
    "estimated_read_time": "2 perc",
    "order_num": 3,
    "is_published": true
  },
  {
    "id": "receivables-and-payment-reminders",
    "category_id": "invoices",
    "title": "Kintlévőség kezelés és fizetési felszólítások",
    "summary": "Vevői tartozások korosítása, kintlévőségi egyenlegek és fizetési felszólító levelek küldése.",
    "content": "# Kintlévőségek és adóskövetés\n\nA **Kintlévőség** menüpontban áttekintheted a partnerek felé fennálló nyitott vevői követeléseket.\n\n### 1. Tartozások korosítása (Aging analitika)\n- **0–30 napos késedelem:** Enyhe késedelemben lévő számlák.\n- **31–60 napos késedelem:** Figyelmeztető kategória, egyeztetést igényel.\n- **60+ napos késedelem:** Kritikus kintlévőségek, jogi lépéseket igényelhetnek.\n\n### 2. Fizetési felszólítások generálása\n- Egyetlen kattintással előállítható a hivatalos formátumú fizetési felszólító levél vagy egyenlegközlő értesítő PDF formátumban.\n- Az értesítők közvetlenül emailben is elküldhetők a partner kapcsolattartójának.",
    "menu_path": "/kintlevo",
    "tags": [
      "kintlévőség",
      "vevő",
      "tartozás",
      "felszólítás",
      "korosítás",
      "egyenlegközlő"
    ],
    "icon": "FileText",
    "estimated_read_time": "3 perc",
    "order_num": 4,
    "is_published": true
  },
  {
    "id": "bank-transactions-and-matching",
    "category_id": "transactions",
    "title": "Banki tranzakciók, intelligens párosítás és futár riportok",
    "summary": "15+ bank támogatása, kivonatok betöltése, 3 szintű számlapárosítás, futár riportok és SZÉP kártya elszámolás.",
    "content": "# Banki tranzakciók, számlapárosítás és futárok\n\nA **Tranzakciók** menüpont a vállalkozás pénzforgalmának digitális vezérlőpultja.\n\n### 1. Támogatott pénzintézetek és formátumok\n- **Hazai bankok:** OTP, CIB, Raiffeisen, K&H, Erste, UniCredit, MagNet, Gránit, MBH, MKB, Binx, Oberbank.\n- **Fintech és nemzetközi szolgáltatók:** Wise, Revolut, PayPal.\n- **Fájlformátumok:** Nemzetközi szabványos CAMT.053 XML, banki export CSV és szöveges/PDF kivonatok. Duplikáció-szűrés a banki tranzakcióazonosító alapján.\n\n### 2. Háromszintű intelligens párosítás\n1. **Pontos egyezés (Zöld):** Közleménybeli számlaszám és forintra egyező összeg esetén azonnali automatikus jóváhagyás.\n2. **Intelligens javaslatok (Sárga):** Partnernév-hasonlóság és összegazonosság alapján algoritmikus javaslat.\n3. **Kézi és részösszegű párosítás:** Tranzakció összekapcsolása több részszámlával vagy előlegszámlával.\n\n### 3. Futár riportok kezelése (GLS, MPL, Mixpack, DPD)\n- A webáruházas csomagküldésnél a futárcégek által átutalt egyösszegű utánvételt a rendszer automatikusan felbontja csomagszám és bizonylat szerint, levonva a futárszolgálati díjat.\n\n### 4. SZÉP Kártya alszámlák\n- Vendéglátás, szálláshely és szabadidő zsebek elkülönített nyilvántartása és forgalmi elszámolása.",
    "menu_path": "/transactions",
    "tags": [
      "bank",
      "tranzakció",
      "matching",
      "párosítás",
      "kivonat",
      "futár",
      "gls",
      "szép kártya"
    ],
    "icon": "Landmark",
    "estimated_read_time": "4 perc",
    "order_num": 1,
    "is_published": true
  },
  {
    "id": "bank-transfers-giro-sepa",
    "category_id": "transactions",
    "title": "Szállítói utalási csomagok és banki export (GIRO / SEPA)",
    "summary": "Hogyan állíts össze kötegelt utalási megbízást szállítói számlákból, és töltsd be a netbankba.",
    "content": "# Szállítói utalások (GIRO és SEPA)\n\nAz **Utalások** menüpont segítségével elkerülhető a szállítói számlák egyesével történő kézi berögzítése a netbanki felületeken.\n\n### 1. Utalási csomag összeállítása\n- Jelöld ki a kifizetésre váró szállítói számlákat a Számlák vagy Utalások listában.\n- A rendszer ellenőrzi a partner bankszámlaszámának formátumát és a fizetési határidőt.\n\n### 2. Banki állomány exportálása\n- **GIRO XML / TXT:** A magyarországi bankok (OTP, Erste, Raiffeisen, MBH, CIB) által elfogadott kötegelt átutalási formátum.\n- **SEPA XML (pain.001):** Eurós nemzetközi átutalásokhoz használható szabványos állomány.\n- Az exportált fájl közvetlenül importálható a netbanki felületre.",
    "menu_path": "/transfers",
    "tags": [
      "utalás",
      "giro",
      "sepa",
      "bank",
      "csomag",
      "átutalás"
    ],
    "icon": "Send",
    "estimated_read_time": "3 perc",
    "order_num": 2,
    "is_published": true
  },
  {
    "id": "petty-cash-and-manual-payments",
    "category_id": "transactions",
    "title": "Házipénztár és készpénzes bizonylatok",
    "summary": "Készpénzes kifizetések rögzítése, pénztárbizonylatok és készpénzforgalmi nyilvántartás.",
    "content": "# Házipénztár kezelése\n\nA készpénzes vásárlások és elszámolások a **Házipénztár** modulban követhetők nyomon.\n\n### 1. Készpénzes számlák\n- A készpénzes fizetési módú számlák automatikusan bekerülnek a házipénztár forgalmi listájába.\n- A rendszer folyamatosan nyilvántartja a pénztári egyenleget és figyelmeztet a negatív pénztáregyenleg kockázatára.\n\n### 2. Bevételi és kiadási pénztárbizonylatok\n- Kézi pénztárbizonylat állítható ki dolgozói előleghez, tagi kölcsön törlesztéséhez vagy egyéb készpénzmozgáshoz.\n- Hivatalos pénztárjelentés és időszaki pénztárzárás generálása.",
    "menu_path": "/petty-cash",
    "tags": [
      "házipénztár",
      "készpénz",
      "pénztárbizonylat",
      "kiadás",
      "bevétel"
    ],
    "icon": "Coins",
    "estimated_read_time": "2 perc",
    "order_num": 3,
    "is_published": true
  },
  {
    "id": "general-ledger-and-chart-of-accounts",
    "category_id": "accounting",
    "title": "Főkönyvi kivonat, kartonok és számlaosztályok",
    "summary": "Kettős könyvvitel alapjai, számlaosztályok, nyitó- és forgalmi egyenlegek és főkönyvi karton.",
    "content": "# Főkönyv és számlalapok\n\nA **Főkönyv** menüpont a kettős könyvvitelt vezető vállalkozások és könyvelőik központi munkafelülete.\n\n### 1. A magyar számlatükör felépítése\n- **1. Számlaosztály:** Befektetett eszközök (immateriális javak, tárgyi eszközök).\n- **2. Számlaosztály:** Készletek (anyagok, áruk).\n- **3. Számlaosztály:** Követelések és pénzeszközök (vevők, bankok, pénztár).\n- **4. Számlaosztály:** Források (saját tőke, kötelezettségek, szállítók).\n- **5. Számlaosztály:** Költségnemek (anyagjellegű, személyi, értékcsökkenés).\n- **8. Számlaosztály:** Ráfordítások.\n- **9. Számlaosztály:** Árbevételek és bevételek.\n\n### 2. Főkönyvi karton kereső\n- Bármely főkönyvi számra kattintva megnyitható a részletes karton, amely tételesen mutatja a Tartozik és Követel mozgásokat bizonylatszámmal.",
    "menu_path": "/general-ledger",
    "tags": [
      "főkönyv",
      "karton",
      "számlaosztály",
      "kettős könyvvitel",
      "számvitel"
    ],
    "icon": "BookOpen",
    "estimated_read_time": "4 perc",
    "order_num": 1,
    "is_published": true
  },
  {
    "id": "chart-of-accounts-and-posting-rules",
    "category_id": "accounting",
    "title": "Magyar számlatükör és automatikus kontírozási szabályok",
    "summary": "Számlatükör szerkesztése, új alszámlák felvétele és intelligens AI kontírozási szabályok beállítása.",
    "content": "# Számlatükör és Kategóriák\n\nA **Kategóriák** menüpontban szabhatod testre a vállalkozás számlatükrét és a számlák automatikus könyvelését irányító szabályokat.\n\n### 1. Számlatükör karbantartása\n- Új 3, 4 vagy 6 jegyű alszámlák rögzítése a hazai számviteli törvény előírásai szerint.\n- Alapértelmezett partner-összerendelések és költséghelyek rögzítése.\n\n### 2. Automatikus kontírozási szabályok\n- Partnernév, termékkategória vagy kulcsszavak alapján a rendszer előre kitölti a Tartozik és Követel számlaszámokat a számlafeldolgozás során.",
    "menu_path": "/categories",
    "tags": [
      "számlatükör",
      "kategória",
      "kontírozás",
      "szabályok",
      "alszámla"
    ],
    "icon": "Layers",
    "estimated_read_time": "3 perc",
    "order_num": 2,
    "is_published": true
  },
  {
    "id": "journal-entries-and-closings",
    "category_id": "accounting",
    "title": "Kettős könyvviteli naplók és könyvelési zárások",
    "summary": "Zárt könyvelési naplók (Vevő, Szállító, Bank, Vegyes), időszaki zárás és manuális vegyes bizonylatok.",
    "content": "# Könyvelési naplók és zárás\n\nA **Napló** felületen a tranzakciók szigorúan zárt naplókba rendezve követhetők nyomon a számviteli törvény előírásainak megfelelően.\n\n### 1. Zárt naplók típusai\n- **Vevő napló:** Kimenő értékesítési számlák könyvelési tételei.\n- **Szállító napló:** Bejövő beszerzési bizonylatok könyvelése.\n- **Bank és Pénztár napló:** Pénzforgalmi mozgások tételei.\n- **Vegyes napló:** Időbeli elhatárolások, év végi záró/nyitó tételek és bérfeladások.\n\n### 2. Időszaki zárás\n- A lezárt időszakok zárolhatók, megakadályozva a visszamenőleges módosításokat.",
    "menu_path": "/journals",
    "tags": [
      "napló",
      "vegyes",
      "zárás",
      "szállító napló",
      "vevő napló"
    ],
    "icon": "BookOpen",
    "estimated_read_time": "3 perc",
    "order_num": 3,
    "is_published": true
  },
  {
    "id": "profit-and-loss-statement",
    "category_id": "accounting",
    "title": "Eredménykimutatás és gazdálkodási PnL elemzés",
    "summary": "Összköltség és forgalmi költség eljárású eredménykimutatás, üzemi eredmény és pénzügyi műveletek.",
    "content": "# Eredménykimutatás (Profit & Loss)\n\nAz **Eredménykimutatás** kimutatja a vállalkozás bevételeit és ráfordításait egy adott időszakra vonatkozóan.\n\n### 1. Eredményszintek struktúrája\n- **I. Értékesítés nettó árbevétele:** Belföldi és export értékesítés bevétele.\n- **II. Anyagjellegű ráfordítások:** Anyagköltség, igénybe vett szolgáltatások.\n- **III. Személyi jellegű ráfordítások:** Bérköltség, személyi kifizetések és bérjárulékok.\n- **Üzemi (üzleti) tevékenység eredménye:** A fő tevékenység nyeresége vagy vesztesége.\n- **Pénzügyi műveletek eredménye:** Kamatbevételek, kamatráfordítások és árfolyamkülönbözetek.\n- **Adózás előtti és adózott eredmény.**",
    "menu_path": "/profit-and-loss",
    "tags": [
      "eredménykimutatás",
      "pnl",
      "bevétel",
      "költség",
      "nyereség",
      "árbevétel"
    ],
    "icon": "Calculator",
    "estimated_read_time": "4 perc",
    "order_num": 4,
    "is_published": true
  },
  {
    "id": "balance-sheet-report",
    "category_id": "accounting",
    "title": "Mérlegkimutatás (eszközök és források)",
    "summary": "A vállalkozás vagyoni helyzetének felmérése: befektetett eszközök, forgóeszközök, saját tőke és kötelezettségek.",
    "content": "# Mérlegkimutatás\n\nA **Mérleg** egy adott fordulónapra (például december 31-re) vonatkozóan mutatja a cég vagyonát (Eszközök) és a vagyon eredetét (Források).\n\n### 1. Eszközök (Aktivák)\n- **Befektetett eszközök:** Immateriális javak, ingatlanok, műszaki gépek, tartós részesedések.\n- **Forgóeszközök:** Készletek, vevőkövetelések, értékpapírok és pénzeszközök.\n- **Aktív időbeli elhatárolások.**\n\n### 2. Források (Passzívák)\n- **Saját tőke:** Jegyzett tőke, tőketartalék, eredménytartalék, tárgyévi eredmény.\n- **Céltartalékok.**\n- **Kötelezettségek:** Hosszú és rövid lejáratú kötelezettségek (szállítók, hitelek, adótartozások).\n- **Passzív időbeli elhatárolások.**",
    "menu_path": "/balance-sheet",
    "tags": [
      "mérleg",
      "eszközök",
      "források",
      "saját tőke",
      "vagyon"
    ],
    "icon": "Landmark",
    "estimated_read_time": "4 perc",
    "order_num": 5,
    "is_published": true
  },
  {
    "id": "annual-report-filing",
    "category_id": "accounting",
    "title": "Éves számviteli beszámoló és kiegészítő melléklet",
    "summary": "Év végi beszámoló csomag összeállítása, letétbe helyezés és közzétételi kötelezettségek.",
    "content": "# Éves beszámoló\n\nA **Beszámoló** modul támogatja a kettős könyvvitelt vezető társaságok kötelező éves számviteli beszámolójának előkészítését.\n\n### 1. Beszámoló formái\n- **Mikrogazdálkodói egyszerűsített beszámoló:** Kisebb cégek számára egyszerűsített értékelési szabályokkal.\n- **Egyszerűsített éves beszámoló:** A legtöbb Kft. és Bt. által alkalmazott forma.\n- **Éves beszámoló:** Nagyobb árbevételű cégek esetén.\n\n### 2. Export és közzététel\n- A rendszer előkészíti a mérleget, eredménykimutatást és a kiegészítő melléklet számszaki adatait a hatósági OBR (Online Beszámoló Rendszer) feltöltéshez.",
    "menu_path": "/annual-report",
    "tags": [
      "beszámoló",
      "éves zárás",
      "kiegészítő melléklet",
      "letétbe helyezés",
      "obr"
    ],
    "icon": "FileText",
    "estimated_read_time": "3 perc",
    "order_num": 6,
    "is_published": true
  },
  {
    "id": "vat-return-and-nav65",
    "category_id": "accounting",
    "title": "ÁFA bevallás kalkuláció, Pro Rata és NAV ÁNYK 2665 export",
    "summary": "Havi, negyedéves és éves ÁFA pozíció, ÁFA Pro Rata arányosítás, levonható és fizetendő egyenleg, XML export.",
    "content": "# ÁFA bevallás és hatósági kimutatás\n\nA **Könyvelés / ÁFA Bevallás** felület a NAV felé benyújtandó 65-ös bevallás előkészítését és kalkulációját végzi.\n\n### 1. Fizetendő és levonható ÁFA analitika\n- A rendszer a lekönyvelt számlák alapján tételesen összesíti az értékesítés fizetendő ÁFA tartalmát és a beszerzések levonható ÁFA összegét a NAV 65 sorai szerint.\n- Automatikusan kezeli a belföldi fordított adózást (FAD) és az EU-s közösségi termékbeszerzést.\n- Figyelmeztet a törvényi levonási korlátozásokra (személygépkocsi üzemanyag, reprezentáció, telefonköltség ÁFA hányad).\n\n### 2. ÁFA Pro Rata (Arányosításos levonás)\n- Tárgyi adómentes és adóköteles tevékenységet párhuzamosan végző vállalkozások esetén a rendszer automatikusan kiszámítja az érvényesíthető levonási hányadost az éves bevételek arányában.\n\n### 3. NAV ÁNYK 2665 és ONYA XML export\n- Egyetlen kattintással előállítható a NAV Általános Nyomtatványkitöltő (ÁNYK) és az Online Nyomtatványkitöltő Alkalmazás (ONYA) által elfogadott hivatalos XML állomány.",
    "menu_path": "/vat-return",
    "tags": [
      "áfa",
      "bevallás",
      "nav65",
      "pro rata",
      "ányk",
      "onya",
      "xml"
    ],
    "icon": "Calculator",
    "estimated_read_time": "3 perc",
    "order_num": 7,
    "is_published": true
  },
  {
    "id": "payroll-cycle-and-salaries",
    "category_id": "hr",
    "title": "Havi bérszámfejtési folyamat és béradatok",
    "summary": "4 fázisú bérszámfejtési ciklus, dolgozói törzs, kedvezmények és NAV 08 bevallás.",
    "content": "# Bérszámfejtés és dolgozói nyilvántartás\n\nA **Bérek / Járulékok** modul a munkavállalók bérszámfejtésének és hatósági elszámolásának eszköze.\n\n### 1. A 4 fázisú havi ciklus\n1. **Tervezet:** Dolgozók kiválasztása, munkaidő és pótlékok rögzítése.\n2. **Számfejtés:** Bruttó bérből SZJA, TB járulék és SZOCHO számítás.\n3. **Ellenőrzés:** Anomáliák és eltérések kiszűrése.\n4. **Lezárva:** Bérjegyzék PDF-ek generálása, banki utalási csomag és NAV 08 export.\n\n### 2. Érvényes jogszabályi sarokszámok\n- Minimálbér és garantált bérminimum aktuális összegei.\n- Családi adókedvezmények az eltartottak száma szerint.\n- 25 év alatti fiatalok adókedvezménye és 30 év alatti anyák kedvezménye.",
    "menu_path": "/salaries",
    "tags": [
      "bér",
      "bérszámfejtés",
      "szja",
      "járulék",
      "nav08",
      "minimálbér"
    ],
    "icon": "Users",
    "estimated_read_time": "4 perc",
    "order_num": 1,
    "is_published": true
  },
  {
    "id": "working-time-and-attendance",
    "category_id": "hr",
    "title": "Munkaidő nyilvántartás és jelenléti ív",
    "summary": "Munkavállalói jelenléti ívek, szabadságok, táppénzes napok és műszakok digitális rögzítése.",
    "content": "# Munkaidő és jelenlét\n\nA **Munkaidő** menüpontban a dolgozók napi munkaideje és távollétei adminisztrálhatók a Munka Törvénykönyve előírásainak megfelelően.\n\n### 1. Jelenléti naptár és státuszok\n- **Ledolgozott munkaidő:** Napi ledolgozott órák és túlórák rögzítése.\n- **Fizetett szabadság:** Alap- és pótszabadságok naprakész keretfigyelője.\n- **Táppénz és betegszabadság:** Hatósági igazolások csatolása és betegszabadság napok számlálása.\n- **Kiküldetés és fizetés nélküli távollét.**\n\n### 2. Munkavállalói önkiszolgáló felület (Employee szerepkör)\n- A csak munkaidő rögzítésére jogosult munkatársak ezen az egyetlen dedikált felületen tölthetik ki jelenlétüket.",
    "menu_path": "/working-time",
    "tags": [
      "munkaidő",
      "jelenlét",
      "szabadság",
      "táppénz",
      "jelenléti ív"
    ],
    "icon": "Clock",
    "estimated_read_time": "3 perc",
    "order_num": 2,
    "is_published": true
  },
  {
    "id": "fixed-assets-and-depreciation",
    "category_id": "hr",
    "title": "Tárgyi eszközök nyilvántartása és értékcsökkenés (TENY)",
    "summary": "Eszközök aktiválása, kivezetése, leírási kulcsok és terv szerinti értékcsökkenési elszámolás.",
    "content": "# Tárgyi eszközök nyilvántartása (TENY)\n\nA **TENY** modul a vállalkozás tartós használatú eszközeinek (gépek, gépjárművek, ingatlanok, informatikai eszközök) törzsnyilvántartását végzi.\n\n### 1. Eszköz felvétele és aktiválása\n- Számla alapján közvetlenül aktiválható az új eszköz bruttó értéke, üzembe helyezésének napja és helyszíne.\n- Egyedi azonosító és leltári szám generálása.\n\n### 2. Értékcsökkenési leírási módszerek\n- **Számviteli leírás:** Lineáris leírás a becsült hasznos élettartam alapján.\n- **Társasági adó szerinti leírás:** A Tao törvény szerinti adóalap-módosító kulcsok alkalmazása.\n- Év végi automatikus feladás a főkönyvi naplóba.",
    "menu_path": "/teny",
    "tags": [
      "tárgyi eszköz",
      "teny",
      "értékcsökkenés",
      "leírás",
      "leltár"
    ],
    "icon": "Building2",
    "estimated_read_time": "3 perc",
    "order_num": 3,
    "is_published": true
  },
  {
    "id": "shipments-and-cmr-management",
    "category_id": "shipments",
    "title": "Fuvarlevelek és CMR megbízások nyilvántartása",
    "summary": "Nemzetközi és belföldi fuvarok rögzítése, CMR okmányok, sofőrök és járműszerelvények kezelése.",
    "content": "# Szállítmányozás és fuvarok\n\nA **Fuvarok** menüpont a logisztikai és szállítmányozási tevékenységet végző cégek belső működését támogatja.\n\n### 1. Fuvarmegbízások rögzítése\n- Pozíciószám, feladó és címzett telephelye, felrakás és lerakás dátumai.\n- Jármű rendszáma, vontató és pótkocsi adatai, gépkocsivezető neve.\n- Vállalási díj, devizanem és fizetési feltételek.\n\n### 2. Dokumentumkezelés és CMR\n- CMR fuvarlevelek, menetlevelek és mérlegjegyek digitális csatolása a fuvarhoz.",
    "menu_path": "/shipments",
    "tags": [
      "fuvar",
      "szállítmány",
      "cmr",
      "logisztika",
      "kamion"
    ],
    "icon": "Truck",
    "estimated_read_time": "3 perc",
    "order_num": 1,
    "is_published": true
  },
  {
    "id": "shipment-excel-import-and-matching",
    "category_id": "shipments",
    "title": "Fuvarlevél Excel import és számlapárosítás",
    "summary": "Tömeges fuvarimportálás külső fuvarszoftverekből (pl. Selexped) és fuvarszámlák automatikus párosítása.",
    "content": "# Fuvarlevél import és számlapárosítás\n\nAz **Excel Import** felület lehetővé teszi több száz fuvarmegbízás egyidejű betöltését.\n\n### 1. Fájlformátum és mezőillesztés\n- Excel (.xlsx) vagy CSV sablonfájlok feltöltése.\n- Mezőillesztő varázsló: pozíciószám, partner adószám, nettó fuvardíj és dátumok megfeleltetése.\n\n### 2. Automatikus számla-összerendelés\n- A rendszer az importált fuvarok pozíciószáma alapján automatikusan megkeresi a bejövő és kimenő fuvarszámlákat.\n- Zöld színnel jelöli a hibátlanul egyező tételeket.",
    "menu_path": "/shipments/import",
    "tags": [
      "fuvar import",
      "excel",
      "selexped",
      "párosítás",
      "matching"
    ],
    "icon": "Upload",
    "estimated_read_time": "3 perc",
    "order_num": 2,
    "is_published": true
  },
  {
    "id": "shipment-discrepancies-and-escalation",
    "category_id": "shipments",
    "title": "Fuvardíj eltérések és vitás ügyek eszkalációja",
    "summary": "Eltérések kezelése a megrendelt és számlázott fuvardíjak között, jóváhagyási workflow és reklamációk.",
    "content": "# Fuvar eszkaláció és eltérések\n\nAz **Eszkaláció** nézetben azon tételek jelennek meg, ahol a beérkezett számla és a diszpécser által rögzített fuvardíj között eltérés mutatkozik.\n\n### 1. Eltérések okai\n- Túlsúly vagy állásidő pótdíj.\n- Üzemanyag-felár vagy útdíj különbözet.\n- Téves devizaárfolyam alkalmazása.\n\n### 2. Jóváhagyási folyamat\n- A diszpécser vagy pénzügyi vezető jóváhagyhatja a különbözetet, vagy vitatott státuszba helyezheti a számlát a korrekciós jóváírás megérkezéséig.",
    "menu_path": "/shipments/escalated",
    "tags": [
      "eszkaláció",
      "fuvardíj",
      "eltérés",
      "reklamáció",
      "jóváhagyás"
    ],
    "icon": "RotateCcw",
    "estimated_read_time": "3 perc",
    "order_num": 3,
    "is_published": true
  },
  {
    "id": "nav-online-szamla-sync",
    "category_id": "system",
    "title": "Rendszerintegrációk: NAV Online Számla, Számlázz.hu és email fiók",
    "summary": "Hogyan kösd össze vállalkozásodat a NAV-val, számlázóprogramokkal és állíts be egyedi számlafogadó email címet.",
    "content": "# Rendszerintegrációk\n\nAz **Integrációk** menüpontban konfigurálhatók a külső adatkapcsolatok a bizonylatok automatikus beérkezéséhez.\n\n### 1. NAV Online Számla szinkronizáció\n- Technikai felhasználó azonosító, jelszó, XML aláírókulcs és cserekulcs beállítása.\n- Automatikus óránkénti számlaszinkronizáció kimenő és bejövő irányban, státuszkövetéssel és hibajelzéssel.\n\n### 2. Számlázz.hu Agent integráció\n- Közvetlen API összeköttetés a Számlázz.hu rendszerrel kibocsátott számlák azonnali átvételéhez.\n\n### 3. Cégszintű számlafogadó e-mail alias\n- Minden cég egyedi számlafogadó email címet kap (pl. `cegnev@eaisybill.hu`), amelyre a partnerek közvetlenül küldhetik a számlákat, automatikus feldolgozással.\n\n### 4. Relax könyvelőprogram adatimport\n- Korábbi könyvelési adatok és partnerállományok importálása Relax XML és DMP állományokból.",
    "menu_path": "/integrations",
    "tags": [
      "nav",
      "online számla",
      "számlázz.hu",
      "email alias",
      "relax",
      "integráció"
    ],
    "icon": "Wrench",
    "estimated_read_time": "3 perc",
    "order_num": 1,
    "is_published": true
  },
  {
    "id": "exchange-rates-mnb",
    "category_id": "system",
    "title": "MNB hivatalos devizaárfolyamok és devizás számlák",
    "summary": "A Magyar Nemzeti Bank hivatalos napi devizaárfolyamainak automatikus lekérdezése és árfolyam-nyilvántartás.",
    "content": "# MNB Hivatalos Devizaárfolyamok\n\nAz **Árfolyamok** menüpont biztosítja a devizás számlák jogszabályszerű forintra történő átszámítását.\n\n### 1. Automatikus napi szinkronizáció\n- A rendszer minden munkanapon automatikusan letölti a Magyar Nemzeti Bank (MNB) által 11:00-kor közzétett hivatalos devizaárfolyamokat (EUR, USD, GBP, CHF stb.).\n- A számlák rögzítésekor a teljesítés napján érvényes hivatalos árfolyam automatikusan kitöltésre kerül.\n\n### 2. Egyedi banki árfolyamok\n- Igény esetén a cég egyedi kereskedelmi banki deviza eladási/vételi árfolyama is rögzíthető.",
    "menu_path": "/exchange-rates",
    "tags": [
      "árfolyam",
      "mnb",
      "deviza",
      "eur",
      "usd",
      "forint"
    ],
    "icon": "Landmark",
    "estimated_read_time": "2 perc",
    "order_num": 2,
    "is_published": true
  },
  {
    "id": "company-notes-and-reminders",
    "category_id": "system",
    "title": "Cégjegyzetek és belső emlékeztetők",
    "summary": "Belső emlékeztetők, könyvelési határidők, ügyfélspecifikus szabályok és kétpaneles feljegyzések.",
    "content": "# Jegyzetek és emlékeztetők\n\nA **Jegyzetek** menüpontban a cég pénzügyi és könyvelési csapata oszthat meg egymással fontos információkat.\n\n### 1. Kétpaneles jegyzetkezelő\n- Bal oldalon láthatók a témakörök és címkék, jobb oldalon a rich-text formázott jegyzettartalom.\n- Csatolható adott partnerhez vagy bizonylattípushoz.\n\n### 2. Megosztás és láthatóság\n- A jegyzetek lehetnek magánjellegűek vagy a cég összes pénzügyi felhasználója számára láthatók.",
    "menu_path": "/notes",
    "tags": [
      "jegyzet",
      "emlékeztető",
      "feljegyzés",
      "belső info"
    ],
    "icon": "FileText",
    "estimated_read_time": "2 perc",
    "order_num": 3,
    "is_published": true
  },
  {
    "id": "financial-analytics-and-charts",
    "category_id": "system",
    "title": "Pénzügyi analitika és idősoros kimutatások",
    "summary": "Havi árbevételek, szállítói ráfordítások és bérköltségek grafikonos elemzése, nettó/bruttó nézet és ÁFA bontás.",
    "content": "# Pénzügyi analitika és vizualizáció\n\nAz **Analitika** menüpont a vállalkozás bevételeinek, költségeinek és bérköltségeinek dinamikus idősoros elemzőfelülete.\n\n### 1. Havi trendek és diagramok\n- **Interaktív grafikonok:** Bevételek, kifizetett számlák és bérköltségek havi alakulása terület- és oszlopdiagramokon.\n- **Nettó és bruttó váltókapcsoló:** Egyetlen kattintással válthatsz az ÁFA-val növelt bruttó cash-flow szemlélet és a nettó számviteli szemlélet között.\n\n### 2. ÁFA kulcsonkénti megoszlás\n- A forgalom megoszlása ÁFA kulcsok szerint (27%, 18%, 5%, 0%, AAM), azonnal kimutatva az adóteher koncentrációját.\n\n### 3. Időszaki összehasonlítás\n- Az aktuális hónap eredményei összevethetők az előző hónappal, vagy a bázisév azonos időszakával (YoY összehasonlítás).\n- A devizás bizonylatok automatikusan a teljesítéskori MNB árfolyamon kerülnek konszolidálásra.",
    "menu_path": "/analytics",
    "tags": [
      "analitika",
      "kimutatás",
      "grafikon",
      "idősor",
      "árbevétel",
      "költségek"
    ],
    "icon": "BarChart3",
    "estimated_read_time": "3 perc",
    "order_num": 4,
    "is_published": true
  },
  {
    "id": "company-settings-and-profile",
    "category_id": "system",
    "title": "Cégprofil, bankszámlák és biztonsági beállítások",
    "summary": "Vállalkozás törzsadatai, bankszámlaszámok, csatlakozási kód, csapattagok meghívása és jogosultsági mátrix.",
    "content": "# Cégprofil és beállítások\n\nA **Beállítások** menüpontban szabhatók testre a vállalkozás működési paraméterei.\n\n### 1. Cégadatok és adózási mód\n- Cégnév, székhely, adószám, cégjegyzékszám és ÁFA alanyisági besorolás (VatRegime).\n- Hivatalos bankszámlaszámok rögzítése devizanemmel és IBAN formátummal.\n\n### 2. Csatlakozási kód és meghívók\n- **Egyszeri csatlakozási token:** 10 percig érvényes biztonságos 6 karakteres kód generálása külső könyvelő vagy munkatárs azonnali összekapcsolásához.\n- **Csapattagok meghívása:** Új felhasználók felvétele szerepkörökkel (Admin, Member, Assistant, Viewer, Employee) és moduláris jogosultsági panellel.",
    "menu_path": "/settings",
    "tags": [
      "beállítások",
      "cégprofil",
      "meghívó",
      "bankszámla",
      "felhasználók",
      "jogosultság"
    ],
    "icon": "Wrench",
    "estimated_read_time": "3 perc",
    "order_num": 5,
    "is_published": true
  },
  {
    "id": "tickets-and-support",
    "category_id": "system",
    "title": "Hibajegyek beküldése és felhasználói támogatás",
    "summary": "Hogyan jelents be hibát, küldj képernyőképet és kövesd a fejlesztői csapat visszajelzéseit.",
    "content": "# Hibajegyek és terméktámogatás\n\nHa kérdésed van a rendszer működésével kapcsolatban vagy észrevételt tennél, a **Hibajegyek** menüpontban közvetlenül kapcsolatba léphetsz a fejlesztőkkel.\n\n### 1. Hibajegy beküldése\n- A képernyő jobb alsó sarkában található funkciógombra kattintva válaszd a **Hibabejelentés** lehetőséget.\n- Add meg a tárgyat és a hiba leírását.\n- Képernyőképet vagy dokumentumot is csatolhatsz a bejelentéshez.\n\n### 2. Állapotok követése\n- A Hibajegyek oldalon valós időben látod a bejelentésed státuszát: *Új*, *Folyamatban*, *Megválaszolva*, vagy *Lezárva*.",
    "menu_path": "/tickets",
    "tags": [
      "hibajegy",
      "support",
      "visszajelzés",
      "hiba",
      "támogatás"
    ],
    "icon": "TicketCheck",
    "estimated_read_time": "2 perc",
    "order_num": 6,
    "is_published": true
  },
  {
    "id": "eaisybooks-portfolio-overview",
    "category_id": "books_portfolio",
    "title": "Könyvelőirodai portfólió és ügyfél mátrix",
    "summary": "Az iroda által kezelt cégek áttekintése: Grid, Lista és Kanban nézetek, zárási státuszok és könyvelői kiosztás.",
    "content": "# eaisyBooks Irodai Portfólió\n\nAz eaisyBooks **Portfólió** felülete a több vállalkozás könyvelését végző szakemberek központi irányítópultja.\n\n### 1. Megjelenítési nézetek\n- **Grid nézet:** Kártyás elrendezés cégmérettel, adózási formával és függő tételek számával.\n- **Lista nézet:** Kompakt táblázat gyorskeresővel és rendezéssel.\n- **Kanban nézet:** Havi könyvelési folyamat fázisai (Bizonylatbekérés, Feldolgozás alatt, Adóellenőrzés, Zárva).\n\n### 2. Kiosztás és felelős könyvelő\n- Minden ügyfélhez kijelölhető a felelős könyvelő és a felülvizsgáló senior kolléga.",
    "menu_path": "/eaisybooks",
    "tags": [
      "eaisybooks",
      "portfólió",
      "ügyfelek",
      "kanban",
      "iroda",
      "könyvelőiroda"
    ],
    "icon": "Briefcase",
    "estimated_read_time": "3 perc",
    "order_num": 1,
    "is_published": true
  },
  {
    "id": "eaisybooks-client-management",
    "category_id": "books_portfolio",
    "title": "Kliensek és ügyféltörzs kezelése",
    "summary": "Ügyféltörzs áttekintése, új cég felvétele meghívó kóddal, könyvelői meghatalmazások és adatlapok.",
    "content": "# Ügyféltörzs és kliensek kezelése\n\nAz eaisyBooks lehetőséget nyújt új ügyfelek villámgyors felvételére és profiljaik karbantartására.\n\n### 1. Új ügyfél felvétele\n- **Meghívó kód:** Ha az ügyfél már használja az eaisyBill-t, egyedi 8 jegyű meghívó kóddal összekapcsolható a könyvelőirodával.\n- **Manuális létrehozás:** Cégadatok rögzítése a NAV törzsadatok lekérdezésével.\n\n### 2. Ügyfél adatlap\n- Adózási forma (TAO, KIVA, Átalányadó, KATA), ÁFA gyakoriság (havi, negyedéves, éves).\n- Kapcsolattartók, bankszámlák és könyvelési feljegyzések.",
    "menu_path": "/eaisybooks/clients",
    "tags": [
      "kliens",
      "ügyféltörzs",
      "meghívó kód",
      "cég felvétel",
      "könyvelő"
    ],
    "icon": "Building2",
    "estimated_read_time": "3 perc",
    "order_num": 2,
    "is_published": true
  },
  {
    "id": "eaisybooks-missing-invoices-hub",
    "category_id": "books_portfolio",
    "title": "Hiányzó számlák irodai kezelése és felszólító e-mailek",
    "summary": "Banki mozgásokhoz hiányzó bizonylatok felderítése és automatikus felszólító email küldése az ügyfeleknek.",
    "content": "# Hiányzó számlák irodai központja\n\nA **Hiányzó számlák** felület automatikusan felderíti azokat a banki kifizetéseket és jóváírásokat, amelyekhez nem található számla.\n\n### 1. Konszolidált hiánylista\n- Az iroda egyetlen táblázatban látja az összes ügyfél hiányzó bizonylatait összeg és dátum szerint.\n\n### 2. Sablon alapú email bekérés\n- Egyetlen kattintással előnézhető és kiküldhető az egyedi bizonylatbekérő e-mail, amely tartalmazza a hiányzó tételek listáját és egy közvetlen feltöltési linket.",
    "menu_path": "/eaisybooks/missing-invoices",
    "tags": [
      "hiányzó számla",
      "bekérés",
      "felszólítás",
      "email sablon",
      "egyeztetés"
    ],
    "icon": "FileText",
    "estimated_read_time": "3 perc",
    "order_num": 3,
    "is_published": true
  },
  {
    "id": "eaisybooks-tax-calendar-deadlines",
    "category_id": "books_portfolio",
    "title": "Hatósági adónaptár és határidő figyelő",
    "summary": "NAV, HIPA és KSH bevallási és befizetési határidők aggregált naptára az összes kezelt ügyfélre kiterjedően.",
    "content": "# Irodai Adónaptár\n\nAz **Adónaptár** megelőzi a késedelmi pótlékokat és mulasztási bírságokat a közelgő határidők figyelésével.\n\n### 1. Aggregált határidő lista\n- 12-e: Havi bérbevallás (NAV 08) és járulékok befizetése.\n- 20-a: Havi és negyedéves ÁFA bevallás (NAV 65).\n- Május 31: Éves társasági adó és számviteli beszámoló határideje.\n\n### 2. Státuszkövetés\n- A könyvelők pipálhatják az elkészült, jóváhagyott és benyújtott bevallásokat cég szinten.",
    "menu_path": "/eaisybooks/tax-calendar",
    "tags": [
      "adónaptár",
      "határidő",
      "nav határidő",
      "bevallás",
      "naptár"
    ],
    "icon": "Calendar",
    "estimated_read_time": "3 perc",
    "order_num": 4,
    "is_published": true
  },
  {
    "id": "eaisybooks-reports-and-ai-anomalies",
    "category_id": "books_portfolio",
    "title": "Vezetői riportok, havi zárási kimutatások és AI anomália elemzés",
    "summary": "Összesített havi kimutatások, ÁFA- és költségelemzések, partner forgalmi riportok, valamint a mesterséges intelligencia által vezérelt bérszámfejtési és számla anomália motor.",
    "content": "# Vezetői Riportok és AI Anomália Elemzés az eaisyBooks Rendszerben\n\nAz eaisyBooks **Riportok** és **AI Anomália Elemzés** felületei az irodavezetők és senior könyvelők számára nyújtanak mélyreható statisztikai rálátást a teljes könyvelési portfólióra, az egyes megbízók gazdálkodására, valamint a számfejtési hibák azonnali kiszűrésére.\n\n### 1. Elérhető Riport Típusok és Exportálási Lehetőségek\nA Riportkatalógus a következő előre definiált szakmai kimutatásokat biztosítja:\n1. **Havi összesítő riport:** Bejövő és kimenő számlák konszolidált forgalma, nettó, ÁFA és bruttó összegek, valamint fizetési státuszok ügyfelenként.\n2. **ÁFA analitika:** Kulcsonkénti ÁFA bontás (27%, 18%, 5%, 0%, AAM), fizetendő és levonható adó egyenlege, valamint az arányosítás alá eső tételek ellenőrzése.\n3. **Költségkimutatás:** Számlaosztályok és költséghelyek szerinti aggregált kiadási struktúra, kiugró tételek automatikus jelölésével.\n4. **Cash flow és likviditási riport:** Pénzforgalmi szemléletű egyenlegek, esedékességi korosítás és banki likviditási előrejelzés.\n5. **Partner forgalmi kimutatás:** Legnagyobb beszállítók és vevők forgalma, koncentrációs kockázatok és kapcsolt vállalkozások forgalmi adatai.\n6. **Hiányzó számlák kimutatása:** Bekérési hatékonyság, függő bizonylatok statisztikája és partnerek fizetési/beküldési fegyelme.\n\nValamennyi kimutatás egyaránt lekérhető gyors képernyős előnézetben, részletes adatsorokkal kiegészített **Excel / CSV** táblázatként, vagy nyomdakész, cégfejléces **PDF** dokumentumként.\n\n### 2. AI Anomália Motor a Bérszámfejtésben és Könyvelésben\nAz intelligens anomália-detektáló motor automatikusan végigellenőrzi az összes rögzített adatot, és figyelmeztet a potenciális adókockázatokra:\n- **Minimálbér és garantált bérminimum vizsgálat:** Figyelmeztet, ha a havi alapbér vagy a számított órabér nem éri el a jogszabályi minimumot (a FEOR kód szakképzettségi követelményének figyelembevételével).\n- **Heti munkaidő és biztosítási jogviszony:** Eltérések detektálása a heti 40 órás teljes munkaidő, a részmunkaidő, valamint a biztosítási státusz között.\n- **Szabadságkeret túllépés:** Éves alapszabadság, pótszabadságok és a már kivett napok automatikus egyenleg-ellenőrzése.\n- **Havi bérkilengések és fluktuáció:** Kiugró, 30%-ot meghaladó havi bérváltozások, indokolatlan prémiumok vagy hirtelen alapbércsökkenések jelzése a zárás előtt.\n\n### 3. Jogosultsági Szabályok és Bizalmas Adatkezelés\nA Riportok modul és az AI Anomália központ elérése szigorúan korlátozott: kizárólag az **Iroda Admin** és a **Senior Könyvelő** szerepkörrel rendelkező munkatársak férhetnek hozzá.",
    "menu_path": "/eaisybooks/reports",
    "tags": [
      "riportok",
      "anomália",
      "elemzés",
      "statisztika",
      "ai",
      "bérszámfejtés",
      "zárás"
    ],
    "icon": "BarChart3",
    "estimated_read_time": "4 perc",
    "order_num": 5,
    "is_published": true
  },
  {
    "id": "eaisybooks-onboarding-and-new-client",
    "category_id": "books_portfolio",
    "title": "Irodai onboarding folyamat és új ügyfél felvételi varázsló",
    "summary": "Új könyvelőirodai regisztráció beállítása, mérföldkövek követése, valamint az új ügyfelek 3 lépéses felvétele AI cégleírás generálással és integrációval.",
    "content": "# Irodai Onboarding és Új Ügyfél Felvétel\n\nAz eaisyBooks kialakításának köszönhetően az új könyvelőirodák rendkívül gyorsan, zökkenőmentesen állhatnak át a digitális munkavégzésre, miközben az új ügyfelek beköltöztetése automatizált varázslókon keresztül történik.\n\n### 1. Irodai Onboarding Vezérlőpult (5 Mérföldkő)\nAz új könyvelőiroda bevezetése során az Onboarding felület lépésről lépésre vezeti végig az irodavezetőt a kritikus konfigurációkon:\n1. **Iroda alapadatok:** Könyvelőiroda hivatalos neve, adószáma, székhelye és kapcsolattartói elérhetőségei.\n2. **Munkatársak és szerepkörök:** Könyvelők, bérszámfejtők és asszisztensek meghívása email alapján, megfelelő jogosultsági szintekkel.\n3. **Első ügyfél beköltöztetése:** Az első megbízó cég adatainak rögzítése az új kliens varázsló segítségével.\n4. **Cégkapu és NAV kapcsolat:** Hatósági kulcsok és technikai felhasználók élesítése a közvetlen szinkronizációhoz.\n5. **Sablonok és automatizmusok:** Alapértelmezett számlabekérő emailek, bérjegyzék kísérőlevelek és emlékeztetők aktiválása.\n\n### 2. Új Ügyfél Felvételi Varázsló (3 Lépéses Folyamat)\nÚj megbízó cég hozzáadásakor a rendszer egy dedikált varázslón kíséri végig a könyvelőt:\n- **1. lépés — Cégadatok és AI profilalkotás:** Cégnév, 8-1-2 formátumú adószám, székhely és elsődleges TEÁOR kód megadása. Az automatikus AI cégleírás generáló funkció a megadott TEÁOR szám és cégnév alapján elkészíti a vállalkozás tevékenységi profilját.\n- **2. lépés — Szoftveres integrációk kiválasztása:** Meglévő könyvelőszoftver integrációjának beállítása (RLB60, Novitax, vagy egyéb egyedi adatcsere formátumok), valamint NAV Online Számla technikai felhasználó megadása.\n- **3. lépés — Ügyfélemeil és meghívó kód kibocsátása:** A rendszer előállít egy egyedi, 8 karakteres ügyfél meghívó kódot, amellyel a megbízó ügyfél regisztrálhat az eaisyBill számlakezelő felületére.",
    "menu_path": "/eaisybooks/onboarding",
    "tags": [
      "onboarding",
      "új-ügyfél",
      "varázsló",
      "teáor",
      "meghívó-kód",
      "bevezetés",
      "iroda"
    ],
    "icon": "Rocket",
    "estimated_read_time": "4 perc",
    "order_num": 6,
    "is_published": true
  },
  {
    "id": "eaisybooks-ev-and-cashbook",
    "category_id": "books_modules",
    "title": "Egyéni vállalkozói (EV) könyvvitel és pénztárkönyv",
    "summary": "Átalányadózó és tételes költségelszámoló egyéni vállalkozók nyilvántartása, pénztárkönyvi zárás és határidők.",
    "content": "# Egyéni vállalkozók (EV) könyvelése\n\nAz egyéni vállalkozók számára kialakított speciális modul kezeli az átalányadózás és a tételes költségelszámolás sajátosságait.\n\n### 1. Átalányadó bevételi nyilvántartás\n- Valós idejű bevételi keretfigyelő az éves átalányadózási és alanyi adómentes (AAM) keretekhez.\n- Automatikus költséghányad (40%, 80%, 90%) alkalmazása a vállalkozó TEÁOR és ÖVTJ tevékenységi köre alapján.\n- Negyedéves adó- és járulékkalkuláció a személyi jövedelemadó és szocho bevallások előkészítéséhez.\n\n### 2. Pénztárkönyv és részletező nyilvántartások\n- Pénzforgalmi szemléletű bevételek és elszámolható kiadások rögzítése.\n- Vevői és szállítói kötelezettségek nyilvántartása és időszaki pénztárkönyvi zárása.",
    "menu_path": "/eaisybooks/ev",
    "tags": [
      "ev",
      "egyéni vállalkozó",
      "pénztárkönyv",
      "átalányadó",
      "bevétel"
    ],
    "icon": "Coins",
    "estimated_read_time": "4 perc",
    "order_num": 1,
    "is_published": true
  },
  {
    "id": "eaisybooks-ev-tax-optimization",
    "category_id": "books_modules",
    "title": "EV adóoptimalizálás és átalányadó kalkulátor",
    "summary": "Összehasonlító szimuláció: Átalányadó vs. Vállalkozói SZJA (VSZJA) vs. Főállású KATA adóterhelés.",
    "content": "# EV Adóoptimalizáció és kalkulátorok\n\nA könyvelőirodák leggyakoribb tanácsadási feladata az egyéni vállalkozó számára a legkedvezőbb adózási forma kiválasztása.\n\n### 1. Összehasonlító szimuláció\n- A várható éves árbevétel és igazolt költségek megadásával a kalkulátor párhuzamosan kiszámolja:\n  - Fizetendő SZJA, TB járulék és SZOCHO összege.\n  - HIPA (Helyi iparűzési adó) egyszerűsített és tételes összege.\n  - Kamarai hozzájárulás és nettó jövedelem.\n\n### 2. Évközi döntéstámogatás\n- Figyelmeztetés a keretösszegek (pl. AAM 12 millió Ft) átlépésének közeledtére.",
    "menu_path": "/eaisybooks/ev",
    "tags": [
      "adóoptimalizálás",
      "kalkulátor",
      "vszja",
      "kata",
      "átalányadó",
      "adóterhelés"
    ],
    "icon": "Calculator",
    "estimated_read_time": "3 perc",
    "order_num": 2,
    "is_published": true
  },
  {
    "id": "eaisybooks-tao-kiva-planner",
    "category_id": "books_modules",
    "title": "TAO és KIVA tervező és év végi zárási ellenőrzőlista",
    "summary": "Társasági adó és kisvállalati adó kalkuláció, adónem összehasonlítás és adóalap korrekciók.",
    "content": "# TAO és KIVA adótervező modul\n\nA társasági adó (TAO) és a kisvállalati adó (KIVA) közötti választás és az év végi adóalap megállapítás kulcsfontosságú pénzügyi döntés.\n\n### 1. Adónem összehasonlítás\n- A rendszer a lekönyvelt eredménykimutatás és a bérköltségek alapján szimulálja mindkét adónem várható fizetési kötelezettségét.\n- Grafikonos és táblázatos döntéstámogatás a kedvezőbb adózási forma kiválasztásához.\n\n### 2. Év végi zárási ellenőrzőlista\n- Lépésről lépésre végigvezet a zárási folyamatokon: leltár egyeztetés, időbeli elhatárolások, értékcsökkenési leírások és adóalap módosító tételek áttekintése.",
    "menu_path": "/eaisybooks/tao",
    "tags": [
      "tao",
      "kiva",
      "adótervező",
      "zárás",
      "ellenőrzőlista"
    ],
    "icon": "Landmark",
    "estimated_read_time": "4 perc",
    "order_num": 3,
    "is_published": true
  },
  {
    "id": "eaisybooks-payroll-and-xml-reconstruction",
    "category_id": "books_modules",
    "title": "Irodai bérszámfejtés és 08-as ÁNYK XML rekonstrukció",
    "summary": "Többhavi NAV 08 ÁNYK XML kötegelt visszafejtése, dolgozói jogviszonyok és bérszámfejtési rekonstrukció.",
    "content": "# Bérszámfejtés és XML rekonstrukció\n\nAz eaisyBooks speciális funkciója lehetővé teszi egy új ügyfél korábbi béradatainak perceken belüli importálását.\n\n### 1. NAV 08 ÁNYK XML visszafejtés\n- Töltsd fel az ügyfél korábbi könyvelője által benyújtott 08-as havi XML bevallásokat.\n- A rendszer automatikusan felépíti a dolgozói törzset, azonosítja a jogviszonykódokat, a bruttó béreket és az érvényesített adókedvezményeket.\n\n### 2. Kötegelt havi számfejtés\n- Több cég bérszámfejtése párhuzamosan, automatikus bérjegyzék e-mail generálással.",
    "menu_path": "/eaisybooks/payroll",
    "tags": [
      "bérszámfejtés",
      "nav 08",
      "xml rekonstrukció",
      "jogviszony",
      "bérjegyzék"
    ],
    "icon": "Users",
    "estimated_read_time": "4 perc",
    "order_num": 4,
    "is_published": true
  },
  {
    "id": "eaisybooks-ev-lifecycle-and-registers",
    "category_id": "books_modules",
    "title": "Egyéni vállalkozás (EV) életciklus, nyilvántartások és értékhatár monitor",
    "summary": "Alanyi adómentesség és átalányadó keretek monitorozása, kötelező nyilvántartások vezetése (útnyilvántartás, beruházások) és szüneteltetés kezelése.",
    "content": "# Egyéni Vállalkozás (EV) Életciklus és Nyilvántartások\n\nAz egyéni vállalkozások könyvelése speciális szabályrendszert követ. Az eaisyBooks EV modulja nemcsak a bevételek és kiadások rögzítését biztosítja, hanem folyamatosan felügyeli a jogszabályi értékhatárokat és támogatja az egyéni vállalkozás teljes életciklusát.\n\n### 1. Törvényi Értékhatárok Monitorozása (Threshold Monitor)\nA rendszer valós időben számítja és vizualizálja a legfontosabb adózási plafonokat:\n- **Alanyi adómentesség (AAM) keret:** Az évi 12 000 000 Ft-os értékhatár folyamatos figyelése. Év közben induló vállalkozás esetén a rendszer automatikusan naptári napra arányosítja a keretet.\n- **Átalányadó bevételi plafon:** Az éves minimálbér tízszerese (általános tevékenységnél), illetve ötvenszerese (kizárólag kiskereskedelmi tevékenységet folytatóknál).\n- **Adómentes jövedelmi sáv:** Az átalányadózók számára biztosított, éves minimálbér felét kitevő adómentes jövedelemkeret felhasználtságának nyomon követése.\n- **Gépjármű és cégautóadó mentesség:** Cégautóadó vizsgálat útnyilvántartás vagy havi 500 km-es átalányköltség elszámolás esetén.\n\n### 2. Kötelező EV Szakmai Nyilvántartások\nA jogszabály által előírt analitikus nyilvántartások közvetlenül kezelhetők a felületről:\n1. **Pénztárkönyv és részletező nyilvántartások:** Pénzforgalmi bevételek, készpénzes és banki mozgások tételes vezetése, a NAV Online Számla adataival szinkronizálva.\n2. **Beruházási és tárgyi eszköz nyilvántartás:** Értékcsökkenési leírások számítása (számviteli és Szja törvény szerinti kulcsokkal), 200 000 Ft alatti kisértékű eszközök azonnali elszámolása.\n3. **Gépjármű-használati nyilvántartás:** Havi útnyilvántartások rögzítése, kiküldetési rendelvények nyilvántartása, üzemanyagnorma szerinti költségkalkuláció.\n\n### 3. EV Életciklus Kezelése: Szüneteltetés és Megszűnés\nAz egyéni vállalkozás státuszváltozásai automatikus zárási és nyitási feladatokat vonnak maguk után:\n- **Szüneteltetés bejelentése:** A Webes Ügysegéden tett bejelentést követően a rendszer rögzíti a szünetelés kezdő napját (minimum 1 hónap, maximum 2 év).\n- **Záró feladatok szüneteléskor:** Az aktív időszakra vonatkozó havi 58-as járulékbevallás elkészítése, a függő követelések és tartozások felmérése, valamint a minimális járulékfizetési kötelezettség felfüggesztése.\n- **Reaktiválás vagy végleges megszüntetés:** Szünetelés utáni újrainduláskor a keretösszegek időarányos újraszámítása, megszüntetés esetén a végleges Szja bevallás előkészítése.",
    "menu_path": "/eaisybooks/ev/thresholds",
    "tags": [
      "ev",
      "átalányadó",
      "értékhatár",
      "aam",
      "szüneteltetés",
      "útnyilvántartás",
      "pénztárkönyv"
    ],
    "icon": "ClipboardList",
    "estimated_read_time": "4 perc",
    "order_num": 5,
    "is_published": true
  },
  {
    "id": "eaisybooks-payroll-documents-and-payslips",
    "category_id": "books_modules",
    "title": "Dolgozói bérjegyzékek, kifizetési jegyzékek és kilépő dokumentációk",
    "summary": "Havi bérlapok kötegelt generálása, jelszóval védett PDF export, banki utalási állományok, valamint a munkaviszony megszűnésekor kiadandó kilépő papírok.",
    "content": "# Dolgozói Dokumentumok, Bérjegyzékek és Kilépő Papírok\n\nA bérszámfejtési folyamat végeredményeként az eaisyBooks automatikusan előállítja a munkavállalók felé átadandó hivatalos elszámolásokat és a munkaviszony változásaival kapcsolatos kötelező okiratokat.\n\n### 1. Havi Bérjegyzékek (Bérlapok) Generálása és Átadása\nA havi bérszámfejtési ciklus lezárását követően elérhetővé válnak az egyéni fizetési jegyzékek:\n- **Kötegelt bérlap generálás:** Egyetlen kattintással előállítható a cég összes dolgozójának havi bérjegyzéke cégfejléces, hivatalos formátumban.\n- **Jelszóval védett PDF export:** A személyes adatok védelme érdekében a bérlapok titkosított, jelszóval védett PDF formátumban tölthetők le.\n- **e-Bérjegyzék munkavállalói portál:** Ha a munkavállaló rendelkezik felhasználói fiókkal, saját felületén digitálisan megtekintheti és letöltheti bérjegyzékeit, amelyről a rendszer igazolt átvételi naplót vezet.\n\n### 2. Banki Kifizetési Jegyzék és Utalási Állomány\nA nettó bérek és a levont köztartozások gyors kifizetéséhez a rendszer közvetlen exportokat készít:\n- **Nettó bérek utalási listája:** Dolgozónkénti bankszámlaszámok, IBAN azonosítók és utalandó összegek tételes jegyzéke.\n- **GIRO kötegelt banki fájl:** Szabványos GIRO és SEPA utalási állomány a vállalati netbankba történő közvetlen beolvasáshoz.\n- **Levonások és letiltások kezelése:** Gyermektartásdíjak, végrehajtói letiltások és egyéb munkabérből levont összegek elkülönített kifizetési listája a végrehajtói letéti számlák felé.\n\n### 3. Kilépő Munkavállalói Dokumentációk\nMunkaviszony megszűnése vagy megszüntetése esetén a Kilépő Varázsló azonnal kiállítja a Munka Törvénykönyve által előírt igazolásokat:\n1. **Jövedelemigazolás az egészségbiztosítási ellátásokhoz:** Igazolás a táppénz, CSED, GYED alapjául szolgáló jövedelmekről.\n2. **Adatlap a személyi jövedelemadó levonásáról (Adatlap 2026):** Az év közben megszerzett jövedelemről és a levont adóelőlegekről.\n3. **Munkáltatói igazolás az álláskeresési járadék megállapításához:** Ledolgozott napok, jogviszony időtartama és átlagbér feltüntetésével.\n4. **Igazolólap a bírósági végrehajtói letiltásokról:** Fennálló vagy lezárt munkabér-letiltások hatósági igazolása.",
    "menu_path": "/eaisybooks/payroll/documents",
    "tags": [
      "bérjegyzék",
      "bérlap",
      "kifizetés",
      "giro",
      "kilépő-papírok",
      "adatlap",
      "munkaügy"
    ],
    "icon": "FileText",
    "estimated_read_time": "4 perc",
    "order_num": 6,
    "is_published": true
  },
  {
    "id": "eaisybooks-cegkapu-and-representation",
    "category_id": "books_admin",
    "title": "Cégkapu / KÜNY tárhely szinkronizáció és EGYKE képviselet",
    "summary": "Hivatalos elektronikus tárhely üzenetek, határozatok és meghatalmazások nyomon követése.",
    "content": "# Cégkapu és KÜNY tárhely kezelés\n\nA könyvelőirodák számára elengedhetetlen a hatósági megkeresések és határozatok határidőben történő feldolgozása.\n\n### 1. Tárhely üzenetek automatikus érkeztetése\n- A rendszer figyeli az ügyfelek Cégkapu és KÜNY tárhelyére érkező hivatalos értesítéseket (NAV, Önkormányzat, KSH).\n- Letölti az igazolásokat, felbontja a csatolmányokat és archiválja a dokumentumokat.\n\n### 2. EGYKE képviseleti nyilvántartás\n- Adóhatósági meghatalmazások érvényességének, típusának és lejárati dátumainak nyilvántartása.\n- Figyelmeztetés a megújításra váró képviseleti jogosultságokra.",
    "menu_path": "/eaisybooks/cegkapu",
    "tags": [
      "cégkapu",
      "küny",
      "tárhely",
      "egyke",
      "képviselet",
      "hatóság"
    ],
    "icon": "Shield",
    "estimated_read_time": "3 perc",
    "order_num": 1,
    "is_published": true
  },
  {
    "id": "eaisybooks-ai-assistant-chat",
    "category_id": "books_admin",
    "title": "eaisyBooks AI Asszisztens és szakmai segítség",
    "summary": "Számviteli, bérszámfejtési és adózási kérdések gyors tisztázása a beépített AI szakértővel.",
    "content": "# eaisyBooks AI Asszisztens\n\nAz eaisyBooks beépített mesterséges intelligencia asszisztense közvetlen szakmai támogatást nyújt a könyvelők és pénzügyi szakemberek mindennapi munkájában.\n\n### 1. Mire használható az AI Asszisztens?\n- **Jogszabályi kérdések:** A Munka Törvénykönyve, Szja, Tbj, Szocho és Áfa szabályok gyors értelmezése.\n- **Bérszámfejtési segítség:** Családi kedvezmények, eltartottak és 25 év alattiak kedvezményének szabályai.\n- **KIVA vs TAO döntéstámogatás:** Adózási szempontok és határidők áttekintése.\n\n### 2. Lebegő elérés és gyorsműveletek\n- A képernyő jobb alsó sarkában található funkciógombbal bármikor előhívható az asszisztens.\n- A leggyakoribb témákhoz előre felkészített gyorsműveleti kártyák állnak rendelkezésre.",
    "menu_path": "/eaisybooks/ai-assistant",
    "tags": [
      "ai",
      "asszisztens",
      "chat",
      "számvitel",
      "szakértő",
      "jogszabály"
    ],
    "icon": "Bot",
    "estimated_read_time": "3 perc",
    "order_num": 2,
    "is_published": true
  },
  {
    "id": "eaisybooks-approval-queue-and-alerts",
    "category_id": "books_admin",
    "title": "Jóváhagyási várólista és riasztási központ",
    "summary": "Ügyfelek által feltöltött számlák könyvelői jóváhagyása és rendszerszintű kritikus riasztások.",
    "content": "# Jóváhagyási sor és Riasztások\n\nA könyvelőirodai munkafolyamat ellenőrzési pontjait a **Jóváhagyási sor** és a **Riasztások** modulok biztosítják.\n\n### 1. Jóváhagyási sor (Approval Queue)\n- Az ügyfelek által feltöltött bizonylatok áttekintése a könyvelésbe történő végleges bejegyzés előtt.\n- Elfogadás, elutasítás hiánypótlási kéréssel vagy módosítási javaslat.\n\n### 2. Riasztási központ\n- Figyelmeztetések érvénytelen adószámú partnerekre, sikertelen NAV számlaszinkronra vagy közeledő adózási határidőkre.",
    "menu_path": "/eaisybooks/approval-queue",
    "tags": [
      "jóváhagyás",
      "sor",
      "riasztás",
      "anomália",
      "ellenőrzés"
    ],
    "icon": "TicketCheck",
    "estimated_read_time": "3 perc",
    "order_num": 3,
    "is_published": true
  },
  {
    "id": "eaisybooks-office-settings-and-templates",
    "category_id": "books_admin",
    "title": "Irodai könyvelők, szerepkörök és sablonok",
    "summary": "Könyvelőirodai csapattagok, senior felülvizsgálók, jogosultsági mátrix és hivatalos dokumentumsablonok.",
    "content": "# Irodai beállítások és adminisztráció\n\nAz **Irodai Beállítások** menüpontban a könyvelőiroda vezetője szabhatja testre a belső folyamatokat.\n\n### 1. Könyvelői jogosultságok\n- Könyvelők, bérszámfejtők és asszisztensek szerepkörei.\n- Ügyfél-hozzárendelések és felelősségi körök meghatározása.\n\n### 2. Sablonok és jogszabályi paraméterek\n- Értesítő levélsablonok, szerződésminták, jogviszonykódok és adómértékek központi beállítása.",
    "menu_path": "/eaisybooks/settings",
    "tags": [
      "iroda beállítás",
      "könyvelők",
      "jogosultság",
      "sablonok",
      "adminisztráció"
    ],
    "icon": "Wrench",
    "estimated_read_time": "3 perc",
    "order_num": 4,
    "is_published": true
  },
  {
    "id": "eaisybooks-accounting-prompts-and-rules",
    "category_id": "books_admin",
    "title": "Intelligens könyvelési szabályok és mesterséges intelligencia promptok testreszabása",
    "summary": "Cégenként testreszabható intelligens kontírozási és bizonylat-felismerési szabályok: licencek, kisértékű eszközök, üzemanyag és szakértői díjak automatizálása.",
    "content": "# Intelligens Könyvelési Szabályok és Promptok Kezelése\n\nAz eaisyBooks platform egyik legfejlettebb automatizációs eszköze a **Könyvelési Szabályok (Prompts)** felülete, ahol a könyvelők természetes nyelven és logikai feltételekkel határozhatják meg, hogyan dolgozza fel a mesterséges intelligencia az egyes bizonylatokat és tranzakciókat.\n\n### 1. Hogyan Működnek az Intelligens Szabályok?\nAmikor egy számla érkezik az OCR feldolgozóba vagy egy banki tranzakció kerül beolvasásra, az AI feldolgozó motor először a céghez rendelt aktív szabályokat futtatja le:\n- Minden szabály egyedi névvel, célterülettel (költség, eszköz, szolgáltatás) és pontos utasítással rendelkezik.\n- A szabályok prioritási sorrendben értékelődnek ki, felülbírálva az általános alapértelmezett gépi kontírozást.\n- Bármely szabály egyetlen kattintással ki- és bekapcsolható anélkül, hogy a korábbi könyvelési tételek módosulnának.\n\n### 2. Előre Beépített Szabálysablonok\nA felületen azonnal aktiválhatók a leggyakrabban alkalmazott magyar számviteli minták:\n1. **Szoftver licenc előfizetések:** Minden olyan bejövő tétel, amely a szoftver, licenc vagy előfizetés kifejezést tartalmazza (pl. Slack, Adobe, Zoom, Google Workspace), automatikusan az **529-es Egyéb igénybevett szolgáltatások** főkönyvi számlára kerül.\n2. **Kisértékű tárgyi eszközök értékhatára:** Ha a beszerzett tétel informatikai vagy irodai eszköz, és a bruttó összege nem éri el a 100 000 Ft-ot, a rendszer közvetlenül az **511-es Anyagköltség** közé könyveli beruházási aktiválás helyett.\n3. **MOL és üzemanyag beszerzések:** Minden ismert üzemanyagtöltő állomásról (MOL, OMV, Shell, Orlen) érkező számlát automatikusan az **513-as Üzemanyagköltség** számlára irányít.\n4. **Könyvvizsgálati és jogi díjak:** Ügyvédi megbízási díjak, szakértői költségek és könyvelési számlák esetén az automatikus kontír az **522-es Könyvvizsgálati, jogi és szakértői díjak** számlaosztály.\n\n### 3. Új Egyedi Szabályok Felvétele és Tesztelése\nA könyvelőirodák bármikor létrehozhatnak saját, cégspecifikus szabályokat, amelyek mentés előtt tesztelhetők korábbi számlák bizonylatadatain.",
    "menu_path": "/eaisybooks/prompts",
    "tags": [
      "promptok",
      "szabályok",
      "kontírozás",
      "ai",
      "automatizáció",
      "számlatükör",
      "beállítások"
    ],
    "icon": "Brain",
    "estimated_read_time": "4 perc",
    "order_num": 5,
    "is_published": true
  },
  {
    "id": "eaisybooks-audit-security-and-gdpr",
    "category_id": "books_admin",
    "title": "Irodai audit napló, adatvédelmi biztonság és GDPR megfelelőség",
    "summary": "Könyvelői tevékenység teljes körű időbélyegzett naplózása, IP címek követése, GDPR adatkezelési szabályzatok és 8 éves törvényi adatmegőrzési protokollok.",
    "content": "# Irodai Audit Napló, Biztonság és GDPR Megfelelőség\n\nA könyvelőirodák számára kiemelten fontos a kezelt ügyféladatok bizalmassága, sérthetetlensége és a hatósági elszámoltathatóság. Az eaisyBooks zárt biztonsági architektúrával és részletes audit naplózással garantálja a jogszabályi megfelelést.\n\n### 1. Részletes Irodai Audit Napló (Audit Trail)\nAz Audit Napló felületen az irodavezetők és kijelölt auditorok valós időben követhetik a rendszerben történt összes felhasználói eseményt:\n- **Rögzített eseménytípusok:** `login`, `create`, `update`, `delete`, `submit`, `export`, `approve`, `reject`, `send_email`.\n- **Audit metaadatok:** Minden bejegyzés tartalmazza a végrehajtó munkatárs email címét, az érintett megbízó cég azonosítóját, az entitás típusát, az IP címet, valamint a módosítás előtti és utáni állapotot.\n\n### 2. GDPR Megfelelőség és Jogosultságkezelés\nAz Európai Unió Általános Adatvédelmi Rendeletének (GDPR) megfelelően a rendszer szigorú garanciákat biztosít:\n1. **Szerepkör-alapú hozzáférés-szeparáció:** Iroda Admin (`iroda_admin`), Senior Könyvelő (`senior_könyvelő`), Könyvelő (`könyvelő`) és Asszisztens szerepkörök szerinti szigorú adat- és ügyfélelhatárolás.\n2. **Hozzájárulási és Süti Kezelés:** A felület beépített GDPR és süti hozzájárulási modullal rendelkezik, amely naplózza a felhasználói elfogadásokat.\n3. **Adatkezelési és Törlési Kérelmek:** Munkavállalói személyes adatok kezelése és törlési kérelmei, szigorúan összehangolva a Számviteli törvény szerinti 8 éves kötelező bizonylat-megőrzési idővel.",
    "menu_path": "/eaisybooks/admin/audit",
    "tags": [
      "audit",
      "biztonság",
      "gdpr",
      "napló",
      "jogosultságok",
      "iroda-admin",
      "adatvédelem"
    ],
    "icon": "ShieldCheck",
    "estimated_read_time": "4 perc",
    "order_num": 6,
    "is_published": true
  }
];
