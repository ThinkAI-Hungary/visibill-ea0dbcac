<!-- converted from Beosztasom_specifikacio_es_roadmap_v2 (1).docx -->

Munkaidő-nyilvántartás és beosztáskezelés
Beosztásom.hu funkcióegyüttes
Összefoglaló · Funkcionális specifikáció · Fejlesztési roadmap
Cél: az Eaisybill kibővítése a www.beosztasom.hu-ban bemutatott munkaidő-nyilvántartási (jelenléti ív) és beosztáskezelési funkciókkal.


Tartalomjegyzék

# 1. Vezetői összefoglaló – mi a szoftver értelme?
## 1.1 Egy mondatban
A beosztasom.hu egy böngészőből használható ügyviteli alkalmazás, amely a Magyarországon minden munkáltató számára kötelező munkaidő-nyilvántartást (köznyelvben: jelenléti ív) kezeli: a hónap elején megtervezi a dolgozók beosztását, hó közben rögzíti a távolléteket (szabadság, betegség, táppénz stb.), hó végén pedig a tervezett beosztásból és a tényleges jelenlétből egy NAV-ellenőrzésen is elfogadott, aláírható Excel összesítőt (munkaidő-jegyzéket) készít – miközben folyamatosan ellenőrzi, hogy a beosztás megfelel-e a Munka Törvénykönyve szabályainak.
## 1.2 Milyen problémát old meg?
A magyar jogszabályok szerint a munkáltatónak naprakészen nyilván kell tartania a dolgozók munkaidejét, túlóráját, pihenőidejét és távolléteit. A bemutató szerint ennek a dokumentumnak a hivatalos neve időközben többször változott (jelenléti ív → munkaidő-beosztás → munkaidő-nyilvántartás), de a lényeg ugyanaz: hó végén kell egy olyan összesítő, amelyet a dolgozó és a munkáltató havonta egyszer aláír, és amelyet egy adóhatósági (NAV) ellenőrzés elfogad. A könyvelőirodák ezt ma jellemzően az ügyfelek helyett vezetik, sok cégre, sok dolgozóra, kézzel.
A szoftver ezt a munkát digitalizálja és részben automatizálja. A leirat alapján a négy legfontosabb értékajánlat:

## 1.3 Kik használják és hogyan?
- Operátor (könyvelőiroda munkatársa) – a jelenlegi tényleges felhasználó. Cégenként (ügyfelenként) külön fiók; ő rögzíti a dolgozókat, tervezi a beosztást, viszi fel a távolléteket, igazolja a jelenlétet és exportál. A bemutatóban minden a könyvelőiroda oldaláról zajlik.
- Munkavállaló – opcionális szerep. Ha a cég bekapcsolja, a dolgozó saját belépéssel láthatja a beosztását, szabadságigényt adhat be, jelezheti, mikor ér rá (jelentkezés), üzenhet, értesítést kap e-mailben/telefonon. A bemutató szerint az ügyfeleknél ez ma nincs használatban, ezért a hozzá tartozó jogosultságokat sem állítják be.
- Bérszámfejtő / könyvelő – külön hozzáférés, amellyel a saját felületén éri el a beosztási és jelenléti adatokat (bérszámfejtéshez).
- Cégvezető / ügyfél – a bemutató szerint a cég maga is kaphat belépést, de a gyakorlatban a könyvelőiroda kezeli helyette.
## 1.4 A jelenlegi havi munkafolyamat (ahogy a bemutató végigvitte)
- Törzsadatok egyszeri felvitele: cég (név, adószám, logó), munkahelyek (üzletek/telephelyek, pl. „Nagy Sándor utca” és „Kőrösi” üzlet), munkakörök, munkavállalók teljes adatlappal (jogviszony, munkaügyi szabályok, munkaidőkeret, szabadságkeret).
- Sablonok beállítása: munkaidő-sablon (mettől meddig tart egy műszak), beosztássablon (melyik dolgozó melyik héten melyik műszakban dolgozik, ismétlődő hetekkel).
- Új havi beosztás létrehozása a Beosztáskezelőben: megnevezés (pl. „2026. szeptember”), időszak (tól–ig), opciók (munkaidő megadása, munkavállalói jelentkezések).
- Munkaidő / létszámigény megadása: sablonból kitöltés, telephelyenként napi létszámigény (pl. „ezeken a napokon 5 főre van szükségem”), ünnepnapok kihagyása.
- Beosztás szerkesztése a rácsban (sorok: dolgozók, oszlopok: a hónap napjai): műszakok felvitele kézzel vagy automatikus kitöltéssel; a rendszer mutatja a ledolgozott/tervezett órákat (pl. 0/176), a napokat (30/0) és a munkaidőkeret maradékát (pl. 167 óra).
- Távollétek rögzítése (szabadság, betegszabadság, táppénz…), amelyek automatikusan megjelennek a beosztásban, és az adott napra a dolgozó nem osztható be.
- Beosztás lezárása (a lezárt beosztás továbbra is szerkeszthető, de innen indul a jelenlét automatikus kitöltése).
- Jelenlét menü: a lezárt beosztás alapján „tömeges igazolás” – a tervezett műszakok tényleges jelenlétté válnak; egyedi eltérések javítása; jelenlét lezárása.
- Exportálás: hónap kiválasztása, pótlék-sorok ki/be, Excel munkaidő-jegyzék generálása, amelyet kinyomtatva a felek havonta egyszer aláírnak. Statisztika (ledolgozott óra, normál/túlóra) szintén exportálható.
## 1.5 A bemutatóban azonosított hiányosságok – ezekre építünk
A felhasználó több ponton jelezte, hol lassítja a munkáját a bemutatott rendszer. Ezek egyben a saját fejlesztésünk legfontosabb megkülönböztető követelményei:

## 1.6 Hogyan illeszkedik az eaisybillbe?
A funkcióegyüttes a Munkaidő alatt jelenik meg új moduljaként. Az illeszkedés fő pontjai [Kiegészítés]:
- Közös ügyfél-törzs: a könyvelőirodai ügyfelek (cégek) már léteznek a rendszerünkben – a munkaidő-modul ezekhez a cégekhez kapcsolódik, nem kell újra felvinni a cégadatokat (név, adószám, logó).
- Közös felhasználó- és jogosultságkezelés: az operátor, a bérszámfejtő/könyvelő és az ügyfél-belépés a meglévő szerepkör-modellünkre épül (esetleg 2FA).
- Bérszámfejtési kapcsolat: a havi jelenlét/távollét/túlóra-összesítő közvetlenül átadható a bérszámfejtésnek (ma: kézi átvitel a bérprogramba, külön vezetett betegszabadság-számlálóval).
- Automatizációs motor: a meglévő automatizációs képességeinket (szabályok, ütemezett futtatás, e-mail feldolgozás) használjuk a beosztás automatikus generálásához és – jövőbeli lépésként – az ügyféltől e-mailben érkező módosítási kérések („XY 3-tól 7-ig szabadságon volt, utána betegszabadságon”) feldolgozásához.

# 2. Fogalomtár
A specifikáció egységes értelmezéséhez az alábbi fogalmakat a leirat alapján, a magyar munkajogi szóhasználattal definiáljuk.

# 3. Funkcionális specifikáció
Ez a fejezet a leiratban elhangzott összes menüpontot, mezőt, gombot és viselkedést rögzíti, kiegészítve a fejlesztéshez szükséges értelmezésekkel. A követelmények azonosítót kapnak (pl. BK-07), hogy a fejlesztési feladatok és tesztesetek hivatkozhassanak rájuk.
## 3.1 Rendszerszintű követelmények

## 3.2 Menüstruktúra (bal oldali navigáció)
A bemutató a bal oldali menüt fentről lefelé olvasta fel. A saját rendszerünkben ugyanezt a logikai csoportosítást javasoljuk megtartani, hogy a könyvelőirodai felhasználók számára ismerős legyen.

## 3.3 Értesítések

## 3.4 Beosztáskezelő – a rendszer központi modulja
A bemutató szerint „a legfontosabb blokk a beosztáskezelő, itt történik a varázslat”. A modul egy varázsló-szerű folyamatból (beosztás létrehozása → munkaidő megadása → jelentkezések → beosztás tervezése → lezárás) és egy rács-alapú szerkesztőből áll.
### 3.4.1 Beosztás létrehozása („Hozzáad”)
### 3.4.2 Munkaidő megadása (létszámigény)
### 3.4.3 Beosztás szerkesztése – a rács
A rács a modul szíve. A leirat alapján a felépítése:
### 3.4.4 Műszak hozzáadása és szerkesztése
### 3.4.5 Kijelölés, helyettesítés, csoportos szerkesztés
### 3.4.6 Mentés, lezárás, állapotok
### 3.4.7 [Új] Szabályalapú automatikus beosztás-generálás
A leirat záró részében a megrendelő megfogalmazta a saját fejlesztés kulcsigényét: „ott lehet úgy szabályokat megadni, hogy cégspecifikusan lehet beállítani őket, mondjuk ennek a cégnek hó végén töltsük ki mindig automatikusan, [adott] paraméterek alapján, és akkor megcsinálja. Egyszer beállítjuk, és csak akkor kell hozzányúlni, amikor valamit máshogy akarunk. Vagy alapbeállítással az összes embert, vagy egy előző hónapot lemásol, és akkor azt a néhány eltérést manuálisan.”

## 3.5 Távollétek
### 3.5.1 Távollét-típusok (teljes lista a leiratból)
A típusok az Mt. és a társadalombiztosítási jogszabályok szerinti jogcímek. A bemutató kiemelte: ezek nem mind „díjak” – egy részük a távolmaradás oka (betegség, szabadságvesztés), más részük az az ellátás, amely miatt a dolgozó otthon van (CSED, GYED, GYES, ápolási díj). Az exportban és a bérszámfejtési átadásban a jogcímet pontosan kell feltüntetni.
[Kiegészítés] A típuslistát adminisztrátori felületen bővíthetővé javasoljuk tenni (kód, megnevezés, „kieső idő”-e, csökkenti-e a szabadságkeretet, óraszám-számítás módja, bérszámfejtési kód), mert a jogszabályi jogcímek változnak.

## 3.6 Jelenlét
### 3.6.1 Exportálás – a hó végi összesítő (munkaidő-jegyzék)
Ez a funkció a szoftver legfontosabb kimenete: a bemutató szerint az így generált Excel-t a NAV ellenőrzés elfogadja, és elég havonta egyszer kinyomtatva aláírni. A megrendelő mintafájlt kért (a bemutató vállalta, hogy Viktor küld egy exportált példát) – a fejlesztés megkezdése előtt a mintafájlt be kell szerezni és a pontos oszlop-/sorstruktúrát abból kell átvenni.

## 3.7 Statisztikák

## 3.8 Üzenetek

## 3.9 Munkavállalók
### 3.9.1 Lista és tömeges műveletek
### 3.9.2 Munkavállaló adatlapja – teljes mezőlista
A bemutató tételesen felolvasta az adatlap blokkjait és mezőit. Ezek a saját rendszerünk munkavállaló-entitásának kötelező részei.
A) Alapadatok
B) Jogosultságok (csak akkor releváns, ha a dolgozó be tud lépni)
A bemutató szerint az ügyfeleknél ezeket nem állítják be, mert a dolgozók nem lépnek be a rendszerbe; „akkor lenne jelentősége, ha ő be tudna ide lépni, és kérni a távollétet meg mindenfélét”.
- Távollét-kezelési jogosultság (saját távollét/szabadságigény beadása)
- Jelenlét-kezelési jogosultság (saját jelenlét rögzítése)
- Home office kezelési jogosultság
- Láthatja a munkatársai beosztását
- Láthatja a munkatársai elérhetőségeit
- Láthatja az összes munkavállaló távollétét
C) Munkaügyi szabályok (dolgozónként)
D) Ellenőrzött munkaügyi szabályok (dolgozónként ki/be kapcsolható)
- Napi munkaidő ellenőrzése
- Heti munkaidő ellenőrzése
- A munka befejezése és a következő munkakezdés közötti egybefüggő minimum pihenőidő ellenőrzése
- Havi legalább egy vasárnapi pihenőnap ellenőrzése
- Heti legalább 48 órát kitevő megszakítás nélküli pihenőidő ellenőrzése
- 6 egybefüggő munkanap utáni legalább egy pihenőnap ellenőrzése
- A munkavállaló típusára vonatkozó specifikus szabályok ellenőrzése
E) Munkaidőkeret
[Kiegészítés] A keret lényege a bemutató szerint: „három hónap ledolgozható óraszámát adjuk össze, és három hónap alatt kell ledolgoznia. Ha másfél hónap alatt ledolgozza és másfél hónapig otthon ül, ugyanúgy kijön.” A rendszer a rácsban mutatja a keretből még hátralévő órákat (pl. 167), és a keret végén a túllépést túlóraként, a hiányt állásidőként/hiányként kell kimutatni.
F) Igények (a dolgozó egyedi beosztási preferenciái)
Az igényeket az automatikus kitöltés és a „Munkavállalói igények” ellenőrzés használja; a bemutató szerint a mezők mellett kérdőjel-ikonos súgó van („az igényeknél megadhatod, hogy a munkavállalónak milyen egyedi igényei vannak a beosztásokkal kapcsolatban”). A felhasználó ezeket nem tölti ki, de a vendéglátós ügyfeleknél hasznos lehet.

## 3.10 Operátorok

## 3.11 Munkahelyek és munkakörök

## 3.12 Sablonok: munkarendek, munkaidősablonok, beosztássablonok

## 3.13 Beléptetőrendszer: belépések, ellenőrzőpontok

## 3.14 Integráció a meglévő rendszerünkkel [Új]

## 3.15 Beállítások, navigáció, dokumentumok
### 3.15.1 Adataim (a bejelentkezett felhasználó profilja)
Mezők: név, jogosultság, e-mail, nyelv, munkahelyek, kezelt munkavállalók, profilkép, kétfaktoros hitelesítés (be/ki). [Leirat]
### 3.15.2 Értesítések (felhasználói)
Beállítható, milyen eseményekről kapjon a felhasználó értesítést és milyen csatornán (felület, e-mail, telefon). Alapértelmezés: mindenről. [Leirat]
### 3.15.3 Vállalkozás beállításai (cégszintű)
### 3.15.4 Navigáció
A bemutató csak megnevezte; feltehetően a menü/felület elrendezésének testreszabása. [Tisztázandó]
### 3.15.5 Dokumentumok
Adatvédelmi nyilatkozat és ÁSZF letölthető (a szolgáltató honlapján is elérhető). A megrendelő kérte ezek lementését és elküldését elolvasásra. A saját rendszerünkben: a cég saját dokumentumai (aláírt munkaidő-jegyzékek) is itt tárolhatók [IN-06].

## 3.16 Munkaügyi szabálymotor – összefoglaló szabálylista
A szabálymotor a Beosztáskezelőben tervezés közben, a Jelenlét menüben belépéskor („frissíti a munkaügyi szabályokat”), valamint az automatikus generálás után fut. A szabályok három szintről öröklődnek: vállalkozás → munkavállaló → adott beosztás (a részletesebb szint felülírja az általánosabbat).
[Kiegészítés] Az eredmény: „A beosztás megfelel a munkaügyi előírásoknak” zöld állapot, vagy szabálysértés-lista dolgozó + nap + szabály + javaslat formában; a cella a rácsban jelölést kap. Súlyosság: tiltás (távollét, jogviszony), hiba (Mt. korlátok), figyelmeztetés (igények).

## 3.17 Adatmodell (entitások)

## 3.18 Nyitott kérdések – a fejlesztés megkezdése előtt tisztázandó
- Export-minták bekérése: Viktortól az exportált havi munkaidő-jegyzék Excel (egy vendéglátós céggel, több dolgozóval) és a statisztika-export mintája – a bemutató vállalta a küldést. Ezek nélkül az export-struktúra nem véglegesíthető (EX-03).
- Műszak típusa értékkészlete (BK-45).
- Automatikus jelenlét-kitöltés pontos opciói a munkavállaló adatlapján (JL-06).
- Munkarendek menü mezői (SB-01).
- Navigáció menüpont tartalma.
- Néhány távollét-típus pontos, hivatalos elnevezése (a leirat hangfelismerési hibái miatt: „tőnkéntes”, „ügyvéd, szabadság”, „öregbefogadói díj”).
- Részleges (órás) távollét szükségessége (TL-03).
- Kell-e a dolgozói önkiszolgálás (belépés, szabadságigény, jelentkezés) az első verzióban, vagy csak az operátori működés? A bemutató szerint az ügyfelek ma nem használják.
- Bérprogram neve és export-formátuma az importhoz / bérszámfejtési átadáshoz (MV-03, EX-07).
- Beléptetőrendszer-integráció konkrét igénye és technológiája (BR-03).
- Az értesítési „telefon” csatorna: SMS vagy push (R-05).

# 4. Fejlesztési roadmap
## 4.1 Alapelvek a sorrend meghatározásához
- Az érték a hó végi exportnál keletkezik. A könyvelőiroda számára a szoftver akkor használható, amikor törzsadat → beosztás → távollét → jelenlét → NAV-kompatibilis Excel lánc végigmegy. Ezért az első mérföldkő (MVP) ezt a láncot fedi le, még kézi kitöltéssel is.
- A megkülönböztető erő az automatizálás. A második mérföldkő a szabályalapú generálás és a tömeges szerkesztés – ez az, amit a bemutatott rendszer nem tud, és amiért a megrendelő saját fejlesztést készít.
- Építsünk a meglévő rendszerre. Cég-törzs, felhasználókezelés, 2FA, dokumentumtár, automatizációs motor újrafelhasználása – nem újraírása.
- A dolgozói önkiszolgálás és a beléptetőrendszer később jön. A bemutató szerint ezeket az ügyfelek ma nem használják.
- Minden fázis végén tesztelhető, bemutatható eredmény legyen, amelyet a könyvelőirodai felhasználó valós ügyféladatokkal kipróbálhat.
## 4.2 Fázisok áttekintése
*A becslések egy 2–3 fős fejlesztőcsapatra, a meglévő rendszer komponenseinek újrafelhasználásával értendők; tartalmazzák a tesztelést, de nem a párhuzamosan futó tisztázásokat. A pontos ütemezést a 0. fázis végén kell rögzíteni.
## 4.3 Fázisok részletesen
### 0. fázis – Előkészítés
- Export-minták (munkaidő-jegyzék, statisztika) bekérése és elemzése; az export oszlop-/sorstruktúra rögzítése.
- A 3.18 nyitott kérdések lezárása a megrendelővel és a bemutatóval.
- Adatmodell és API-terv (3.17); a meglévő cég- és felhasználó-entitások bővítésének megtervezése.
- UI-prototípus a rácsra (BK-20) és a munkavállaló adatlapjára; a könyvelőirodai felhasználóval validálva.
- Munkaszüneti napok naptárának forrása és karbantartási módja.
- Távollét-típus törzs véglegesítése bérszámfejtési kódokkal.
Kimenet: jóváhagyott specifikáció, klikkelhető UI-vázlat, adatmodell, sprint-terv.
### 1. fázis – Törzsadatok
- Cég-modul bővítése a vállalkozás beállításaival (3.15.3): pihenőidő, kapcsolók, szabály-alapértelmezések, 2FA-kötelezettségek, veszélyzóna.
- Munkahelyek (alapértelmezett „Központ”) és munkakörök (szín, import/export).
- Munkavállaló adatlap az összes blokkal (A–F), lista, szűrők, kilépettek, soft-delete, töröltek megjelenítése, tömeges műveletek.
- Operátorok, Adataim, értesítési beállítások.
- Munkarendek és munkaidősablonok (SB-01, SB-02) – a 2. fázis előfeltétele.
- Alap naplózás (R-08).
Kimenet: egy ügyfél (pl. a két üzletes vendéglátó cég) teljes törzsadata felvihető és karbantartható.
### 2. fázis – Beosztáskezelő (alap)
- Beosztás létrehozása (megnevezés, időszak, opciók), lista, állapotok, lezárás.
- A rács: dolgozók × napok, mutatók a név mellett (óra, nap, munkaidőkeret-maradék), napi/heti/havi nézet, szűrők, színezés, nézet-kapcsolók, üres sorok elrejtése, sormagasság.
- Műszak hozzáadása/szerkesztése/törlése űrlapon és táblázatos (jelenléti ív jellegű) nézetben; összes munkaidő számítása.
- Munkaidő megadása lépés: létszámigény munkahelyenként, sablonból kitöltés ünnepnapok kihagyásával.
- Kitöltés beosztássablonnal és munkarend szerint; beosztássablon-szerkesztő (SB-03).
- Visszavonás/mégis, mentés, mentés és tovább.
- Már ebben a fázisban: Ctrl+C/V, tartomány-kijelölés, sor/hét másolás (BK-44) – ez a legnagyobb napi fájdalompont, nem érdemes később hagyni.
Kimenet: egy hónap beosztása felvihető gyorsabban, mint a bemutatott rendszerben.
### 3. fázis – Távollétek
- Távollét rögzítése, teljes típuslista, megjegyzés; típus elsődleges megjelenítése.
- Megjelenítés a rácsban (kék, típus névvel), műszak-tiltás a távollét napjaira.
- Fizetett szabadság egyenleg (éves keret, kivett, maradék, negatív engedélyezése).
- Szűrők (típus, munkahely, munkakör).
- Betegszabadság/táppénz elkülönítése altípusként (az automatika a 6. fázisban).
### 4. fázis – Jelenlét és export (MVP mérföldkő)
- Jelenlét menü: hónapválasztó, szerkesztés, egyedi és tömeges igazolás, jelenlét lezárása, automatikus jelenlét-kitöltés lezárt beosztásból (JL-06).
- Munkaügyi szabályok „frissítése” belépéskor (a szabálymotor 5. fázisú részei ide kapcsolódnak; itt minimum a távollét/jogviszony ütközések).
- Excel export: cég, hónap, dolgozónkénti munkalap, Beosztás és Jelenlét oszlopok, távollétek típussal és órával, pótlék-sorok kapcsolóval, aláírás-helyek; PDF változat; archiválás, verziózás.
- Statisztikák: intervallum, adatforrás, ledolgozott/normál/túlóra, részletek, export.
- Végponttól végpontig teszt egy valós ügyfél augusztusi adataival; összevetés a bemutatott rendszer exportjával.
### 5. fázis – Munkaügyi szabálymotor és munkaidőkeret
- Szabályok háromszintű öröklése (vállalkozás → munkavállaló → beosztás).
- A 3.16 táblázat összes szabályának megvalósítása, súlyossági szintekkel, cellaszintű jelöléssel és összesítő listával.
- Munkavállaló-típus specifikus szabályok (fiatalkorú, kismama, alkalmi) jogszabályi paraméterezéssel.
- Munkaidőkeret: ciklusszámítás, előzetes órák, maradék kijelzése, kerethatár-átlépés jelzése, keretzárás túlóra/hiány kimutatással.
- Munkavállalói igények ellenőrzése (figyelmeztetés).
### 6. fázis – Automatizálás és tömeges szerkesztés (a megkülönböztető erő)
- Cégszintű generálási szabályok (AG-01) és ütemezett automatikus beosztás-generálás (AG-02) a meglévő automatizációs motorral; értesítés az operátornak.
- „Előző hónap másolása” (AG-07) és „Automatikus kitöltés” létszámigény + szabályok alapján (BK-24).
- Kijelölés-mód újragondolva: üres cellákra is, csoportos szerkesztés, áthelyezés másik dolgozóhoz, intelligens helyettesítés partnerek alapján (BK-50…54).
- Tömeges műveletek a beosztássablon-szerkesztőben (SB-04), sablonkönyvtár cégek között (SB-05).
- Betegszabadság → táppénz automatika (TL-08).
- Munkavállaló-import bérprogramból / saját törzsből, oszlop-hozzárendeléssel (MV-03).
Kimenet: egy „normál” ügyfélnél a havi munka a generált beosztás átnézésére és néhány eltérés rögzítésére csökken.
### 7. fázis – Integráció és értesítések
- Bérszámfejtési adatátadás (EX-07, IN-03): gépi export / API a bérprogram felé, betegszabadság-számláló átadása.
- Dokumentumtár-integráció: exportok archiválása, aláírt példány visszatöltése (IN-06).
- Értesítések: rendszer, e-mail, telefon; havi teendő-emlékeztetők az operátornak (ER-01…04).
- Üzenetek modul (UZ-01…02).
- Bővített statisztikák (ST-06).
### 8. fázis – Dolgozói önkiszolgálás
- Munkavállalói belépés, tömeges meghívás, munkavállalói 2FA-kötelezettség.
- Jogosultságok (3.9.2 B): saját beosztás, munkatársak beosztása/elérhetősége, összes távollét megtekintése.
- Szabadságigény beadása és jóváhagyása (TL-10), saját jelenlét rögzítése, jövőbeli jelenlét tiltása/engedélyezése (JL-09).
- Jelentkezések (rendelkezésre állás) a beosztáshoz (BK-05, BK-06 c eset), beosztás-generálás a jelentkezések figyelembevételével.
- Home office kezelés dolgozói oldalról.
### 9. fázis – Beléptetőrendszer és bővítések
- Belépési események fogadása (API/webhook), ellenőrzőpontok, dinamikus munkavállalói azonosító (BR-01…03).
- Belépési események → jelenlét automatikus képzése, eltérések jelzése a beosztáshoz képest (JL-10).
- E-mail / feltöltött jelenléti ív alapú módosítási kérések félautomatikus feldolgozása (AG-06).
- Több nyelv, további export-formátumok, mobil-optimalizált nézetek igény szerint.
## 4.4 Függőségek és kockázatok
## 4.5 Sikerkritériumok
- Egy ügyfél havi munkaidő-nyilvántartása a saját rendszerben kevesebb operátori idővel készül el, mint a bemutatott rendszerben (mérés: az első valós hónap időráfordítása).
- Az exportált munkaidő-jegyzék könyvelői és NAV-szempontból elfogadott (könyvelői ellenőrzés, majd éles használat).
- A 6. fázis után a „normál munkarendű” ügyfelek beosztása automatikusan generálódik, és csak az eltéréseket kell kézzel rögzíteni.
- A munkaügyi szabályellenőrzés minden Mt.-korlátot jelez a tesztesetekben (fiatalkorú, kismama, munkaidőkeret-túllépés, 11 órás pihenő stb.).
| Jelölések a dokumentumban
[Leirat] – a bemutató videóban közvetlenül elhangzott, a meglévő rendszerben létező funkció.
[Kiegészítés] – a leiratból csak közvetve következő, a dokumentum készítője által kifejtett vagy értelmezett elem, amelynek célja, hogy a fejlesztők számára egyértelmű legyen.
[Új] – a leiratban felmerült igény vagy panasz alapján a saját fejlesztésünkben megvalósítandó, a bemutatott rendszerben nem (vagy nem jól) létező funkció.
[Tisztázandó] – a leirat alapján nem eldönthető részlet, amelyet a fejlesztés megkezdése előtt a megrendelővel vagy a bemutatóval egyeztetni kell. |
| --- |
| # | Értékajánlat | Mit jelent a gyakorlatban? |
| --- | --- | --- |
| 1 | Hó végi, NAV által elfogadott összesítő | Egy kattintásra Excel munkaidő-jegyzéket generál, dolgozónként külön munkalappal, „Beosztás” (tervezett) és „Jelenlét” (tényleges) oszloppal, a távollétek jogcímével, opcionálisan a pótlék-sorokkal (éjszakai, ünnepnapi stb.). Ezt elég havonta egyszer kinyomtatni és aláíratni – nem kell naponta aláírni. |
| 2 | Szabályalapú, automatikus kitöltés | A cégre és a dolgozóra beállított szabályok (munkarend, munkaidő-sablon, beosztássablon, létszámigény) alapján a rendszer automatikusan felviszi a hónap munkanapjait; az operátornak csak az eltéréseket (szabadság, betegség, csere) kell kézzel módosítania. Ez a saját fejlesztésünk fő megkülönböztető ereje – a bemutatott rendszerben ez csak részben működik. |
| 3 | Munkaügyi szabályok automatikus ellenőrzése | A beosztás tervezésekor a rendszer figyeli a napi/heti munkaidő-maximumot, a 11 órás napi pihenőidőt, a heti 48 órás pihenőidőt, a havi vasárnapi pihenőnapot, a 6 munkanap utáni pihenőnapot, a munkavállaló-típus (fiatalkorú, kismama, alkalmi) speciális szabályait, valamint a munkaidőkeret (pl. 3 havi) egyenlegét. |
| 4 | Törzsadat- és távollét-kezelés Mt. szerinti jogcímekkel | Kb. 30 féle, a Munka Törvénykönyve szerinti távollét-típus (fizetett szabadság, betegszabadság/táppénz, baleseti táppénz, CSED, GYED, GYES, apasági szabadság, igazolt/igazolatlan távollét stb.), szabadságegyenleg vezetése, több telephely (munkahely) és munkakör kezelése. |
| Fájdalompont [Leirat] | Következmény | Elvárás a saját rendszerben [Új] |
| --- | --- | --- |
| A beosztás-rácsban csak cellánként lehet másolni; sort, hetet, hónapot nem lehet kijelölni és Ctrl+C/Ctrl+V-vel átvinni. Csak Ctrl+Alt + egérrel húzással másolható egy-egy cella. | Egy dolgozó havi beosztásának felvitele napról napra, egyesével történik („mazsolázás”). A korábban használt másik rendszerben egy hét felvitele után Ctrl+C/V-vel „öt kattintással megvolt egy hónap”. | Tartomány-kijelölés (sor, több nap, több dolgozó), vágólap-műveletek, „hét másolása a következő hetekre”, „előző hónap másolása”, valamint teljes szabályalapú automatikus kitöltés. |
| Nincs (vagy nem működik jól) az automatikus jelenlét-/beosztás-kitöltés a cégre beállított szabályok alapján. | Minden hónapban kézi munka, holott a legtöbb dolgozó ugyanabban a munkarendben dolgozik. | Cégspecifikus szabályok egyszeri beállítása, majd hó végén (vagy hó elején) automatikus generálás; csak az eltéréseket kell kézzel módosítani. |
| A távollétnél a megjegyzés jelenik meg a naptárban és az exportban, nem a kiválasztott típus (pl. „Betegség” helyett kézzel kell beírni, hogy betegszabadság vagy táppénz). | Dupla adatrögzítés, hibalehetőség; a betegszabadság (15 nap, munkáltató fizeti) és a táppénz (NEAK folyósítja, bérszámfejtésben „kieső idő”) megkülönböztetése kézzel, külön bérprogramban vezetve. | A típus legyen az elsődleges megjelenített adat; a betegszabadság → táppénz átfordulás (15 munkanap után) automatikusan számolódjon. |
| A kijelölés funkció (kijelölt műszakok, helyettesítések, csoportos szerkesztés) csak a már kitöltött cellákra működik, célja a felhasználó számára nem volt világos. | Nem használják, a benne rejlő lehetőség (tömeges csere, helyettesítés) kihasználatlan. | Egyértelmű, üres cellákra is működő tömeges szerkesztés. |
| A munkavállalókat kézzel viszik fel, bár a bérprogramból exportálható lista importálható lenne. | Időigényes, hibalehetőség. | Import a bérprogramból / a saját rendszerünk meglévő törzsadataiból; szinkron. |
| A beosztássablonban sem lehet másolni, minden cellát egyesével kell kitölteni. | Sablonkészítés lassú. | Sablonszerkesztő tömeges műveletekkel. |
| A rendszer helyenként lassú (munkavállalók listájának betöltése, visszalépés). | Felhasználói élmény romlik. | Teljesítménykövetelmény: listák < 1 s, rács-műveletek azonnaliak. |
| Fogalom | Jelentés |
| --- | --- |
| Munkaidő-nyilvántartás (jelenléti ív) | A munkáltató által kötelezően vezetett dokumentum, amely napi bontásban tartalmazza a munkaidő kezdetét, végét, a pihenőidőt, a ledolgozott órákat, a túlórát és a távolléteket. A bemutató szerint a hivatalos elnevezés változott (jelenléti ív → munkaidő-beosztás → munkaidő-nyilvántartás), a rendszer „munkaidő-jegyzék” néven exportálja. |
| Beosztás (tervezett) | Egy adott időszakra (jellemzően naptári hónapra) előre elkészített terv: melyik dolgozó melyik napon, mettől meddig, melyik munkahelyen és munkakörben dolgozik. A Beosztáskezelő menüben készül. Az exportban a „Beosztás” oszlop. |
| Jelenlét (tényleges) | Az, ahogyan a dolgozó valóban dolgozott. A lezárt beosztásból „igazolással” keletkezik, majd az eltérések kézzel javíthatók. Az exportban a „Jelenlét” oszlop. |
| Igazolás / tömeges igazolás | A tervezett műszakok tényleges jelenlétként való elfogadása. Tömeges igazolás: az összes dolgozó összes műszakja egy lépésben. |
| Lezárt beosztás | Állapot, amelyet az operátor a tervezés végén állít be. A lezárt beosztás továbbra is szerkeszthető, de a jelenlét automatikus kitöltése a lezárt beosztásra épül. |
| Távollét | Olyan nap/időszak, amikor a dolgozó nem végez munkát; Mt. szerinti jogcímmel (típussal) rögzítve. A távollét napjára a dolgozó nem osztható be. |
| Betegszabadság vs. táppénz | Betegség esetén az első 15 munkanap betegszabadság (a munkáltató bérszámfejti és fizeti), azt követően táppénz (a NEAK folyósítja; a bérszámfejtésben „kieső idő”). A bemutatott rendszer egyetlen „Betegség/táppénz” típust ismer, a megkülönböztetés a megjegyzésben történik. |
| Kieső idő | Bérszámfejtési fogalom: olyan távollét, amelyre a munkáltató nem fizet bért (pl. táppénz, fizetés nélküli szabadság). |
| Munkarend | A dolgozó általános munkavégzési rendje (pl. hétfő–péntek 9–17). A munkanap definíciója és a napi/heti munkaidő ehhez kötődik. |
| Munkaidő-sablon | Egy műszak időbeli meghatározása (mettől meddig, pihenőidővel), amely újrafelhasználható több cégnél, telephelynél. |
| Beosztássablon | Dolgozó × hét × műszak mátrix, meghatározott számú ismétlődő héttel (pl. 4 hetes ciklus), amellyel a havi beosztás egy lépésben kitölthető. |
| Munkaidőkeret | Az Mt. szerinti elszámolási időszak (pl. 3 hónap), amelyen belül a dolgozónak a keretre jutó összes órát kell ledolgoznia, de a havi elosztás rugalmas (egyik hónapban 220, másikban 130 óra is lehet). A rendszer a keret maradék óraszámát mutatja. |
| Munkahely | A cég telephelye/üzlete (pl. két gyrosos üzlet; építőipari cégnél „Központ” = iroda és „építkezés”). Minden cégnél alapból létezik egy „Központ” munkahely. |
| Munkakör | A dolgozó feladatköre (pl. pultos, szakács). Színnel jelölhető. |
| Operátor | A céget kezelő adminisztratív felhasználó (a könyvelőiroda munkatársa vagy a cég vezetője). A cég létrehozásakor kötelező legalább egy operátor. |
| Műszak | Egy dolgozó egy napra szóló munkavégzési egysége: kezdés, vége, pihenőidő, típus, munkahely, munkakör, home office jelölés, megjegyzés. |
| Pótlék | Bérpótlékra jogosító munkavégzés (éjszakai, vasárnapi, ünnepnapi, túlóra). Az export opcionálisan pótlék-sorokat tartalmaz. |
| Létszámigény (munkaerőigény) | Adott napon/műszakban adott munkahelyen szükséges dolgozók száma (pl. 5 fő), amely az automatikus beosztás-generálás bemenete. |
| Jelentkezés | A dolgozó által megadott rendelkezésre állás („mikor ér rá”) – csak akkor releváns, ha a dolgozók be vannak kötve a rendszerbe. |
| ID | Követelmény | Részletek / forrás |
| --- | --- | --- |
| R-01 | Többcéges (multi-tenant) működés | Egy operátor több céget (ügyfelet) kezel; a bemutató több cég között váltott. Minden adat (munkahely, dolgozó, beosztás, beállítás) cégszinten elkülönül. [Leirat] |
| R-02 | Szerepkörök | Operátor; Munkavállaló; Bérszámfejtő/könyvelő; (Cégvezető/ügyfél – operátori joggal). Minden szerepkörhöz külön 2FA-kötelezettség állítható. [Leirat] |
| R-03 | Kétfaktoros hitelesítés (2FA) | Felhasználónként bekapcsolható (Adataim), cégszinten kötelezővé tehető külön az operátorok, a munkavállalók és a bérszámfejtők részére. [Leirat] |
| R-04 | Nyelv | Magyar és angol felület, felhasználónként és munkavállalónként beállítva. [Leirat] |
| R-05 | Értesítések | Rendszerüzenetek (Értesítések menü), e-mail és telefon (SMS/push [Tisztázandó]) a dolgozónak és az operátornak; konfigurálható, miről érkezzen értesítés (pl. jelenlét kitöltésének elmaradása). [Leirat] |
| R-06 | GDPR / adattörlés | Cégszinten „összes adat törlése” és „felhasználói fiók törlése” művelet; adatvédelmi nyilatkozat és ÁSZF elérhető a Dokumentumok menüből. [Leirat] |
| R-07 | Teljesítmény | A munkavállalói lista betöltése és a navigáció a bemutatott rendszerben lassú volt; célérték: listák és rács-műveletek 1 másodperc alatt. [Új] |
| R-08 | Naplózás (audit trail) | Minden beosztás-, jelenlét- és távollét-módosítás naplózva (ki, mikor, mit), mivel NAV-ellenőrzés tárgya lehet. [Kiegészítés] |
| R-09 | Integráció a meglévő rendszerrel | Közös cég-törzs, felhasználókezelés, bérszámfejtési adatátadás, automatizációs motor (lásd 3.14). [Új] |
| Blokk | Menüpont | Rövid funkció | Spec. fejezet |
| --- | --- | --- | --- |
| – | Értesítések | Rendszerüzenetek fogadása | 3.3 |
| – | Beosztáskezelő | Havi beosztások létrehozása, tervezése, szerkesztése, lezárása | 3.4 |
| – | Távollétek | Szabadság, betegség, egyéb távollétek rögzítése | 3.5 |
| – | Jelenlét | Tényleges jelenlét igazolása, lezárása, exportálása | 3.6 |
| – | Statisztikák | Ledolgozott órák, túlóra lekérdezése, export | 3.7 |
| – | Üzenetek | Belső üzenőfelület operátor és dolgozók között | 3.8 |
| Felhasználók | Munkavállalók | Dolgozók törzsadatai, jogosultságai, munkaügyi szabályai | 3.9 |
| Felhasználók | Operátorok | Adminisztrátorok kezelése | 3.10 |
| Opciók | Munkahelyek | Telephelyek / üzletek | 3.11 |
| Opciók | Munkakörök | Munkakörök, színek, import/export | 3.11 |
| Sablonok | Munkarendek | Általános munkarendek | 3.12 |
| Sablonok | Munkaidősablonok | Műszak-időpontok (tól–ig) | 3.12 |
| Sablonok | Beosztássablonok | Ismétlődő heti beosztásminták | 3.12 |
| Beléptetőrendszer | Belépések | Beléptetőrendszerből érkező be-/kilépések | 3.13 |
| Beléptetőrendszer | Ellenőrzőpontok | Fizikai/virtuális belépési pontok, dinamikus azonosító | 3.13 |
| Egyebek | Beállítások | Adataim, értesítések, vállalkozás beállításai | 3.15 |
| Egyebek | Navigáció | Felületi navigációs beállítások [Tisztázandó] | 3.15 |
| Egyebek | Dokumentumok | Adatvédelmi nyilatkozat, ÁSZF | 3.15 |
| ID | Követelmény |
| --- | --- |
| ER-01 | A menü a rendszer által generált üzeneteket listázza (pl. jelenlét kitöltésének elmaradása, szabadságigény érkezése, rendszerüzenetek). A bemutató szerint az operátor „mindenről kap értesítést”. [Leirat] |
| ER-02 | Olvasott/olvasatlan állapot, olvasatlanok száma a menüben (badge). [Kiegészítés] |
| ER-03 | Az értesítési csatornák (felület, e-mail, telefon) felhasználónként a Beállítások → Értesítések alatt konfigurálhatók. [Leirat] |
| ER-04 | [Új] Havi teendő-értesítések az operátornak: „X cég szeptemberi beosztása még nincs lezárva”, „Y cég jelenléte exportálásra kész”. |
| ID | Követelmény |
| --- | --- |
| BK-01 | A Beosztáskezelő listázza a cég meglévő beosztásait (időszakonként egy); „Hozzáad” gombbal új beosztás hozható létre. [Leirat] |
| BK-02 | Beosztás megnevezése – szabad szöveg, pl. „2026. szeptember”. [Leirat] |
| BK-03 | Beosztási időszak – tól–ig dátum (pl. 2026. 09. 01. – 2026. 09. 30.). Az időszakon kívülre a rács nem lapozható („nem tudunk átlépni a következő hónapra, mert megadtunk egy tól–ig-et”). A leiratban a „2021. szeptember 1-től” kezdőév átírási hiba, helyesen 2026. [Leirat] |
| BK-04 | Opció: Munkaidő megadásának engedélyezése – ha be van kapcsolva, a folyamatba bekerül a „Munkaidő megadása” lépés, ahol megadható, milyen műszakokban és mekkora munkaerőigénnyel van szükség dolgozókra. A munkaerőigény szerinti automatikus kitöltéshez ez a lépés elengedhetetlen. [Leirat] |
| BK-05 | Opció: Munkavállalói jelentkezések engedélyezése – a dolgozók megadhatják, mikor érnek rá. Ha nincs engedélyezve, a „munkaidő megadása” és a „jelentkezések” lépések kimaradnak, és rögtön a beosztás szervezése lépés indul. [Leirat] |
| BK-06 | [Kiegészítés] A két opció együttes értelmezése: (a) egyik sem → egyszerű kézi/sablonos rács-szerkesztés; (b) csak munkaidő → létszámigény-alapú automatikus kitöltés; (c) mindkettő → létszámigény + dolgozói rendelkezésre állás alapján optimalizált beosztás. |
| BK-07 | [Új] Új beosztás létrehozásakor felajánlható: „előző hónap másolása” és „generálás a cég szabályai szerint” (lásd 3.4.7). |
| ID | Követelmény |
| --- | --- |
| BK-10 | A lépés felülete három műveletet kínál: Munkaidő megtekintése, Munkaidő szerkesztése, Beosztás tervezés indítása; alatta a kiválasztott beosztás megnevezése. [Leirat] |
| BK-11 | Nézet váltható napi / heti / havi bontásra; a felhasználó havi nézetet használ, „hogy egyben lássak mindent”. [Leirat] |
| BK-12 | Kitöltés sablonból: sablon neve kiválasztása (munkaidő-sablonok közül), kitöltés kezdete, kitöltés vége, jelölőnégyzet „ünnepnapokat hagyjuk ki”. [Leirat] |
| BK-13 | Létszámigény megadása munkahelyenként (üzletenként) és naponként/műszakonként: pl. „ezeken a napokon 5 főre van szükségem” a Nagy Sándor utcai üzletben, majd ugyanez a Kőrösi üzletre. A „Beosztás tervezés indítása” a megadott létszám szerint „beszórja” a dolgozókat a hónap napjaira. [Leirat] |
| BK-14 | Gombok: Mentés (marad az oldalon) és Mentés és tovább (átlép a beosztás tervezésére). [Leirat] |
| BK-15 | [Kiegészítés] Az ünnepnapok forrása: magyar munkaszüneti napok naptára évenként karbantartva (áthelyezett munkanapokkal együtt). |
| ID | Követelmény |
| --- | --- |
| BK-20 | Sorok: a cég dolgozói egymás alatt. Oszlopok: az időszak napjai (1–30/31, 28/29-es hónapoknál rövidebb). A cellákba műszakok kerülnek. [Leirat] |
| BK-21 | A név mellett mutatók: (a) ledolgozott / havi kötelező óra – pl. „0 / 176” = szeptemberben 176 óra a keret, még 0 óra van beosztva; (b) napok – pl. „30 / 0” = 30 nap a hónapban, 0 nap beosztva; (c) a dolgozó munkaköre/beosztása; (d) ha munkaidőkeretben dolgozik: a keretből még ledolgozandó órák (pl. „167 óra a 3 havi keretből”). [Leirat] |
| BK-22 | A mutatók a szerkesztés közben valós időben frissülnek. [Kiegészítés] |
| BK-23 | Távolléttel érintett napok a rácsban kék színnel, a távollét megnevezésével jelennek meg (pl. „szabadság”, „betegség”), és oda műszak nem osztható be. A bemutatott rendszerben csak „Betegség” látszik, nem különül el a betegszabadság és a táppénz – nálunk a pontos típus jelenjen meg. [Leirat] [Új] |
| BK-24 | Kitöltés fül – három művelet: Automatikus kitöltés (létszámigény és szabályok szerint), Kitöltés beosztássablonnal, Kitöltés munkaidőrend (munkarend) szerint. [Leirat] |
| BK-25 | Munkaügyi szabályok fül – állapotjelző: „A beosztás megfelel a munkaügyi előírásoknak” (vagy a szabálysértések listája); Munkaügyi szabályok beállítása gomb, amellyel az adott beosztásra egyedi szabályok adhatók meg (alapértelmezés: a vállalkozás beállításaiból). [Leirat] |
| BK-26 | Munkavállalói igények fül – külön fülön ellenőrizhető, hogy a beosztás megfelel-e a dolgozók egyedi igényeinek (pihenőnapok, preferált időszak). [Leirat] |
| BK-27 | Szűrők: „Összes munkahely” legördülő (mind / egyik / másik üzlet – megfordítva mind eltűnik), „Összes munkakör” legördülő. [Leirat] |
| BK-28 | Színezés: négy mód – munkakör, munkahely, munkavállaló, megnevezés alapján. [Leirat] |
| BK-29 | Nézet: foglalt időpontok, munkaidő, távollét, pihenőidő, kilépett munkavállalók megjelenítése – kapcsolók. [Leirat] |
| BK-30 | Napi / heti / havi bontás; alul órában megjelenített összesítés. [Leirat] |
| BK-31 | Üres sorok elrejtése (hasznosnak jelölt) és sormagasság csökkentése (áttekinthetőbb, de nem fér el minden adat). [Leirat] |
| BK-32 | Törlés teljes beosztásra, Visszavonás (undo) és Mégis (redo). [Leirat] |
| BK-33 | Lapozás a hónapok között a rács végén, de csak a beosztási időszakon belül. [Leirat] |
| BK-34 | „Három kis vonalka” ikon – egyedi nézet/beállítások; a bemutatóban nem változtatott semmit. [Tisztázandó] |
| ID | Követelmény |
| --- | --- |
| BK-40 | Műszak hozzáadása űrlap mezői: munkavállaló neve, munkahely, munkakör, kezdés, vége, pihenőidő (alapértelmezés a vállalkozás beállításából, pl. 30 perc), műszak típusa, megjegyzés, home office jelölés. [Leirat] |
| BK-41 | Mentés után a műszak a rács megfelelő cellájában jelenik meg (pl. „aznap dolgozott, 30 perc szünettel”). [Leirat] |
| BK-42 | Alternatív, táblázatos (jelenléti ív jellegű) kitöltő nézet dolgozónként – ezt használja a felhasználó a napi felvitelre. Oszlopai: sorszám, dátum, nap (hét napja), kezdés, befejezés, pihenőidő, összes munkaidő (számolt), műszak típusa, munkahely, munkakör, home office. [Leirat] |
| BK-43 | A táblázatos nézetben kezdés/befejezés kézzel beírható (pl. 8:00 és 16:30), a rendszer az összes munkaidőt automatikusan számolja; a „Kitöltés” gomb alul átemeli a sorokat a rácsba. [Leirat] |
| BK-44 | A bemutatott rendszerben a táblázatos nézetben csak egy cella jelölhető ki; Ctrl+C/V nem működik (csak a rácsban); cella másolása Ctrl+Alt + húzással. [Új] Elvárás: sor- és tartomány-kijelölés (Shift/Ctrl+kattintás, egérhúzás), Ctrl+C / Ctrl+V, húzással kitöltés (Excel-szerű „fill handle”), „sor másolása a hét többi napjára”, „hét másolása a következő hetekre / a hónap végéig”, hétvégék/ünnepnapok automatikus kihagyásával. |
| BK-45 | Műszak típusa – a bemutató nem sorolta fel az értékeket. [Tisztázandó] Javasolt készlet: normál, éjszakai, ügyelet, készenlét, túlóra, tanfolyam/oktatás. |
| BK-46 | Műszak szerkesztése és törlése cellára kattintva; ütközés (átfedő műszak ugyanannál a dolgozónál) tiltása. [Kiegészítés] |
| ID | Követelmény |
| --- | --- |
| BK-50 | Kijelölés mód: cellák (műszakok) kijelölhetők; a bemutatott rendszerben csak a kitöltött cellák jelölhetők ki, üres napok nem. [Leirat] |
| BK-51 | A kijelölés menü elemei: Kijelölt műszakok, Helyettesítések, Csoportos szerkesztés. [Leirat] |
| BK-52 | Csoportos szerkesztés: a kijelölt műszakok adatai egyszerre felülírhatók (pl. „ott dolgozzon”), illetve másik munkavállalóhoz rendelhetők – a rendszer a műszakot az egyik dolgozótól elveszi és a másikhoz áthelyezi. [Leirat] |
| BK-53 | Helyettesítések / intelligens helyettesítés szabályai – a kijelöléseknél beállíthatók a helyettesítés szabályai (pl. kik helyettesíthetik egymást; ehhez kapcsolódik a munkavállaló adatlapján a „partnerek/párok” mező). [Leirat] |
| BK-54 | [Új] A kijelölés működjön üres cellákra is (tömeges műszak-felvitel több dolgozóra/napra egyszerre), és a kijelölt tartomány legyen másolható/beilleszthető (lásd BK-44). |
| ID | Követelmény |
| --- | --- |
| BK-60 | Mentés – csak ment. Mentés és tovább – ment és a folyamat következő lépésére (lezárás) lép. [Leirat] |
| BK-61 | Lezárás – a beosztás „Lezárt beosztás” jelölést kap. A lezárt beosztás továbbra is szerkeszthető („nincsen ebben probléma”). [Leirat] |
| BK-62 | A lezárt beosztás a jelenlét automatikus kitöltésének forrása (lásd 3.6 és a munkavállaló „automatikus jelenlét-kitöltés: lezárt beosztás szerint” beállítása). [Leirat] |
| BK-63 | [Kiegészítés] Állapotgép: Tervezet → Lezárt → (Jelenlét igazolva) → (Jelenlét lezárva/exportálva). Lezárt beosztás módosításakor a már igazolt jelenlétet nem írjuk felül automatikusan, hanem figyelmeztetünk az eltérésre. |
| ID | Követelmény |
| --- | --- |
| AG-01 | Cégszintű generálási szabály definiálható: forrás (munkarend / beosztássablon / előző hónap másolása / létszámigény), időzítés (hó eleje, hó vége, adott nap), érintett dolgozók (mind / munkahely / munkakör / egyedi lista), ünnepnapok és hétvégék kezelése. |
| AG-02 | A generálás ütemezetten, automatikusan lefut (a meglévő automatizációs motorunkkal), létrehozza a havi beosztást, és értesíti az operátort. |
| AG-03 | A generált beosztásra automatikusan lefut a munkaügyi szabályellenőrzés (3.16); a szabálysértések listázva, javításig figyelmeztetés. |
| AG-04 | A generálás figyelembe veszi a már rögzített távolléteket (szabadság, táppénz) és a dolgozó jogviszonyának kezdetét/végét. |
| AG-05 | Eltérések kézi kezelése: az operátor a generált beosztáson csak a módosításokat végzi (pl. „XY 3-tól 7-ig szabadságon, utána betegszabadságon”). |
| AG-06 | Jövőbeli lépés: az ügyféltől e-mailben / feltöltött jelenléti ívként érkező módosítási információ félautomatikus feldolgozása (a meglévő dokumentumfeldolgozó képességeinkre építve), operátori jóváhagyással. |
| AG-07 | „Előző hónap másolása” művelet kézzel is indítható a Beosztáskezelőből: az előző időszak műszakjait a hét napjai szerint illeszti az új hónapra (első hétfő → első hétfő), ünnepnapokat kihagyva. |
| ID | Követelmény |
| --- | --- |
| TL-01 | A Távollétek menü a kiválasztott beosztási időszak dolgozóit listázza; „Szerkesztés” után távollét adható hozzá. [Leirat] |
| TL-02 | Távollét hozzáadása mezői: munkavállaló neve, kezdet (dátum), vége (dátum), típus (legördülő), megjegyzés (szabad szöveg). [Leirat] |
| TL-03 | [Kiegészítés] Részleges napi távollét (óra alapú, pl. fél nap szabadság) támogatása – a leiratban csak napos távollét szerepelt. [Tisztázandó] |
| TL-04 | A rögzített távollét azonnal megjelenik a Beosztáskezelő rácsában (kék), az adott napokra műszak nem osztható; a lezárt beosztásból a jelenlétbe és az exportba is átkerül. [Leirat] |
| TL-05 | A naptárban/exportban a bemutatott rendszer a megjegyzést jeleníti meg (ha üres, csak a dátumtartományt). [Új] Nálunk elsődlegesen a típus neve jelenjen meg, a megjegyzés csak kiegészítésként. |
| TL-06 | Szűrők: összes típus / adott típus; összes munkahely / adott munkahely; munkakör – ugyanaz a szűrőlogika, mint a Beosztáskezelőben. [Leirat] |
| TL-07 | Fizetett szabadság rögzítésekor a dolgozó szabadságegyenlege (éves kivehető – kivett) automatikusan csökken; a vállalkozás beállítása szerint az egyenleg negatívba is mehet. [Leirat] |
| TL-08 | [Új] Betegszabadság → táppénz automatika: „Betegség/táppénz” típusú, egybefüggő távollét esetén a rendszer az adott naptári évben már felhasznált betegszabadság-napokat számolja; az első 15 munkanap betegszabadság, az azt követő napok táppénz jogcímre kerülnek automatikusan (külön típusként vagy altípusként), a felhasználó felülbírálhatja. Ma ezt a felhasználó a bérprogramban külön vezeti és a megjegyzésbe írja. |
| TL-09 | Fizetett szabadság az exportban napi 8 órával számolódik (a bemutatott rendszer így hozta). [Kiegészítés] Részmunkaidősnél a napi munkaidő szerinti órával. |
| TL-10 | [Kiegészítés] Munkavállalói szabadságigény (ha a dolgozó be van kötve): igény beadása → operátor jóváhagyása/elutasítása → automatikus távollét-rögzítés + értesítés. |
| # | Típus | Magyarázat / bérszámfejtési vonatkozás [Kiegészítés] |
| --- | --- | --- |
| 1 | Fizetett szabadság | Alapeset; csökkenti az éves szabadságkeretet; napi 8 órával számol. |
| 2 | Betegség / táppénz | Első 15 munkanap betegszabadság (munkáltató fizeti, 70%), utána táppénz (NEAK folyósítja, kieső idő). Lásd TL-08. |
| 3 | Baleseti táppénz | Üzemi baleset miatti keresőképtelenség; külön jogcím. |
| 4 | Csecsemőgondozási díj (CSED) | Szülést követő időszak; a dolgozó „elment szülni, a kisbabájával van otthon”. |
| 5 | Gyermekgondozási díj (GYED) | A gyermek 2 éves koráig. |
| 6 | Gyermekgondozási segély / támogatás (GYES) | Gyermek gondozása miatti távollét. |
| 7 | Gyermeknevelési támogatás (GYET) | Három vagy több gyermek nevelése esetén. |
| 8 | Ápolási díj | Hozzátartozó ápolása. |
| 9 | Katonai szolgálat | Tényleges/önkéntes katonai szolgálat. |
| 10 | Önkéntes tartalékos szolgálat | A leiratban „tőnkéntes” – önkéntes tartalékos katonai szolgálat. [Tisztázandó pontos megnevezés] |
| 11 | Előzetes letartóztatás | A leiratban „erőzetes letartóztatás”. |
| 12 | Szabadságvesztés | Büntetés-végrehajtás. |
| 13 | Munkavégzési kötelezettség alóli felmentés | Pl. felmondási idő alatti felmentés. |
| 14 | Ügyvédi tevékenység szünetelése | A leiratban „ügyvéd, szabadság” – ügyvédi kamarai tagság szünetelése. [Tisztázandó] |
| 15 | Ügyvivő / kamarai tagság szünetelése | Kamarai tagsághoz kötött tevékenység szünetelése. |
| 16 | Állatorvosi tevékenység szünetelése | Kamarai jogcím. |
| 17 | Tanulószerződés szüneteltetése | Duális képzés / szakképzési munkaszerződés szünetelése. |
| 18 | Fizetés nélküli szabadság | Kieső idő. |
| 19 | Fizetés nélküli szabadság – gyermekápolás | Gyermek otthoni ápolása miatti fizetés nélküli szabadság. |
| 20 | Igazolt távollét | Egyéb, igazolt (pl. hatósági idézés, véradás). |
| 21 | Igazolatlan távollét | Nem igazolt hiányzás; bérlevonás alapja. |
| 22 | Jogszerű sztrájk időtartama | Mt. szerinti. |
| 23 | Gyermekek otthongondozási díja (GYOD) | Tartósan beteg gyermek otthoni gondozása. |
| 24 | Örökbefogadói díj | Örökbefogadás esetén járó ellátás. |
| 25 | Pénzbeli ellátás nélküli keresőképtelenség | Keresőképtelen, de nem jár táppénz (pl. várakozási idő). |
| 26 | Egyéb | Szabad szöveges megjegyzéssel. |
| 27 | Apasági szabadság | Gyermek születése esetén az apának járó szabadság. |
| 28 | Hozzátartozó halála | Mt. szerinti mentesülés. |
| ID | Követelmény |
| --- | --- |
| JL-01 | A Jelenlét menüben kiválasztható a szerkesztendő hónap. Belépéskor a rendszer „frissíti a munkaügyi szabályokat” (újraellenőrzi a jelenlétet). [Leirat] |
| JL-02 | Szerkesztés nézet: dolgozónként a tervezett műszakok és a tényleges jelenlét; egyedi napok igazolhatók vagy módosíthatók (kezdés/vége/pihenőidő). [Leirat] |
| JL-03 | Tömeges igazolás: a lezárt beosztás szerinti összes műszak, minden dolgozónál, egy lépésben tényleges jelenlétként igazolódik („elfogadtam az összeset”). A távollétek is átkerülnek. [Leirat] |
| JL-04 | [Kiegészítés] Egyedi igazolás: dolgozónként/naponként jelölőnégyzettel kiválasztható, kiét/melyik napot fogadjuk el. |
| JL-05 | Jelenlét lezárása – az igazolás után a hónap jelenléte lezárható; ezután exportálható. [Leirat] |
| JL-06 | Munkavállaló-szintű beállítás: „automatikus jelenlét-kitöltés” – értékei: nincs / lezárt beosztás szerint / munkarend szerint [Tisztázandó a pontos értékkészlet]. Ha „lezárt beosztás szerint”, a beosztás lezárásakor a jelenlét automatikusan feltöltődik. [Leirat] |
| JL-07 | Szűrők: összes típus, összes munkahely, munkakör – azonos a többi modullal. [Leirat] |
| JL-08 | Az igazolt jelenlét adja az export „Jelenlét” oszlopát, a tervezett beosztás a „Beosztás” oszlopot. [Leirat] |
| JL-09 | [Kiegészítés] Ha a dolgozók be vannak kötve: a dolgozó maga is rögzíthet jelenlétet; a vállalkozás beállítása szabályozza, hogy jövőbeli jelenlétet rögzíthet-e; értesítés jelenlét-kitöltés elmaradásakor. |
| JL-10 | [Kiegészítés] Beléptetőrendszerből érkező be-/kilépési adatok automatikus jelenlétté alakítása (lásd 3.13). |
| ID | Követelmény |
| --- | --- |
| EX-01 | Az export a Jelenlét menüből indítható; hónap kiválasztása (bármely korábbi, lezárt hónap, pl. augusztus). [Leirat] |
| EX-02 | Formátum: Excel (.xlsx), dolgozónként külön munkalap („alul vannak a fülek”). [Leirat] |
| EX-03 | Munkalap tartalma (a leirat alapján): cég adatai; dolgozó adatai; napi sorok a hónap minden napjára; „Beosztás” oszlop(csoport) – tervezett kezdés/vége/óra; „Jelenlét” oszlop(csoport) – tényleges kezdés/vége/pihenőidő/ledolgozott óra; távollétek jogcímmel és óraszámmal (fizetett szabadság 8 órával); havi összesítő sorok (ledolgozott óra, túlóra, távollét); aláírás-helyek a dolgozónak és a munkáltatónak. [Leirat] [Kiegészítés] A pontos elrendezést a mintafájl alapján kell véglegesíteni. |
| EX-04 | Kapcsoló: pótlék-sorok megjelenítése – éjszakai, ünnepnapi (vasárnapi, túlóra) pótlékok sorai opcionálisan; normál, hétfő–péntek 9–17 munkarendnél ezek feleslegesek, ezért kikapcsolhatók, hogy ne legyen „ekkora táblázat”. [Leirat] |
| EX-05 | A távollétnél a bemutatott export a megjegyzést írja ki (ha üres, semmit). [Új] A típus neve kerüljön az exportba, a megjegyzés mellé/külön oszlopba. |
| EX-06 | [Új] Export PDF-ben is (nyomtatásra, aláírásra), és tömeges export (egy cég összes dolgozója egy fájlban, illetve több cég egyszerre a könyvelőiroda számára). |
| EX-07 | [Új] Bérszámfejtési adatátadás: gépi formátum (CSV/XLSX/API) a bérprogram felé: dolgozónként ledolgozott óra, túlóra, pótlékórák, távollétek jogcímenként és napszámban, kieső idő. |
| EX-08 | [Kiegészítés] Az exportált fájl cégenként archiválva, verziózva (újraexport esetén az előző példány megmarad), mert NAV-ellenőrzés esetén visszakereshetőnek kell lennie. |
| ID | Követelmény |
| --- | --- |
| ST-01 | Lekérdezési intervallum (tól–ig) kötelező megadása. [Leirat] |
| ST-02 | Adatforrás választó: jelenléti adatok / lezárt beosztások adatai / összes beosztás adatai. [Leirat] |
| ST-03 | Eredménytábla: az összes dolgozó, ledolgozott órák, normál óra, túlóra (a leirat: „normál túlóra” – normál és túlóra oszlop). [Leirat] |
| ST-04 | Részletek gomb dolgozónként: napi bontás, hogyan dolgozott; nyomtatható. [Leirat] |
| ST-05 | Export gomb (zöld): Excel export a statisztikáról. A megrendelő ebből is mintát kért. [Leirat] |
| ST-06 | [Kiegészítés] További mutatók: pótlékórák típusonként, távollét napok jogcímenként, munkaidőkeret-egyenleg, szabadságegyenleg; szűrés munkahelyre/munkakörre. |
| ID | Követelmény |
| --- | --- |
| UZ-01 | Belső üzenőfelület operátor és munkavállalók között; a dolgozók pl. szabadság miatt üzennének. Az ügyfeleknél nincs használatban, mert a dolgozók nincsenek bekötve, de a megrendelő szerint „van értelme, mi is használjuk, hogy van ilyen”. [Leirat] |
| UZ-02 | [Kiegészítés] Egyéni és csoportos (munkahely/munkakör szerinti) üzenet, olvasási visszaigazolás, e-mail értesítés új üzenetről. Alacsony prioritás. |
| ID | Követelmény |
| --- | --- |
| MV-01 | Listanézet a cég dolgozóiról; oszlopban a hozzárendelt munkahely(ek) (pl. „Nagy Sándor”, „Kőrösi”). A bemutatott rendszerben a lista betöltése lassú. [Leirat] |
| MV-02 | Hozzáadás (új dolgozó adatlapja), szerkesztés, törlés. Régen kilépett dolgozó törölhető. [Leirat] |
| MV-03 | Importálás / exportálás – a dolgozók listája importálható (pl. a bérprogramból exportált fájlból) és exportálható. A felhasználó ma kézzel viszi fel őket. [Új] Import a saját rendszerünk meglévő törzsadataiból és a bérprogram export-formátumából (oszlop-hozzárendeléssel). [Leirat] |
| MV-04 | Kilépettek – a jogviszony végével rendelkező dolgozók külön nézete/szűrője. [Leirat] |
| MV-05 | Tömeges meghívás – több dolgozónak egyszerre belépési meghívó küldése (e-mail). [Leirat] |
| MV-06 | Tömeges tagságtörlés – több dolgozó eltávolítása a cégből (a felhasználói fiók marad). [Leirat] |
| MV-07 | Tömeges törlés – több dolgozó végleges törlése. [Leirat] |
| MV-08 | Töröltek megjelenítése – kapcsoló a törölt (soft-deleted) dolgozók listázására. [Leirat] [Kiegészítés] Ebből következik: a törlés logikai (soft delete), a korábbi beosztások/jelenlétek megmaradnak. |
| Mező | Típus | Megjegyzés |
| --- | --- | --- |
| Név | szöveg | kötelező |
| E-mail | e-mail | értesítésekhez és belépéshez; „ha valamiről ki akarnád értesíteni, mindenről kap a dolgozó is értesítést” |
| Telefon | szöveg | értesítésekhez |
| Adóazonosító jel | 10 számjegy | bérszámfejtési azonosító; [Kiegészítés] formátum-ellenőrzés |
| Törzsszám | szöveg | a bérprogram/HR azonosítója; import-kulcs [Kiegészítés] |
| Jogviszony kezdete | dátum | beosztás csak ettől a naptól |
| Jogviszony vége | dátum | üres = aktív; kitöltve → „Kilépettek” közé kerül |
| Munkahelyek | többes választás | a cég munkahelyei közül a hozzárendeltek |
| Elsődleges munkahely | választás | alapértelmezés műszak felvitelénél |
| Munkakör(ök) | többes választás |  |
| Elsődleges munkakör | választás | alapértelmezés műszak felvitelénél |
| Partnerek / párok | többes választás (dolgozók) | „kikkel dolgozik együtt”, egymást helyettesíthetik; a felhasználó nem használja, de a helyettesítési logika bemenete |
| Szín | színválasztó | a rácsban a dolgozó színe; a felhasználó a nagy fluktuáció miatt nem használja |
| Kivett szabadság (adott év) | szám (nap) | a rendszer által vezetett érték, pl. „2020-ban kivett” |
| Éves kivehető szabadság | szám (nap) | pl. 26; a rendszer jelzi, mennyi nem lett még kivéve |
| Nyelv | magyar / angol | a dolgozó felületének nyelve |
| Megjegyzés | szöveg | pl. munkarendre vonatkozó megjegyzés |
| Automatikus jelenlét-kitöltés | választás | nincs / lezárt beosztás szerint / (munkarend szerint) [Tisztázandó] |
| Mező | Értékkészlet / példa | Magyarázat |
| --- | --- | --- |
| Munkavállaló típusa | normál / fiatalkorú / kismama / alkalmi munkavállaló | A típusra az Mt. külön korlátokat ír elő (pl. fiatalkorú: max. 8 óra/nap, éjszakai munka tilos; kismama: éjszakai és rendkívüli munka korlátai; alkalmi: egyszerűsített foglalkoztatás napszám-korlátai) – ezeket a szabálymotor ellenőrzi. [Kiegészítés] |
| Munkanap definíciója | (1) Naptári nap – a munkaidő kezdés és befejezés kizárólag azonos naptári napra osztható be; (2) Megszakítás nélküli 24 óra a munkaidő kezdetétől – nem azonos naptári napra is beosztható | Éjszakai/átnyúló műszakoknál a (2) kell. |
| Napi munkaidő | óra, pl. 8 | a munkaszerződés szerinti napi munkaidő; részmunkaidősnél pl. 4 vagy 2 |
| Beosztás szerinti napi munkaidő minimuma | óra, pl. 4 | „ha valaki 2 órás, akkor nem lehet a minimum 4 óra, át kell írni 2-re” |
| Beosztás szerinti napi munkaidő maximuma | óra, pl. 12 | Mt. szerinti felső korlát |
| Beosztás szerinti heti munkaidő maximuma | óra, pl. 40 (48 rendkívüli munkával) |  |
| Minimum egybefüggő pihenőidő két munkanap között | óra, pl. 11 | Mt. 104. § – napi pihenőidő |
| Mező | Példa | Magyarázat |
| --- | --- | --- |
| Munkaidőkeretben dolgozik | jelölőnégyzet | ha nincs bejelölve, havi elszámolás |
| Munkaidőkeret kezdete | október 1. | a keretciklusok ettől számolódnak |
| Munkaidőkeret hossza | 3 hónap | Mt. szerint max. 4 hónap (kollektív szerződéssel több) |
| Már van ledolgozott munkaideje az első munkaidőkeret-ciklusban | jelölőnégyzet + óraszám [Kiegészítés] | ha a dolgozót ciklus közben vesszük fel a rendszerbe, a korábban ledolgozott órák beszámítása |
| Mező | Magyarázat |
| --- | --- |
| Dolgozhat munkaszüneti napokon is | jelölőnégyzet |
| Pihenőnapok | a hét napjai, amikor a dolgozó nem szeretne dolgozni |
| Preferált munkavégzési időszak | napszak/időintervallum |
| Maximum munkaórák / naptári nap | egyedi napi korlát |
| Maximum munkaórák / hét [Tisztázandó – a leirat „per órák”] | egyedi heti korlát |
| Visszaváltáshoz (műszakváltáshoz) szükséges minimum pihenőidő | pl. éjszakai → nappali műszak közötti pihenő |
| ID | Követelmény |
| --- | --- |
| OP-01 | A cég létrehozásakor kötelező legalább egy operátor megadása („ki fogja kezelni”); ezzel a felhasználóval történik a belépés. [Leirat] |
| OP-02 | Több operátor is felvehető; lista, hozzáadás, szerkesztés, törlés, töröltek megjelenítése. [Leirat] |
| OP-03 | Operátor adatai: név, jogosultság, e-mail, nyelv, munkahelyek (mely telephelyeket látja), kezelt munkavállalók, profilkép, 2FA (lásd Adataim, 3.15). [Leirat] |
| OP-04 | [Kiegészítés] A könyvelőirodai operátor egyszerre több céghez rendelhető (cégváltó a fejlécben). |
| ID | Követelmény |
| --- | --- |
| MH-01 | Munkahelyek: a cég telephelyei/üzletei. Alapból létezik egy „Központ” munkahely; a felhasználó ide nem rak senkit, ha több üzlet van, hanem üzletekre bontja („szétbontom őket üzletre”). Építőipari cégnél a „Központ” az iroda (2–3 fő), az „építkezés” a másik csoport. [Leirat] |
| MH-02 | Munkahelynél megadhatók a hozzá tartozó munkavállalók („a Nagy Sándorba kik dolgoznak”); ugyanez a hozzárendelés a dolgozó adatlapjáról is elvégezhető, a lista mindkét irányból látszik. [Leirat] |
| MH-03 | Munkakörök: lista, hozzáadás, importálás, exportálás; munkakörhöz szín rendelhető (a rács színezéséhez). [Leirat] |
| MH-04 | [Kiegészítés] Munkahelyhez cím, nyitvatartás és alapértelmezett munkaidő-sablon rendelhető, amely a létszámigény és az automatikus kitöltés alapja. |
| ID | Követelmény |
| --- | --- |
| SB-01 | Munkarendek: a dolgozók általános munkarendjei (pl. hétfő–péntek 8–16:30). A „Kitöltés munkaidőrend szerint” és a dolgozó „munkanap definíciója munkarend alapján” mezője hivatkozik rá. A bemutató nem részletezte a mezőit. [Tisztázandó] Javasolt: név, hét napjai, napi kezdés/vége, pihenőidő, ciklus. |
| SB-02 | Munkaidősablonok: „itt adjuk meg, hogy hánytól hányig van munkaidő” – név, kezdés, vége, pihenőidő. Műveletek: új létrehozása, módosítás/szerkesztés, másolás. Újrafelhasználható másik telephelynél („ha nyitok a város másik pontján is egy gyrosost”). [Leirat] |
| SB-03 | Beosztássablonok: ismétlődő hetek száma (pl. 4) megadása; a rács soraiban a dolgozók, oszlopaiban a hetek napjai; cellánként beállítható, melyik műszakban (munkaidősablonban) dolgozik. A Beosztáskezelő „Kitöltés beosztássablonnal” művelete ezt emeli be a hónapba. [Leirat] |
| SB-04 | A bemutatott rendszerben a beosztássablon cellái egyesével tölthetők csak („nem tudom átmásolgatni – ez béna”). [Új] Tömeges kitöltés, sor/hét másolás a sablonszerkesztőben is. |
| SB-05 | [Kiegészítés] Sablonok cégek közötti másolása (könyvelőiroda-szintű sablonkönyvtár), mert azonos profilú ügyfeleknél (pl. több vendéglátóhely) ugyanaz a minta használható. |
| ID | Követelmény |
| --- | --- |
| BR-01 | A modul külső beléptetőrendszerrel köthető össze: a dolgozó kártyás/egyéb belépését és kilépését a rendszer automatikusan jelenlétként rögzíti, „nem kell írkálni”. Az ügyfeleknél nincs használatban. [Leirat] |
| BR-02 | Belépések: a beérkezett be-/kilépési események listája dolgozónként, időbélyeggel. [Leirat] |
| BR-03 | Ellenőrzőpontok: a belépési pontok definiálása, dinamikus munkavállalói azonosítóval (pl. QR-kód/NFC/mobilos azonosítás). [Leirat] [Tisztázandó a konkrét technológia] |
| BR-04 | [Kiegészítés] Alacsony prioritás; API/webhook fogadó felület tervezése elegendő az első fázisban. |
| ID | Követelmény |
| --- | --- |
| IN-01 | Cég-törzs: a munkaidő-modul a meglévő ügyfél (cég) rekordhoz kapcsolódik; cégnév, adószám, logó onnan öröklődik. |
| IN-02 | Felhasználók és szerepkörök: a meglévő auth/2FA megoldásra épül; a bérszámfejtő/könyvelő hozzáférés a meglévő könyvelői szerepkörrel egyezik. |
| IN-03 | Bérszámfejtési átadás: havi zárás után a jelenlét/túlóra/pótlék/távollét-adatok a bérszámfejtési modulnak (vagy külső bérprogramnak) exportálva; a betegszabadság-számláló innen kerül a bérprogramba (ma kézzel vezetik). |
| IN-04 | Munkavállaló-törzs szinkron: a bérprogram / HR-adatok importja (adóazonosító, törzsszám mint kulcs), változások (belépés, kilépés) átvezetése. |
| IN-05 | Automatizációs motor: ütemezett beosztás-generálás, értesítések, e-mail alapú módosítási kérések feldolgozása (AG-06). |
| IN-06 | Dokumentumtár: az exportált havi munkaidő-jegyzékek a cég dokumentumai közé kerülnek, aláírt példány visszatölthető. |
| Blokk | Mező / beállítás | Megjegyzés |
| --- | --- | --- |
| Vállalkozás adatai | Vállalkozás neve; adószám; logó | [IN-01] a saját rendszerből öröklődik |
| Általános beállítások | Alapértelmezett pihenőidő (pl. 30 perc = ebédszünet) | műszak felvitelénél automatikusan felajánlva |
| Általános beállítások | Munkavállalók és operátorok értesítése a jelenlét kitöltésének elmaradása esetén | jelölőnégyzet |
| Általános beállítások | Munkavállalók tudnak jövőbeli jelenlétet rögzíteni | jelölőnégyzet |
| Általános beállítások | A munkavállalók fennmaradó kivehető szabadságainak száma lehet negatív is | jelölőnégyzet |
| Munkaügyi szabályok | „A beosztástervezés közben a rendszer ellenőrizze, hogy a beosztás megfelel-e a munkaügyi szabályoknak” + az ellenőrzendő szabályok listája (lásd 3.16) | cégszintű alapértelmezés, dolgozónként és beosztásonként felülírható |
| Munkavállalói igények | „A beosztástervezés közben a rendszer ellenőrizze, hogy a beosztás megfelel-e a munkavállalók igényeinek” | jelölőnégyzet |
| Kétfaktoros hitelesítés | Kötelezővé tétel külön: operátorok / munkavállalók / bérszámfejtők részére | jelölőnégyzetek |
| Bérszámfejtő / könyvelő | Hozzáférés adása bérszámfejtőnek, könyvelőnek, hogy a saját felületükön elérjék a beosztási és jelenléti adatokat; az adott iroda megjelenik | [IN-02] |
| Veszélyzóna | Összes adat törlése; felhasználói fiók törlése | megerősítéssel, naplózva |
| Szabály | Paraméter forrása | Ellenőrzés |
| --- | --- | --- |
| Napi munkaidő minimum / maximum | dolgozó: min. (pl. 4 h), max. (pl. 12 h) | műszak hossza – pihenőidő a tartományban van |
| Heti munkaidő maximum | dolgozó: pl. 40 h | hét (hétfő–vasárnap) összes órája |
| Napi pihenőidő két munkanap között | dolgozó: pl. 11 h | előző műszak vége → következő műszak kezdete |
| Havi legalább egy vasárnapi pihenőnap | kapcsoló | hónapban legalább egy vasárnap műszak nélkül |
| Heti 48 óra egybefüggő pihenőidő | kapcsoló | hetente egy 48 órás műszakmentes blokk |
| 6 egybefüggő munkanap után pihenőnap | kapcsoló | max. 6 egymást követő munkanap |
| Munkavállaló-típus specifikus szabályok | dolgozó típusa | fiatalkorú / kismama / alkalmi korlátok |
| Munkanap definíciója | naptári nap / 24 óra | átnyúló műszak engedélyezése |
| Munkaidőkeret egyenlege | kezdet, hossz, előzetes órák | keretciklus végén ledolgozott = kötelező óra; folyamatos maradék kijelzése |
| Munkavállalói igények | pihenőnapok, preferált időszak, max. órák, műszakváltási pihenő, munkaszüneti nap | figyelmeztetés (nem tiltás) |
| Távollét ütközés | rögzített távollétek | távollét napjára műszak nem vihető fel (tiltás) |
| Jogviszony időszak | jogviszony kezdete/vége | azon kívül műszak nem vihető fel (tiltás) |
| Ünnepnapok | munkaszüneti napok naptára | „dolgozhat munkaszüneti napon” igény hiányában figyelmeztetés; pótlék-jelölés az exportban |
| Entitás | Fő mezők | Kapcsolatok |
| --- | --- | --- |
| Cég (Tenant) | név, adószám, logó, alapértelmezett pihenőidő, kapcsolók, 2FA-kötelezettségek, szabálybeállítások | 1–N munkahely, munkakör, munkavállaló, operátor, beosztás |
| Munkahely | név, (cím), alapértelmezett-e (Központ) | N–M munkavállaló |
| Munkakör | név, szín | N–M munkavállaló |
| Munkavállaló | 3.9.2 A–F blokk összes mezője; soft-delete | N–M munkahely, munkakör; N–M partner; 1–N műszak, távollét, jelenlét |
| Operátor / Felhasználó | név, e-mail, jogosultság, nyelv, 2FA, profilkép | N–M cég; N–M kezelt munkahely/munkavállaló |
| Munkarend | név, napok, kezdés/vége, pihenőidő | N munkavállaló |
| Munkaidősablon | név, kezdés, vége, pihenőidő | használja: beosztássablon, létszámigény |
| Beosztássablon | név, ismétlődő hetek száma; cellák: dolgozó × hét × nap → munkaidősablon | cég |
| Beosztás (időszak) | megnevezés, tól, ig, opciók (munkaidő megadása, jelentkezések), állapot (tervezet/lezárt), egyedi szabályok | 1–N létszámigény, műszak |
| Létszámigény | beosztás, munkahely, nap, műszak (munkaidősablon), fő |  |
| Műszak | beosztás, munkavállaló, munkahely, munkakör, dátum, kezdés, vége, pihenőidő, típus, home office, megjegyzés |  |
| Jelentkezés | beosztás, munkavállaló, nap/időszak, elérhető-e | csak engedélyezett jelentkezéseknél |
| Távollét | munkavállaló, kezdet, vége, típus, (altípus: betegszabadság/táppénz), megjegyzés, óraszám | típus-törzs |
| Távollét-típus | kód, név, kieső idő?, csökkenti szabadságkeretet?, bérszámfejtési kód |  |
| Jelenlét (tényleges nap) | munkavállaló, dátum, kezdés, vége, pihenőidő, ledolgozott óra, forrás (igazolt beosztás / kézi / beléptető), igazolva-e, lezárva-e |  |
| Export / munkaidő-jegyzék | cég, hónap, fájl, verzió, pótlékokkal-e, generálás ideje, generálta | archívum |
| Belépési esemény | ellenőrzőpont, munkavállaló-azonosító, időbélyeg, irány | beléptetőrendszer |
| Üzenet / Értesítés | feladó, címzett(ek), tárgy, szöveg, olvasva |  |
| Naplóbejegyzés | ki, mikor, entitás, művelet, előtte/utána érték | minden fenti entitás |
| Fázis | Cél | Fő tartalom (követelmény-ID-k) |
| --- | --- | --- |
| 0. Előkészítés | Tisztázott specifikáció, minták, architektúra | 3.18 nyitott kérdések; export-minták; adatmodell (3.17); UI-vázlatok (rács, adatlap); integrációs pontok (3.14) |
| 1. Törzsadatok | Cég, munkahelyek, munkakörök, munkavállalók, operátorok, beállítások | R-01…R-06, MH-01…04, MV-01…08, 3.9.2 A–F, OP-01…04, 3.15 |
| 2. Beosztáskezelő – alap | Havi beosztás kézi és sablonos kitöltése rácsban | BK-01…06, BK-10…15, BK-20…34, BK-40…46, BK-60…63, SB-02, SB-03 |
| 3. Távollétek | Mt. szerinti távollét-kezelés, szabadságegyenleg | TL-01…10, 3.5.1 típuslista |
| 4. Jelenlét és export (MVP) | Igazolás, lezárás, NAV-kompatibilis Excel | JL-01…10, EX-01…08, ST-01…05 |
| 5. Szabálymotor és munkaidőkeret | Automatikus munkaügyi ellenőrzés | 3.16 összes szabály, BK-25, BK-26, 3.9.2 C–F |
| 6. Automatizálás és tömeges szerkesztés | A megkülönböztető funkciók | AG-01…07, BK-07, BK-24, BK-44, BK-50…54, SB-04, SB-05, TL-08, MV-03 import |
| 7. Integráció és értesítések | Bérszámfejtés, dokumentumtár, értesítések, üzenetek | IN-01…06, EX-07, ER-01…04, UZ-01…02, ST-06 |
| 8. Dolgozói önkiszolgálás | Dolgozói belépés, szabadságigény, jelentkezés | 3.9.2 B jogosultságok, BK-05, TL-10, JL-09, R-03 munkavállalói 2FA |
| 9. Beléptetőrendszer és bővítések | Automatikus jelenlét külső forrásból | BR-01…04, JL-10, AG-06 e-mail alapú módosítás |
| MVP definíció
A 0–4. fázis végén a könyvelőiroda egy ügyfélre a teljes havi folyamatot (törzsadat → beosztás → távollét → jelenlét → aláírható Excel) el tudja végezni a saját rendszerünkben, és az eredmény tartalmilag megegyezik a bemutatott rendszer NAV által elfogadott kimenetével. |
| --- |
| Kockázat / függőség | Hatás | Kezelés |
| --- | --- | --- |
| Export-minták hiánya | Az MVP legfontosabb kimenete nem véglegesíthető; NAV-elfogadhatóság kockázata | 0. fázisban bekérni; ha nem érkezik, a leirat + a bemutatott rendszer felületének ismételt átnézése alapján készül, majd könyvelői ellenőrzés |
| Jogszabályi paraméterek (Mt., tb) változása | Szabálymotor és távollét-típusok elavulnak | Paraméterezhető szabálytörzs, évenkénti felülvizsgálat, ünnepnap-naptár karbantartás |
| Rács-teljesítmény nagy létszámnál | Lassú felület (a bemutatott rendszer hibája) | Virtualizált rács, szerveroldali lapozás, célértékek R-07 |
| A dolgozói funkciók iránti valós igény bizonytalan | Felesleges fejlesztés | 8. fázisba sorolva, ügyfél-visszajelzés után indul |
| Bérprogram-formátum ismeretlen | Import/export késik | 0. fázisban tisztázni; első körben generikus CSV/XLSX oszlop-hozzárendeléssel |
| Adatvédelem (személyes és egészségügyi adat: táppénz, CSED stb.) | GDPR-megfelelés | Szerepkör-alapú hozzáférés, naplózás, törlési funkciók, adatkezelési tájékoztató a 1. fázisban |