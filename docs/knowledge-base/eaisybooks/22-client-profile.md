# 📋 Ügyfél Profil és Törzsadatok (Client Profile)

> **Alkalmazás:** eaisyBooks  
> **Menücsoport:** Ügyfél Kontextus / Beállítások  
> **Szükséges szerepkör:** Minden könyvelői szerepkör (Irodavezető adminisztrátor, Szenior könyvelő, Könyvelő), aki jogosult a cég kezelésére  

---

## 1. Hol található? (Elhelyezkedés és Navigáció)

- **Oldalsáv pozíció:** Az eaisyBooks felületen egy adott cég kiválasztása után a bal oldali menüben a **Beállítások** vagy **Profil** menüpont (`/eaisybooks/:companyId/:dateRange/profile`).
- **Ikon:** Felhasználó / Cégprofil (`User` / `Building`) ikon
- **Elérési útvonal:** Portfólió → Ügyfél kiválasztása → Profil
- **Gyorsműveletek:** Kapcsolattartó adatainak mentése, értesítési csatornák (E-mail, SMS, Viber) beállítása, adóprofil és ÁFA gyakoriság ellenőrzése

---

## 2. A menü funkciója és célja

Az **Ügyfél Profil és Törzsadatok** oldal az adott vállalkozás hivatalos azonosítóinak, elsődleges kapcsolattartójának, értesítési preferenciáinak és számviteli adózási profiljának központi adatlapja.

### Fő feladatai és szerepe a könyvelési együttműködésben:
1. **Hivatalos cégadatok megjelenítése:** A vállalkozás törvényes neve, adószáma és egyedi rendszerazonosítója.
2. **Közvetlen ügyféli kapcsolattartó nyilvántartása:** A számlázásért és pénzügyekért felelős ügyvezető vagy pénzügyi munkatárs neve, e-mail címe és közvetlen telefonszáma.
3. **Kommunikációs csatornák és automatikus értesítések:** Meghatározza, hogy a havi számlabekérőket és riasztásokat milyen formában (E-mail, SMS, Viber, közvetlen telefon) kapja meg az ügyfél.
4. **Adóprofil összefoglaló:** Nyilvántartja a cég ÁFA alanyiságát (Általános, KATA, AAM), a bevallási gyakoriságot (havi, negyedéves, éves) és a helyi iparűzési adó kötelezettségét.

---

## 3. Mit lehet benne a felhasználónak csinálni?

### 3.1 Cégadatok Panel
- **Hogy hívják:** „Cég adatok” kártya
- **Mire való:** A vállalkozás hivatalos adatainak (cégnév, adószám, belső rendszerazonosító) leolvasása és ellenőrzése.
- **Hol található a felületen:** A képernyő bal felső dobozában.
- **Hogyan használhatja a felhasználó:**
  1. Olvassa le a **Cégnév** mezőt.
  2. Ellenőrizze az **Adószám** pontosságát (8 jegyű törzsszám és 11 jegyű teljes adószám).
  3. Szükség esetén másolja ki az egyedi **Visibill azonosítót** technikai támogatáshoz.
  - **Eredmény:** Pontos, hatósági adatokkal dolgozhat a könyvelési egyeztetések során.

### 3.2 Kapcsolattartó Adatlap és Mentés Gomb
- **Hogy hívják:** „Kapcsolattartó” panel, beviteli mezők és „Adatok mentése” gomb
- **Mire való:** Az ügyféloldali döntéshozó vagy pénzügyi felelős elérhetőségeinek karbantartása.
- **Hol található a felületen:** A képernyő jobb felső dobozában.
- **Hogyan használhatja a felhasználó:**
  1. Írja be a kapcsolattartó nevét a **„Kapcsolattartó neve”** mezőbe (pl. *Nagy Anna ügyvezető*).
  2. Adja meg a hivatalos e-mail címet az **„E-mail cím”** mezőben (ide érkeznek a bizonylatbekérők).
  3. Rögzítse a közvetlen mobilszámot a **„Telefonszám”** mezőben (pl. *+36 30 123 4567*).
  4. Kattintson a kék **„Adatok mentése”** gombra.
  - **Eredmény:** A gomb zöldre vált (*„Mentve!”*), és a rendszer a jövőben ezekre az elérhetőségekre küldi az összes automatikus értesítőt.

### 3.3 Adóprofil Összefoglaló
- **Hogy hívják:** „Adóprofil összefoglaló” kártya
- **Mire való:** A cég adózási jogállásának, ÁFA bevallási kötelezettségének és HIPA státuszának áttekintése.
- **Hol található a felületen:** A cégadatok és a kapcsolattartó panel alatt elhelyezkedő 3 oszlopos kártyablokk.
- **Hogyan használhatja a felhasználó:**
  1. Tekintse meg az **„ÁFA típus”** mezőt: jelzi, hogy a cég *Általános*, *KATA* vagy *Alanyi adómentes (AAM)* körbe tartozik-e.
  2. Ellenőrizze az **„ÁFA gyakoriság”** dobozt: mutatja, hogy a bevallást *Havi*, *Negyedéves* vagy *Éves* rendszerességgel kell benyújtani.
  3. Tekintse meg az **„Iparűzési adó”** állapotot (*Igen* / *Nem*).
  - **Eredmény:** A könyvelő azonnal látja a cég adózási keretrendszerét anélkül, hogy a NAV törzsadatbázisban kellene keresnie.

### 3.4 Kommunikációs Csatornák és Automatikus Emlékeztetők
- **Hogy hívják:** Kommunikációs kapcsolók (E-mail, SMS, Viber, Telefon) és „Automatikus emlékeztető” kapcsoló
- **Mire való:** Szabályozza, hogy az ügyfél milyen csatornákon és milyen automatizmussal kapjon figyelmeztetést a hiányzó bizonylatokról.
- **Hol található a felületen:** A kapcsolattartó doboz alján elhelyezkedő kapcsolósor.
- **Hogyan használhatja a felhasználó:**
  1. Jelölje be a kívánt kommunikációs csatornákat (pl. E-mail és SMS).
  2. Kapcsolja be az **„Automatikus emlékeztető”** kapcsolót, ha szeretné, hogy a rendszer a hónap 5. és 10. napján automatikusan kiküldje a hiányzó számlák listáját.
  3. Kattintson az **„Adatok mentése”** gombra.
  - **Eredmény:** A bizonylatbekérési folyamat automatizálttá válik.

---

## 4. Tipikus könyvelői munkafolyamatok (Workflow-k)

### 4.1 Kapcsolattartó váltás átvezetése
1. Az ügyfélcégnél új pénzügyi vezető érkezik, aki átveszi a számlázási feladatokat.
2. A könyvelő megnyitja az ügyfél **Profil** lapját.
3. Átírja a nevet, az új céges e-mail címet és telefonszámot.
4. Kattint az **„Adatok mentése”** gombra. Ezzel biztosítja, hogy a havi számlabekérők és ÁFA értesítők már az új kollégához menjenek.

### 4.2 ÁFA bevallási gyakoriság ellenőrzése év elején
1. Évváltáskor a könyvelő leellenőrzi, hogy az ügyfél átlépte-e a negyedévesből haviba váltás törvényi értékhatárát.
2. Megnyitja az **Adóprofil összefoglaló** kártyát, összeveti a korábbi év forgalmával és szükség esetén kezdeményezi az ÁFA gyakoriság módosítását.

---

## 5. Kapcsolódó jogszabályok és szakmai háttér

- **2007. évi CXXVII. törvény az általános forgalmi adóról (Áfa tv.):** Bevallási gyakoriság (havi, negyedéves, éves) meghatározása az éves adóalap alapján.
- **2017. évi CL. törvény az adózás rendjéről (Art.):** Hivatalos képviselet és kapcsolattartás szabályai.
- **1990. évi C. törvény a helyi adókról (Htv.):** Helyi iparűzési adó kötelezettség és bevallás.
