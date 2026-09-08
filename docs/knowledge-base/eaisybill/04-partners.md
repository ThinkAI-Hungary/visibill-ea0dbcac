# 👥 Partnertörzs és Partner Analitika

> **Alkalmazás:** eaisyBill  
> **Menücsoport:** Törzsadatok  
> **Szükséges szerepkör:** Tulajdonos, Adminisztrátor, Könyvelő, Pénzügyi munkatárs  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:** Az eaisyBill bal oldali navigációs menüjében a **Törzsadatok** blokkban: **Partnerek** menüpont.
- **Ikon:** Felhasználók / Partnerek ikon
- **Elérési útvonal:** Kattintson a bal oldali menüben a **Partnerek** elemre.
- **Gyorsműveletek:** Új partner hozzáadása a fejléc gombjával, adószám egykattintásos másolása a listából.

---

## 2. A menü funkciója és célja

A **Partnertörzs** modul a vállalkozás üzleti kapcsolatainak (vevők, beszállítók, alvállalkozók, hatóságok) központi adatbázisa és forgalmi analitikai felülete.

### Fő feladatai:
- **Partnerek nyilvántartása:** Vevők és szállítók adatlapja, adószámok, székhelyek, bankszámlaszámok és kapcsolattartási adatok tárolása.
- **Magyar adószám ellenőrzés:** 8-1-2 formátumú hivatalos adószámok strukturális és ellenőrzőösszeg-vizsgálata a NAV szabályai szerint, valamint nemzetközi partnerek kezelése.
- **TOP Partner forgalmi rangsor:** Automatikus forgalmi összesítés a legnagyobb forgalmat generáló vevők és beszállítók azonosítására a kiválasztott időszakban.
- **Kapcsolt vállalkozási státusz:** Kapcsolt felek megjelölése a Társasági adó (TAO) transzferár-nyilvántartási és adóalap-korrekciós kötelezettségek teljesítéséhez.
- **Könyvelésből kizárás:** Magánjellegű vagy reprezentációs partnerek opcionális kizárása az automatikus könyvelésből.
- **Konszolidált számlatörténet:** Bármely partner kiválasztásakor azonnal látható a partner összes korábbi számlája a NAV szinkronból és a feltöltésekből egyaránt.

---

## 3. Részletes Funkciók és Használatuk (Hogy hívják, Mire való, Hol van, Hogyan használható)

### 3.1 Új Partner Rögzítése
- **Hogy hívják:** „Új partner” gomb és űrlap
- **Mire való:** Új vevő vagy beszállító manuális felvétele a rendszerbe a számlázáshoz és könyveléshez.
- **Hol található a felületen:** A képernyő jobb felső sarkában lévő kék akciógomb.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson az **„Új partner”** gombra a jobb felső sarokban.
  2. Írja be a partner adószámát (a rendszer azonnal ellenőrzi az ellenőrző összeget).
  3. Adja meg a partner hivatalos cégnevét, székhelyét és kapcsolattartási adatait (e-mail cím, telefonszám).
  4. Válassza ki a partner típusát (*Vevő*, *Szállító* vagy *Mindkettő*).
  5. Szükség esetén jelölje be a *„Kapcsolt vállalkozás”* opciót.
  6. Kattintson a „Mentés” gombra.
  7. **Eredmény:** A partner azonnal bekerül a partnertörzsbe, és a számláknál automatikusan felajánlásra kerül.

### 3.2 Kétpaneles Partner Kereső és Lista
- **Hogy hívják:** Partnerlista Táblázat és Szűrősáv
- **Mire való:** A partnerek közötti gyors keresés, szűrés típus szerint (vevő/szállító) és a partnerek áttekintése.
- **Hol található a felületen:** A képernyő bal oldali széles panelén.
- **Hogyan használhatja a felhasználó:**
  1. A lista tetején lévő keresőmezőbe gépelje be a cég nevét vagy adószámának bármely részletét.
  2. A fenti szűrőgombokkal szűkítse a kört: *Összes*, *Csak Vevők*, *Csak Szállítók*.
  3. Az adószám melletti másolás ikonra kattintva az adószám egy kattintással a vágólapra kerül.
  4. Kattintson egy partner sorára a részletező adatlap megnyitásához a jobb oldali panelen.

### 3.3 Partner Részletező Adatlap és Kapcsolt Vállalkozás Jelölő
- **Hogy hívják:** Partner Adatlap Panel
- **Mire való:** A kiválasztott partner összes törzsadatának, adózási beállításainak és könyvelési státuszának kezelése.
- **Hol található a felületen:** A képernyő jobb oldali panelén, miután kiválasztottunk egy partnert a bal oldali listából.
- **Hogyan használhatja a felhasználó:**
  1. Tekintse át a partner székhelyét, adószámát és e-mail címét.
  2. A **„Bekerüljön a könyvelésbe?”** kapcsolóval beállíthatja, hogy a partnerhez tartozó számlák automatikusan könyvelődjenek-e, vagy ki legyenek zárva.
  3. A **„Kapcsolt vállalkozás”** jelölőnégyzettel rögzítheti a tulajdonosi összefonódást a TAO bevalláshoz.
  4. A ceruza ikonra kattintva módosíthatja az adatokat.

### 3.4 Partner Számlatörténet és Számlarészletező
- **Hogy hívják:** Partner Számlák Panel
- **Mire való:** A kiválasztott partnerhez tartozó összes múltbeli és aktuális számla tételes vizsgálata.
- **Hol található a felületen:** A jobb oldali részletező panel alsó szekciójában.
- **Hogyan használhatja a felhasználó:**
  1. Váltson a lapfülek között (*Összes számla*, *NAV szinkron*, *Feltöltött számlák*).
  2. A keresőmezővel keressen konkrét számlaszámra.
  3. Kattintson bármelyik számlára a listában.
  4. **Eredmény:** Megnyílik a számla részletező adatlapja a kibocsátás, teljesítés, fizetési határidő, ÁFA kulcsok és a csatolt számlakép közvetlen elérésével.

### 3.5 TOP Partner Forgalmi Rangsor
- **Hogy hívják:** Forgalmi Rangsor Kártya
- **Mire való:** Kimutatja, hogy a kijelölt időszakban mely vevők generálták a legnagyobb árbevételt, és mely beszállítók jelentették a legnagyobb költségtételt.
- **Hol található a felületen:** A képernyő fejlécének felső sávjában lenyitható modulként.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a fejlécben a „Forgalmi rangsor” gombra.
  2. Válasszon a *Vevői forgalom* és *Beszállítói költségek* nézet között.
  3. Olvassa le a partnerek sorrendjét és százalékos részarányát a teljes céges forgalomból.
