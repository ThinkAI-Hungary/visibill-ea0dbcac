# ⚙️ Beállítások (Cégprofil, Bankszámlák, Tagok és Jogosultságok)

> **Alkalmazás:** eaisyBill  
> **Menücsoport:** Fő navigáció / Rendszer  
> **Szükséges szerepkör:**  
> - *Személyes profil, Rendszer és Értesítések:* Minden bejelentkezett felhasználó saját maga szerkesztheti.  
> - *Cégadatok, Bankszámlák, Csapattagok és Jogosultságok:* Kizárólag cégtulajdonos (Owner) és adminisztrátor (Admin) módosíthatja; a könyvelő és pénzügyi munkatársak csak olvasási joggal rendelkeznek.  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:** Az oldalsó menü alsó szekciójában található **Beállítások** menüpont.
- **Ikon:** Fogaskerék ikon
- **Elérési útvonal:** Beállítások menüpont a bal oldali navigációs sávban
- **Gyorsműveletek:** Új tag meghívása, csatlakozási kód generálása, új bankszámla rögzítése

---

## 2. A menü funkciója és célja

A **Beállítások** modul a vállalat jogi, szervezeti, pénzügyi és biztonsági paramétereinek központi adminisztrációs felülete.

### Fő feladatai és szerepe a rendszerben:
1. **Cégtörzs és törvényes adatok karbantartása:** Cégnév, adószám, székhely cím, fő TEÁOR tevékenység, ÁFA alanyisági forma és mesterséges intelligenciával generált cégismertető.
2. **Bankszámlatörzs menedzsment:** A cég hivatalos forint és deviza bankszámláinak rögzítése, IBAN formátum ellenőrzése, alapértelmezett számla beállítása az automatikus banki párosításhoz.
3. **Munkatársak, könyvelők és meghívók kezelése:** Felhasználók meghívása e-mailben vagy 10 perces titkosított csatlakozási kóddal, szerepkörök kiosztása és modul-szintű jogosultságmátrix testreszabása.
4. **Deviza könyvelési szabályzat:** Napi MNB árfolyam vagy számla szerinti árfolyam alkalmazásának meghatározása a devizás tranzakciókhoz.
5. **Biztonság és Adatvédelem (GDPR):** Kétlépcsős hitelesítés, jelszó- és e-mail változtatás, teljes céges adatvagyon biztonsági exportálása.

---

## 3. Részletes Funkciók és Használatuk (Hogy hívják, Mire való, Hol van, Hogyan használható)

### 3.1 Cégadatok és AI Cégismertető Generálása
- **Hogy hívják:** „Cégadatok szerkesztése” űrlap és „AI Leírás generálása” gomb
- **Mire való:** A cég hivatalos adatainak (cégnév, adószám, székhely, TEÁOR) karbantartása, és automatikus szakmai tevékenységleírás készítése a könyvelési és besorolási AI modellek számára.
- **Hol található a felületen:** A **„Cégadatok”** lapfül felső részén.
- **Hogyan használhatja a felhasználó:**
  1. Írja be vagy ellenőrizze az adószámot és a székhely címet.
  2. Adja meg a fő TEÁOR kódot.
  3. Kattintson az **„AI Leírás generálása”** gombra: a rendszer az adószám és tevékenység alapján automatikusan megfogalmazza a cég profilját.
  4. Kattintson a kék **„Módosítások mentése”** gombra.
  - **Eredmény:** A számlák fejlécében és a hivatalos beszámolókban azonnal a frissített cégadatok jelennek meg.

### 3.2 Csatlakozási Kód Generálása (Gyors Tagcsatlakoztatás)
- **Hogy hívják:** „Csatlakozási kód generálása” panel és másolás gomb
- **Mire való:** 6 karakteres, 10 percig érvényes titkosított belépési kód készítése, amellyel egy új munkatárs vagy a könyvelő azonnal csatlakozhat a céghez e-mailes meghívó megvárása nélkül.
- **Hol található a felületen:** A **„Csapat”** fül tetején, a taglista felett.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a **„Csatlakozási kód generálása”** gombra.
  2. A felugró ablakban megjelenik a 6 betűs kód (pl. *X7K-9P2*) és az élő 10 perces visszaszámláló.
  3. Kattintson a **„Kód másolása”** gombra.
  4. Küldje el a kódot a belépni kívánó kollégának (aki saját fiókjában a *Csatlakozás céghez* mezőbe másolja be).
  - **Eredmény:** A kolléga azonnal hozzáfér a céghez, és megjelenik a taglistában.

### 3.3 Új Tag Meghívása és Jogosultságok Beállítása
- **Hogy hívják:** „Tag meghívása” gomb és jogosultságkezelő mátrix
- **Mire való:** Munkatársak vagy a külső könyvelő felvétele e-mailben, szerepkörük (Tulajdonos, Admin, Könyvelő, Pénzügyi munkatárs, Megtekintő) kijelölése és hozzáférési szintjeik testreszabása.
- **Hol található a felületen:** A **„Csapat”** lapfül jobb felső részén lévő kék akciógomb, illetve az alatta lévő tagtáblázat.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson az **„Új tag meghívása”** gombra.
  2. Írja be a meghívandó személy e-mail címét, és válassza ki a szerepkörét a legördülő listából.
  3. Kattintson a **„Meghívó küldése”** gombra.
  4. Meglévő tagnál a sor végén lévő szerepkör mezővel bármikor módosíthatja a jogosultságot, vagy a törlés ikonnal visszavonhatja a hozzáférést.
  - **Eredmény:** A felhasználó megkapja a regisztrációs e-mailt, és a kijelölt jogosultságokkal léphet be a rendszerbe.

### 3.4 Új Bankszámla Rögzítése és IBAN Validáció
- **Hogy hívják:** „Új bankszámla hozzáadása” gomb és számlaűrlap
- **Mire való:** A cég pénzintézeti számláinak (OTP, Erste, K&H, Revolut, Wise stb.) rögzítése, nemzetközi IBAN kód ellenőrzése és alapértelmezett kifizetési számla kijelölése.
- **Hol található a felületen:** A **„Bankszámlák”** lapfülön található zöld **„+ Új számla”** gomb.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a **„+ Új számla”** gombra.
  2. Válassza ki a bank nevét és a devizanemet (HUF, EUR, USD).
  3. Írja be a 24 jegyű belföldi számlaszámot vagy az IBAN kódot.
  4. A rendszer automatikusan ellenőrzi az ellenőrzőösszeget.
  5. Jelölje be az *„Alapértelmezett bankszámla”* négyzetet, ha erről indulnak az utalások.
  6. Kattintson a **„Mentés”** gombra.
  - **Eredmény:** A bankszámla bekerül a rendszerbe, elérhetővé válik a kivonatok feltöltésénél és a szállítói utalásoknál.

### 3.5 Rendszer Téma és GDPR Adatvagyon Exportálása
- **Hogy hívják:** „Megjelenés beállítása” és „GDPR Adatok exportálása” gomb
- **Mire való:** A vizuális sötét/világos mód közötti váltás, valamint a cég teljes adatvagyonának (számlák, partnerek, könyvelés) kimentése biztonsági archívumba.
- **Hol található a felületen:** A **„Rendszer”** lapfülön.
- **Hogyan használhatja a felhasználó:**
  1. A Megjelenés résznél válassza a **„Világos”**, **„Sötét”** vagy **„Rendszerkövető”** opciót.
  2. Biztonsági mentéshez görgessen az Adatvédelem szekcióhoz, és kattintson az **„Összes adat exportálása”** gombra.
  - **Eredmény:** A felület azonnal átvált a választott témára, illetve letöltődik a cég teljes adatcsomagja.

### 3.6 Kétlépcsős Hitelesítés (2FA) és Jelszócsere
- **Hogy hívják:** „Kétlépcsős azonosítás (2FA)” kapcsoló és „Jelszó módosítása” űrlap
- **Mire való:** A felhasználói fiók maximális biztonsági védelme mobiltelefonos hitelesítő kód (Google Authenticator, Microsoft Authenticator) bekapcsolásával.
- **Hol található a felületen:** A **„Biztonság”** lapfülön.
- **Hogyan használhatja a felhasználó:**
  1. Kattintson a **„Kétlépcsős azonosítás bekapcsolása”** gombra.
  2. Olvassa be a képernyőn megjelenő QR kódot a telefonos hitelesítő alkalmazással.
  3. Írja be a generált 6 jegyű ellenőrző kódot a megerősítéshez.
  4. Kattintson az **„Aktiválás”** gombra.
  - **Eredmény:** A 2FA azonnal élessé válik, a következő bejelentkezéskor a jelszó mellett a telefonos kód megadása is kötelező lesz.
