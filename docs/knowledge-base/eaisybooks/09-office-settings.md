# 🏢 Irodai Beállítások (Office Settings)

> **Alkalmazás:** eaisyBooks  
> **Menücsoport:** Iroda & Rendszer  
> **Szükséges szerepkör:** Irodavezető adminisztrátor (`iroda_admin`)  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:** Az eaisyBooks felület bal oldali menüjében az **Iroda Adminisztráció** csoportban: **Iroda beállítások** menüpont (`/eaisybooks/admin/office-settings`).
- **Ikon:** Épület / Házikó (`Building`) vagy Fogaskerék ikon
- **Elérési útvonal:** Oldalsáv → Adminisztráció → Iroda beállítások
- **Gyorsműveletek:** Irodai törzsadatok frissítése, biztonsági előírások és 2FA szabályozása, értesítési határidők beállítása, NAV környezet konfigurálása

---

## 2. A menü funkciója és célja

Az **Irodai Beállítások** a könyvelőiroda mint önálló gazdasági és szolgáltató szervezet központi konfigurációs felülete. Itt határozhatók meg az iroda hivatalos törzsadatai, szakmai biztosítási nyilvántartása, a rendszer szintű IT-biztonsági és adatmegőrzési szabályok, valamint a NAV integrációs beállítások.

### Fő feladatai és szerepe az irodavezetésben:
1. **Hivatalos irodai adatok nyilvántartása:** Az iroda neve, székhelye, adószáma, kamarai engedélyszáma és kötvényszáma, amelyek az ügyfelek felé kiadott bizonylatokon és igazolásokon megjelennek.
2. **Kiemelt adat- és IT-biztonság:** Kétfaktoros hitelesítés (2FA) szabályozása, automatikus munkamenet-időkorlát (inaktivitási kijelentkezés) és audit napló megőrzési idők felügyelete.
3. **Automatikus határidő-értesítések:** Az irodai munkatársak figyelmeztetése a közeledő bérszámfejtési és adóbevallási napok előtt.
4. **NAV interfész felügyelete:** A hatósági számla- és adatszolgáltatási környezet (Éles NAV szerverek vagy Sandbox tesztkörnyezet) beállítása.

---

## 3. Mit lehet benne a felhasználónak csinálni?

### 3.1 Visszanavigálás és Fejléc Mentés Gomb
- **Hogy hívják:** „Vissza” nyíl gomb és „Beállítások mentése” gomb
- **Mire való:** Visszatérés a korábbi oldalra, valamint a négy beállítási fülön végrehajtott bármely módosítás egyidejű adatbázisba írása.
- **Hol található a felületen:** A képernyő felső fejlécében, bal oldalon a vissza nyíl, jobb szélen a zöld/kék mentés gomb.
- **Hogyan használhatja a felhasználó:**
  1. A beállítások szerkesztése után kattintson a jobb felső **„Mentés”** lemez ikonra.
  2. A rendszer zöld megerősítő üzenetet jelenít meg: *„Beállítások mentve”*.
  3. A bal oldali vissza nyílra kattintva elhagyhatja az oldalt.
  - **Eredmény:** Az új konfigurációk azonnal érvénybe lépnek az iroda valamennyi munkatársa számára.

### 3.2 1. Fül — Általános Irodai Törzsadatok
- **Hogy hívják:** „Általános” lapfül és beviteli mezők
- **Mire való:** Az iroda cégadatainak, elérhetőségeinek, szakmai felelősségbiztosítási és könyvviteli nyilvántartási számának rögzítése.
- **Hol található a felületen:** A fülsor 1. eleme (`Building` ikon).
- **Hogyan használhatja a felhasználó:**
  1. Kattintson az **„Általános”** fülre.
  2. Töltse ki az iroda adatait:
     - **Iroda neve:** Hivatalos cégnév vagy egyéni cég elnevezése.
     - **Adószám és Cégjegyzékszám:** Hivatalos azonosítók.
     - **Székhely címe, Telefonszám, E-mail és Weboldal.**
     - **Könyvelői engedélyszám:** PM regisztrációs vagy MKVK kamarai tagsági szám.
     - **Felelősségbiztosítási kötvényszám:** Szakmai károkat fedező kötvény azonosítója.
     - **Pénzügyi év vége:** Alapértelmezett fordulónap (pl. 12-31).
     - **Alapértelmezett pénznem:** HUF, EUR vagy USD.
  - **Eredmény:** A hivatalos adatok bekerülnek a megbízási szerződésekbe és a kiküldött ügyfélértesítők láblécébe.

### 3.3 2. Fül — Biztonsági és Munkamenet Szabályok
- **Hogy hívják:** „Biztonság” lapfül, kapcsolók és numerikus beállítók
- **Mire való:** Az irodai könyvelők belépési biztonságának szigorítása és a GDPR audit naplók megőrzési idejének szabályozása.
- **Hol található a felületen:** A fülsor 2. eleme (`Shield` ikon).
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a **„Biztonság”** fülre.
  2. Állítsa be a következő védelmi szinteket:
     - **Kétlépcsős azonosítás (2FA):** Kapcsolja be az SMS/Hitelesítő app alapú belépés kényszerítését minden munkatárs számára.
     - **Munkamenet időkorlát (perc):** Adja meg, hány perc tétlenség után léptessen ki automatikusan a rendszer (alapértelmezetten 30 perc).
     - **Minimális jelszóhossz:** Karakterek minimális száma (pl. legalább 8 vagy 12 karakter).
     - **Automatikus adatmentés:** Felhőalapú biztonsági pillanatképek engedélyezése.
     - **Audit napló megőrzése (év):** Hány évig köteles a rendszer megőrizni a könyvelési módosítások naplóját (pl. 5 vagy 8 év).
  - **Eredmény:** Az iroda megfelel a szigorú digitális biztonsági és kamarában elvárt adatvédelmi normáknak.

### 3.4 3. Fül — Értesítési Preferenciák és Emlékeztetők
- **Hogy hívják:** „Értesítések” lapfül és Határidő csúszka
- **Mire való:** A munkatársaknak és ügyfeleknek küldött automatikus figyelmeztetések időzítése.
- **Hol található a felületen:** A fülsor 3. eleme (`Bell` ikon).
- **Hogyan használhatja a felhasználó:**
  1. Kattintson az **„Értesítések”** fülre.
  2. Kapcsolja be az **„E-mail értesítések engedélyezése”** kapcsolót.
  3. A **„Bérszámfejtési határidő emlékeztető”** mezőben állítsa be a napok számát (pl. 3 nappal a hó 10-e előtt küldjön riasztást a nyitott bérszámfejtésekről).
  - **Eredmény:** A rendszer automatikusan generálja a belső és külső emlékeztetőket a kritikus határidők előtt.

### 3.5 4. Fül — NAV Integrációs Környezet
- **Hogy hívják:** „Integrációk” lapfül és NAV Környezet választó
- **Mire való:** A Nemzeti Adó- és Vámhivatal felé irányuló Online Számla és adatszolgáltatási modulok hálózati végpontjának beállítása.
- **Hol található a felületen:** A fülsor 4. eleme (`Globe` ikon).
- **Hogyan használhatja a felhasználó:**
  1. Kattintson az **„Integrációk”** fülre.
  2. A **„NAV Környezet”** választóban válasszon:
     - **Éles (Production):** A valós gazdasági forgalom és valós NAV számlák letöltéséhez.
     - **Sandbox (Teszt):** Tesztfiókok és próbaszámlázások kipróbálásához.
  3. Szükség esetén ellenőrizze a központi NAV API kapcsolat státuszát.
  - **Eredmény:** A rendszer az éles hatósági szerverekhez kapcsolódik.

---

## 4. Tipikus könyvelői munkafolyamatok (Workflow-k)

### 4.1 Éves kamarai és biztosítási adategyeztetés
1. Az irodavezető az éves szakmai felelősségbiztosítás megújításakor belép az **Iroda beállítások** felületre.
2. Az **Általános** fülön frissíti a biztosítási kötvényszámot és az érvényességi dátumot.
3. A jobb felső sarokban a **„Mentés”** gombra kattint, így a generált szerződések azonnal az új kötvényszámmal készülnek.

### 4.2 IT-biztonsági szigorítás bevezetése
1. Adatvédelmi audit alkalmával az irodavezető a **Biztonság** fülre navigál.
2. Bekapcsolja a kötelező kétfaktoros azonosítást (2FA), és a munkamenet lejárati idejét 15 percre csökkenti az irodai munkaállomások védelmében.
3. A mentést követően a rendszer minden munkatársnak előírja a 2FA beállítását a következő belépéskor.

---

## 5. Kapcsolódó jogszabályok és szakmai háttér

- **2000. évi C. törvény a számvitelről (Sztv.):** A bizonylatok és könyvviteli nyilvántartások megőrzési ideje (legalább 8 év).
- **2006. évi LXXV. törvény a Magyar Könyvvizsgálói Kamaráról:** Kötelező szakmai felelősségbiztosítás és kamarai regisztrációs előírások.
- **GDPR (Európai Parlament és a Tanács 2016/679 rendelete):** Adatbiztonsági intézkedések, hozzáférés-kezelés és auditnaplózás a könyvelésben kezelt személyes adatok védelmére.
