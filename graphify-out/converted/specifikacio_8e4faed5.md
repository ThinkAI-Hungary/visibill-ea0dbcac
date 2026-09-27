<!-- converted from specifikacio.docx -->

Specifikáció: Visibill Könyvelőirodai Menedzsment és Ügyfélkommunikációs Modul
1. Ügyfélportfólió átlátható kezelése (Irodai Központi Irányítópult)
Ez a modul a könyvelőiroda "irányítótornya", amely a menedzsment és a munkatársak napi munkaszervezését támogatja.
1.1. Jogosultsági Szintek és Láthatóság
Szenior Könyvelő / Irodavezető: Teljes rálátás az iroda összes ügyfelére, minden cég státuszára, hiányosságára és a kollégák teljesítményére.
Junior / Beosztott Könyvelő: Csak a hozzá dedikáltan (manuálisan vagy automatikusan) "kiszignált" cégeket látja az irányítópultján. Számára a felület egy fókuszált to-do listaként működik.
1.2. Határidő-figyelő és Automatikus Szinkronizáció
Dinamikus NAV Integráció: A rendszer a NAV adatbázisából (az adószám alapján) lekérdezi a cég adózási profilját, és ez alapján automatikusan beállítja a kötelező bevallási ritmusokat (pl. havi, negyedéves vagy éves ÁFA, járulékbevallások).
Manuális felülbírálat: A könyvelő a felületen egyedi határidőket is felvihet, vagy felülírhatja a NAV-ból húzott logikát (pl. belső irodai határidő beállítása a 20-ai ÁFA előtt 15-re).
Vizuális státuszok: A cégek a határidő közeledtével színkódolva (zöld, sárga, piros) jelennek meg a feldolgozottsági szint és a nyitott hiányosságok arányában.
1.3. Könyvelői Teljesítmény Riport (KPI Dashboard)
Egy dedikált nézet az irodavezető számára, amely automatikusan méri a munkatársak hatékonyságát.
Mért metrikák: Lezárt cégek száma/hónap, feldolgozott és párosított számlák darabszáma, ügyfélkommunikációra fordított idő (automatizmusok által megspórolt órák).

2. Automatikus hiányazonosítás (Az "Okos Detektív")
A modul, amely folyamatosan figyeli a Visibillbe érkező adatokat, összeveti a külső forrásokkal, és összeállítja az elvégzendő feladatokat.
2.1. Cégspecifikus Hiány-Dashboard
Minden cég saját adatlapján helyet kap egy priorizált, rangsorolt lista az azonosított hiányosságokról.
Csoportosított nézet: A hiányok logikusan tagolva jelennek meg (pl. "Hiányzó kimenő számlaképek: 14 db", "Hiányzó költségszámlák banki utalás alapján: 5 db", "Nem párosított tranzakciók: 3 db").
Interaktív Drill-down (Mögé fúrás): A kategóriákra kattintva a könyvelő pontosan látja a tételeket (pl. a NAV Online Számlából behúzott, de PDF formátumban fel nem töltött számlák pontos adatai).
2.2. A Hiányok Kezelése (Akciók)
A könyvelő kétféleképpen reagálhat egy detektált hiányra az irányítópultról:
Ignorálás ("Fals pozitív" kezelése): Egy gombnyomással törölheti a listáról a tételt (pl. ha a bankkivonaton egy havi számlavezetési díj szerepel, amihez sosem lesz számla). A rendszer a jövőbeni predikciókhoz elraktározza ezt az információt.
Feloldás (Átirányítás): A "Megoldom" gombra kattintva a rendszer átirányítja a könyvelőt a Visibill releváns, már meglévő felületére (pl. a tranzakció-párosító nézetbe), hogy manuálisan összehúzza a számlát a bankkal.
2.3. Dinamikus Időbeli Mélység (Visszatekintés)
A hiánykereső motor nem a végtelenbe tekint vissza, hanem az aktuális határidő típusához igazodik:
Havi ÁFA esetén: Csak az előző (még le nem zárt) hónapot figyeli.
Negyedéves ÁFA esetén: Az előző 3 hónapot aggregálja.
Éves beszámoló: A teljes előző évet szkenneli.
2.4. Bérszámfejtési Protokoll (Javasolt Működés)
Mivel a bérügyi adatok (jelenléti ív, táppénz) nem húzhatók le a bankból, a rendszer egy "Kötelező havi nyilatkoztatási" protokollt alkalmaz.
Generált "Szellemkövetelések": A rendszer minden hónap 1-jén automatikusan létrehoz egy hiánytételt a cég Dashboardján (pl. "Tárgyhavi bérszámfejtési anyagok").
Ügyfél interakció: Az ügyfélnek a portálon (vagy üzenetben) kötelezően reagálnia kell: fel kell töltenie az anyagokat, VAGY meg kell nyomnia egy "Nincs változás / Nem volt táppénz" gombot. A hiány csak ezután tűnik el a Dashboardról.

3. Többcsatornás automatikus ügyfélértesítés
Az azonosított hiányok automatizált, emberi beavatkozást nem igénylő bekérése az ügyfelektől.
3.1. Opt-in és Csatornakezelés (GDPR Megfelelés)
Automatikus Üdvözlő Üzenet: Amikor egy céget (és annak kapcsolattartóját) rögzítenek a rendszerben, a Visibill egy hivatalos üdvözlő SMS-t/Viber üzenetet küld: "Üdvözlöm! A [Könyvelőiroda] automatikus asszisztense vagyok. Kérem, válaszoljon egy IGEN-nel, ha a jövőben ezen a csatornán is küldhetek értesítéseket a hiányzó anyagokról."
Az ügyfél beleegyezése után a csatorna aktívvá válik a kommunikációs mátrixban.
3.2. Értesítési Lánc és Tartalom
Személyre szabott listák: A rendszer nem "vaktában" kér be dokumentumokat. A generált e-mail vagy chat üzenet pontosan felsorolja, mi hiányzik (pl. "Tisztelt Ügyfelünk! Az előző havi záráshoz még hiányzik a május 10-i, 25.000 Ft-os Vodafone számla másolata, valamint a jelenléti ív.").
3.3. Interaktív AI Telefonhívás
Ha az üzenetekre nincs válasz, a rendszer telefonál (a könyvelő klónozott hangján).
Párbeszéd-képesség: Az AI élő kapcsolatban van a cég hiánylistájával. Ha az ügyfél visszakérdez: "Melyik Vodafone számláról van szó?", az AI képes a listából kiolvasni és válaszolni: "A május 10-i, 25.000 forintos utaláshoz tartozó számláról."
3.4. Az Adatok Beküldése (Ügyfélélmény)
Az ügyfél két egyenrangú módon tehet eleget a hiánypótlásnak:
Közvetlen válasz: Egyszerűen csatolja a számlaképeket válasz e-mailben, vagy lefotózza és elküldi Viberen/WhatsAppon. A Visibill NLP motorja ezt felismeri, beszippantja, és automatikusan leveszi a tételt a hiánylistáról.
Dedikált Ügyfélportál (Magic Link): Az értesítésben szerepel egy egyedi, bejelentkezést nem igénylő link. Erre kattintva a telefonon vagy gépen megnyílik a Visibill Ügyfélportál letisztult felülete, ahol egy "Drag & Drop" módszerrel feltöltheti a hiányzó fájlokat. Bérszámfejtés esetén itt tudja bepipálni a "Nincs változás" gombot is.
