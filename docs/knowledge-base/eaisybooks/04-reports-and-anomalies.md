# 📊 Riportok és AI Anomáliák (Reports & AI Anomalies)

> **Alkalmazás:** eaisyBooks  
> **Menücsoport:** Portfólió  
> **Szükséges szerepkör:** Irodavezető adminisztrátor, Szenior könyvelő  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:** Az eaisyBooks felület bal oldali menüjében a **Portfólió** csoport menüpontja.
- **Ikon:** Oszlopdiagram ikon
- **Elérési útvonal:** Riportok menüpont a navigációs sávban
- **Gyorsműveletek:** AI anomália vizsgálat, hiányzó számlák vezetői kimutatása, portfólió export

---

## 2. A menü funkciója és célja

A **Riportok és AI Anomáliák** modul a könyvelőiroda vezetői minőségellenőrző és döntéstámogató központja. Célja, hogy mesterséges intelligencia és statisztikai audit algoritmusok segítségével feltárja a hibákat, a gyanús tranzakciókat és a könyvelési következetlenségeket a teljes cégportfólióban, még a hatósági ellenőrzések előtt.

### Fő feladatai és szakmai jelentősége:
1. **AI Anomália Detektálás:** Automatizált mélyelemzés szokatlan tételekre:
   - Duplikált számlák (azonos összeg, partner és teljesítési dátum, de eltérő bizonylatszám).
   - Szokatlanul kiugró összegek a partner korábbi átlagos forgalmához képest.
   - Hétvégi vagy szokatlan időpontú készpénzes tranzakciók a házipénztárban.
   - Érvénytelen vagy felfüggesztett adószámú partnerrel történt ügylet.
   - Nem megszokott ÁFA kulcs alkalmazása adott tevékenységnél vagy termékkörnél.
2. **Irodai összesített kimutatások:** Konszolidált forgalmi, adózási és bérköltség statisztikák a könyvelőiroda teljes ügyfélköréről.
3. **Hiányzó bizonylatok vezetői jelentése:** Átfogó kimutatás arról, hogy mely ügyfeleknél a legmagasabb a rendezetlen banki tételek aránya.
4. **Adókockázati rangsor:** Minden cég kockázati értékelést kap a NAV ellenőrzési szempontjai alapján (pl. magas készpénzhasználat, negatív saját tőke, tartós veszteség).

---

## 3. Részletes Funkciók és Használatuk (Hogy hívják, Mire való, Hol van, Hogyan használható)

### 3.1 Konszolidált Portfólió Műszerfal és Kockázati Mátrix
- **Hogy hívják:** Irodai forgalmi diagram és Cégkockázati mátrix
- **Mire való:** A könyvelőiroda által kezelt teljes cégállomány konszolidált forgalmának és a NAV ellenőrzési kockázati besorolásának (Alacsony, Közepes, Magas) vizuális áttekintése.
- **Hol található a felületen:** A képernyő felső harmadában elhelyezkedő grafikonos blokk.
- **Hogyan használhatja a felhasználó:**
  1. Tekintse át a havi konszolidált árbevételt és ÁFA volument.
  2. Kattintson a pirossal kiemelt **„Magas kockázatú cégek”** kártyára (pl. tartós veszteség, tőkehiány vagy magas készpénzforgalom miatt).
  - **Eredmény:** A képernyő alsó szekciója leszűkül azokra a cégekre, amelyek kiemelt figyelmet és vezetői ellenőrzést igényelnek.

### 3.2 AI Anomália Detektáló Lista és Szakmai Bizonyítékok
- **Hogy hívják:** „AI Anomáliák és Kockázatok” táblázat
- **Mire való:** Mesterséges intelligencia által azonosított gyanús tételek (duplikált számlák, kiugró összegek, szokatlan ÁFA kulcsok, törölt vagy érvénytelen adószámú partnerek) listázása konkrét szöveges indoklással.
- **Hol található a felületen:** A képernyő középső részén lévő részletes elemző tábla.
- **Hogyan használhatja a felhasználó:**
  1. Keresse meg a sárga vagy piros jelvényes anomáliát (pl. *„Duplikáció gyanú”* vagy *„Kirívó összeg”*).
  2. Olvassa el az AI magyarázatát: pl. *„A partner átlagos számlája 45 000 Ft volt, a jelenlegi tétel 1 850 000 Ft azonos teljesítési nappal egy másik számlával.”*
  3. Kattintson a bizonylatszámra a kapcsolódó számla eredeti képének megnyitásához.
  - **Eredmény:** Azonnal látható a könyvelési vagy számlázási hiba forrása.

### 3.3 Téves Riasztás Elfogadása és AI Tanítás
- **Hogy hívják:** „Téves riasztás (Jóváhagyás)” gomb (pipa ikon)
- **Mire való:** Ha a tétel bár kirívó, de jogszerű (pl. év végi egyszeri nagy beruházás vagy egyedi gépvásárlás), a könyvelő megerősítheti a tétel érvényességét, betanítva a modellt a jövőbeli riasztások megelőzésére.
- **Hol található a felületen:** Az anomália sorának jobb szélén található zöld pipa gomb.
- **Hogyan használhatja a felhasználó:**
  1. Miután megvizsgálta a bizonylatot és igazoltnak találta, kattintson a zöld pipára.
  2. A felugró ablakban válassza a *„Jogszerű egyedi tétel”* opciót.
  3. Kattintson a **„Megerősítés”** gombra.
  - **Eredmény:** Az anomália kikerül a hibalistából, és a rendszer nem fog újra riasztani hasonló paramétereknél.

### 3.4 Javítás Kezdeményezése és Feladatküldés
- **Hogy hívják:** „Javítás kérése” gomb (felkiáltójel ikon)
- **Mire való:** Valós hiba vagy könyvelési anomália esetén közvetlen belső feladat és értesítés létrehozása a cégért felelős könyvelő vagy az ügyfél felé.
- **Hol található a felületen:** Az anomália sora végén lévő narancssárga feladat gomb.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a **„Javítás kérése”** gombra.
  2. Írja be az utasítást (pl. *„Kérlek ellenőrizd az 5-ös számlaosztályba sorolást, mert az ÁFA kulcs tévesnek tűnik!”*).
  3. Kattintson a **„Feladat kiosztása”** gombra.
  - **Eredmény:** A felelős könyvelő figyelmeztetést kap, a tétel pedig bekerül a jóváhagyási és javítási sorába.

### 3.5 Hiányzó Bizonylatok Vezetői Rangsor Táblázata
- **Hogy hívják:** „Ügyféli Bizonylatfegyelem Rangsor”
- **Mire való:** Cégek sorba rendezése a hiányzó bizonylatok összege és az átlagos bizonylatpótlási idő szerint, azonosítva a leglassabban reagáló ügyfeleket.
- **Hol található a felületen:** A felület alsó harmadában elhelyezkedő rangsor táblázat.
- **Hogyan használhatja a felhasználó:**
  1. Rendezze a táblázatot a hiányzó összeg vagy a késedelmi napok száma szerint.
  2. Tekintse meg, hogy mely cégeknél áll fenn kockázat az ÁFA zárás csúszására.
  - **Eredmény:** Tárgyalási alap az ügyféllel a bizonylatfegyelem javítására vagy pótdíj felszámítására.

### 3.6 Vezetői Riport Exportálása (Excel / PDF)
- **Hogy hívják:** „Riport exportálása” gomb
- **Mire való:** Az irodai KPI-k, anomáliák és bizonylathiányok kimentése hivatalos audit táblázatba vagy ügyfél-prezentációra alkalmas PDF dokumentumba.
- **Hol található a felületen:** A fejléc jobb felső sarkában elhelyezkedő export gombok.
- **Hogyan használhatja a felhasználó:**
  1. Állítsa be a kívánt időszakot és a kockázati szűrőket.
  2. Kattintson az **„Excel export”** vagy **„PDF jelentés”** gombra.
  - **Eredmény:** Letöltődik a komplett irodavezetői minőségbiztosítási riport.
