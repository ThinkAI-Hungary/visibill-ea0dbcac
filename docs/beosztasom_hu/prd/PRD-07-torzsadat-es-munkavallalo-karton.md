# PRD-07: Törzsadat-kezelés és Munkavállalói Mesterkarton

[Előző: PRD-06 Jelenlét és Export](./PRD-06-jelenlet-zaras-es-berszamfejtesi-export.md) · [Vissza a PRD Indexhez](./INDEX.md) · [Következő: PRD-08 Dolgozói Önkiszolgáló](./PRD-08-dolgozoi-onkiszolgalo-es-mobil-nezet.md)

---

## 1. Termék- és Funkciócélkitűzés

A **Törzsadat-kezelés és Munkavállalói Mesterkarton** modul biztosítja a beosztástervezéshez, jelenléti adminisztrációhoz és bérszámfejtési feladáshoz szükséges alapadatok pontos nyilvántartását. Itt kezelhetők a cég telephelyei (munkahelyek), a színkódolt munkakörök, valamint a dolgozók teljes körű személyi, jogviszonyi, munkaügyi és szabadság-paraméterei.

### 1.1 Kiemelt Felületi Értékajánlat
- **6-Füles Munkavállalói Mesterkarton:** Egyetlen professzionális felületen áttekinthető minden munkavállaló aladatai, jogviszonya, Mt. szabályai, szabadságkerete és munkaidőkerete.
- **Rugalmas Szabályfelülbírálás Dolgozónként:** Lehetőség van a dolgozó egyedi szerződéséhez (pl. osztott pihenőidő, 12 órás készenlét, fiatalkorú védelem) igazítani az ellenőrzött szabályokat.
- **Színkódolt Munkakörök és Telephelyek:** Vizuális megkülönböztetés a naptárrácsban (pl. Pultos = Kék, Szakács = Sárga).

---

## 2. Képernyőszerkezet és Munkavállalói Lista

A Munkavállalók menüpontban egy teljesítmény-optimalizált (1 másodperc alatti betöltésű, lapozható) táblázat listázza a cég dolgozóit (`MV-01`):

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ MUNKAVÁLLALÓK LISTÁJA    [🔍 Keresés névre/adóazonosítóra...]   [🏢 Telephely ▾]   [+ Új Dolgozó]│
├───────────────────┬──────────────┬──────────────┬──────────────┬─────────────┬─────────┤
│ Név               │ Munkakör     │ Telephely(ek)│ Heti óraszám │ Szabadság   │ Művelet │
├───────────────────┼──────────────┼──────────────┼──────────────┼─────────────┼─────────┤
│ Kovács István     │ Pultos       │ Nagy Sándor  │ 40 óra (FT)  │ 18 / 23 nap │ ✏️ 🗑️    │
│ Nagy Éva          │ Szakács      │ Kőrösi üzlet │ 40 óra (FT)  │ 8 / 21 nap  │ ✏️ 🗑️    │
│ Szabó Péter       │ Felszolgáló  │ Mindkettő    │ 20 óra (RT)  │ 12 / 20 nap │ ✏️ 🗑️    │
└───────────────────┴──────────────┴──────────────┴──────────────┴─────────────┴─────────┘
```

---

## 3. A 6-Füles Munkavállalói Mesterkarton Specifikációja (`EmployeeCardDrawer`)

Egy munkavállaló sorára kattintva a jobb oldalról becsúszó, fülekre osztott szerkesztőpanel jelenik meg:

### 3.1 1. Fül: Alapadatok és Elérhetőségek (`GeneralInfoTab`)
- **Személyes azonosítók:** Viselt név, Születési név, Anyja születési neve, Születési hely és idő.
- **Hivatalos azonosítók:** Adóazonosító jel (10 számjegy, algoritmusos ellenőrzéssel), TAJ szám (9 számjegy, CDV ellenőrzéssel).
- **Elérhetőségek:** E-mail cím (értesítésekhez), Telefonszám, Állandó lakcím.
- **Rendszernyelv:** Magyar / Angol felület és értesítési nyelv (`R-04`).

### 3.2 2. Fül: Jogviszony és Munkaidő Norma (`EmploymentTab`)
- **Jogviszony típusa:** Munkaszerződés (alapeset), Egyszerűsített foglalkoztatás (alkalmi munka / EFO), Megbízási szerződés, Diákmunka / Tanulószerződés, Nyugdíjas munkavállaló.
- **Időtartam:** Jogviszony kezdete (dátum), Jogviszony vége (határozott idő esetén), Próbaidő lejárata.
- **Munkaidő norma:**
  - Heti kötelező óraszám: pl. 40 óra (teljes munkaidő) vagy 20/30 óra (részmunkaidő).
  - Napi norma: pl. 8.0 óra/nap (részmunkaidőnél arányosan 4.0 vagy 6.0 óra).
  - Munkarend típusa: Általános munkarend vs. Egyenlőtlen munkaidő-beosztás.

### 3.3 3. Fül: Szabadságkeret és Egyenlegek (`LeaveBalanceTab`)
- **Éves alapszabadság:** Törvényi 20 munkanap.
- **Életkor szerinti pótszabadság:** A születési dátum alapján automatikusan kalkulált pótnapok (25 év felett 1 nap ... 45 év felett 10 nap).
- **Gyermekek utáni pótszabadság:** Gyermekek száma alapján (1 gyermek: 2 nap, 2 gyermek: 4 nap, 3+ gyermek: 7 nap).
- **Egyéb pótszabadságok:** Fiatal munkavállaló, megváltozott munkaképesség, apasági napok.
- **Egyenleg számláló:**
  `Összes kivehető nap` - `Kivett napok` = `Hátralévő szabadságnapok`.
- **Kapcsoló:** *„Negatív egyenleg engedélyezése”* (ha a cég megengedi az előrehozott szabadságot `TL-07`).

### 3.4 4. Fül: Munkaidőkeret Konfiguráció (`WorkHoursFrameworkTab`)
- **Keret alkalmazása:** Jelölőnégyzet: *„A dolgozó munkaidőkeretben dolgozik”*.
- **Keret időtartama:** 1, 2, 3, 4 vagy 6 hónapos ciklus (Mt. 94. §).
- **Aktuális keret kezdete és vége:** tól–ig dátum (pl. `2026.09.01 - 2026.11.30`).
- **Összes keretóra:** A keretbe eső általános munkanapok száma × napi norma óra (pl. 65 munkanap × 8h = 520 óra).
- **Egyenlegkövetés a felületen:** A havi naptárrácsban folyamatosan mutatja a még ledolgozandó keretórákat (`BK-21`).

### 3.5 5. Fül: Munkaügyi Szabályok és Felülbírálások (`ComplianceTab`)
Dolgozónként egyedileg ki- és bekapcsolható ellenőrzések:
- ☑️ Napi 11 órás pihenőidő ellenőrzése
- ☑️ Heti 48 órás pihenőidő ellenőrzése
- ☑️ 6 egymást követő munkanap utáni pihenőnap kötelezettség
- ☑️ Napi 12 órás maximális munkaidő korlát
- ☑️ Vasárnapi munkavégzés engedélyezése / tiltása
- ☑️ Éjszakai munka tilalma (kismamák és fiatalkorúak esetén kötelezően bekapcsolva!)

### 3.6 6. Fül: Beosztási Igények és Helyettesítés (`PreferencesTab`)
- **Helyettesítő partnerek („Párok”):** Elsődlegesen kijelölt kollégák, akik kiesés esetén automatikusan helyettesíthetik egymást (`BK-53`).
- **Egyedi dolgozói igények:** Preferált műszakok (pl. *„Csak délelőttös műszak”*), kizárt napok (pl. *„Hétfőn egyetemi oktatás miatt nem osztható be”*).

---

## 4. Telephelyek és Munkakörök Kezelése (`WorkplacesAndJobs`)

### 4.1 Telephelyek (Munkahelyek) Modul
- Céges üzletek és telephelyek felvitele (Név, Cím, Nyitvatartási intervallum, Alapértelmezett minimális létszámigény).
- Munkavállalók hozzárendelése: egy dolgozó egy vagy több telephelyhez is hozzárendelhető (pl. mozgó dolgozók).

### 4.2 Munkakörök Modul
- Munkaköri megnevezés (pl. *Pultos*, *Konyhai kisegítő*, *Üzletvezető*).
- **Színválasztó (Color Picker):** Szemantikus színkód hozzárendelése, amely a naptárrács műszakkártyáinak háttérszínét adja.
- Munkaköri pótlék-jogosultságok (pl. egészségügyi kockázati pótlék).

---

## 5. A 4 Kötelező UI Állapot

1. **Betöltési Állapot:** A dolgozói lista megnyitásakor kompakt táblázatszkeleton töltődik be (&lt;300ms alatt akár 500 dolgozó esetén is, lapozással).
2. **Üres Állapot:** Ha a céghez még nincs dolgozó rögzítve: *„Még nincsenek munkavállalók a rendszerben. Kattintson az Új munkavállaló gombra, vagy importáljon dolgozókat Excelből!”*.
3. **Sikeres Állapot:** Mentés után a fiók bezárul, a táblázat frissül, és zöld toast igazol: *„Munkavállaló adatai sikeresen mentve!”*.
4. **Hibaállapot (Adószám / TAJ validáció):**
   - Érvénytelen adóazonosító vagy TAJ szám beírásakor a mező alatt azonnali piros ellenőrző hibaüzenet jelenik meg, megakadályozva a hibás bérszámfejtési adatfeladást.
