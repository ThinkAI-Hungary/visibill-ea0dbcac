Az alábbiakban szintről szintre kidolgozom mindkét oldal teljes hierarchiáját a legmagasabbtól a legalacsonyabbig, javaslatot téve a kódbázis letisztítására.

🏢 I. RÉSZ: eaisyBill (Vállalati / Ügyfél Oldal) Szerepkörei
A kódbázisban (useUserRole.ts:6) jelenleg 6 üzleti szerepkör található. Fentről lefelé haladva a hierarchia: [ 1. Cégtulajdonos ] ─── (owner)
         │
 [ 2. Cégvezető / Ügyvezető ] ─── (admin)
         │
 [ 3. Pénzügyi Vezető / Belső Könyvelő ] ─── (member)  <-- Javasolt pontosítás: 'cfo' / 'finance_manager'
         │
 [ 4. Pénzügyi Asszisztens / Számlázó ] ─── (assistant)
         │
 [ 5. Megfigyelő / Felügyelőbizottság ] ─── (viewer)
         │
 [ 6. Munkavállaló ] ─── (employee)  <-- Magic link / Jelenléti ív

1. Szint: Cégtulajdonos (owner)
Ki ő a valóságban? A vállalkozás tulajdonosa / többségi tulajdonosa.
Jogosultsága: A legmagasabb szint, abszolút vétójoggal.
Mit csinálhat?
Mindenhez hozzáfér, amit a Cégvezető lát (operatív pénzügyek + Könyvelési Kontrolling).
Kizárólagos joga: Ő kezeli a szoftver-előfizetést, a számlázási csomagot, ő adhatja át a cég tulajdonjogát, és kizárólag ő törölheti a céget vagy archiválhatja a teljes adatbázist.
A Kontrollingban: Teljes körű Read-Only betekintés a Főkönyvbe, Mérlegbe, P&L-be és ÁFA-ba.
2. Szint: Cégvezető / Ügyvezető (admin)
Ki ő a valóságban? Az operatív ügyvezető igazgató (CEO / Managing Director), aki a napi üzletmenetet irányítja és viseli a gazdasági/büntetőjogi felelősséget.
Mit csinálhat?
Teljes operatív jogkör: Szállítói számlák végső jóváhagyása, banki utalási csomagok indítása és netbankos exportja, kintlévőség-kezelési stratégiák jóváhagyása, munkatársak meghívása és szerepköreik beállítása.
Vezetői Kontrolling Fülke (Read-Only): Korlátlanul szűrheti az Eredménykimutatást (P&L), nézheti a Mérleget, a Főkönyvi kartonokat, az ÁFA-bevallást (2665 replika + számlalista) és a Tárgyi Eszközöket.
Amit NEM láthat: A tiszta könyveléstechnikai Folyószámlát (/subledger) és Főkönyvi Naplókat (/journals), valamint nem módosíthatja a könyvelő által lezárt tételeket.
3. Szint: Pénzügyi Vezető / Belső Főkönyvelő (member)
Ki ő a valóságban? A cég belső gazdasági vezetője (CFO), controlling szakembere vagy belső főkönyvelője, aki a külső könyvelőirodával tartja a kapcsolatot.
💡 Kódbázis-kritika és Javaslat: A jelenlegi member elnevezés a kódbázisban túlságosan általános (egy Supabase sablonmaradvány). Javasolt a felületen és belső logikában finance_manager vagy internal_accountant néven kezelni!
Mit csinálhat?
Ő a cégvezető szakmai jobbkeze: előkészíti az utalási csomagokat, elemzi a költséghelyi/projektszintű fedezetet, egyeztet a partnerekkel a vitatott számlákról.
Látja a vezetői P&L-t, a mérleget és a főkönyvi kartonokat (szintén Read-Only módban, hiszen a hivatalos könyvviteli zárlatot a külső eaisyBooks könyvelő végzi).
A cégvezetővel ellentétben ő NEM láthatja a cégvezetői és tulajdonosi bérszinteket/osztalékokat, ha a cég béradatai bizalmasak (opcionális bér-titkosítási kapcsoló).
4. Szint: Pénzügyi Asszisztens / Számlázó (assistant)
Ki ő a valóságban? Napi operatív adminisztrátor, számlázó kolléga, back-office munkatárs.
Mit csinálhat?
Kimenő számlák kiállítása, bejövő számlák feltöltése, iktatása és előzetes ellenőrzése.
Kintlévőség figyelése: fizetési felszólítók generálása és postázása/kiküldése.
Házipénztári bizonylatok fizikai rögzítése, banki kivonatok feltöltése.
Projektek és partnerek adatainak karbantartása.
Amit SOHA NEM láthat (Rejtett modulok):
Teljes Könyvelés menüpont (Főkönyv, P&L, Mérleg, ÁFA-bevallás, TENY) teljesen rejtve van számára.
Nem látja a bankszámlák pontos egyenlegét és a cég összesített likviditását (csak a nyitott számlák összegét).
Bérek és HR modul teljesen zárolva.
5. Szint: Megfigyelő / Felügyelőbizottság / Befektető (viewer)
Ki ő a valóságban? Passzív üzletrész-tulajdonos, csendestárs, felügyelőbizottsági tag vagy külső banki hitelbíráló/auditor.
Mit csinálhat?
Globális Read-Only: Mindent láthat a pénzügyi műszerfalon és a számlalistában, beleértve a vezetői kontrollingot is, de semmilyen rögzítést, módosítást, számlakiállítást vagy utalásindítást nem végezhet. Nincsenek aktív gombjai.
6. Szint: Munkavállaló (employee) — A Piramis Alja
Ki ő a valóságban? A cég mezei alkalmazottja (sofőr, fejlesztő, gyári dolgozó, boltos).
Hogyan lép be? Nincs hagyományos jelszavas, bonyolult fiókja; SMS-ben vagy e-mailben kapott Magic Linken keresztül éri el a rendszert, vagy egy ultra-letisztult mobilnézeten.
Mit csinálhat?
Kizárólag a saját személyes munkaidejét és jelenlétét kezeli:
Be- és kicsekkolás (munkaidő-nyilvántartás / jelenléti ív).
Szabadságkérelmek leadása és jóváhagyási státuszának megtekintése.
Saját havi jelenléti ív megtekintése.
(Opcionális: Saját letölthető, jelszózott havi PDF bérlapjának elérése).
Amit lát a szoftverből: Semmi mást. Nincs oldalsáv, nincsenek céges partnerek, nincs számlázás, nem látja más dolgozók adatait. Számára az eaisyBill egy egyszerű „digitális jelenléti ív és zseb-bérlap”.

📚 II. RÉSZ: eaisyBooks (Könyvelőirodai Oldal) Szerepkörei
Az eaisyBooks a könyvelőiroda operációs rendszere. Itt a kódbázisban (AccountyRoleContext.tsx:8) 4 szint létezik. Fentről lefelé haladva: [ 1. Iroda Adminisztrátor / Partner ] ─── (iroda_admin)
         │
 [ 2. Szenior Könyvelő ] ─── (senior_könyvelő)
         │
 [ 3. Önálló Könyvelő ] ─── (könyvelő)
         │
 [ 4. Könyvelői Asszisztens / Adatrögzítő ] ─── (asszisztens)

1. Szint: Iroda Adminisztrátor / Irodavezető (iroda_admin)
Ki ő a valóságban? A könyvelőiroda tulajdonosa, ügyvezetője vagy vezető könyvvizsgálója.
Jogosultsága: Abszolút, korlátlan hozzáférés az iroda összes könyvelt ügyfélcégéhez és összes munkatársához.
Kizárólagos feladatai:
Új ügyfélcégek létrehozása és beállítása (adózási forma, kettős/EV, számlatükör sablon kiválasztása).
Ügyfélallokáció: Ő rendeli hozzá az ügyfélcégeket a könyvelőkhöz és asszisztensekhez (ki melyik cégért felel).
Számlázási és irodai beállítások, Cégkapu gép-gép kapcsolatok hitelesítése.
Hozzáfér az irodai szintű KPI műszerfalhoz (határidő-monitor, elmaradások, irodai kapacitáskihasználtság).
2. Szint: Szenior Könyvelő (senior_könyvelő)
Ki ő a valóságban? Tapasztalt, mérlegképes könyvelő, adótanácsadó, aki a szakmai minőségért és a zárásokért felel.
Mit csinálhat?
Látja a hozzá rendelt (vagy a teljes irodai) cégportfóliót.
Zárási és Bevallási Jogkör: Ő véglegesíti és zárja le a havi ÁFA-bevallásokat (2665), futtatja le a TAO / KIVA éves zárási varázslót, készíti el a Kiegészítő mellékletet és az OBR elektronikus beszámolót.
Ellenőrzi és jóváhagyja az önálló könyvelők és asszisztensek által előkészített kontírozásokat.
Módosíthatja a számlatükröt és létrehozhat új főkönyvi naplókat.
3. Szint: Önálló Könyvelő (könyvelő)
Ki ő a valóságban? Könyvelő munkatárs, aki önállóan viszi a rá bízott Kft.-k, Bt.-k napi könyvvezetését.
Mit csinálhat?
Kizárólag a hozzárendelt ügyfelekhez fér hozzá: Nem látja a kollégái által könyvelt más cégeket.
Napi könyvelési műveletek: Bejövő és kimenő számlák tételes kontírozása, vegyes naplók könyvelése, banki tranzakciók illesztése, házipénztár lezárása.
Tárgyi eszközök aktiválása és havi ÉCS futtatása.
Előkészíti az ÁFA-bevallás tervezetét (replika és analitika generálása a szeniornak jóváhagyásra).
Korlátai: Nem törölhet lezárt időszakot, és nem küldhet be hivatalos ÁNYK XML-t szeniori ellenőrzés nélkül.
4. Szint: Könyvelői Asszisztens / Adatrögzítő (asszisztens) — A Piramis Alja
Ki ő a valóságban? Junior könyvelő, gyakornok vagy adatrögzítő kolléga.
Mit csinálhat?
Kizárólag a hozzárendelt cégek operatív előkészítését végzi.
NAV Online Számla importok áttekintése, papíralapú számlaképek feltöltése és OCR ellenőrzése.
Ismert partnerekhez tartozó alapértelmezett számlák előkontírozása szabályok alapján.
Banki kivonatok betöltése és automatikus számlapárosítás felügyelete.
Hiányzó számlák listájának összeállítása és ügyféli bekérése.
Amit NEM tehet meg:
Nem fér hozzá az éves záráshoz, nem nyithatja meg a Társasági Adó modult.
Nem szerkesztheti a cég számlatükrét vagy könyvelési szabályzatát.
Nem véglegesíthet bevallást.

💡 III. RÉSZ: Javaslatok a Kódbázis Tisztítására és Összhangjára
Ahhoz, hogy a kód tükrözze a fenti tiszta struktúrát, az alábbi finomhangolásokat javaslom:
A member szerepkör átnevezése vagy kettébontása az eaisyBill-ben:
A jelenlegi company_members.role = 'member' helyett hozzunk létre egyértelmű kategóriát:
finance_lead (Gazdasági vezető / Belső főkönyvelő – látja a P&L kontrollingot).
assistant (Pénzügyi asszisztens – csak számlák és kintlévőség, semmi könyvelés).
Specializált szerepkör megfontolása: Bérszámfejtő (payroll_specialist) az eaisyBooks-ban:
A könyvelőirodákban a bérszámfejtés gyakran teljesen külön osztály. Érdemes lehet az eaisyBooks-ban egy olyan szerepkört fenntartani, aki kizárólag a Bérszámfejtéshez és a 08-as bevalláshoz fér hozzá, de nem látja az ügyfélcég bankszámláit és főkönyvét (adatvédelmi okokból).
Átlátható Jogosultsági Szótár az Adatbázisban:
A felületeken ne hardcode-olt role === 'admin' feltételek legyenek, hanem képességalapú vizsgálatok (pl. canAccessControlling, canManageInvoices, canClosePeriod), ami lehetővé teszi, hogy később egyedi egyéni jogosultságokat is lehessen kattintgatni.

📊 Összegző Jogosultsági Térkép
Alkalmazás
Szerepkör neve a kódban
Üzleti Megnevezés
Elsődleges Fókusz
Könyvelési Jogkör
eaisyBill
owner
Cégtulajdonos
Cégjog, előfizetés, globális felügyelet
Teljes Vezetői Kontrolling (Read-Only)
eaisyBill
admin
Cégvezető / Ügyvezető
Operatív cégirányítás, utalások, döntések
Teljes Vezetői Kontrolling (Read-Only)
eaisyBill
member (javasolt: finance_lead)
Pénzügyi Vezető / Belső Könyvelő
Költségek, fedezet, utalás-előkészítés
Teljes Vezetői Kontrolling (Read-Only)
eaisyBill
assistant
Pénzügyi Asszisztens
Számlázás, iktatás, kintlévőség
🚫 Minden könyvelés REJTVE
eaisyBill
viewer
Megfigyelő / Csendestárs
Pénzügyi és kontrolling tájékozódás
Globális Read-Only
eaisyBill
employee
Munkavállaló
Kizárólag saját jelenlét és munkaidő
🚫 Minden pénzügy REJTVE (Magic link)
eaisyBooks
iroda_admin
Iroda Admin / Partner
Irodai portfólió, cégkiosztás, szabályok
Korlátlan Mesterkönyvelői Jogkör
eaisyBooks
senior_könyvelő
Szenior Könyvelő
Zárások, TAO/KIVA, ÁFA feladás, ellenőrzés
Teljes Könyvelési és Zárási Jogkör
eaisyBooks
könyvelő
Önálló Könyvelő
Hozzárendelt cégek napi könyvvezetése
Teljes Napi Kontírozás & Előkészítés
eaisyBooks
asszisztens
Könyvelői Asszisztens
Bizonylat-előkészítés, OCR, bankpárosítás
Korlátozott Adatrögzítés (Zárás nélkül)
