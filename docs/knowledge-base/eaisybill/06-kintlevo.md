# 💳 Kintlévőség és Fizetési Felszólítások

> **Alkalmazás:** eaisyBill  
> **Menücsoport:** Pénzügyek  
> **Szükséges szerepkör:** Tulajdonos, Adminisztrátor, Pénzügyi vezető, Könyvelő  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:** Az eaisyBill bal oldali navigációs menüjében a **Pénzügyek** blokkban: **Kintlévőség** menüpont.
- **Ikon:** Fizetésre váró kártya / Óra ikon
- **Elérési útvonal:** Kattintson a bal oldali menüben a **Kintlévőség** menüpontra.
- **Gyorsműveletek:** Fizetési felszólítás küldése, szűrés késedelmi napok szerint, egyenlegközlő levél generálása.

---

## 2. A menü funkciója és célja

A **Kintlévőség** modul a kifizetetlen kimenő vevői számlák követésére, a késedelmes partnerek korosítás szerinti elemzésére és a hivatalos fizetési felszólítások kiküldésére szolgál.

### Fő feladatai:
- **Vevői tartozások összesítése:** Az összes nyitott vagy részben kiegyenlített vevői számla partnerenkénti és határidő szerinti csoportosítása.
- **Kintlévőség korosítás (Aging analitika):** A követelések kategorizálása a fizetési határidő lejárata óta eltelt napok alapján (nem járt le, 1–30 nap, 31–60 nap, 61–90 nap, 90+ nap).
- **Fizetési felszólítás generátor:** Hivatalos, jogilag megalapozott fizetési felszólító és egyenlegközlő levelek előállítása és e-mailes továbbítása a partnereknek.
- **Partneri adatok karbantartása:** Közvetlen e-mail cím frissítés a partnertörzsben a sikeres kézbesítéshez.

---

## 3. Részletes Funkciók és Használatuk (Hogy hívják, Mire való, Hol van, Hogyan használható)

### 3.1 Korosítási Idősáv Kártyák (Aging Szűrők)
- **Hogy hívják:** Korosítási Kártyasor (*Nem járt le*, *1–30 nap*, *31–60 nap*, *61–90 nap*, *90+ nap*)
- **Mire való:** Azonnali áttekintést ad a kintlévőségek összegéről késedelmi kategóriák szerint, és egykattintásos szűrőként funkcionál.
- **Hol található a felületen:** A képernyő felső részén elhelyezkedő 5 színes összegző kártya.
- **Hogyan használhatja a felhasználó:**
  1. Tekintse át az egyes idősávokhoz tartozó forintösszegeket és számlaszámokat.
  2. Kattintson bármelyik kártyára (pl. a pirossal jelölt **„90+ nap”** kártyára).
  3. **Eredmény:** Az alatta lévő partnerlista azonnal leszűkül, és csak azokat a partnereket mutatja, akiknek több mint 90 napja lejárt tartozásuk van.

### 3.2 Nettó / Bruttó Nézetváltó
- **Hogy hívják:** Nettó / Bruttó kapcsoló
- **Mire való:** Átkapcsolás a számviteli árbevételi kintlévőség (nettó összeg) és a ténylegesen beérkezendő banki összeg (bruttó tartozás) között.
- **Hol található a felületen:** A korosítási kártyák jobb felső szélén.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a kapcsolóra.
  2. **Eredmény:** Az összes kártya és a táblázat összegei azonnal átváltanak nettó vagy bruttó megjelenítésre.

### 3.3 Partner Kintlévőségi Táblázat (Lenyitható Partner Sávok)
- **Hogy hívják:** Vevői Tartozások Táblázata
- **Mire való:** Partnerek szerinti aggregált tartozás megtekintése, és a partnerhez tartozó nyitott számlák tételes kibontása.
- **Hol található a felületen:** A képernyő középső és alsó munkaterületén.
- **Hogyan használhatja a felhasználó:**
  1. Keresse meg a partnert a keresőmezővel vagy a listában.
  2. Olvassa le a partner összesített tartozását és kapcsolattartó e-mail címét.
  3. Kattintson a partner sorára.
  4. **Eredmény:** A sáv lenyílik, és megjelenik a partner összes kifizetetlen számlája (számlaszám, kibocsátás dátuma, esedékesség, késedelem napjainak száma, hátralék összege).

### 3.4 Fizetési Felszólítás Küldése
- **Hogy hívják:** „Felszólítás küldése” gomb és űrlap
- **Mire való:** Hivatalos fizetési felszólító levél generálása a partner felé az összes nyitott tétel részletezésével és a bankszámlaszámmal.
- **Hol található a felületen:** A partner kibontott sávjának jobb szélén, vagy a táblázat feletti műveleti sávban.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a partner sora mellett a **„Felszólítás küldése”** gombra.
  2. A felugró ablakban ellenőrizze a partner kapcsolattartójának e-mail címét.
  3. Tekintse át a levél generált szövegét (amely tételesen felsorolja a számlákat, összegeket, késedelmi napokat és a fizetési bankszámlaszámot).
  4. Szükség esetén egészítse ki a szöveget személyes megjegyzéssel.
  5. Kattintson az **„E-mail küldése”** gombra, vagy töltse le a levelet PDF formátumban.
  6. **Eredmény:** A rendszer elküldi a felszólítást, és a partner adatlapján rögzíti az utolsó felszólítás dátumát.

### 3.5 Egyenlegközlő Levél Generálása
- **Hogy hívják:** „Egyenlegközlő készítése” gomb
- **Mire való:** Hivatalos könyvelési egyeztető levél készítése az év végi vagy időszaki vevő-szállító egyeztetéshez.
- **Hol található a felületen:** A partner részletező adatlapján a dokumentum-műveletek között.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson az „Egyenlegközlő készítése” gombra.
  2. Válassza ki a fordulónapot (pl. december 31.).
  3. Töltse le a hivatalos, aláírásra alkalmas PDF dokumentumot.
