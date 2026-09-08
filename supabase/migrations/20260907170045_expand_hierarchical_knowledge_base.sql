-- ==============================================================================
-- Migration: 20260907180000_expand_hierarchical_knowledge_base.sql
-- Description: Teljes hierarchikus Tudástár bővítés: eaisyBill + eaisyBooks
--              összes menüpontjának 10 kategóriába és 40 szakmai útmutatóba
--              történő strukturált leképezése.
-- Reference: BRD, PRD, information-architecture.md, Decision 055, P-077, P-078
-- ==============================================================================

-- 1. Kategóriák beszúrása és frissítése (10 hierarchikus kategória)
INSERT INTO public.knowledge_base_categories (id, title, description, icon, order_num)
VALUES
  ('basics', 'Alapok & Vezérlőpult', 'Kezdő lépések, felület megismerése, cégváltás, vezérlőpult és jogosultságok', 'Compass', 1),
  ('invoices', 'Bizonylatok & Számlák', 'Számlák kezelése, OCR feltöltés, sztornózás, kintlévőségek és fizetési felszólítások', 'Receipt', 2),
  ('transactions', 'Pénzügyek & Bank', 'Banki tranzakciók, intelligens párosítás, banki utalási csomagok és házipénztár', 'Landmark', 3),
  ('accounting', 'Könyvelés & Adózás', 'Főkönyvi kivonat, számlatükör, naplók, mérleg, eredménykimutatás, beszámoló és ÁFA bevallás', 'BookOpen', 4),
  ('hr', 'Bérszámfejtés & HR', 'Havi bérszámfejtési ciklus, jelenléti ív, munkaidő és tárgyi eszközök nyilvántartása', 'Users', 5),
  ('shipments', 'Szállítmányozás & Fuvarok', 'Fuvarlevelek, CMR megbízások, Excel import, számlapárosítás és eszkaláció', 'Truck', 6),
  ('system', 'Integrációk & Rendszer', 'NAV Online Számla, MNB árfolyamok, cégjegyzetek, beállítások és hibajegyek', 'Wrench', 7),
  ('books_portfolio', 'eaisyBooks Portfólió', 'Könyvelőirodai ügyfélkezelés, portfólió áttekintés, hiányzó számlák és adónaptár', 'Briefcase', 8),
  ('books_modules', 'eaisyBooks Szakmai Modulok', 'Egyéni vállalkozók (EV), pénztárkönyv, TAO/KIVA tervező és irodai bérszámfejtés', 'Calculator', 9),
  ('books_admin', 'eaisyBooks Adminisztráció & AI', 'Cégkapu tárhely, EGYKE képviselet, AI Asszisztens, jóváhagyási sor és irodai beállítások', 'Bot', 10)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  order_num = EXCLUDED.order_num;

-- Régi 'eaisybooks' kategóriás cikkek átirányítása az új alkategóriákra, mielőtt törölnénk a régi kategóriát
UPDATE public.knowledge_base_articles
SET category_id = 'books_portfolio'
WHERE category_id = 'eaisybooks' AND id IN ('eaisybooks-client-management');

UPDATE public.knowledge_base_articles
SET category_id = 'books_modules'
WHERE category_id = 'eaisybooks' AND id IN ('eaisybooks-ev-and-cashbook', 'eaisybooks-tao-kiva-planner');

UPDATE public.knowledge_base_articles
SET category_id = 'books_admin'
WHERE category_id = 'eaisybooks' AND id IN ('eaisybooks-cegkapu-and-representation', 'eaisybooks-ai-assistant-chat');

-- Régi kategória eltávolítása, ha maradt
DELETE FROM public.knowledge_base_categories WHERE id = 'eaisybooks';

-- 2. Mind a 40 menüpont leképezése és beszúrása / frissítése
INSERT INTO public.knowledge_base_articles (id, category_id, title, summary, content, menu_path, tags, icon, estimated_read_time, order_num)
VALUES
  -- ── 1. basics (Alapok & Vezérlőpult) ──
  (
    'navigation-and-company-switching',
    'basics',
    'Kezdő lépések, navigáció és cégváltás',
    'Ismerd meg az eaisyBill modern felületét, a hierarchikus cégválasztót és a gyorsbillentyűket.',
    '# Kezdő lépések az eaisyBill rendszerben

Az eaisyBill egy teljes körű pénzügyi és könyveléstámogató platform vállalkozások és könyvelőik számára. A felület bal oldalán található a fő navigációs menü, felül a globális kereső és cégválasztó, középen pedig az aktív munkaterület.

### 1. Cégváltás és cégprofil
- A fejlécben vagy az oldalsáv tetején lévő **Cégválasztó** lenyíló menüvel azonnal válthatsz az általad kezelt vállalkozások között.
- Cégváltáskor a rendszer az aktuálisan nyitott aloldalon tart (például ha a Számlák nézetben vagy, a másik cégnél is a Számlák nyílik meg).

### 2. Gyorsbillentyűk (Hotkeys)
- `Ctrl + B`: Oldalsáv (sidebar) összecsukása és kinyitása a maximális munkaterületért.
- `Ctrl + K`: Gyorskereső és parancspaletta megnyitása bármely oldalról.
- `Esc`: Felugró ablakok, modálok és oldalsó panelek azonnali bezárása.

### 3. Sötét és világos mód
- A felület támogatja a modern sötét módot (Dark Mode), amely az oldalsáv alsó felhasználói menüjéből vagy a profil beállításoknál aktiválható.',
    '/',
    ARRAY['navigáció', 'cégváltás', 'gyorsbillentyű', 'alapok', 'kezdés'],
    'Compass',
    '2 perc',
    1
  ),
  (
    'dashboard-overview-and-kpis',
    'basics',
    'Irányítópult és vezérlőpulti KPI mutatók',
    'A vállalkozás pénzügyi egészségének azonnali áttekintése: bevételek, költségek, cash-flow és teendők.',
    '# Irányítópult (Dashboard)

Az **Irányítópult** a vállalkozás vezetői és pénzügyi információs központja, amely valós időben mutatja a legfontosabb pénzügyi mutatókat (KPI).

### 1. Főbb vezérlőpulti kártyák
- **Összes bevétel:** A kiválasztott időszakban kibocsátott és könyvelt kimenő vevői számlák nettó és bruttó összege.
- **Összes kiadás:** A szállítói bejövő számlák, házipénztári kiadások és egyéb költségek összege.
- **Kintlévőség egyenleg:** A vevők által még ki nem egyenlített számlák összege, külön jelölve a lejárt határidejű tartozásokat.
- **Aktuális egyenlegek:** A szinkronizált bankszámlák és a házipénztár pillanatnyi készpénzállománya.

### 2. Időszak szűrő és összehasonlítás
- A felső dátumválasztóval vizsgálhatod az aktuális hónapot, negyedévet, az egész évet, vagy egyedi dátumtartományt.
- A grafikonok azonnal mutatják az előző év azonos időszakához képest mért változást (YoY összehasonlítás).',
    '/',
    ARRAY['dashboard', 'kpi', 'bevétel', 'kiadás', 'cash-flow', 'áttekintés'],
    'Layers',
    '3 perc',
    2
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
    3
  ),

  -- ── 2. invoices (Bizonylatok & Számlák) ──
  (
    'invoices-management-and-filters',
    'invoices',
    'Számlák kezelése, szűrése és státuszai',
    'Hogyan kezeld a bejövő és kimenő számlákat, használd a többdimenziós szűrőket és kövesd a fizetettséget.',
    '# Számlakezelés az eaisyBill rendszerben

A **Számlák** menüpontban tekintheted át a vállalkozás összes bizonylatát egyetlen konszolidált felületen.

### 1. Bejövő és kimenő nézet
- A fenti fülek segítségével válthatsz a **Bejövő (szállítói)** és a **Kimenő (vevői)** számlák között.
- A táblázat azonnal mutatja a számlaszámot, partnert, teljesítési és fizetési határidőt, nettó és bruttó összeget, valamint az ÁFA tartalmat.

### 2. Számla státuszok
- **Fizetett (Zöld):** A számla összege teljes mértékben kiegyenlítésre került banki vagy készpénzes tétellel.
- **Részben fizetett (Sárga):** A számlához kapcsolódik jóváírás, de a fennmaradó összeg még kiegyenlítésre vár.
- **Kiegyenlítetlen / Lejárt (Piros):** A fizetési határidő lejárt, a számla még nincs kifizetve.
- **Stornózott (Szürke áthúzott):** Érvénytelenített vagy stornózott számla.

### 3. Haladó szűrők és megosztható nézetek
- Szűrés partnerre, fizetési határidőre, ÁFA kulcsra vagy összegtartományra.
- A szűrők állapota azonnal tükröződik az URL-ben, így a szűrt lista könyvjelzőzhető vagy közvetlenül megosztható kollégákkal.',
    '/invoices',
    ARRAY['számla', 'bejövő', 'kimenő', 'szűrés', 'státusz', 'áfa'],
    'Receipt',
    '4 perc',
    1
  ),
  (
    'invoice-upload-and-ocr',
    'invoices',
    'Bizonylatok feltöltése és mesterséges intelligencia (OCR)',
    'Hogyan működik az automatikus számlafeldolgozás, a többoldalas PDF bontás és a látási AI (Vision OCR).',
    '# Számlafeltöltés és AI adatkinyerés

Az eaisyBill beépített képi mesterséges intelligencia motorja másodpercek alatt felismeri a feltöltött dokumentumok adatait.

### 1. Feltöltési csatornák
- **Húzás és ejtés (Drag & Drop):** Húzd a fájlokat közvetlenül a Feltöltés menüpontba.
- **Email továbbítás:** Minden cég rendelkezik egy egyedi számlafogadó email címmel, ahová a szállítói számlákat közvetlenül továbbíthatod.
- **Többoldalas PDF-ek:** Ha egyetlen PDF állományban több számla található, az automatikus lapszétválasztó funkció önálló bizonylatokra bontja azokat.

### 2. Automatikus mezőfelismerés
A rendszer automatikusan kinyeri:
- Számla sorszáma és típusa (normál számla, végszámla, előlegszámla, díjbekérő).
- Kibocsátó és vevő adószáma, neve, címe.
- Teljesítés kelte, kibocsátás dátuma és fizetési határidő.
- Nettó összeg, ÁFA kulcsok és bruttó végösszeg.
- Tételes sorok és termékmegnevezések.',
    '/upload',
    ARRAY['feltöltés', 'ocr', 'ai', 'vision', 'pdf', 'számlafeldolgozás'],
    'Upload',
    '3 perc',
    2
  ),
  (
    'storno-and-corrections',
    'invoices',
    'Sztornó és helyesbítő számlák kezelése',
    'Ismerd meg a számlakorrekciók, helyesbítések és a kétlépcsős sztornó-lezárás szabályait.',
    '# Sztornó és módosító bizonylatok

A magyar számviteli szabályok szerint kibocsátott sztornó és helyesbítő számlák precíz adminisztrációt igényelnek.

### 1. Automatikus sztornó párosítás
- A rendszer az eredeti számla sorszáma alapján automatikusan összekapcsolja a stornó bizonylatot az alapbizonylattal.
- A két számla nettó és bruttó egyenlege kioltja egymást, így a kintlévőségi listákban nem jelenik meg téves tartozás.

### 2. Kézi sztornó lezárás
- Ha a számla stornózása pénzmozgás nélkül történt, a számla részleteiben található "Sztornó lezárása" gombbal a bizonylat közvetlenül lezárható.',
    '/invoices',
    ARRAY['storno', 'helyesbítő', 'módosítás', 'kioltás'],
    'RotateCcw',
    '2 perc',
    3
  ),
  (
    'receivables-and-payment-reminders',
    'invoices',
    'Kintlévőség kezelés és fizetési felszólítások',
    'Vevői tartozások korosítása, kintlévőségi egyenlegek és fizetési felszólító levelek küldése.',
    '# Kintlévőségek és adóskövetés

A **Kintlévőség** menüpontban áttekintheted a partnerek felé fennálló nyitott vevői követeléseket.

### 1. Tartozások korosítása (Aging analitika)
- **0–30 napos késedelem:** Enyhe késedelemben lévő számlák.
- **31–60 napos késedelem:** Figyelmeztető kategória, egyeztetést igényel.
- **60+ napos késedelem:** Kritikus kintlévőségek, jogi lépéseket igényelhetnek.

### 2. Fizetési felszólítások generálása
- Egyetlen kattintással előállítható a hivatalos formátumú fizetési felszólító levél vagy egyenlegközlő értesítő PDF formátumban.
- Az értesítők közvetlenül emailben is elküldhetők a partner kapcsolattartójának.',
    '/kintlevo',
    ARRAY['kintlévőség', 'vevő', 'tartozás', 'felszólítás', 'korosítás', 'egyenlegközlő'],
    'FileText',
    '3 perc',
    4
  ),

  -- ── 3. transactions (Pénzügyek & Bank) ──
  (
    'bank-transactions-and-matching',
    'transactions',
    'Banki tranzakciók és intelligens számlapárosítás',
    'Hogyan tölts fel bankkivonatot, és hogyan párosítja az algoritmus a banki mozgásokat a számlákkal.',
    '# Banki tranzakciók és párosítás

A **Tranzakciók** menüpontban láthatók a bankszámlák és pénzforgalmi szolgáltatók pénzmozgásai.

### 1. Banki adatok betöltése
- **Kivonat feltöltése:** CSV, CAMT.053 vagy PDF formátumú bankkivonatok egyszerű feltöltése.
- A rendszer kiszűri és megelőzi a duplikált tranzakciók rögzítését a banki tranzakcióazonosítók alapján.

### 2. Háromszintű párosítási folyamat
1. **Pontos egyezés (Zöld):** Ha a közleményben szerepel a számlaszám és az összeg forintra megegyezik, a rendszer azonnal jóváhagyja a párosítást.
2. **Intelligens javaslatok (Sárga):** Partnernév hasonlóság és összegazonosság alapján javaslatot tesz a felhasználónak.
3. **Manuális párosítás:** Tetszőleges tranzakció összekapcsolható egy vagy több részszámlával.',
    '/transactions',
    ARRAY['bank', 'tranzakció', 'matching', 'párosítás', 'kivonat'],
    'Landmark',
    '4 perc',
    1
  ),
  (
    'bank-transfers-giro-sepa',
    'transactions',
    'Szállítói utalási csomagok és banki export (GIRO / SEPA)',
    'Hogyan állíts össze kötegelt utalási megbízást szállítói számlákból, és töltsd be a netbankba.',
    '# Szállítói utalások (GIRO és SEPA)

Az **Utalások** menüpont segítségével elkerülhető a szállítói számlák egyesével történő kézi berögzítése a netbanki felületeken.

### 1. Utalási csomag összeállítása
- Jelöld ki a kifizetésre váró szállítói számlákat a Számlák vagy Utalások listában.
- A rendszer ellenőrzi a partner bankszámlaszámának formátumát és a fizetési határidőt.

### 2. Banki állomány exportálása
- **GIRO XML / TXT:** A magyarországi bankok (OTP, Erste, Raiffeisen, MBH, CIB) által elfogadott kötegelt átutalási formátum.
- **SEPA XML (pain.001):** Eurós nemzetközi átutalásokhoz használható szabványos állomány.
- Az exportált fájl közvetlenül importálható a netbanki felületre.',
    '/transfers',
    ARRAY['utalás', 'giro', 'sepa', 'bank', 'csomag', 'átutalás'],
    'Send',
    '3 perc',
    2
  ),
  (
    'petty-cash-and-manual-payments',
    'transactions',
    'Házipénztár és készpénzes bizonylatok',
    'Készpénzes kifizetések rögzítése, pénztárbizonylatok és készpénzforgalmi nyilvántartás.',
    '# Házipénztár kezelése

A készpénzes vásárlások és elszámolások a **Házipénztár** modulban követhetők nyomon.

### 1. Készpénzes számlák
- A készpénzes fizetési módú számlák automatikusan bekerülnek a házipénztár forgalmi listájába.
- A rendszer folyamatosan nyilvántartja a pénztári egyenleget és figyelmeztet a negatív pénztáregyenleg kockázatára.

### 2. Bevételi és kiadási pénztárbizonylatok
- Kézi pénztárbizonylat állítható ki dolgozói előleghez, tagi kölcsön törlesztéséhez vagy egyéb készpénzmozgáshoz.
- Hivatalos pénztárjelentés és időszaki pénztárzárás generálása.',
    '/petty-cash',
    ARRAY['házipénztár', 'készpénz', 'pénztárbizonylat', 'kiadás', 'bevétel'],
    'Coins',
    '2 perc',
    3
  ),

  -- ── 4. accounting (Könyvelés & Adózás) ──
  (
    'general-ledger-and-chart-of-accounts',
    'accounting',
    'Főkönyvi kivonat, kartonok és számlaosztályok',
    'Kettős könyvvitel alapjai, számlaosztályok, nyitó- és forgalmi egyenlegek és főkönyvi karton.',
    '# Főkönyv és számlalapok

A **Főkönyv** menüpont a kettős könyvvitelt vezető vállalkozások és könyvelőik központi munkafelülete.

### 1. A magyar számlatükör felépítése
- **1. Számlaosztály:** Befektetett eszközök (immateriális javak, tárgyi eszközök).
- **2. Számlaosztály:** Készletek (anyagok, áruk).
- **3. Számlaosztály:** Követelések és pénzeszközök (vevők, bankok, pénztár).
- **4. Számlaosztály:** Források (saját tőke, kötelezettségek, szállítók).
- **5. Számlaosztály:** Költségnemek (anyagjellegű, személyi, értékcsökkenés).
- **8. Számlaosztály:** Ráfordítások.
- **9. Számlaosztály:** Árbevételek és bevételek.

### 2. Főkönyvi karton kereső
- Bármely főkönyvi számra kattintva megnyitható a részletes karton, amely tételesen mutatja a Tartozik és Követel mozgásokat bizonylatszámmal.',
    '/general-ledger',
    ARRAY['főkönyv', 'karton', 'számlaosztály', 'kettős könyvvitel', 'számvitel'],
    'BookOpen',
    '4 perc',
    1
  ),
  (
    'chart-of-accounts-and-posting-rules',
    'accounting',
    'Magyar számlatükör és automatikus kontírozási szabályok',
    'Számlatükör szerkesztése, új alszámlák felvétele és intelligens AI kontírozási szabályok beállítása.',
    '# Számlatükör és Kategóriák

A **Kategóriák** menüpontban szabhatod testre a vállalkozás számlatükrét és a számlák automatikus könyvelését irányító szabályokat.

### 1. Számlatükör karbantartása
- Új 3, 4 vagy 6 jegyű alszámlák rögzítése a hazai számviteli törvény előírásai szerint.
- Alapértelmezett partner-összerendelések és költséghelyek rögzítése.

### 2. Automatikus kontírozási szabályok
- Partnernév, termékkategória vagy kulcsszavak alapján a rendszer előre kitölti a Tartozik és Követel számlaszámokat a számlafeldolgozás során.',
    '/categories',
    ARRAY['számlatükör', 'kategória', 'kontírozás', 'szabályok', 'alszámla'],
    'Layers',
    '3 perc',
    2
  ),
  (
    'journal-entries-and-closings',
    'accounting',
    'Kettős könyvviteli naplók és könyvelési zárások',
    'Zárt könyvelési naplók (Vevő, Szállító, Bank, Vegyes), időszaki zárás és manuális vegyes bizonylatok.',
    '# Könyvelési naplók és zárás

A **Napló** felületen a tranzakciók szigorúan zárt naplókba rendezve követhetők nyomon a számviteli törvény előírásainak megfelelően.

### 1. Zárt naplók típusai
- **Vevő napló:** Kimenő értékesítési számlák könyvelési tételei.
- **Szállító napló:** Bejövő beszerzési bizonylatok könyvelése.
- **Bank és Pénztár napló:** Pénzforgalmi mozgások tételei.
- **Vegyes napló:** Időbeli elhatárolások, év végi záró/nyitó tételek és bérfeladások.

### 2. Időszaki zárás
- A lezárt időszakok zárolhatók, megakadályozva a visszamenőleges módosításokat.',
    '/journals',
    ARRAY['napló', 'vegyes', 'zárás', 'szállító napló', 'vevő napló'],
    'BookOpen',
    '3 perc',
    3
  ),
  (
    'profit-and-loss-statement',
    'accounting',
    'Eredménykimutatás és gazdálkodási PnL elemzés',
    'Összköltség és forgalmi költség eljárású eredménykimutatás, üzemi eredmény és pénzügyi műveletek.',
    '# Eredménykimutatás (Profit & Loss)

Az **Eredménykimutatás** kimutatja a vállalkozás bevételeit és ráfordításait egy adott időszakra vonatkozóan.

### 1. Eredményszintek struktúrája
- **I. Értékesítés nettó árbevétele:** Belföldi és export értékesítés bevétele.
- **II. Anyagjellegű ráfordítások:** Anyagköltség, igénybe vett szolgáltatások.
- **III. Személyi jellegű ráfordítások:** Bérköltség, személyi kifizetések és bérjárulékok.
- **Üzemi (üzleti) tevékenység eredménye:** A fő tevékenység nyeresége vagy vesztesége.
- **Pénzügyi műveletek eredménye:** Kamatbevételek, kamatráfordítások és árfolyamkülönbözetek.
- **Adózás előtti és adózott eredmény.**',
    '/profit-and-loss',
    ARRAY['eredménykimutatás', 'pnl', 'bevétel', 'költség', 'nyereség', 'árbevétel'],
    'Calculator',
    '4 perc',
    4
  ),
  (
    'balance-sheet-report',
    'accounting',
    'Mérlegkimutatás (eszközök és források)',
    'A vállalkozás vagyoni helyzetének felmérése: befektetett eszközök, forgóeszközök, saját tőke és kötelezettségek.',
    '# Mérlegkimutatás

A **Mérleg** egy adott fordulónapra (például december 31-re) vonatkozóan mutatja a cég vagyonát (Eszközök) és a vagyon eredetét (Források).

### 1. Eszközök (Aktivák)
- **Befektetett eszközök:** Immateriális javak, ingatlanok, műszaki gépek, tartós részesedések.
- **Forgóeszközök:** Készletek, vevőkövetelések, értékpapírok és pénzeszközök.
- **Aktív időbeli elhatárolások.**

### 2. Források (Passzívák)
- **Saját tőke:** Jegyzett tőke, tőketartalék, eredménytartalék, tárgyévi eredmény.
- **Céltartalékok.**
- **Kötelezettségek:** Hosszú és rövid lejáratú kötelezettségek (szállítók, hitelek, adótartozások).
- **Passzív időbeli elhatárolások.**',
    '/balance-sheet',
    ARRAY['mérleg', 'eszközök', 'források', 'saját tőke', 'vagyon'],
    'Landmark',
    '4 perc',
    5
  ),
  (
    'annual-report-filing',
    'accounting',
    'Éves számviteli beszámoló és kiegészítő melléklet',
    'Év végi beszámoló csomag összeállítása, letétbe helyezés és közzétételi kötelezettségek.',
    '# Éves beszámoló

A **Beszámoló** modul támogatja a kettős könyvvitelt vezető társaságok kötelező éves számviteli beszámolójának előkészítését.

### 1. Beszámoló formái
- **Mikrogazdálkodói egyszerűsített beszámoló:** Kisebb cégek számára egyszerűsített értékelési szabályokkal.
- **Egyszerűsített éves beszámoló:** A legtöbb Kft. és Bt. által alkalmazott forma.
- **Éves beszámoló:** Nagyobb árbevételű cégek esetén.

### 2. Export és közzététel
- A rendszer előkészíti a mérleget, eredménykimutatást és a kiegészítő melléklet számszaki adatait a hatósági OBR (Online Beszámoló Rendszer) feltöltéshez.',
    '/annual-report',
    ARRAY['beszámoló', 'éves zárás', 'kiegészítő melléklet', 'letétbe helyezés', 'obr'],
    'FileText',
    '3 perc',
    6
  ),
  (
    'vat-return-and-nav65',
    'accounting',
    'ÁFA bevallás kalkuláció és NAV ÁNYK 2665 export',
    'Havi, negyedéves és éves ÁFA pozíció vizsgálata, levonható és fizetendő ÁFA egyenleg, XML export.',
    '# ÁFA bevallás és hatósági kimutatás

A **Könyvelés / ÁFA Bevallás** felület a NAV felé benyújtandó 65-ös bevallás előkészítését automatizálja.

### 1. Fizetendő és levonható ÁFA
- A rendszer a lekönyvelt bizonylatok alapján automatikusan összesíti az értékesítés fizetendő ÁFA tartalmát és a beszerzések levonható ÁFA összegét.
- Külön figyelmeztet a jogszabályi levonási korlátozásokra (például személygépkocsi üzemanyag, reprezentáció).

### 2. NAV ÁNYK és ONYA kompatibilis XML
- Egyetlen kattintással generálható a hivatalos XML állomány, amely közvetlenül betölthető az Általános Nyomtatványkitöltő vagy az ONYA felületére.',
    '/vat-return',
    ARRAY['áfa', 'bevallás', 'nav65', 'ányk', 'onya', 'xml'],
    'Calculator',
    '3 perc',
    7
  ),

  -- ── 5. hr (Bérszámfejtés & HR) ──
  (
    'payroll-cycle-and-salaries',
    'hr',
    'Havi bérszámfejtési folyamat és béradatok',
    '4 fázisú bérszámfejtési ciklus, dolgozói törzs, kedvezmények és NAV 08 bevallás.',
    '# Bérszámfejtés és dolgozói nyilvántartás

A **Bérek / Járulékok** modul a munkavállalók bérszámfejtésének és hatósági elszámolásának eszköze.

### 1. A 4 fázisú havi ciklus
1. **Tervezet:** Dolgozók kiválasztása, munkaidő és pótlékok rögzítése.
2. **Számfejtés:** Bruttó bérből SZJA, TB járulék és SZOCHO számítás.
3. **Ellenőrzés:** Anomáliák és eltérések kiszűrése.
4. **Lezárva:** Bérjegyzék PDF-ek generálása, banki utalási csomag és NAV 08 export.

### 2. Érvényes jogszabályi sarokszámok
- Minimálbér és garantált bérminimum aktuális összegei.
- Családi adókedvezmények az eltartottak száma szerint.
- 25 év alatti fiatalok adókedvezménye és 30 év alatti anyák kedvezménye.',
    '/salaries',
    ARRAY['bér', 'bérszámfejtés', 'szja', 'járulék', 'nav08', 'minimálbér'],
    'Users',
    '4 perc',
    1
  ),
  (
    'working-time-and-attendance',
    'hr',
    'Munkaidő nyilvántartás és jelenléti ív',
    'Munkavállalói jelenléti ívek, szabadságok, táppénzes napok és műszakok digitális rögzítése.',
    '# Munkaidő és jelenlét

A **Munkaidő** menüpontban a dolgozók napi munkaideje és távollétei adminisztrálhatók a Munka Törvénykönyve előírásainak megfelelően.

### 1. Jelenléti naptár és státuszok
- **Ledolgozott munkaidő:** Napi ledolgozott órák és túlórák rögzítése.
- **Fizetett szabadság:** Alap- és pótszabadságok naprakész keretfigyelője.
- **Táppénz és betegszabadság:** Hatósági igazolások csatolása és betegszabadság napok számlálása.
- **Kiküldetés és fizetés nélküli távollét.**

### 2. Munkavállalói önkiszolgáló felület (Employee szerepkör)
- A csak munkaidő rögzítésére jogosult munkatársak ezen az egyetlen dedikált felületen tölthetik ki jelenlétüket.',
    '/working-time',
    ARRAY['munkaidő', 'jelenlét', 'szabadság', 'táppénz', 'jelenléti ív'],
    'Clock',
    '3 perc',
    2
  ),
  (
    'fixed-assets-and-depreciation',
    'hr',
    'Tárgyi eszközök nyilvántartása és értékcsökkenés (TENY)',
    'Eszközök aktiválása, kivezetése, leírási kulcsok és terv szerinti értékcsökkenési elszámolás.',
    '# Tárgyi eszközök nyilvántartása (TENY)

A **TENY** modul a vállalkozás tartós használatú eszközeinek (gépek, gépjárművek, ingatlanok, informatikai eszközök) törzsnyilvántartását végzi.

### 1. Eszköz felvétele és aktiválása
- Számla alapján közvetlenül aktiválható az új eszköz bruttó értéke, üzembe helyezésének napja és helyszíne.
- Egyedi azonosító és leltári szám generálása.

### 2. Értékcsökkenési leírási módszerek
- **Számviteli leírás:** Lineáris leírás a becsült hasznos élettartam alapján.
- **Társasági adó szerinti leírás:** A Tao törvény szerinti adóalap-módosító kulcsok alkalmazása.
- Év végi automatikus feladás a főkönyvi naplóba.',
    '/teny',
    ARRAY['tárgyi eszköz', 'teny', 'értékcsökkenés', 'leírás', 'leltár'],
    'Building2',
    '3 perc',
    3
  ),

  -- ── 6. shipments (Szállítmányozás & Fuvarok) ──
  (
    'shipments-and-cmr-management',
    'shipments',
    'Fuvarlevelek és CMR megbízások nyilvántartása',
    'Nemzetközi és belföldi fuvarok rögzítése, CMR okmányok, sofőrök és járműszerelvények kezelése.',
    '# Szállítmányozás és fuvarok

A **Fuvarok** menüpont a logisztikai és szállítmányozási tevékenységet végző cégek belső működését támogatja.

### 1. Fuvarmegbízások rögzítése
- Pozíciószám, feladó és címzett telephelye, felrakás és lerakás dátumai.
- Jármű rendszáma, vontató és pótkocsi adatai, gépkocsivezető neve.
- Vállalási díj, devizanem és fizetési feltételek.

### 2. Dokumentumkezelés és CMR
- CMR fuvarlevelek, menetlevelek és mérlegjegyek digitális csatolása a fuvarhoz.',
    '/shipments',
    ARRAY['fuvar', 'szállítmány', 'cmr', 'logisztika', 'kamion'],
    'Truck',
    '3 perc',
    1
  ),
  (
    'shipment-excel-import-and-matching',
    'shipments',
    'Fuvarlevél Excel import és számlapárosítás',
    'Tömeges fuvarimportálás külső fuvarszoftverekből (pl. Selexped) és fuvarszámlák automatikus párosítása.',
    '# Fuvarlevél import és számlapárosítás

Az **Excel Import** felület lehetővé teszi több száz fuvarmegbízás egyidejű betöltését.

### 1. Fájlformátum és mezőillesztés
- Excel (.xlsx) vagy CSV sablonfájlok feltöltése.
- Mezőillesztő varázsló: pozíciószám, partner adószám, nettó fuvardíj és dátumok megfeleltetése.

### 2. Automatikus számla-összerendelés
- A rendszer az importált fuvarok pozíciószáma alapján automatikusan megkeresi a bejövő és kimenő fuvarszámlákat.
- Zöld színnel jelöli a hibátlanul egyező tételeket.',
    '/shipments/import',
    ARRAY['fuvar import', 'excel', 'selexped', 'párosítás', 'matching'],
    'Upload',
    '3 perc',
    2
  ),
  (
    'shipment-discrepancies-and-escalation',
    'shipments',
    'Fuvardíj eltérések és vitás ügyek eszkalációja',
    'Eltérések kezelése a megrendelt és számlázott fuvardíjak között, jóváhagyási workflow és reklamációk.',
    '# Fuvar eszkaláció és eltérések

Az **Eszkaláció** nézetben azon tételek jelennek meg, ahol a beérkezett számla és a diszpécser által rögzített fuvardíj között eltérés mutatkozik.

### 1. Eltérések okai
- Túlsúly vagy állásidő pótdíj.
- Üzemanyag-felár vagy útdíj különbözet.
- Téves devizaárfolyam alkalmazása.

### 2. Jóváhagyási folyamat
- A diszpécser vagy pénzügyi vezető jóváhagyhatja a különbözetet, vagy vitatott státuszba helyezheti a számlát a korrekciós jóváírás megérkezéséig.',
    '/shipments/escalated',
    ARRAY['eszkaláció', 'fuvardíj', 'eltérés', 'reklamáció', 'jóváhagyás'],
    'RotateCcw',
    '3 perc',
    3
  ),

  -- ── 7. system (Integrációk & Rendszer) ──
  (
    'nav-online-szamla-sync',
    'system',
    'NAV Online Számla integráció beállítása',
    'Hogyan kösd össze vállalkozásodat a NAV-val technikai felhasználó segítségével a számlák automatikus letöltéséhez.',
    '# NAV Online Számla integráció

Az automatikus számlaszinkronizációhoz be kell állítani a NAV Technikai felhasználó adatait.

### Szükséges adatok a NAV Online Számla portálról:
1. **Technikai felhasználónév:** A NAV felületén létrehozott technikai felhasználó azonosítója.
2. **Jelszó:** A technikai felhasználóhoz tartozó jelszó.
3. **XML Aláírókulcs:** 32 karakteres titkos biztonsági kulcs.
4. **XML Cserekulcs:** 32 karakteres titkos biztonsági kulcs.

Az adatok mentése után a rendszer titkosítva tárolja a kulcsokat, és automatikusan óránként lekérdezi a legfrissebb számlákat.',
    '/integrations',
    ARRAY['nav', 'online számla', 'integráció', 'szinkron', 'technikai felhasználó'],
    'Wrench',
    '3 perc',
    1
  ),
  (
    'exchange-rates-mnb',
    'system',
    'MNB hivatalos devizaárfolyamok és devizás számlák',
    'A Magyar Nemzeti Bank hivatalos napi devizaárfolyamainak automatikus lekérdezése és árfolyam-nyilvántartás.',
    '# MNB Hivatalos Devizaárfolyamok

Az **Árfolyamok** menüpont biztosítja a devizás számlák jogszabályszerű forintra történő átszámítását.

### 1. Automatikus napi szinkronizáció
- A rendszer minden munkanapon automatikusan letölti a Magyar Nemzeti Bank (MNB) által 11:00-kor közzétett hivatalos devizaárfolyamokat (EUR, USD, GBP, CHF stb.).
- A számlák rögzítésekor a teljesítés napján érvényes hivatalos árfolyam automatikusan kitöltésre kerül.

### 2. Egyedi banki árfolyamok
- Igény esetén a cég egyedi kereskedelmi banki deviza eladási/vételi árfolyama is rögzíthető.',
    '/exchange-rates',
    ARRAY['árfolyam', 'mnb', 'deviza', 'eur', 'usd', 'forint'],
    'Landmark',
    '2 perc',
    2
  ),
  (
    'company-notes-and-reminders',
    'system',
    'Cégjegyzetek és belső emlékeztetők',
    'Belső emlékeztetők, könyvelési határidők, ügyfélspecifikus szabályok és kétpaneles feljegyzések.',
    '# Jegyzetek és emlékeztetők

A **Jegyzetek** menüpontban a cég pénzügyi és könyvelési csapata oszthat meg egymással fontos információkat.

### 1. Kétpaneles jegyzetkezelő
- Bal oldalon láthatók a témakörök és címkék, jobb oldalon a rich-text formázott jegyzettartalom.
- Csatolható adott partnerhez vagy bizonylattípushoz.

### 2. Megosztás és láthatóság
- A jegyzetek lehetnek magánjellegűek vagy a cég összes pénzügyi felhasználója számára láthatók.',
    '/notes',
    ARRAY['jegyzet', 'emlékeztető', 'feljegyzés', 'belső info'],
    'FileText',
    '2 perc',
    3
  ),
  (
    'company-settings-and-profile',
    'system',
    'Cégprofil és rendszerbeállítások',
    'Vállalkozás alapadatainak kezelése, bankszámlaszámok, csapattagok meghívása és biztonsági beállítások.',
    '# Cégprofil és beállítások

A **Beállítások** menüpontban konfigurálhatók a cég globális működési paraméterei.

### 1. Cég alapadatok
- Cégnév, székhely, adószám és cégjegyzékszám.
- Hivatalos bankszámlaszámok (IBAN formátumban is) a számlákhoz és utalásokhoz.

### 2. Csapattagok és meghívók
- Új munkatársak meghívása email cím alapján szerepkör kiválasztásával (Admin, Member, Assistant, Viewer, Employee).
- Meghívók visszavonása vagy szerepkörök azonnali módosítása.',
    '/settings',
    ARRAY['beállítások', 'cégprofil', 'meghívó', 'bankszámla', 'felhasználók'],
    'Wrench',
    '3 perc',
    4
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
    5
  ),

  -- ── 8. books_portfolio (eaisyBooks Portfólió) ──
  (
    'eaisybooks-portfolio-overview',
    'books_portfolio',
    'Könyvelőirodai portfólió és ügyfél mátrix',
    'Az iroda által kezelt cégek áttekintése: Grid, Lista és Kanban nézetek, zárási státuszok és könyvelői kiosztás.',
    '# eaisyBooks Irodai Portfólió

Az eaisyBooks **Portfólió** felülete a több vállalkozás könyvelését végző szakemberek központi irányítópultja.

### 1. Megjelenítési nézetek
- **Grid nézet:** Kártyás elrendezés cégmérettel, adózási formával és függő tételek számával.
- **Lista nézet:** Kompakt táblázat gyorskeresővel és rendezéssel.
- **Kanban nézet:** Havi könyvelési folyamat fázisai (Bizonylatbekérés, Feldolgozás alatt, Adóellenőrzés, Zárva).

### 2. Kiosztás és felelős könyvelő
- Minden ügyfélhez kijelölhető a felelős könyvelő és a felülvizsgáló senior kolléga.',
    '/eaisybooks',
    ARRAY['eaisybooks', 'portfólió', 'ügyfelek', 'kanban', 'iroda', 'könyvelőiroda'],
    'Briefcase',
    '3 perc',
    1
  ),
  (
    'eaisybooks-client-management',
    'books_portfolio',
    'Kliensek és ügyféltörzs kezelése',
    'Ügyféltörzs áttekintése, új cég felvétele meghívó kóddal, könyvelői meghatalmazások és adatlapok.',
    '# Ügyféltörzs és kliensek kezelése

Az eaisyBooks lehetőséget nyújt új ügyfelek villámgyors felvételére és profiljaik karbantartására.

### 1. Új ügyfél felvétele
- **Meghívó kód:** Ha az ügyfél már használja az eaisyBill-t, egyedi 8 jegyű meghívó kóddal összekapcsolható a könyvelőirodával.
- **Manuális létrehozás:** Cégadatok rögzítése a NAV törzsadatok lekérdezésével.

### 2. Ügyfél adatlap
- Adózási forma (TAO, KIVA, Átalányadó, KATA), ÁFA gyakoriság (havi, negyedéves, éves).
- Kapcsolattartók, bankszámlák és könyvelési feljegyzések.',
    '/eaisybooks/clients',
    ARRAY['kliens', 'ügyféltörzs', 'meghívó kód', 'cég felvétel', 'könyvelő'],
    'Building2',
    '3 perc',
    2
  ),
  (
    'eaisybooks-missing-invoices-hub',
    'books_portfolio',
    'Hiányzó számlák irodai kezelése és felszólító e-mailek',
    'Banki mozgásokhoz hiányzó bizonylatok felderítése és automatikus felszólító email küldése az ügyfeleknek.',
    '# Hiányzó számlák irodai központja

A **Hiányzó számlák** felület automatikusan felderíti azokat a banki kifizetéseket és jóváírásokat, amelyekhez nem található számla.

### 1. Konszolidált hiánylista
- Az iroda egyetlen táblázatban látja az összes ügyfél hiányzó bizonylatait összeg és dátum szerint.

### 2. Sablon alapú email bekérés
- Egyetlen kattintással előnézhető és kiküldhető az egyedi bizonylatbekérő e-mail, amely tartalmazza a hiányzó tételek listáját és egy közvetlen feltöltési linket.',
    '/eaisybooks/missing-invoices',
    ARRAY['hiányzó számla', 'bekérés', 'felszólítás', 'email sablon', 'egyeztetés'],
    'FileText',
    '3 perc',
    3
  ),
  (
    'eaisybooks-tax-calendar-deadlines',
    'books_portfolio',
    'Hatósági adónaptár és határidő figyelő',
    'NAV, HIPA és KSH bevallási és befizetési határidők aggregált naptára az összes kezelt ügyfélre kiterjedően.',
    '# Irodai Adónaptár

Az **Adónaptár** megelőzi a késedelmi pótlékokat és mulasztási bírságokat a közelgő határidők figyelésével.

### 1. Aggregált határidő lista
- 12-e: Havi bérbevallás (NAV 08) és járulékok befizetése.
- 20-a: Havi és negyedéves ÁFA bevallás (NAV 65).
- Május 31: Éves társasági adó és számviteli beszámoló határideje.

### 2. Státuszkövetés
- A könyvelők pipálhatják az elkészült, jóváhagyott és benyújtott bevallásokat cég szinten.',
    '/eaisybooks/tax-calendar',
    ARRAY['adónaptár', 'határidő', 'nav határidő', 'bevallás', 'naptár'],
    'Calendar',
    '3 perc',
    4
  ),

  -- ── 9. books_modules (eaisyBooks Szakmai Modulok) ──
  (
    'eaisybooks-ev-and-cashbook',
    'books_modules',
    'Egyéni vállalkozói (EV) könyvvitel és pénztárkönyv',
    'Átalányadózó és tételes költségelszámoló egyéni vállalkozók nyilvántartása, pénztárkönyvi zárás és határidők.',
    '# Egyéni vállalkozók (EV) könyvelése

Az egyéni vállalkozók számára kialakított speciális modul kezeli az átalányadózás és a tételes költségelszámolás sajátosságait.

### 1. Átalányadó bevételi nyilvántartás
- Valós idejű bevételi keretfigyelő az éves átalányadózási és alanyi adómentes (AAM) keretekhez.
- Automatikus költséghányad (40%, 80%, 90%) alkalmazása a vállalkozó TEÁOR és ÖVTJ tevékenységi köre alapján.
- Negyedéves adó- és járulékkalkuláció a személyi jövedelemadó és szocho bevallások előkészítéséhez.

### 2. Pénztárkönyv és részletező nyilvántartások
- Pénzforgalmi szemléletű bevételek és elszámolható kiadások rögzítése.
- Vevői és szállítói kötelezettségek nyilvántartása és időszaki pénztárkönyvi zárása.',
    '/eaisybooks/ev',
    ARRAY['ev', 'egyéni vállalkozó', 'pénztárkönyv', 'átalányadó', 'bevétel'],
    'Coins',
    '4 perc',
    1
  ),
  (
    'eaisybooks-ev-tax-optimization',
    'books_modules',
    'EV adóoptimalizálás és átalányadó kalkulátor',
    'Összehasonlító szimuláció: Átalányadó vs. Vállalkozói SZJA (VSZJA) vs. Főállású KATA adóterhelés.',
    '# EV Adóoptimalizáció és kalkulátorok

A könyvelőirodák leggyakoribb tanácsadási feladata az egyéni vállalkozó számára a legkedvezőbb adózási forma kiválasztása.

### 1. Összehasonlító szimuláció
- A várható éves árbevétel és igazolt költségek megadásával a kalkulátor párhuzamosan kiszámolja:
  - Fizetendő SZJA, TB járulék és SZOCHO összege.
  - HIPA (Helyi iparűzési adó) egyszerűsített és tételes összege.
  - Kamarai hozzájárulás és nettó jövedelem.

### 2. Évközi döntéstámogatás
- Figyelmeztetés a keretösszegek (pl. AAM 12 millió Ft) átlépésének közeledtére.',
    '/eaisybooks/ev',
    ARRAY['adóoptimalizálás', 'kalkulátor', 'vszja', 'kata', 'átalányadó', 'adóterhelés'],
    'Calculator',
    '3 perc',
    2
  ),
  (
    'eaisybooks-tao-kiva-planner',
    'books_modules',
    'TAO és KIVA tervező és év végi zárási ellenőrzőlista',
    'Társasági adó és kisvállalati adó kalkuláció, adónem összehasonlítás és adóalap korrekciók.',
    '# TAO és KIVA adótervező modul

A társasági adó (TAO) és a kisvállalati adó (KIVA) közötti választás és az év végi adóalap megállapítás kulcsfontosságú pénzügyi döntés.

### 1. Adónem összehasonlítás
- A rendszer a lekönyvelt eredménykimutatás és a bérköltségek alapján szimulálja mindkét adónem várható fizetési kötelezettségét.
- Grafikonos és táblázatos döntéstámogatás a kedvezőbb adózási forma kiválasztásához.

### 2. Év végi zárási ellenőrzőlista
- Lépésről lépésre végigvezet a zárási folyamatokon: leltár egyeztetés, időbeli elhatárolások, értékcsökkenési leírások és adóalap módosító tételek áttekintése.',
    '/eaisybooks/tao',
    ARRAY['tao', 'kiva', 'adótervező', 'zárás', 'ellenőrzőlista'],
    'Landmark',
    '4 perc',
    3
  ),
  (
    'eaisybooks-payroll-and-xml-reconstruction',
    'books_modules',
    'Irodai bérszámfejtés és 08-as ÁNYK XML rekonstrukció',
    'Többhavi NAV 08 ÁNYK XML kötegelt visszafejtése, dolgozói jogviszonyok és bérszámfejtési rekonstrukció.',
    '# Bérszámfejtés és XML rekonstrukció

Az eaisyBooks speciális funkciója lehetővé teszi egy új ügyfél korábbi béradatainak perceken belüli importálását.

### 1. NAV 08 ÁNYK XML visszafejtés
- Töltsd fel az ügyfél korábbi könyvelője által benyújtott 08-as havi XML bevallásokat.
- A rendszer automatikusan felépíti a dolgozói törzset, azonosítja a jogviszonykódokat, a bruttó béreket és az érvényesített adókedvezményeket.

### 2. Kötegelt havi számfejtés
- Több cég bérszámfejtése párhuzamosan, automatikus bérjegyzék e-mail generálással.',
    '/eaisybooks/payroll',
    ARRAY['bérszámfejtés', 'nav 08', 'xml rekonstrukció', 'jogviszony', 'bérjegyzék'],
    'Users',
    '4 perc',
    4
  ),

  -- ── 10. books_admin (eaisyBooks Adminisztráció & AI) ──
  (
    'eaisybooks-cegkapu-and-representation',
    'books_admin',
    'Cégkapu / KÜNY tárhely szinkronizáció és EGYKE képviselet',
    'Hivatalos elektronikus tárhely üzenetek, határozatok és meghatalmazások nyomon követése.',
    '# Cégkapu és KÜNY tárhely kezelés

A könyvelőirodák számára elengedhetetlen a hatósági megkeresések és határozatok határidőben történő feldolgozása.

### 1. Tárhely üzenetek automatikus érkeztetése
- A rendszer figyeli az ügyfelek Cégkapu és KÜNY tárhelyére érkező hivatalos értesítéseket (NAV, Önkormányzat, KSH).
- Letölti az igazolásokat, felbontja a csatolmányokat és archiválja a dokumentumokat.

### 2. EGYKE képviseleti nyilvántartás
- Adóhatósági meghatalmazások érvényességének, típusának és lejárati dátumainak nyilvántartása.
- Figyelmeztetés a megújításra váró képviseleti jogosultságokra.',
    '/eaisybooks/cegkapu',
    ARRAY['cégkapu', 'küny', 'tárhely', 'egyke', 'képviselet', 'hatóság'],
    'Shield',
    '3 perc',
    1
  ),
  (
    'eaisybooks-ai-assistant-chat',
    'books_admin',
    'eaisyBooks AI Asszisztens és szakmai segítség',
    'Számviteli, bérszámfejtési és adózási kérdések gyors tisztázása a beépített AI szakértővel.',
    '# eaisyBooks AI Asszisztens

Az eaisyBooks beépített mesterséges intelligencia asszisztense közvetlen szakmai támogatást nyújt a könyvelők és pénzügyi szakemberek mindennapi munkájában.

### 1. Mire használható az AI Asszisztens?
- **Jogszabályi kérdések:** A Munka Törvénykönyve, Szja, Tbj, Szocho és Áfa szabályok gyors értelmezése.
- **Bérszámfejtési segítség:** Családi kedvezmények, eltartottak és 25 év alattiak kedvezményének szabályai.
- **KIVA vs TAO döntéstámogatás:** Adózási szempontok és határidők áttekintése.

### 2. Lebegő elérés és gyorsműveletek
- A képernyő jobb alsó sarkában található funkciógombbal bármikor előhívható az asszisztens.
- A leggyakoribb témákhoz előre felkészített gyorsműveleti kártyák állnak rendelkezésre.',
    '/eaisybooks/ai-assistant',
    ARRAY['ai', 'asszisztens', 'chat', 'számvitel', 'szakértő', 'jogszabály'],
    'Bot',
    '3 perc',
    2
  ),
  (
    'eaisybooks-approval-queue-and-alerts',
    'books_admin',
    'Jóváhagyási várólista és riasztási központ',
    'Ügyfelek által feltöltött számlák könyvelői jóváhagyása és rendszerszintű kritikus riasztások.',
    '# Jóváhagyási sor és Riasztások

A könyvelőirodai munkafolyamat ellenőrzési pontjait a **Jóváhagyási sor** és a **Riasztások** modulok biztosítják.

### 1. Jóváhagyási sor (Approval Queue)
- Az ügyfelek által feltöltött bizonylatok áttekintése a könyvelésbe történő végleges bejegyzés előtt.
- Elfogadás, elutasítás hiánypótlási kéréssel vagy módosítási javaslat.

### 2. Riasztási központ
- Figyelmeztetések érvénytelen adószámú partnerekre, sikertelen NAV számlaszinkronra vagy közeledő adózási határidőkre.',
    '/eaisybooks/approval-queue',
    ARRAY['jóváhagyás', 'sor', 'riasztás', 'anomália', 'ellenőrzés'],
    'TicketCheck',
    '3 perc',
    3
  ),
  (
    'eaisybooks-office-settings-and-templates',
    'books_admin',
    'Irodai könyvelők, szerepkörök és sablonok',
    'Könyvelőirodai csapattagok, senior felülvizsgálók, jogosultsági mátrix és hivatalos dokumentumsablonok.',
    '# Irodai beállítások és adminisztráció

Az **Irodai Beállítások** menüpontban a könyvelőiroda vezetője szabhatja testre a belső folyamatokat.

### 1. Könyvelői jogosultságok
- Könyvelők, bérszámfejtők és asszisztensek szerepkörei.
- Ügyfél-hozzárendelések és felelősségi körök meghatározása.

### 2. Sablonok és jogszabályi paraméterek
- Értesítő levélsablonok, szerződésminták, jogviszonykódok és adómértékek központi beállítása.',
    '/eaisybooks/settings',
    ARRAY['iroda beállítás', 'könyvelők', 'jogosultság', 'sablonok', 'adminisztráció'],
    'Wrench',
    '3 perc',
    4
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
