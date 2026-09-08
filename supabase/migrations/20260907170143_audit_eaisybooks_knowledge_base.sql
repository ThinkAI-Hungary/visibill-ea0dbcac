-- Migration: 20260907200000_audit_eaisybooks_knowledge_base.sql
-- Description: Audit and complete eaisyBooks menus and features in Knowledge Base
-- Adds 6 new dedicated articles covering reports & AI anomalies, onboarding & new client wizard,
-- EV registers & lifecycle, payroll documents & payslips, accounting AI prompts, and audit & GDPR.

INSERT INTO public.knowledge_base_articles (
  id, category_id, title, summary, content, menu_path, tags, icon, estimated_read_time, order_num, is_published
) VALUES
(
  'eaisybooks-reports-and-ai-anomalies',
  'books_portfolio',
  'Vezetői riportok, havi zárási kimutatások és AI anomália elemzés',
  'Összesített havi kimutatások, ÁFA- és költségelemzések, partner forgalmi riportok, valamint a mesterséges intelligencia által vezérelt bérszámfejtési és számla anomália motor.',
  '# Vezetői Riportok és AI Anomália Elemzés az eaisyBooks Rendszerben

Az eaisyBooks **Riportok** és **AI Anomália Elemzés** felületei az irodavezetők és senior könyvelők számára nyújtanak mélyreható statisztikai rálátást a teljes könyvelési portfólióra, az egyes megbízók gazdálkodására, valamint a számfejtési hibák azonnali kiszűrésére.

---

## 1. Elérhető Riport Típusok és Exportálási Lehetőségek

A Riportkatalógus a következő előre definiált szakmai kimutatásokat biztosítja:
1. **Havi összesítő riport:** Bejövő és kimenő számlák konszolidált forgalma, nettó, ÁFA és bruttó összegek, valamint fizetési státuszok ügyfelenként.
2. **ÁFA analitika:** Kulcsonkénti ÁFA bontás (27%, 18%, 5%, 0%, AAM), fizetendő és levonható adó egyenlege, valamint az arányosítás alá eső tételek ellenőrzése.
3. **Költségkimutatás:** Számlaosztályok és költséghelyek szerinti aggregált kiadási struktúra, kiugró tételek automatikus jelölésével.
4. **Cash flow és likviditási riport:** Pénzforgalmi szemléletű egyenlegek, esedékességi korosítás és banki likviditási előrejelzés.
5. **Partner forgalmi kimutatás:** Legnagyobb beszállítók és vevők forgalma, koncentrációs kockázatok és kapcsolt vállalkozások forgalmi adatai.
6. **Hiányzó számlák kimutatása:** Bekérési hatékonyság, függő bizonylatok statisztikája és partnerek fizetési/beküldési fegyelme.

Valamennyi kimutatás egyaránt lekérhető gyors képernyős előnézetben, részletes adatsorokkal kiegészített **Excel / CSV** táblázatként, vagy nyomdakész, cégfejléces **PDF** dokumentumként.

---

## 2. AI Anomália Motor a Bérszámfejtésben és Könyvelésben

Az intelligens anomália-detektáló motor automatikusan végigellenőrzi az összes rögzített adatot, és figyelmeztet a potenciális adókockázatokra:
- **Minimálbér és garantált bérminimum vizsgálat:** Figyelmeztet, ha a havi alapbér vagy a számított órabér nem éri el a jogszabályi minimumot (a FEOR kód szakképzettségi követelményének figyelembevételével).
- **Heti munkaidő és biztosítási jogviszony:** Eltérések detektálása a heti 40 órás teljes munkaidő, a részmunkaidő, valamint a biztosítási státusz között.
- **Szabadságkeret túllépés:** Éves alapszabadság, pótszabadságok és a már kivett napok automatikus egyenleg-ellenőrzése.
- **Havi bérkilengések és fluktuáció:** Kiugró, 30%-ot meghaladó havi bérváltozások, indokolatlan prémiumok vagy hirtelen alapbércsökkenések jelzése a zárás előtt.

---

## 3. Jogosultsági Szabályok és Bizalmas Adatkezelés

A Riportok modul és az AI Anomália központ elérése szigorúan korlátozott:
- Kizárólag az **Iroda Admin** és a **Senior Könyvelő** szerepkörrel rendelkező munkatársak férhetnek hozzá.
- Az asszisztensek és junior könyvelők csak az általuk kezelt egyedi kliensek bizonylatszintű listáit láthatják, a teljes portfólióra kiterjedő aggregált pénzügyi kimutatásokat nem.',
  '/eaisybooks/reports',
  ARRAY['#riportok', '#anomália', '#elemzés', '#statisztika', '#ai', '#bérszámfejtés', '#zárás'],
  'BarChart3',
  '4 perc',
  5,
  true
),
(
  'eaisybooks-onboarding-and-new-client',
  'books_portfolio',
  'Irodai onboarding folyamat és új ügyfél felvételi varázsló',
  'Új könyvelőirodai regisztráció beállítása, mérföldkövek követése, valamint az új ügyfelek 3 lépéses felvétele AI cégleírás generálással és integrációval.',
  '# Irodai Onboarding és Új Ügyfél Felvétel

Az eaisyBooks kialakításának köszönhetően az új könyvelőirodák rendkívül gyorsan, zökkenőmentesen állhatnak át a digitális munkavégzésre, miközben az új ügyfelek beköltöztetése automatizált varázslókon keresztül történik.

---

## 1. Irodai Onboarding Vezérlőpult (5 Mérföldkő)

Az új könyvelőiroda bevezetése során az Onboarding felület lépésről lépésre vezeti végig az irodavezetőt a kritikus konfigurációkon:
1. **Iroda alapadatok:** Könyvelőiroda hivatalos neve, adószáma, székhelye és kapcsolattartói elérhetőségei.
2. **Munkatársak és szerepkörök:** Könyvelők, bérszámfejtők és asszisztensek meghívása email alapján, megfelelő jogosultsági szintekkel.
3. **Első ügyfél beköltöztetése:** Az első megbízó cég adatainak rögzítése az új kliens varázsló segítségével.
4. **Cégkapu és NAV kapcsolat:** Hatósági kulcsok és technikai felhasználók élesítése a közvetlen szinkronizációhoz.
5. **Sablonok és automatizmusok:** Alapértelmezett számlabekérő emailek, bérjegyzék kísérőlevelek és emlékeztetők aktiválása.

---

## 2. Új Ügyfél Felvételi Varázsló (3 Lépéses Folyamat)

Új megbízó cég hozzáadásakor a rendszer egy dedikált varázslón kíséri végig a könyvelőt:
- **1. lépés — Cégadatok és AI profilalkotás:**
  - Cégnév, 8-1-2 formátumú adószám, székhely és elsődleges TEÁOR kód megadása.
  - Az automatikus AI cégleírás generáló funkció a megadott TEÁOR szám és cégnév alapján elkészíti a vállalkozás tevékenységi profilját, amely segít az intelligens kontírozási szabályok azonnali felállításában.
- **2. lépés — Szoftveres integrációk kiválasztása:**
  - Meglévő könyvelőszoftver integrációjának beállítása (RLB60, Novitax, vagy egyéb egyedi adatcsere formátumok).
  - NAV Online Számla technikai felhasználó és cserekulcsok megadása a múltbeli számlatörténet azonnali letöltéséhez.
- **3. lépés — Ügyfélemeil és meghívó kód kibocsátása:**
  - A rendszer előállít egy egyedi, 8 karakteres ügyfél meghívó kódot.
  - A megbízó ügyfél ezzel a kóddal regisztrálhat az eaisyBill számlakezelő felületére, amely automatikusan összeköti a vállalkozást a könyvelőirodával.',
  '/eaisybooks/onboarding',
  ARRAY['#onboarding', '#új-ügyfél', '#varázsló', '#teáor', '#meghívó-kód', '#bevezetés', '#iroda'],
  'Rocket',
  '4 perc',
  6,
  true
),
(
  'eaisybooks-ev-lifecycle-and-registers',
  'books_modules',
  'Egyéni vállalkozás (EV) életciklus, nyilvántartások és értékhatár monitor',
  'Alanyi adómentesség és átalányadó keretek monitorozása, kötelező nyilvántartások vezetése (útnyilvántartás, beruházások) és szüneteltetés kezelése.',
  '# Egyéni Vállalkozás (EV) Életciklus és Nyilvántartások

Az egyéni vállalkozások könyvelése speciális szabályrendszert követ. Az eaisyBooks EV modulja nemcsak a bevételek és kiadások rögzítését biztosítja, hanem folyamatosan felügyeli a jogszabályi értékhatárokat és támogatja az egyéni vállalkozás teljes életciklusát.

---

## 1. Törvényi Értékhatárok Monitorozása (Threshold Monitor)

A rendszer valós időben számítja és vizualizálja a legfontosabb adózási plafonokat:
- **Alanyi adómentesség (AAM) keret:** Az évi 12 000 000 Ft-os értékhatár folyamatos figyelése. Év közben induló vállalkozás esetén a rendszer automatikusan naptári napra arányosítja a keretet.
- **Átalányadó bevételi plafon:** Az éves minimálbér tízszerese (általános tevékenységnél), illetve ötvenszerese (kizárólag kiskereskedelmi tevékenységet folytatóknál).
- **Adómentes jövedelmi sáv:** Az átalányadózók számára biztosított, éves minimálbér felét kitevő adómentes jövedelemkeret felhasználtságának nyomon követése.
- **Gépjármű és cégautóadó mentesség:** Cégautóadó vizsgálat útnyilvántartás vagy havi 500 km-es átalányköltség elszámolás esetén.

---

## 2. Kötelező EV Szakmai Nyilvántartások

A jogszabály által előírt analitikus nyilvántartások közvetlenül kezelhetők a felületről:
1. **Pénztárkönyv és részletező nyilvántartások:** Pénzforgalmi bevételek, készpénzes és banki mozgások tételes vezetése, a NAV Online Számla adataival szinkronizálva.
2. **Beruházási és tárgyi eszköz nyilvántartás:** Értékcsökkenési leírások számítása (számviteli és Szja törvény szerinti kulcsokkal), 200 000 Ft alatti kisértékű eszközök azonnali elszámolása.
3. **Gépjármű-használati nyilvántartás:** Havi útnyilvántartások rögzítése, kiküldetési rendelvények nyilvántartása, üzemanyagnorma szerinti költségkalkuláció.

---

## 3. EV Életciklus Kezelése: Szüneteltetés és Megszűnés

Az egyéni vállalkozás státuszváltozásai automatikus zárási és nyitási feladatokat vonnak maguk után:
- **Szüneteltetés bejelentése:** A Webes Ügysegéden tett bejelentést követően a rendszer rögzíti a szünetelés kezdő napját (minimum 1 hónap, maximum 2 év).
- **Záró feladatok szüneteléskor:** Az aktív időszakra vonatkozó havi 58-as járulékbevallás elkészítése, a függő követelések és tartozások felmérése, valamint a minimális járulékfizetési kötelezettség felfüggesztése.
- **Reaktiválás vagy végleges megszüntetés:** Szünetelés utáni újrainduláskor a keretösszegek időarányos újraszámítása, megszüntetés esetén a végleges Szja bevallás előkészítése.',
  '/eaisybooks/ev/thresholds',
  ARRAY['#ev', '#átalányadó', '#értékhatár', '#aam', '#szüneteltetés', '#útnyilvántartás', '#pénztárkönyv'],
  'ClipboardList',
  '4 perc',
  5,
  true
),
(
  'eaisybooks-payroll-documents-and-payslips',
  'books_modules',
  'Dolgozói bérjegyzékek, kifizetési jegyzékek és kilépő dokumentációk',
  'Havi bérlapok kötegelt generálása, jelszóval védett PDF export, banki utalási állományok, valamint a munkaviszony megszűnésekor kiadandó kilépő papírok.',
  '# Dolgozói Dokumentumok, Bérjegyzékek és Kilépő Papírok

A bérszámfejtési folyamat végeredményeként az eaisyBooks automatikusan előállítja a munkavállalók felé átadandó hivatalos elszámolásokat és a munkaviszony változásaival kapcsolatos kötelező okiratokat.

---

## 1. Havi Bérjegyzékek (Bérlapok) Generálása és Átadása

A havi bérszámfejtési ciklus lezárását követően elérhetővé válnak az egyéni fizetési jegyzékek:
- **Kötegelt bérlap generálás:** Egyetlen kattintással előállítható a cég összes dolgozójának havi bérjegyzéke cégfejléces, hivatalos formátumban.
- **Jelszóval védett PDF export:** A személyes adatok védelme érdekében a bérlapok titkosított, jelszóval védett (alapértelmezetten a munkavállaló adóazonosító jelének utolsó számjegyeivel nyitható) PDF formátumban tölthetők le.
- **e-Bérjegyzék munkavállalói portál:** Ha a munkavállaló rendelkezik felhasználói fiókkal, saját felületén digitálisan megtekintheti és letöltheti bérjegyzékeit, amelyről a rendszer igazolt átvételi naplót vezet.

---

## 2. Banki Kifizetési Jegyzék és Utalási Állomány

A nettó bérek és a levont köztartozások gyors kifizetéséhez a rendszer közvetlen exportokat készít:
- **Nettó bérek utalási listája:** Dolgozónkénti bankszámlaszámok, IBAN azonosítók és utalandó összegek tételes jegyzéke.
- **GIRO kötegelt banki fájl:** Szabványos GIRO és SEPA utalási állomány a vállalati netbankba történő közvetlen beolvasáshoz.
- **Levonások és letiltások kezelése:** Gyermektartásdíjak, végrehajtói letiltások és egyéb munkabérből levont összegek elkülönített kifizetési listája a végrehajtói letéti számlák felé.

---

## 3. Kilépő Munkavállalói Dokumentációk

Munkaviszony megszűnése vagy megszüntetése esetén a Kilépő Varázsló azonnal kiállítja a Munka Törvénykönyve által előírt igazolásokat:
1. **Jövedelemigazolás az egészségbiztosítási ellátásokhoz:** Igazolás a táppénz, CSED, GYED alapjául szolgáló jövedelmekről.
2. **Adatlap a személyi jövedelemadó levonásáról (Adatlap 2026):** Az év közben megszerzett jövedelemről és a levont adóelőlegekről.
3. **Munkáltatói igazolás az álláskeresési járadék megállapításához:** Ledolgozott napok, jogviszony időtartama és átlagbér feltüntetésével.
4. **Igazolólap a bírósági végrehajtói letiltásokról:** Fennálló vagy lezárt munkabér-letiltások hatósági igazolása.',
  '/eaisybooks/payroll/documents',
  ARRAY['#bérjegyzék', '#bérlap', '#kifizetés', '#giro', '#kilépő-papírok', '#adatlap', '#munkaügy'],
  'FileText',
  '4 perc',
  6,
  true
),
(
  'eaisybooks-accounting-prompts-and-rules',
  'books_admin',
  'Intelligens könyvelési szabályok és mesterséges intelligencia promptok testreszabása',
  'Cégenként testreszabható intelligens kontírozási és bizonylat-felismerési szabályok: licencek, kisértékű eszközök, üzemanyag és szakértői díjak automatizálása.',
  '# Intelligens Könyvelési Szabályok és Promptok Kezelése

Az eaisyBooks platform egyik legfejlettebb automatizációs eszköze a **Könyvelési Szabályok (Prompts)** felülete, ahol a könyvelők természetes nyelven és logikai feltételekkel határozhatják meg, hogyan dolgozza fel a mesterséges intelligencia az egyes bizonylatokat és tranzakciókat.

---

## 1. Hogyan Működnek az Intelligens Szabályok?

Amikor egy számla érkezik az OCR feldolgozóba vagy egy banki tranzakció kerül beolvasásra, az AI feldolgozó motor először a céghez rendelt aktív szabályokat futtatja le:
- Minden szabály egyedi névvel, célterülettel (költség, eszköz, szolgáltatás) és pontos utasítással rendelkezik.
- A szabályok prioritási sorrendben értékelődnek ki, felülbírálva az általános alapértelmezett gépi kontírozást.
- Bármely szabály egyetlen kattintással ki- és bekapcsolható anélkül, hogy a korábbi könyvelési tételek módosulnának.

---

## 2. Előre Beépített Szabálysablonok

A felületen azonnal aktiválhatók a leggyakrabban alkalmazott magyar számviteli minták:
1. **Szoftver licenc előfizetések:**
   - *Szabály leírás:* Minden olyan bejövő tétel, amely a szoftver, licenc, felhőszolgáltatás vagy előfizetés kifejezést tartalmazza (pl. Slack, Adobe, Zoom, Google Workspace), automatikusan az **529-es Egyéb igénybevett szolgáltatások** főkönyvi számlára kerül.
2. **Kisértékű tárgyi eszközök értékhatára:**
   - *Szabály leírás:* Ha a beszerzett tétel informatikai vagy irodai eszköz (pl. billentyűzet, monitor, dokkoló, irodaszék), és a bruttó összege nem éri el a 100 000 Ft-ot, a rendszer közvetlenül az **511-es Anyagköltség** közé könyveli beruházási aktiválás helyett.
3. **MOL és üzemanyag beszerzések:**
   - *Szabály leírás:* Minden ismert üzemanyagtöltő állomásról (MOL, OMV, Shell, Orlen) érkező számlát automatikusan az **513-as Üzemanyagköltség** számlára irányít.
4. **Könyvvizsgálati és jogi díjak:**
   - *Szabály leírás:* Ügyvédi megbízási díjak, szakértői költségek és könyvelési számlák esetén az automatikus kontír az **522-es Könyvvizsgálati, jogi és szakértői díjak** számlaosztály.

---

## 3. Új Egyedi Szabályok Felvétele és Tesztelése

A könyvelőirodák bármikor létrehozhatnak saját, cégspecifikus szabályokat:
- Megadható a partner neve, kulcsszavak a számlatétel megnevezéséből, valamint az összeghatár.
- Természetes magyar nyelvű instrukciók adhatók az AI számára (pl. *Ha a partner neve tartalmazza a Nyomda szót, könyveld a 523-as Hirdetés, reklám számlára*).
- A szabályok mentés előtt tesztelhetők korábbi számlák bizonylatadatain.',
  '/eaisybooks/prompts',
  ARRAY['#promptok', '#szabályok', '#kontírozás', '#ai', '#automatizáció', '#számlatükör', '#beállítások'],
  'Brain',
  '4 perc',
  5,
  true
),
(
  'eaisybooks-audit-security-and-gdpr',
  'books_admin',
  'Irodai audit napló, adatvédelmi biztonság és GDPR megfelelőség',
  'Könyvelői tevékenység teljes körű időbélyegzett naplózása, IP címek követése, GDPR adatkezelési szabályzatok és 8 éves törvényi adatmegőrzési protokollok.',
  '# Irodai Audit Napló, Biztonság és GDPR Megfelelőség

A könyvelőirodák számára kiemelten fontos a kezelt ügyféladatok bizalmassága, sérthetetlensége és a hatósági elszámoltathatóság. Az eaisyBooks zárt biztonsági architektúrával és részletes audit naplózással garantálja a jogszabályi megfelelést.

---

## 1. Részletes Irodai Audit Napló (Audit Trail)

Az Audit Napló felületen az irodavezetők és kijelölt auditorok valós időben követhetik a rendszerben történt összes felhasználói eseményt:
- **Rögzített eseménytípusok:**
  - `login` / `logout`: Bejelentkezési kísérletek, sikeres és elutasított munkamenetek.
  - `create` / `update` / `delete`: Számlák, tranzakciók, béradatok, munkavállalói jogviszonyok módosításai.
  - `submit` / `export`: Hatósági bevallások beküldése, banki állományok és riportok letöltése.
  - `approve` / `reject`: Bizonylatok és költségtételek jóváhagyása az irodai várólistán.
  - `send_email`: Kiküldött számlabekérő levelek és fizetési emlékeztetők naplózása.
- **Audit metaadatok:** Minden bejegyzés tartalmazza a végrehajtó munkatárs email címét, az érintett megbízó cég azonosítóját, az entitás típusát, az IP címet, valamint a módosítás előtti és utáni állapotot.

---

## 2. GDPR Megfelelőség és Jogosultságkezelés

Az Európai Unió Általános Adatvédelmi Rendeletének (GDPR) megfelelően a rendszer a következő garanciákat biztosítja:
1. **Szerepkör-alapú hozzáférés-szeparáció:**
   - `iroda_admin`: Teljes hozzáférés az iroda összes ügyfeléhez, beállításaihoz és az audit naplóhoz.
   - `senior_könyvelő`: Portfólió szintű riportok, jóváhagyások és zárások kezelése.
   - `könyvelő`: Kizárólag a hozzá kifejezetten hozzárendelt megbízó cégek adataihoz férhet hozzá.
   - `asszisztens`: Korlátozott bizonylat-feltöltési és számlaegyeztetési jogosultság.
2. **Hozzájárulási és Süti Kezelés:** A felület beépített GDPR és süti hozzájárulási modullal rendelkezik, amely naplózza a felhasználói elfogadásokat.
3. **Adatkezelési és Törlési Kérelmek:** Munkavállalói személyes adatok törlési vagy anonimizálási kérelmének kezelése, szigorúan összehangolva a Számviteli törvény szerinti 8 éves kötelező bizonylat-megőrzési idővel.',
  '/eaisybooks/admin/audit',
  ARRAY['#audit', '#biztonság', '#gdpr', '#napló', '#jogosultságok', '#iroda-admin', '#adatvédelem'],
  'ShieldCheck',
  '4 perc',
  6,
  true
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
  order_num = EXCLUDED.order_num,
  is_published = EXCLUDED.is_published,
  updated_at = NOW();
