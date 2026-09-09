# ⚙️ Ügyfél Egyedi Beállítások (Client Specific Settings & Payroll Configuration)

> **Alkalmazás:** eaisyBooks  
> **Menücsoport:** Ügyfél Kontextus / Beállítások  
> **Szükséges szerepkör:** Irodavezető adminisztrátor, Szenior könyvelő, Könyvelő (adott céghez rendelt jogosultsággal)  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:** Az eaisyBooks felületen a bal oldali navigációs menüben az aktív ügyfél-munkamenet alsó részén: **Beállítások** menüpont (vagy az Ügyfél Adatlap **Beállítások** füle).
- **Ikon:** Fogaskerék / Rendszerkonfigurációs ikon (`Settings`)
- **Elérési útvonal:** eaisyBooks munkamenet -> Ügyfelek -> [Ügyfél kiválasztása] -> Beállítások fül
- **Gyorsműveletek:** Kapcsolattartói csatornák és emlékeztető-gyakoriság beállítása, adózási profil és ÁFA bevallási gyakoriság rögzítése, bérszámfejtési kerekítési és pótlékszabályok konfigurálása, távmunka költségtérítés és bérkifizetési nap beállítása

---

## 2. A menü funkciója és célja

Az **Ügyfél Egyedi Beállítások** modul a kiválasztott vállalkozásra vonatkozó speciális számviteli, adózási, bérszámfejtési és automatikus értesítési paraméterek személyre szabott finomhangoló központja.

### Fő feladatai és jogi-számviteli relevanciája:
1. **Adózási profil és bevallási gyakoriságok (Art.):** Rögzíti az ügyfél ÁFA bevallási gyakoriságát (havi, negyedéves, éves), a havi járulékbevallási rendet (08-as bevallás), valamint a választott adónemeket (KATA, KIVA, TAO).
2. **Bérszámfejtési és Munka Törvénykönyve (Mt.) szabályrendszer:**
   - Kerekítési szabályok meghatározása (forint fillérmentesítése, 1 Ft-ra, 10 Ft-ra vagy 100 Ft-ra történő kerekítés).
   - Munkanapok forrása (hivatalos állami munkarend vagy egyedi munkaidőkeret).
   - Törvényi műszak- és túlórapótlékok (Mt. szerinti szabályok, kollektív szerződés / KSZ, vagy egyedi munkaszerződéses feltételek).
   - Távmunka és home office adómentes költségtérítésének havi keretösszege (Szja tv. szerinti maximált összeg).
3. **Kommunikációs és automatikus emlékeztető motor:** Beállítja, hogy a havi zárási adatszolgáltatásokról, hiányzó számlákról és fizetési kötelezettségekről az ügyfél mely csatornákon (Email, Viber, SMS, Telefon) és milyen gyakorisággal kapjon automatikus jelzést.
4. **Digitális bérjegyzék-kézbesítés és bérkifizetés:** Beállítja a havi rendszeres bérfizetés napját (pl. minden hónap 10-e), valamint az elektronikus, jelszóval védett bérjegyzékek munkavállalóknak történő automatikus email-kiküldését.

---

## 3. Mit lehet benne a felhasználónak csinálni? (Funkciók részletes leírása)

### 3.1 Almenü / Sub-tab választó sáv
- **Hogy hívják:** Beállítási kategóriák választója (Kapcsolat & Értesítések / Adózási Profil / Cégkapu \/ KÜNY / Bérszámfejtés & NAV)
- **Mire való:** Rendszerezi az ügyfélszintű paramétereket négy jól elkülönülő szakmai területre, megkönnyítve a gyors áttekintést és szerkesztést.
- **Hol található a felületen:** A beállítási képernyő bal oldalán elhelyezkedő vertikális gombsor.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a szerkeszteni kívánt kategóriára:
     - **Kapcsolat & Értesítések (`Bell` ikon):** Értesítési csatornák, nyelvi beállítás és kapcsolattartó adatai.
     - **Adózási Profil (`Settings` ikon):** ÁFA, KIVA, KATA és NAV adózási gyakoriságok.
     - **Cégkapu / KÜNY (`Shield` ikon):** Hivatalos tárhely és KAÜ aláíró beállítások.
     - **Bérszámfejtés & NAV (`Calculator` ikon):** Munkaügyi paraméterek, pótlékszabályok, telephelyek és bérkifizetési nap.
  - **Eredmény:** A jobb oldali főpanel azonnal betölti a kiválasztott konfigurációs űrlapot.

---

### 3.2 „Kapcsolat & Értesítések” — Kapcsolattartó és csatornák beállítása
- **Hogy hívják:** Elsődleges kapcsolattartó adatai és Értesítési csatornák választó
- **Mire való:** Meghatározza az ügyfél felőli hivatalos kontakt személyt, valamint engedélyezi/letiltja az egyes kommunikációs csatornákat (Email, Viber, SMS, Telefon).
- **Hol található a felületen:** A **Kapcsolat & Értesítések** almenü felső és középső blokkja.
- **Hogyan használhatja a felhasználó:**
  1. Töltse ki a kapcsolattartó nevét, hivatalos email címét és telefonszámát.
  2. A csatorna-kapcsolók segítségével jelölje be a kívánt értesítési módokat (zöldre váltva a releváns csatornákat).
  3. A **Nyelv** legördülő listában válassza ki a kommunikáció nyelvét (Magyar, Angol, Német).
  4. Az **Emlékeztetők gyakorisága** választóban határozza meg a sürgősségi szintet (Alacsony, Normál, Magas).
  5. Pipálja be az **Automatikus emlékeztetők** kapcsolót az ütemezett értesítésekhez.
  6. Kattintson az alsó **„Mentés”** gombra (`Save` ikon).
  - **Eredmény:** Az automatikus rendszerüzenetek és havi felszólítások ezen csatornákon keresztül jutnak el az ügyfélhez.

---

### 3.3 „Adózási Profil” — Bevallási gyakoriságok és adózási formák
- **Hogy hívják:** Adózási profil és gyakorisági mátrix
- **Mire való:** Rögzíti a Nemzeti Adó- és Vámhivatal felé érvényes bevallási időszakokat és adózási státuszokat, amelyek alapján a rendszer automatikusan felépíti az ügyfél adónaptárát és határidős riasztásait.
- **Hol található a felületen:** Az **Adózási Profil** almenü kártyája.
- **Beállítható paraméterek:**
  - **ÁFA bevallási gyakoriság:** Havi (20-i határidő), Negyedéves (negyedévet követő hónap 20.), Éves (követő év február 25. / május 31.).
  - **Járulékbevallási gyakoriság:** Havi (társas vállalkozások esetén a 08-as bevallás havonta kötelező) vagy Negyedéves.
  - **Választott adónemek jelölői:** KIVA (Kisvállalati adó), KATA (Kisadózó vállalkozások tételes adója), TAO (Társasági adó).
- **Hogyan használhatja a felhasználó:**
  1. Válassza ki az ügyfél NAV nyilvántartása szerinti pontos ÁFA és járulék gyakoriságot.
  2. Jelölje be az alkalmazott adózási formát.
  3. Kattintson a mentés gombra.
  - **Eredmény:** Az adónaptár modul és a hiányzó bizonylatok figyelője automatikusan az itt megadott ciklusokhoz igazítja a határidőket.

---

### 3.4 „Bérszámfejtés & NAV” — Kerekítési és munkanap szabályok
- **Hogy hívják:** Bérszámfejtési kerekítés és munkanap-számítási forrás választó
- **Mire való:** Beállítja a nettó bérkifizetések kerekítési pontosságát és a havi munkaidőkeret elszámolásának alapját.
- **Hol található a felületen:** A **Bérszámfejtés & NAV** almenü felső konfigurációs blokkja.
- **Választható beállítások:**
  - **Kerekítés:** *Nincs kerekítés* (fillérmentes forintösszeg), *1 Ft-ra kerekítés* (hivatalos MNB készpénzkerekítés), *10 Ft-ra* vagy *100 Ft-ra* kerekítés.
  - **Munkanapok forrása:** *Hivatalos naptár* (az éves állami munkarend, áthelyezett munkanapok és ünnepnapok automatikus figyelembevétele) vagy *Egyedi* (kézzel megadott munkanap-szám).
- **Hogyan használhatja a felhasználó:**
  1. Válassza ki a cég belső bérszámfejtési szabályzatának megfelelő kerekítési módot.
  2. Válassza ki a hivatalos vagy egyedi munkanap-forrást.
  - **Eredmény:** A havi bérszámfejtési algoritmus ezen szabályok szerint számolja a napi bért és a kifizetendő végösszeget.

---

### 3.5 „Bérszámfejtés & NAV” — Pótlékszabályok és munkaidő-beállítások
- **Hogy hívják:** Műszakpótlék szabályok és Heti munkaidő konfiguráció
- **Mire való:** Szabályozza az éjszakai, műszak- és túlórapótlékok elszámolási rendjét, valamint a teljes munkaidős foglalkoztatás heti alapóraszámát.
- **Hol található a felületen:** A **Bérszámfejtés & NAV** almenü középső blokkja.
- **Választható pótlék-szabályok:**
  - **Mt. szerinti szabályok:** A Munka Törvénykönyve szerinti kötelező pótlékmértékek (15% éjszakai pótlék, 30% műszakpótlék, 50% vagy 100% túlórapótlék).
  - **Kollektív szerződés (KSZ):** Cégspecifikus, magasabb mértékű szerződéses pótlékok.
  - **Egyedi szabályok:** Speciális munkarend szerinti megállapodások.
- **Hogyan használhatja a felhasználó:**
  1. Állítsa be az alkalmazandó pótlékrendszert.
  2. Az **Alapértelmezett heti munkaidő** mezőbe írja be az alapértéket (alapesetben 40 óra).
  - **Eredmény:** A jelenléti ívek és túlórák importálásakor a rendszer automatikusan a kiválasztott kulcsokkal szorozza fel a pótlékalapokat.

---

### 3.6 „Bérszámfejtés & NAV” — Kifizetési nap, Cafeteria és Távmunka keret
- **Hogy hívják:** Bérfizetési nap, SZÉP Kártya kibocsátó és Távmunka költségtérítés mezők
- **Mire való:** Rögzíti a havi bérutalás határidejét (Mt. szerint legkésőbb a tárgyhónapot követő 10. nap), a munkavállalói SZÉP Kártya partnerintézményét és az igazolás nélkül elszámolható havi home office költségtérítést.
- **Hol található a felületen:** A **Bérszámfejtés & NAV** almenü alsó adatbeviteli doboza.
- **Hogyan használhatja a felhasználó:**
  1. A **Havi bérkifizetés napja** mezőben adja meg a napot (pl. *10*).
  2. A **SZÉP Kártya szolgáltató** mezőben válassza ki a kibocsátót (pl. *OTP*, *K&H*, *MBH*).
  3. A **Távmunka költségtérítés alapértelmezése** mezőben ellenőrizze az összeget (a minimálbér 10%-áig adómentesen adható összeg, pl. *32 280 Ft*).
  4. Kapcsolja be az **Email bérjegyzékek** kapcsolót, ha a dolgozók automatikusan elektronikus úton kapják meg a havi bérlapot.
  - **Eredmény:** A havi bérszámfejtés lezárásakor az utalási csomag automatikusan a megadott napra készül el, és a távmunka pótlékok beépülnek a bérbe.

---

### 3.7 „Bérszámfejtés & NAV” — Telephelyek és Székhelyek gyorskezelése
- **Hogy hívják:** Céges telephelyek gyorsrögzítője és listája
- **Mire való:** Gyors hozzáférést biztosít a cég székhelyének és fióktelepeinek rögzítéséhez és törléséhez közvetlenül a bérügyi beállításokból.
- **Hol található a felületen:** A **Bérszámfejtés & NAV** lap alján elhelyezkedő lokációs kártya.
- **Hogyan használhatja a felhasználó:**
  1. Új helyszín hozzáadásához írja be a **Helyszín nevét** (pl. *Központi Iroda*, *Raktár*).
  2. Adja meg a pontos **Címet** (irányítószám, város, utca, házszám).
  3. Válassza ki a típust: *Székhely* vagy *Telephely / Fióktelep*.
  4. Kattintson a **„Telephely hozzáadása”** gombra.
  5. Telephely törléséhez kattintson a meglévő helyszínek melletti **Kuka** ikonra.
  - **Eredmény:** A telephely mentésre kerül, és azonnal megjelenik a bérszámfejtési helyszínek között.

---

### 3.8 „Bérszámfejtés & NAV mentése” műveleti gomb
- **Hogy hívják:** Bérszámfejtési és NAV beállítások mentése gomb
- **Mire való:** Az összes módosított bérügyi, munkaidő- és adózási paraméter véglegesítése és mentése az adatbázisba.
- **Hol található a felületen:** A **Bérszámfejtés & NAV** almenü jobb alsó sarkában elhelyezkedő kék gomb lemez ikonnal (`Save`).
- **Hogyan használhatja a felhasználó:**
  1. A beállítások módosítása után kattintson a **„Mentés”** gombra.
  2. A gomb töltési állapotot jelez (*„Mentés...”*).
  - **Eredmény:** A rendszer elmenti az új paramétereket az ügyfél adózási és bérügyi profiljába, és zöld felugró értesítés jelenik meg: *„Mentve! — Bérszámfejtési és NAV integrációs beállítások sikeresen mentve.”*

---

## 4. Jogosultságok és Szerepkörök

| Szerepkör | Megtekintés | Értesítések módosítása | Adózási profil állítása | Bérügyi szabályok mentése |
| :--- | :---: | :---: | :---: | :---: |
| **Irodavezető adminisztrátor** |  Teljes |  Engedélyezett |  Engedélyezett |  Engedélyezett |
| **Szenior könyvelő** |  Teljes |  Engedélyezett |  Engedélyezett |  Engedélyezett |
| **Könyvelő** |  Teljes |  Engedélyezett |  Engedélyezett |  Engedélyezett |
| **Könyvelő asszisztens** |  Teljes |  Engedélyezett | ❌ Nincs | ❌ Nincs |
| **Ügyfél (Cégvezető)** |  Megtekintés | ❌ Nincs | ❌ Nincs | ❌ Nincs |

---

## 5. Kapcsolódó jogszabályi és szakmai hivatkozások

- **2012. évi I. törvény a munka törvénykönyvéről (Mt.):**
  - **140–143. §:** A bérpótlékok (éjszakai pótlék, műszakpótlék, rendkívüli munkaidő / túlóra pótlékai) számítási szabályai.
  - **157. § (1):** A munkabér kifizetésének határideje: a tárgyhónapot követő hónap 10. napja.
- **1995. évi CXVII. törvény a személyi jövedelemadóról (Szja tv.):**
  - **3. számú melléklet I. 24. pont:** Távmunkavégzés keretében igazolás nélkül elszámolható költségtérítés szabályai (a mindenkori havi minimálbér legfeljebb 10%-ának megfelelő összeg).
- **2017. évi CL. törvény az adózás rendjéről (Art.):**
  - **2. melléklet:** Az általános forgalmi adó és a havi adó- és járulékbevallások (08-as bevallás) benyújtási határidői és gyakorisági szabályai.
