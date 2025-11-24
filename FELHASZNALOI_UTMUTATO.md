# VisiBill - Felhasználói Útmutató

## Tartalomjegyzék

1. [Bevezetés](#bevezetés)
2. [Regisztráció és bejelentkezés](#regisztráció-és-bejelentkezés)
3. [Kezdőlépések](#kezdőlépések)
4. [NAV integráció beállítása](#nav-integráció-beállítása)
5. [Számlák kezelése](#számlák-kezelése)
6. [Projektek kezelése](#projektek-kezelése)
7. [Fizetések és számlák](#fizetések-és-számlák)
8. [Email integráció](#email-integráció)
9. [Árfolyamok](#árfolyamok)
10. [Előfizetések](#előfizetések)
11. [Beállítások](#beállítások)
12. [Gyakori kérdések](#gyakori-kérdések)

---

## Bevezetés

### Mi a VisiBill?

A VisiBill egy komplex számlakezelő rendszer magyar vállalkozások számára, amely lehetővé teszi:
- A NAV rendszeréből történő számla szinkronizálást
- Manuális számla feltöltést és kezelést
- Email-es számla fogadást
- Projekt alapú költségkövetést
- Fizetési és bérszámfejtési nyilvántartást
- Deviza árfolyam követést

### Kinek készült?

- Kisvállalkozások és egyéni vállalkozók számára
- Könyvelők és pénzügyi asszisztensek számára
- Bárki, aki strukturált számlakezelést szeretne

---

## Regisztráció és bejelentkezés

### Új fiók létrehozása

1. Nyissa meg a VisiBill alkalmazást
2. A bejelentkezési oldalon kattintson a **"Regisztráció"** vagy **"Új fiók"** gombra
3. Adja meg az alábbi adatokat:
   - **Email cím**: Ez lesz a bejelentkezési azonosítója
   - **Jelszó**: Minimum 8 karakter, használjon erős jelszót
4. Kattintson a **"Regisztráció"** gombra
5. Ellenőrizze a postafiókját - érkezni fog egy megerősítő email
6. Kattintson az emailben található linkre a regisztráció véglegesítéséhez

**Fontos**: Ha nem érkezik meg az email, ellenőrizze a spam mappát is.

### Bejelentkezés

1. Nyissa meg a VisiBill alkalmazást
2. Adja meg az email címét és jelszavát
3. Kattintson a **"Bejelentkezés"** gombra

### Elfelejtett jelszó

1. A bejelentkezési oldalon kattintson a **"Elfelejtett jelszó?"** linkre
2. Adja meg az email címét
3. Ellenőrizze a postafiókját
4. Kattintson az emailben található linkre
5. Adja meg az új jelszavát kétszer
6. Jelentkezzen be az új jelszóval

---

## Kezdőlépések

### Első bejelentkezés után

Az első bejelentkezés után megjelenik a **kezdővarázsló** (onboarding), amely végigvezeti a profil kitöltésén:

1. **Személyes adatok**:
   - Teljes név
   - Beosztás (pl. ügyvezető, könyvelő)
   - Cégnév
   
2. **Email beállítások**:
   - Email értesítések engedélyezése/tiltása
   - Értesítés típusok kiválasztása

3. **Első lépések**:
   - NAV integráció beállítása (opcionális)
   - Előfizetési csomag kiválasztása

### Vezérlőpult áttekintése

A főoldal (Dashboard) a következő információkat tartalmazza:

- **Számlák összegzése**: Havi kimenő/bejövő számlák összege
- **NAV szinkronizálás státusza**: Utolsó szinkronizálás ideje
- **Projektek**: Aktív projektek listája
- **Legutóbbi számlák**: A legfrissebb számlák gyors áttekintése

### Menü áttekintése

A bal oldali menüben találja a következő funkciókat:

- **🏠 Főoldal**: Vezérlőpult, összegzések
- **🧾 Számlák**: Összes számla listája és kezelése
- **📁 Projektek**: Projekt alapú költségkövetés
- **💰 Fizetések**: Bérek és kifizetések nyilvántartása
- **🔗 Integrációk**: NAV, email és egyéb integrációk
- **💳 Előfizetés**: Díjcsomagok és számlázás
- **📊 Árfolyamok**: Valuta árfolyamok megtekintése
- **⚙️ Beállítások**: Profil és rendszer beállítások

---

## NAV integráció beállítása

### Miért fontos a NAV integráció?

A NAV integráció lehetővé teszi, hogy automatikusan lekérdezze és szinkronizálja a NAV rendszerében tárolt számlákat. Ez jelentősen megkönnyíti a könyvelést és adóbevallást.

### Szükséges adatok

A NAV integráció beállításához az alábbi adatokra van szüksége:

1. **NAV felhasználónév**: A NAV technikai felhasználó neve
2. **Adószám**: 8 jegyű magyar adószám
3. **NAV jelszó**: A technikai felhasználó jelszava
4. **Aláírási kulcs**: XML aláíráshoz használt kulcs
5. **Cserekulcs**: Adatcsere titkosításhoz használt kulcs
6. **Környezet**: Teszt vagy Éles

**Hol szerezhetem be ezeket az adatokat?**
- A NAV Online Számla rendszerben (onlineszamla.nav.gov.hu)
- Technikai felhasználó létrehozása szükséges
- Részletes útmutató: [NAV dokumentáció](https://onlineszamla.nav.gov.hu/)

### Beállítási lépések

1. Kattintson a **"Integrációk"** menüpontra a bal oldali menüben
2. Válassza a **"NAV integráció"** kártyát
3. Töltse ki az űrlapot:
   - NAV felhasználónév
   - Adószám (8 számjegy)
   - NAV jelszó
   - Aláírási kulcs
   - Cserekulcs
   - Válassza a **Teszt** vagy **Éles** környezetet
4. Kattintson a **"Mentés és tesztelés"** gombra
5. A rendszer ellenőrzi a kapcsolatot és megerősítést küld

**Tipp**: Először a teszt környezetet használja, hogy megbizonyosodjon arról, hogy minden megfelelően működik.

### Hibakezelés

Ha a NAV kapcsolat sikertelen:
- Ellenőrizze, hogy az adószám 8 jegyű-e
- Győződjön meg róla, hogy a helyes környezetet választotta
- Ellenőrizze a technikai felhasználó státuszát a NAV oldalán
- Próbálja meg frissíteni a kulcsokat

---

## Számlák kezelése

### Számlák szinkronizálása a NAV-ból

Miután beállította a NAV integrációt, elkezdheti szinkronizálni a számlákat:

1. Menjen a **"Számlák"** oldalra
2. Kattintson a **"NAV szinkronizálás"** gombra
3. Válassza ki a dátum tartományt (maximum 35 nap)
4. Válassza ki az irányt:
   - **Bejövő**: Beszállítói számlák
   - **Kimenő**: Kiállított számlák
5. Kattintson a **"Szinkronizálás indítása"** gombra
6. Várjon, amíg a folyamat befejeződik
7. Az új számlák megjelennek a listában

**Fontos**: A NAV API korlátozza a lekérdezhető időtartamot 35 napra. Hosszabb időszakhoz több lekérdezés szükséges.

### Számlák megtekintése és szűrése

A számlák listáján a következő műveleteket végezheti:

**Szűrés**:
- Dátum szerint (kezdő és befejező dátum)
- Irány szerint (bejövő/kimenő)
- Projekt szerint
- Összeg szerint
- Keresés számlaszám vagy partner név alapján

**Rendezés**:
- Dátum szerint (növekvő/csökkenő)
- Összeg szerint
- Partner név szerint

**Műveletek**:
- Számla részleteinek megtekintése
- Számla letöltése (ha elérhető)
- Számla hozzárendelése projekthez
- Számla exportálása

### Manuális számla feltöltés

Ha olyan számla érkezett, amely nincs a NAV rendszerben, manuálisan is feltöltheti:

1. Menjen a **"Manuális feltöltés"** oldalra (menü: Számlák > Manuális feltöltés)
2. Kattintson a **"Fájl kiválasztása"** vagy **"Fájlok húzása ide"** területre
3. Válassza ki a számla fájlt (PDF, JPG, PNG formátum)
4. Töltse ki a következő adatokat (opcionális):
   - Számlaszám
   - Kiállító neve
   - Dátum
   - Összeg
   - Projekt hozzárendelés
5. Kattintson a **"Feltöltés"** gombra
6. A rendszer automatikusan feldolgozza a számlát (OCR)
7. Ellenőrizze a felismert adatokat
8. Kattintson a **"Jóváhagyás"** gombra

**Automatikus feldolgozás**: A rendszer megpróbálja automatikusan felismerni a számla adatait (számlaszám, összeg, dátum). Mindig ellenőrizze a helyességet!

### Email-es számla fogadás

A VisiBill lehetővé teszi, hogy email-en keresztül is fogadjon számlákat:

#### Email alias létrehozása

1. Menjen a **"Beállítások"** oldalra
2. Válassza az **"Email alias"** fület
3. Kattintson az **"Új email alias létrehozása"** gombra
4. Adjon meg egy nevet az aliasnak (pl. "Cég számlák")
5. A rendszer létrehoz egy egyedi email címet (pl. `company123@mg.visibill.app`)
6. Másolja ki ezt az email címet

#### Email alias használata

1. Küldje el a számlát az email alias címre
2. A rendszer automatikusan fogadja és feldolgozza
3. A számla megjelenik a **"Számlák"** listában
4. Email értesítést kap a feldolgozásról

**Tippek**:
- Ossza meg az email aliast beszállítóival
- Egy projekthez egy aliast használjon
- A tárgyban feltüntetheti a számlaszámot

### Számlák exportálása

Számlák exportálása Excel formátumba:

1. Menjen a **"Számlák"** oldalra
2. Szűrje a számlákat (dátum, projekt, stb.)
3. Kattintson az **"Export"** gombra
4. Válassza az export formátumot:
   - **Excel (.xlsx)**: Táblázat formátum
   - **CSV**: Egyszerű szöveges formátum
   - **PDF**: Nyomtatható lista
5. Válassza ki az exportálandó oszlopokat
6. Kattintson a **"Letöltés"** gombra

---

## Projektek kezelése

### Mi az a projekt?

A projektek lehetővé teszik, hogy a számlákat és költségeket logikai egységekbe rendezze. Például:
- Különböző ügyfelek vagy megbízások
- Belső projektek (pl. marketing, fejlesztés)
- Időszakos kampányok

### Új projekt létrehozása

1. Menjen a **"Projektek"** oldalra
2. Kattintson az **"Új projekt"** gombra
3. Töltse ki a projekt adatait:
   - **Projekt neve**: Egyedi, beszédes név
   - **Leírás**: Rövid összefoglaló (opcionális)
   - **Ügyfél neve**: Ha külső projektről van szó
   - **Kezdő dátum**: Projekt indulása
   - **Befejező dátum**: Várható befejezés (opcionális)
   - **Költségkeret**: Tervezett költség (opcionális)
   - **Státusz**: Aktív, Szünetelő, Lezárt
4. Kattintson a **"Projekt létrehozása"** gombra

### Számla hozzárendelése projekthez

Két módszerrel rendelhet számlát projekthez:

**1. Számla listából**:
1. Menjen a **"Számlák"** oldalra
2. Kattintson a számla sorára
3. A részletes nézetben válassza a **"Projekt"** mezőt
4. Válassza ki a projektet a legördülő listából
5. Kattintson a **"Mentés"** gombra

**2. Feltöltéskor**:
- Manuális feltöltésnél a feltöltési űrlapon
- Email-es fogadásnál automatikusan (ha beállított szabály)

### Projekt áttekintése

Egy projekt részletes nézetében láthatja:

- **Összesítések**:
  - Összes költés
  - Számlák száma
  - Átlagos számlázási érték
  - Költségkeret kihasználtság (%)
  
- **Számlák listája**: Projekthez rendelt összes számla

- **Időbeli eloszlás**: Havi bontásban a költések

- **Műveletek**:
  - Projekt szerkesztése
  - Projekt lezárása
  - Projekt törlése (ha nincs hozzárendelt számla)

---

## Fizetések és számlák

### Bérek nyilvántartása

A **"Fizetések"** oldalon vezetheti a bér nyilvántartást:

1. Menjen a **"Fizetések"** oldalra
2. Kattintson az **"Új bér bejegyzés"** gombra
3. Töltse ki az adatokat:
   - **Munkavállaló neve**
   - **Időszak**: Év és hónap
   - **Bruttó bér**: Adózás előtti összeg
   - **Nettó bér**: Kifizetendő összeg
   - **Adó összege**: SZJA, TB járulék
   - **Megjegyzés**: Például túlóra, prémium
4. Kattintson a **"Mentés"** gombra

### Bérlista exportálása

1. Szűrje az időszakot (év, hónap)
2. Kattintson az **"Export"** gombra
3. Válassza a formátumot (Excel, PDF)
4. Töltse le a fájlt

### Adófizetések rögzítése

Az adófizetéseket is rögzítheti a rendszerben:

1. Kattintson az **"Adófizetés"** fülre
2. Kattintson az **"Új adófizetés"** gombra
3. Adja meg:
   - **Adó típusa**: SZJA, ÁFA, TB, Társasági adó, stb.
   - **Időszak**: Melyik hónapra/negyedévre vonatkozik
   - **Összeg**: Befizetett összeg
   - **Fizetés dátuma**
   - **Hivatkozási szám**: NAV utalási azonosító
4. Mentse el

---

## Email integráció

### Nylas email szinkronizálás

A Nylas integráció lehetővé teszi, hogy összekapcsolja a Gmail, Outlook vagy más email fiókját, és automatikusan detektálja a bejövő számlákat.

#### Beállítás lépései

1. Menjen az **"Integrációk"** oldalra
2. Kattintson a **"Nylas Email Sync"** kártyára
3. Kattintson a **"Csatlakozás"** gombra
4. Válassza ki az email szolgáltatót:
   - Gmail
   - Microsoft Outlook
   - Yahoo
   - IMAP (egyéni szerver)
5. Jelentkezzen be az email fiókjába
6. Engedélyezze a hozzáférést a VisiBill számára
7. Várja meg a megerősítést

#### Automatikus számla detektálás

A rendszer automatikusan átvizsgálja a beérkező emaileket, és:
- Felismeri a számla mellékleteket (PDF, képek)
- Automatikusan feldolgozza azokat
- Értesíti Önt az új számlákról

**Adatvédelem**: A VisiBill csak a számla mellékleteket olvassa és tárolja, az email tartalmát nem.

#### Leválasztás

Ha nem kívánja tovább használni az email szinkronizálást:

1. Menjen az **"Integrációk"** oldalra
2. Kattintson a **"Leválasztás"** gombra a Nylas kártyán
3. Erősítse meg a műveletet

---

## Árfolyamok

### Deviza árfolyamok megtekintése

Az **"Árfolyamok"** oldalon valós idejű deviza árfolyamokat tekinthet meg, amelyek segítenek a külföldi számlák kezelésében és a devizanemek közötti átváltásban.

#### Funkciók

1. Menjen az **"Árfolyamok"** oldalra a bal oldali menüben
2. Megtekintheti a következő információkat:
   - **MNB hivatalos árfolyamok**: A Magyar Nemzeti Bank naprakész árfolyamai
   - **Népszerű devizapárok**: EUR/HUF, USD/HUF, GBP/HUF, CHF/HUF
   - **Árfolyam változások**: Napi változások százalékban
   - **Frissítés ideje**: Utolsó frissítés időpontja

#### Használati tippek

- Az árfolyamok automatikusan frissülnek
- Használja referenciaként külföldi számlák feldolgozásakor
- A számított összegek tájékoztató jellegűek, a banki árfolyamok eltérhetnek
- Több devizanem támogatása elérhető

#### Deviza konverzió

Ha külföldi devizás számlákat kezel:
1. Nézze meg az aktuális árfolyamot az Árfolyamok oldalon
2. Használja a számlák rögzítésekor a megfelelő devizanemet
3. A rendszer automatikusan tárolja az eredeti devizát
4. Később visszanézheti a történeti árfolyamokat

---

## Előfizetések

### Díjcsomagok

A VisiBill többféle díjcsomagot kínál:

#### Ingyenes csomag
- Havonta 10 számla feldolgozás
- Alapvető NAV integráció
- 1 projekt
- Email támogatás

#### Pro csomag
- Havonta 100 számla feldolgozás
- Teljes NAV integráció
- Korlátlan projektek
- Email alias (3 db)
- Prioritásos támogatás

#### Business csomag
- Havonta 500 számla feldolgozás
- Minden Pro funkció
- Csapat hozzáférés (5 felhasználó)
- Egyedi email aliaok (10 db)
- Telefonos támogatás
- Adatexport API

#### Enterprise csomag
- Korlátlan számla feldolgozás
- Minden Business funkció
- Korlátlan felhasználók
- Dedikált account manager
- SLA garancia
- Egyedi integrációk

### Előfizetés vásárlása

1. Menjen az **"Előfizetés"** vagy **"Árazás"** oldalra
2. Válassza ki a megfelelő csomagot
3. Kattintson az **"Előfizetés"** gombra
4. Töltse ki a számlázási adatokat
5. Adja meg a fizetési adatokat (bankkártya)
6. Erősítse meg a fizetést
7. Az előfizetés azonnal aktív lesz

### Előfizetés kezelése

Az **"Előfizetés"** oldalon:

- **Aktuális csomag**: Megtekintheti a jelenlegi csomagot
- **Használati statisztika**: Havi felhasznált számlák, projektek
- **Következő fizetés**: Dátum és összeg
- **Számla előzmények**: Korábbi számlák letöltése

**Műveletek**:
- **Csomag módosítása**: Átváltás magasabb/alacsonyabb csomagra
- **Fizetési mód frissítése**: Új bankkártya hozzáadása
- **Előfizetés lemondása**: Csomag leállítása

### Ügyfélportál

A Stripe ügyfélportál lehetővé teszi:

1. Kattintson az **"Ügyfélportál megnyitása"** gombra
2. Új ablakban megnyílik a Stripe portál
3. Itt kezelheti:
   - Fizetési módokat
   - Előfizetés módosítását
   - Számla letöltését
   - Előfizetés lemondását

---

## Beállítások

### Profil beállítások

A **"Beállítások"** oldalon személyre szabhatja a fiókját:

#### Személyes adatok
- **Név**: Teljes név módosítása
- **Email**: Email cím megtekintése (nem módosítható)
- **Beosztás**: Pozíció a cégen belül
- **Cégnév**: Vállalkozás neve
- **Profilkép**: Avatar feltöltése

#### Jelszó módosítása

1. Kattintson a **"Jelszó módosítása"** gombra
2. Adja meg a jelenlegi jelszavát
3. Adja meg az új jelszavát (minimum 8 karakter)
4. Erősítse meg az új jelszót
5. Kattintson a **"Mentés"** gombra

### Email értesítések

Beállíthatja, milyen értesítéseket szeretne kapni:

- ✅ **Számla feldolgozás**: Értesítés feldolgozott számlákról
- ✅ **NAV szinkronizálás**: Szinkronizálás befejezésekor
- ✅ **Heti összegzés**: Heti statisztikák emailben
- ✅ **Havi összegzés**: Havi kimutatás
- ❌ **Marketing emailek**: Promóciók, újdonságok

### Nyelv és régió

- **Nyelv**: Magyar (alapértelmezett)
- **Időzóna**: Europe/Budapest
- **Dátumformátum**: ÉÉÉÉ-HH-NN
- **Számformátum**: 1 234 567,89 Ft

### Téma

Válasszon a megjelenítési módok közül:
- **Világos**: Világos háttér
- **Sötét**: Sötét háttér (szemkímélő)
- **Automatikus**: Rendszer beállítás szerint

### Adatkezelés

#### Adatok exportálása

GDPR jogai alapján exportálhatja az összes adatát:

1. Kattintson az **"Adatok exportálása"** gombra
2. A rendszer összeállítja az adatokat
3. Email-ben megkapja a letöltési linket
4. JSON formátumban letölthető

#### Fiók törlése

Ha véglegesen törölni szeretné a fiókját:

1. Kattintson a **"Fiók törlése"** gombra
2. Olvassa el a figyelmeztetést
3. Írja be: "TÖRLÉS MEGERŐSÍTÉSE"
4. Kattintson a **"Végleges törlés"** gombra

**Figyelem**: Ez a művelet **visszavonhatatlan**! Minden adat véglegesen törlődik.

---

## Gyakori kérdések

### Általános kérdések

**Mennyibe kerül a VisiBill?**
Az alapverzió ingyenes 10 számla/hó limitel. A Pro csomag 4990 Ft/hó, amely 100 számla feldolgozást tartalmaz. További csomagokat az Árazás oldalon talál.

**Milyen fájlformátumokat támogat a rendszer?**
PDF, JPG, PNG, JPEG formátumú számla fájlokat tud feldolgozni.

**Biztonságban vannak az adataim?**
Igen. Az adatokat titkosítva tároljuk, és SSL kapcsolatot használunk. A szerverek EU-ban találhatók (GDPR kompatibilis).

### NAV integráció

**Miért nem sikerül a NAV kapcsolat?**
Ellenőrizze:
- Adószám 8 jegyű-e
- NAV technikai felhasználó aktív-e
- Helyes környezetet választotta (Teszt/Éles)
- Az aláírási és cserekulcs helyes-e

**Milyen gyakran tudom szinkronizálni a számlákat?**
Bármikor futtathat szinkronizálást, de a NAV API maximum 35 napos időszakot enged egy lekérdezésben.

**A teszt környezet számláit látom az éles rendszerben?**
Nem. A teszt és éles környezet teljesen elkülönült a NAV rendszerben.

### Számlák

**Automatikusan felismeri a rendszer a számla adatait?**
Igen, OCR technológiával felismerjük a számlaszámot, dátumot, összeget és partner nevet. Azonban mindig ellenőrizze a pontosságot!

**Mi történik, ha rosszul töltöttem fel egy számlát?**
A számla részletes nézetében szerkesztheti az adatokat vagy törölheti a számlát.

**Hogyan tudom egy számlát projekthez rendelni?**
A számla részletes nézetében válassza ki a Projekt mezőt, és válasszon a listából.

### Email integráció

**Biztonságos-e az email fiók összekapcsolása?**
Igen. OAuth2 protokollt használunk, így a jelszavát nem látjuk. Bármikor leválaszthatja a fiókot.

**Minden emailem látható lesz a VisiBill-nek?**
Nem. Csak a mellékleteket olvassuk, az email tartalmát nem tároljuk.

**Hány email aliast hozhatok létre?**
Az ingyenes csomag nem tartalmaz email aliast. A Pro csomag 3, a Business csomag 10 aliast tartalmaz.

### Előfizetés

**Hogyan módosíthatom a csomagomat?**
Az Előfizetés oldalon kattintson a "Csomag módosítása" gombra, és válassza ki az új csomagot. A változás azonnal érvényes.

**Mi történik, ha túllépem a havi limitemet?**
A rendszer értesíti, és felajánlja a csomag frissítését. Az ingyenes csomagnál nem tud több számlát feldolgozni a limit után.

**Hogyan mondhatom le az előfizetést?**
Az Előfizetés oldalon vagy a Stripe ügyfélportálban. A lemondás a következő fizetési ciklus előtt lép életbe.

**Visszatérítést kaphatok?**
A 14 napos próbaidőszakon belül teljes visszatérítés jár. Utána pro-rata alapon számolunk.

### Technikai problémák

**Lassú a rendszer vagy nem tölt be egy oldal**
1. Frissítse az oldalt (F5)
2. Törölje a böngésző cache-t
3. Próbáljon inkognitó módban
4. Ellenőrizze az internet kapcsolatot

**Nem érkezik email értesítés**
1. Ellenőrizze a spam mappát
2. Nézze meg a Beállításokban az email értesítések be vannak-e kapcsolva
3. Ellenőrizze az email címet

**Hiba üzenet a számla feltöltésekor**
- Ellenőrizze a fájlméretet (max 10 MB)
- Próbáljon PDF formátumot JPG helyett
- Várjon néhány percet és próbálja újra

### Támogatás

**Hogyan kérhetek segítséget?**
- **Email**: support@visibill.app
- **Chat**: A jobb alsó sarokban található chat ikon
- **Tudásbázis**: docs.visibill.app
- **Telefonos támogatás**: Business és Enterprise csomagokhoz

**Milyen nyelven érhető el a támogatás?**
Magyar és angol nyelven is.

**Mennyi idő alatt válaszolnak?**
- Ingyenes/Pro: 48 órán belül
- Business: 24 órán belül
- Enterprise: 4 órán belül (SLA garancia)

---

## Kapcsolat

**Email**: support@visibill.app  
**Weboldal**: www.visibill.app  
**Dokumentáció**: docs.visibill.app  

**Közösségi média**:
- Facebook: /visibillapp
- LinkedIn: /company/visibill

---

*Utolsó frissítés: 2025. november*  
*Verzió: 1.0*