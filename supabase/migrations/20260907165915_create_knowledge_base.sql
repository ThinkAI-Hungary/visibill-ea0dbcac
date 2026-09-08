-- ==============================================================================
-- Migration: 20260907170000_create_knowledge_base.sql
-- Description: eaisyBill & eaisyBooks Egységes Tudástár (Knowledge Base) adatmodell,
--              FTS indexek, RLS szabályok és átfogó szakmai seed tartalom.
-- Reference: visibill-db-checklist, Decision 055, PRD P-077, P-078, ADR A-104, A-105
-- ==============================================================================

-- 1. Kategóriák tábla
CREATE TABLE IF NOT EXISTS public.knowledge_base_categories (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'BookOpen',
  order_num INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Cikkek tábla
CREATE TABLE IF NOT EXISTS public.knowledge_base_articles (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES public.knowledge_base_categories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  menu_path TEXT,
  tags TEXT[] DEFAULT '{}',
  icon TEXT DEFAULT 'FileText',
  estimated_read_time TEXT DEFAULT '3 perc',
  order_num INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  fts TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('simple', title || ' ' || summary || ' ' || content)
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Indexek (FK, rendezés, Full-Text Search)
CREATE INDEX IF NOT EXISTS idx_kb_articles_category ON public.knowledge_base_articles(category_id);
CREATE INDEX IF NOT EXISTS idx_kb_articles_published ON public.knowledge_base_articles(is_published, order_num);
CREATE INDEX IF NOT EXISTS idx_kb_articles_fts ON public.knowledge_base_articles USING gin(fts);

-- 4. RLS engedélyezése
ALTER TABLE public.knowledge_base_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base_articles ENABLE ROW LEVEL SECURITY;

-- 5. RLS Házirendek
DROP POLICY IF EXISTS "Allow authenticated read knowledge_base_categories" ON public.knowledge_base_categories;
CREATE POLICY "Allow authenticated read knowledge_base_categories"
  ON public.knowledge_base_categories FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated read knowledge_base_articles" ON public.knowledge_base_articles;
CREATE POLICY "Allow authenticated read knowledge_base_articles"
  ON public.knowledge_base_articles FOR SELECT
  TO authenticated
  USING (is_published = true);

DROP POLICY IF EXISTS "Allow service_role full access knowledge_base_categories" ON public.knowledge_base_categories;
CREATE POLICY "Allow service_role full access knowledge_base_categories"
  ON public.knowledge_base_categories FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow service_role full access knowledge_base_articles" ON public.knowledge_base_articles;
CREATE POLICY "Allow service_role full access knowledge_base_articles"
  ON public.knowledge_base_articles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 6. Jogosultságok
REVOKE ALL ON TABLE public.knowledge_base_categories FROM anon;
REVOKE ALL ON TABLE public.knowledge_base_articles FROM anon;
GRANT SELECT ON TABLE public.knowledge_base_categories TO authenticated;
GRANT SELECT ON TABLE public.knowledge_base_articles TO authenticated;
GRANT ALL ON TABLE public.knowledge_base_categories TO service_role;
GRANT ALL ON TABLE public.knowledge_base_articles TO service_role;

-- 7. Seed kategóriák beszúrása (7 kategória)
INSERT INTO public.knowledge_base_categories (id, title, description, icon, order_num)
VALUES
  ('basics', 'Alapok & Navigáció', 'Kezdő lépések, felület megismerése, cégváltás és jogosultságok', 'Compass', 1),
  ('invoices', 'Bizonylatok & Számlák', 'Számlák feldolgozása, OCR feltöltés, jóváhagyás és sztornózás', 'Receipt', 2),
  ('transactions', 'Pénzügyek & Bank', 'Banki tranzakciók, automatikus párosítás, házipénztár és kintlévőség', 'Landmark', 3),
  ('accounting', 'Könyvelés & Adózás', 'Főkönyvi kivonat, számlatükör, ÁFA bevallás és mérlegkimutatások', 'BookOpen', 4),
  ('hr', 'Bérszámfejtés & HR', 'Havi bérszámfejtési ciklus, jelenléti ív, járulékok és munkaidő', 'Users', 5),
  ('system', 'Integrációk & Rendszer', 'NAV Online Számla, email fiókok, hibajegyek és beállítások', 'Wrench', 6),
  ('eaisybooks', 'eaisyBooks Könyvelőiroda', 'Kliensek kezelése, könyvelői zárások, egyéni vállalkozók, TAO/KIVA és AI asszisztens', 'Briefcase', 7)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  order_num = EXCLUDED.order_num;

-- 8. Seed cikkek beszúrása (17 cikk, technikai útvonalaktól mentes szövegezéssel)
INSERT INTO public.knowledge_base_articles (id, category_id, title, summary, content, menu_path, tags, icon, estimated_read_time, order_num)
VALUES
  (
    'navigation-and-company-switching',
    'basics',
    'Kezdő lépések, navigáció és cégváltás',
    'Ismerd meg az eaisyBill modern felületét, a hierarchikus cégválasztót és a gyorsbillentyűket.',
    '# Kezdő lépések az eaisyBill rendszerben

Az eaisyBill egy teljes körű pénzügyi és könyveléstámogató platform. A felület bal oldalán található a fő navigációs menü, felül a globális kereső és cégválasztó, középen pedig az aktív munkaterület.

### 1. Cégváltás és cégprofil
- A fejlécben vagy az oldalsáv tetején lévő **Cégválasztó** lenyíló menüvel azonnal válthatsz az általad kezelt vállalkozások között.
- Cégváltáskor a rendszer az aktuálisan nyitott aloldalon tart (pl. ha a Számlák nézetben vagy, a másik cégnél is a Számlák nyílik meg).

### 2. Gyorsbillentyűk (Hotkeys)
- `Ctrl + B`: Oldalsáv (sidebar) összecsukása és kinyitása.
- `Ctrl + K`: Gyorskereső és parancspaletta megnyitása.
- `Esc`: Felugró ablakok, modálok és szűrők azonnali bezárása.

### 3. Sötét és világos mód
- A felület támogatja a modern sötét módot (Dark Mode), amely az oldalsáv alsó felhasználói menüjéből vagy a profil beállításoknál aktiválható.',
    '/',
    ARRAY['navigáció', 'cégváltás', 'gyorsbillentyű', 'alapok', 'kezdés'],
    'Compass',
    '2 perc',
    1
  ),
  (
    'roles-and-permissions',
    'basics',
    'Felhasználói szerepkörök és hozzáférések',
    'Ismerd meg a rendszer többszintű szerepkör-kezelését és az egyedi modul jogosultságokat.',
    '# Jogosultsági szintek az eaisyBill rendszerben

A rendszer szigorú, többlépcsős szerepkör-alapú hozzáférés-vezérlést biztosít a vállalkozási adatok védelmére.

### Szerepkörök hierarchiája:
1. **Tulajdonos (Owner):** Teljes hozzáférés a cég összes pénzügyi, banki és számlázási adatához, valamint a számlázási előfizetéshez.
2. **Adminisztrátor (Admin):** Kezelheti a csapattagokat, integrációkat, számlákat és pénzügyi beállításokat.
3. **Munkatárs (Member):** Számlák és tranzakciók rögzítése, megtekintése és jóváhagyása.
4. **Asszisztens (Assistant):** Bizonylatok feltöltése, hiányzó számlák pótlása korlátozott pénzügyi rálátással.
5. **Megtekintő (Viewer):** Csak olvasható hozzáférés riportokhoz és kimutatásokhoz.
6. **Munkavállaló (Employee):** Kizárólag a saját munkaidejét és jelenlétét rögzítheti.',
    '/settings',
    ARRAY['jogosultság', 'szerepkör', 'admin', 'owner', 'biztonság'],
    'Shield',
    '3 perc',
    2
  ),
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

### 3. Haladó szűrők
- Szűrés partnerre, fizetési határidőre, ÁFA kulcsra vagy összegtartományra.
- A szűrők állapota azonnal tükröződik az URL-ben, így a szűrt lista könyvjelzőzhető vagy megosztható.',
    '/invoices',
    ARRAY['számla', 'bejövő', 'kimenő', 'szűrés', 'státusz', 'áfa'],
    'Receipt',
    '4 perc',
    3
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
- Számla sorszáma és típusa (normál, végszámla, előleg, díjbekérő).
- Kibocsátó és vevő adószáma, neve, címe.
- Teljesítés kelte, kibocsátás dátuma és fizetési határidő.
- Nettó összeg, ÁFA kulcsok és bruttó végösszeg.
- Tételes sorok és termékmegnevezések.',
    '/upload',
    ARRAY['feltöltés', 'ocr', 'ai', 'vision', 'pdf', 'számlafeldolgozás'],
    'Upload',
    '3 perc',
    4
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
- Ha a számla stornózása banki mozgás nélkül történt, a számla részleteiben található "Sztornó lezárása" gombbal a bizonylat közvetlenül lezárható.',
    '/invoices',
    ARRAY['storno', 'helyesbítő', 'módosítás', 'kioltás'],
    'RotateCcw',
    '2 perc',
    5
  ),
  (
    'bank-transactions-and-matching',
    'transactions',
    'Banki tranzakciók és intelligens számlapárosítás',
    'Hogyan tölts fel bankkivonatot, és hogyan párosítja az algoritmus a banki mozgásokat a számlákkal.',
    '# Banki tranzakciók és párosítás

A **Tranzakciók** menüpontban láthatók a bankszámlák és pénzforgalmi szolgáltatók (például OTP, Erste, Revolut, Wise) pénzmozgásai.

### 1. Banki adatok betöltése
- **Kivonat feltöltése:** CSV, CAMT vagy PDF formátumú bankkivonatok egyszerű feltöltése.
- A rendszer kiszűri és megelőzi a duplikált tranzakciók rögzítését.

### 2. Háromszintű párosítási folyamat
1. **Pontos egyezés:** Ha a közleményben szerepel a számlaszám és az összeg forintra megegyezik, a rendszer azonnal zöldre váltja a párosítást.
2. **Intelligens javaslatok:** Partnernév hasonlóság és dátumközelség alapján javaslatot tesz a könyvelőnek.
3. **Manuális párosítás:** Egyetlen kattintással összeköthetsz egy tranzakciót akár több részszámlával is.',
    '/transactions',
    ARRAY['bank', 'tranzakció', 'matching', 'párosítás', 'kivonat'],
    'Landmark',
    '4 perc',
    6
  ),
  (
    'petty-cash-and-manual-payments',
    'transactions',
    'Házipénztár és készpénzes bizonylatok',
    'Készpénzes kifizetések rögzítése, pénztárbizonylatok és készpénzforgalmi nyilvántartás.',
    '# Házipénztár kezelése

A készpénzes vásárlások és elszámolások a **Házipénztár** modulban követhetők nyomon.

### 1. Készpénzes számlák
- A készpénzes számlák automatikusan bekerülnek a házipénztár forgalmi listájába.
- A rendszer azonnal nyilvántartja a pénztár egyenleg változását.

### 2. Bevételi és kiadási pénztárbizonylat
- Kézi pénztárbizonylat állítható ki dolgozói előleghez, tagi kölcsönhöz vagy egyéb készpénzmozgáshoz.',
    '/petty-cash',
    ARRAY['házipénztár', 'készpénz', 'pénztárbizonylat', 'kiadás'],
    'Coins',
    '2 perc',
    7
  ),
  (
    'general-ledger-and-chart-of-accounts',
    'accounting',
    'Főkönyvi kivonat, kontírozás és számlatükör',
    'Kettős könyvvitel alapjai, számlaosztályok, automatikus kontírozási javaslatok és naplók.',
    '# Főkönyv és számlatükör

A **Főkönyv** menüpont a kettős könyvvitelt vezető vállalkozások és könyvelőik központi munkafelülete.

### 1. Magyar számlatükör felépítése
- 1. Számlaosztály: Befektetett eszközök
- 2. Számlaosztály: Készletek
- 3. Számlaosztály: Követelések, pénzeszközök
- 4. Számlaosztály: Források (saját tőke, kötelezettségek)
- 5. Számlaosztály: Költségnemek (anyag, bér, egyéb)
- 8-9. Számlaosztály: Ráfordítások és Bevételek

### 2. Könyvelési szabályok
- A vállalkozáshoz egyedi kontírozási szabályok rendelhetők, amelyek alapján a rendszer automatikusan javaslatot tesz a Tartozik és Követel főkönyvi számokra.',
    '/general-ledger',
    ARRAY['főkönyv', 'számlatükör', 'kontírozás', 'kettős könyvvitel'],
    'BookOpen',
    '4 perc',
    8
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
    9
  ),
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
    10
  ),
  (
    'nav-online-szamla-sync',
    'system',
    'NAV Online Számla integráció beállítása',
    'Hogyan kösd össze vállalkozásodat a NAV-val technikai felhasználó segítségével a számlák automatikus letöltéséhez.',
    '# NAV Online Számla integráció

Az automatikus számlaszinkronizációhoz be kell állítani a NAV Technikai felhasználó adatait.

### Szükséges adatok a NAV Online Számla portálról:
1. **Technikai felhasználónév:** A NAV felületén létrehozott technikai felhasználó azonosítója.
2. **Jelszó:** A felhasználóhoz tartozó jelszó.
3. **XML Aláírókulcs:** 32 karakteres titkos biztonsági kulcs.
4. **XML Cserekulcs:** 32 karakteres titkos biztonsági kulcs.

Az adatok mentése után a rendszer titkosítva tárolja a kulcsokat, és automatikusan óránként lekérdezi a legfrissebb számlákat.',
    '/integrations',
    ARRAY['nav', 'online számla', 'integráció', 'szinkron', 'technikai felhasználó'],
    'Wrench',
    '3 perc',
    11
  ),
  (
    'tickets-and-support',
    'system',
    'Hibajegyek beküldése és felhasználói támogatás',
    'Hogyan jelents be hibát, küldj képernyőképet és kövesd a fejlesztői csapat visszajelzéseit.',
    '# Hibajegyek és terméktámogatás

Ha kérdésed van a rendszer működésével kapcsolatban vagy észrevételt tennél, a **Hibajegyek** menüpontban közvetlenül kapcsolatba léphetsz a technikai csapattal.

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
    12
  ),
  (
    'eaisybooks-client-management',
    'eaisybooks',
    'Kliensek és ügyfelek kezelése az eaisyBooks-ban',
    'Ügyféltörzs áttekintése, új cég felvétele, könyvelői meghatalmazások és kapcsolattartók adminisztrációja.',
    '# Kliensek és ügyféltörzs kezelése

Az eaisyBooks a könyvelőirodák és több vállalkozást kezelő szakemberek központi munkafelülete, amely lehetővé teszi több tucat vagy több száz ügyfél átlátható nyilvántartását.

### 1. Ügyféllista és gyorskeresés
- Az Ügyfelek listájában azonnal látható minden kezelt cég neve, adószáma, vállalkozási formája (Kft., Bt., EV) és adózási módja (TAO, KIVA, Átalányadó).
- Gyorsszűrők segítségével pillanatok alatt listázhatók az aktív, szünetelő vagy könyvelői felülvizsgálatra váró vállalkozások.

### 2. Kliens adatlap és beállítások
- Minden ügyfélhez egyedi könyvelési beállítások, kapcsolattartói adatok, bankszámlaszámok és adóhatósági technikai hozzáférések rendelhetők.
- A könyvelői feljegyzések és belső emlékeztetők közvetlenül az ügyfél adatlapján követhetők.

### 3. Cégváltás egyetlen kattintással
- Az irodai felületről bármelyik ügyfél részletes belső számláihoz és kimutatásaihoz közvetlenül beléphetsz az adott cégre kattintva.',
    '/eaisybooks/clients',
    ARRAY['eaisybooks', 'kliens', 'ügyféltörzs', 'könyvelőiroda', 'cégválasztó'],
    'Briefcase',
    '3 perc',
    13
  ),
  (
    'eaisybooks-ev-and-cashbook',
    'eaisybooks',
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
    'BookOpen',
    '4 perc',
    14
  ),
  (
    'eaisybooks-tao-kiva-planner',
    'eaisybooks',
    'TAO és KIVA tervező és év végi zárási ellenőrzőlista',
    'Társasági adó és kisvállalati adó kalkuláció, adónem összehasonlítás és adóalap korrekciók.',
    '# TAO és KIVA adótervező modul

A társasági adó (TAO) és a kisvállalati adó (KIVA) közötti választás és az év végi adóalap megállapítás kulcsfontosságú pénzügyi döntés.

### 1. Adónem összehasonlítás
- A rendszer a lekönyvelt eredménykimutatás és a bérköltségek alapján szimulálja mindkét adónem várható fizetési kötelezettségét.
- Grafikonos és táblázatos döntéstámogatás a kedvezőbb adózási forma kiválasztásához.

### 2. Év végi zárási ellenőrzőlista
- Lépésről lépésre végigvezet a zárási folyamatokon: leltár egyeztetés, időbeli elhatárolások, értékcsökkenési leírások és adóalap módosító tételek áttekintése.',
    '/eaisybooks/tax-planner',
    ARRAY['tao', 'kiva', 'adótervező', 'zárás', 'ellenőrzőlista'],
    'Calculator',
    '4 perc',
    15
  ),
  (
    'eaisybooks-cegkapu-and-representation',
    'eaisybooks',
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
    16
  ),
  (
    'eaisybooks-ai-assistant-chat',
    'eaisybooks',
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
    17
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
