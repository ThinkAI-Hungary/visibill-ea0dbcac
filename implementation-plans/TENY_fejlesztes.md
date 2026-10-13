TÁRGYI ESZKÖZÖK
1.1. Tárgyi eszköz analitika és főkönyvi egyezőség
Alapkövetelmény: Teljes, tételes tárgyi eszköz analitika, amely automatikusan egyezik a főkönyvvel. Az eltérést a rendszer ne csak jelezze, hanem eszközre és könyvelési tételre bontva vezesse le.
🏢 Visibill (eaisyBill) – Operatív réteg:
Számla alapú eszköz-előkészítés: Bejövő beruházási számla (161 Beruházások) rögzítésekor a rendszer automatikusan felajánlja az új eszközkarton létrehozását, kitöltve a partneradatokat, számlaszámot, beszerzési értéket és dátumot.
Eszköz-állapotlap és digitális dosszié: Fotók, üzembe helyezési jegyzőkönyv, jótállási jegy és szállítólevél közvetlen csatolása a tárgyi eszközhöz.
Fizikai azonosító és címkézés: Generált leltári számhoz vonalkód és QR kód generálás nyomtatható matricaként (
QrLabelDialog.tsx bővítése).
📚 eaisyBooks – Könyvelői és főkönyvi réteg:
Valós idejű Főkönyv ↔ TENY Rekonciliációs Motor: Automatikus mérlegegyezőség-vizsgálat az 1-es főkönyvi számlák (12, 13, 14 bruttó értékek; 129, 139, 149 terv szerinti halmozott ÉCS; 161 beruházások) és a tárgyi eszköz analitika összesítői között.
Tételes Eltérés-levezető Munkalap (Root-cause Analysis): Ha differencia áll fenn (eltérés ≠ 0 Ft), a rendszer nemcsak riasztást ad, hanem eszközökre és könyvelési tételekre lebontva kimutatja az okokat:
Könyveletlen eszközök: TENY-ben aktivált eszköz, amelyhez még nem jött létre vagy függőben van az aktiválási vegyes napló tétel (T 12-14 → K 161).
Analitika nélküli könyvelés: Olyan tétel az 1-es számlaosztályban, amelyhez nem kapcsoltak tárgyi eszközt a vegyes naplóban.
Periódus-eltérés: A beruházási számla teljesítése és az eszköz aktiválási napja eltérő hónapba/évbe esik.
1-kattintásos szinkronizáló varázsló: Az azonosított hiányzó aktiválási vagy ÉCS tételek kötegelt lekönyvelése a vegyes naplóba.

1.2. Párhuzamos értékcsökkenési nyilvántartás
Alapkövetelmény: Számviteli és társaságiadó-törvény szerinti értékcsökkenés párhuzamos kezelése ugyanazon eszközön. Beszerzési érték, módszer, kulcs, tárgyévi és halmozott értékcsökkenés, számviteli és adó szerinti nettó érték egy helyen.
🏢 Visibill (eaisyBill) – Operatív réteg:
Vállalkozói hasznos élettartam és maradványérték rögzítése: A cégvezető által meghatározott várható valós használati időtartam (években/hónapokban) és a becsült maradványérték megadása.
Teljesítményarányos ÉCS adatbevitel: Gépjárműveknél km-óra állás, termelőgépeknél üzemóra vagy gyártott darabszám havi rögzítése a tényleges amortizációhoz.
Cégvezetői vagyonkimutatás: Számviteli nettó érték és eszköz-öregedési mutatók megjelenítése vezetői grafikonokon.
📚 eaisyBooks – Könyvelői és adózási réteg:
Kettős ÉCS Motor ugyanazon az eszközkartonon:
Számviteli (Sztv.) ÉCS: Hasznos élettartam, maradványérték és választott leírási módszer (lineáris, degresszív, teljesítményarányos). Ez kerül lekönyvelésre a vegyes naplóba (T 571 → K 1x9).
Adó szerinti (Tao tv.) ÉCS: A Tao tv. 1. és 2. számú melléklete szerinti törvényi leírási kulcsok (informatika 33%, gépek 14,5%, járművek 20%, épületek 2-3%, 200 ezer Ft alatti kisértékű eszközök azonnali leírása), maradványérték levonása nélkül.
Párhuzamos Értéktábla és Mozgáskarton: Egyetlen nézetben, egymás mellett kimutatva:
Beszerzési bruttó érték,
Tárgyévi és halmozott számviteli ÉCS ↔ Tárgyévi és halmozott Tao szerinti ÉCS,
Számviteli nettó könyv szerinti érték ↔ Adótörvény szerinti számított nettó érték.
Automatikus TAO Éves Adóalap-korrekció Integráció:
Év végén automatikusan összegzi a Tao 7. § (1) b) pont szerinti csökkentő tételt (adó szerinti ÉCS) és a Tao 8. § (1) b) pont szerinti növelő tételt (számviteli ÉCS).
Az értékeket közvetlenül átadja a
TaoYearEndWizardPage.tsx 3. és 4. lépésének, és beemeli a hivatalos 2629-es bevallás megfelelő soraiba.

1.3. Leltár és tárolóhely
Alapkövetelmény: Automatikus eszközleltár telephely, tárolóhely, szervezeti egység és felelős személy szerint. Áthelyezések történetének megőrzése.
🏢 Visibill (eaisyBill) – Operatív réteg:
Hierarchikus elhelyezkedési törzs: Telephely → Épület/Szint → Tárolóhely/Iroda/Raktár.
Szervezeti egység és Felelős személy hozzárendelés: Eszköz felelős dolgozójának és költségviselő szervezeti egységének (pl. Értékesítés, Üzem, IT) kijelölése.
Eszköz-áthelyezési munkafolyamat és Átadási jegyzőkönyv:
Áthelyezés indítása új helyszínre vagy új munkavállalóhoz (
TransferDialog.tsx kibővítése).
Kétnyelvű átadás-átvételi nyilatkozat PDF generálása a felelősök aláírásához.
Idősoros Mozgástörténet (Audit Trail): Az eszköz teljes életút-naplója (mikor, melyik telephelyen volt, kinél volt használatban).
Mobil Leltározási Felület: Helyszíni leltár QR-kód / vonalkód kamerás beolvasással, automatikus egyezőség-ellenőrzéssel és eltérés-jelzéssel.
📚 eaisyBooks – Könyvelői réteg:
Költséghelyi ÉCS könyvelés: Az eszközök értékcsökkenési leírásának automatikus felosztása szervezeti egységek és telephelyek szerinti költséghelyekre (6-os/7-es számlaosztály vagy analitikus 5-ös bontás).
Hivatalos leltárív és leltárösszesítő generálás: A Számviteli törvény előírásai szerinti fordulónapi analitikus leltárkimutatás készítése.
Kiegészítő melléklet záradék: Beszámolóhoz csatolandó leltározási szabályzatnak megfelelő igazolás előállítása.

1.4. Fejlesztési tartalék és adókedvezmények
Alapkövetelmény: A fejlesztési tartalék képzésének és felhasználásának eszközhöz kötött nyilvántartása, határidőfigyeléssel. A tárgyi eszközhöz kapcsolódó kisvállalkozói adókedvezmény elkülönített nyilvántartása és monitoringja.
🏢 Visibill (eaisyBill) – Operatív réteg:
Fejlesztési tartalék keretfigyelő sáv: Vezetői műszerfal a cég még fel nem használt fejlesztési tartalék keretéről.
Beruházáskor tartalék-kijelölés: Új eszköz aktiválásakor opció: "Fejlesztési tartalék terhére aktiválva" (
CreateFixedAssetDialog.tsx).
📚 eaisyBooks – Könyvelői és adózási réteg:
Törvényi 4 adóéves határidő-monitoring (Tao tv. 7. § (1) f)):
A lekötött tartalékba helyezés évének és határidejének követése.
Proaktív figyelmeztetés a 3. és 4. évben a le nem kötött keretekre a késedelmi pótlékos adófizetés megelőzésére.
Automatikus feloldás és könyvelési tétel aktiváláskor:
Az eszköz bekerülési értékének erejéig a lekötött tartalék feloldása eredménytartalékba: T 414 → K 413 a vegyes naplóban.
Az érintett eszköz Tao szerinti ÉCS kulcsának automatikus 0%-ra állítása (mivel az adóalapból korábban már érvényesítették).
Nem teljesítés esetén az adó és késedelmi pótlék automatikus kiszámítása.
Kisvállalkozói Adókedvezmény Monitoring (Tao tv. 7. § (1) zs) és 22/A. §):
Beruházási hitelkamat-kedvezmény és kisvállalkozói beruházási adóalap-kedvezmény eszközhöz kötött nyilvántartása.
Elidegenítési tilalom figyelése: Törvényi 4–5 éves elidegenítési és üzemeltetésből kivonási korlát felügyelete; riasztás, ha az eszközt a védelmi időn belül értékesítenék vagy selejteznék (visszafizetési kötelezettség levezetése).

1.5. Kivezetés, értékesítés, selejtezés, leltárhiány
Alapkövetelmény: Értékesítéskor az eszköz automatikus felismerése és a kivezetési tételek előkészítése. Selejtezési és leltárhiány-jegyzőkönyv automatikus, szerkeszthető előállítása; könyvelés csak jóváhagyás után.
🏢 Visibill (eaisyBill) – Operatív réteg:
Értékesítéskori Eszközfelismerés: Kimenő számla kiállításakor vagy beérkezésekor az eszköz neve/leltári száma alapján a rendszer felajánlja a kapcsolódó tárgyi eszköz kiválasztását és kivezetési folyamat indítását.
Szerkeszthető Selejtezési Jegyzőkönyv Űrlap:
Selejtezési bizottság kijelölése (tagok, elnök).
Műszaki indoklás rögzítése (erkölcsi/fizikai elavulás, gazdaságtalan javítás, töréskár).
Hulladékkezelési / veszélyes hulladék átadási adatok.
Nyomtatható, digitálisan aláírható hivatalos selejtezési jegyzőkönyv PDF.
Leltárhiány és Káreset Jegyzőkönyv: Leltárhiány dokumentálása, dolgozói felelősségvizsgálat és térítési kötelezettség rögzítése.
Vezetői / Könyvelői Jóváhagyási Kapu: A selejtezés státusza "Jóváhagyásra vár" marad mindaddig, amíg az illetékes jóvá nem hagyja.
📚 eaisyBooks – Könyvelői és könyvviteli réteg:
Feltételes Kivezetési Könyvelő Motor (Csak jóváhagyás után aktiválódik):
Értékesítés esetén:
Törtidőszaki ÉCS lekönyvelése az értékesítés napjáig (T 571 → K 1x9).
Halmozott ÉCS kivezetése: T 1x9 → K 1x.
Könyv szerinti nettó érték egyéb ráfordításként: T 861 → K 1x.
Értékesítési árbevétel könyvelése egyéb bevételként: T 311/384 → K 961.
Selejtezés esetén:
Halmozott ÉCS kivezetése: T 1x9 → K 1x.
Maradványérték terven felüli ÉCS-ként / egyéb ráfordításként: T 869 / 1x9 → K 1x.
Leltárhiány esetén:
Eszköz kivezetése: T 869 → K 1x, megtéríttetett kár előírása dolgozóval szemben: T 361 → K 969.
TAO adóalap kivezetési korrekció levezetése: Könyv szerinti nettó érték (Tao növelő) és adótörvény szerinti számított nettó érték (Tao csökkentő) különbségének automatikus beemelése az éves társasági adó zárásba.

1.6. Támogatásból megvalósított eszközök
Alapkövetelmény: Egy eszköz egy eszközkarton maradjon, de több értékkomponenst és finanszírozási forrást kezelhessen. Támogatási forrás, saját forrás, későbbi ráaktiválás, eltérő aktiválási dátum és projektkapcsolat komponensenként is nyilvántartható legyen. Alapelv: Egy gazdasági eszköz ne szakadjon szét több mesterséges kartonra csak azért, mert több forrásból finanszírozták.
🏢 Visibill (eaisyBill) – Operatív réteg:
Komponens-elvű Eszközkarton: Egyetlen fizikai eszköz alatt több forrás- és értékkomponens kezelése:
Pl. Eredeti beszerzés: 70% GINOP támogatás + 30% saját erő.
Későbbi bővítés / ráaktiválás (pl. új vezérlőegység 1 évvel később): 100% saját erő.
Komponensenkénti aktiválási dátum: Különböző időpontban üzembe helyezett komponensek egy főkarton alatt.
Pályázati és Projekt Címkézés: Komponensenkénti hozzárendelés az adott beruházási vagy támogatási projekthez.
📚 eaisyBooks – Könyvelői réteg:
Komponens-szintű ÉCS és Forráskalkuláció: A rendszer a háttérben komponensenként számítja az amortizációt az eltérő aktiválási dátumok és finanszírozási források alapján, miközben a főkönyvben az eszköz egyetlen egységként jelenik meg.
Pályázati Audit Eszközkarton Export: Olyan hivatalos mozgáskimutatás, amely bemutatja az ellenőröknek a teljes gép értékét, a támogatott hányadot és a saját erőt.

1.7. Integrált támogatási nyilvántartás
Alapkövetelmény: Az Excel-alapú támogatási tábla kiváltása projektlappal: támogatási döntés, szerződés, projektköltség, támogatási intenzitás, megítélt és kifizetett támogatás, előleg, saját forrás, kapcsolódó eszközök. A támogatás időbeli elhatárolásának és az értékcsökkenéssel arányos feloldásának automatikus kezelése. Támogatási nyilvántartás ↔ tárgyi eszköz analitika ↔ főkönyv ↔ elhatárolások automatikus egyeztetése.
🏢 Visibill (eaisyBill) – Operatív réteg:
Digitális Támogatási Projektlap (Pályázati Modul):
Támogató szervezet (pl. Nemzetgazdasági Minisztérium, MVH), pályázati azonosító (pl. GINOP-Plusz-1.2.3), szerződésszám.
Projekt elszámolható összköltsége, megítélt támogatási összeg, támogatási intenzitás százalékban (pl. 65%).
Pénzügyi mérföldkövek: kapott támogatási előleg, benyújtott kifizetési kérelmek (PEK), kiutalt támogatási összegek, önerő ráfordítások.
Kapcsolt eszközök és számlák hálója: A projektlapon közvetlenül látható az összes megvásárolt gép, beruházási számla és kivitelezői szerződés.
Kötelező fenntartási időszak monitoring: A támogatási szerződés szerinti 3 vagy 5 éves fenntartási kötelezettség figyelése (eszköz-eladási tiltás riasztásokkal).
📚 eaisyBooks – Könyvelői és könyvviteli réteg:
Támogatások Automatizált Passzív Időbeli Elhatárolása (PIE):
Fejlesztési/beruházási célra folyósított vissza nem térítendő támogatás azonnali elhatárolása a jóváíráskor:
Banki jóváírás és bevétel: T 384 → K 96.
Időbeli elhatárolás képzése: T 96 → K 483 (Támogatások passzív időbeli elhatárolása).
ÉCS-vel Arányos Automatikus Év Végi Feloldó Motor:
Amikor a támogatásból vásárolt eszközre ÉCS számolódik el (T 571 → K 1x9), a rendszer a támogatási intenzitás arányában automatikusan kiszámítja és lekönyveli az elhatárolás feloldását egyéb bevételként:
T 483 → K 964 (Költségek ellentételezésére kapott támogatások feloldása).
Négyoldalú Automatikus Rekonciliáció (Zero-Error Guard):
Folyamatos számszaki egyeztetés a 4 pillér között: $$\text{Támogatási Projektlap} \longleftrightarrow \text{Tárgyi Eszköz Analitika} \longleftrightarrow \text{Főkönyvi Számlák (161, 1x, 483, 964)} \longleftrightarrow \text{Passzív Elhatárolások Analitikája}$$
Eltérés esetén tételes figyelmeztetés (pl. feloldatlan elhatárolás, vagy ÉCS nélkül feloldott összeg).