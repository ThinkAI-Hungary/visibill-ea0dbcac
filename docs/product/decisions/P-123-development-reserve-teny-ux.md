# P-123: Fejlesztési Tartalék és Tárgyi Eszköz Nyilvántartás (TENY) Összekapcsolása UX

**Állapot:** Elfogadva (Decided)  
**Dátum:** 2026-09-27  
**Döntéshozó:** Product & Accounting Lead  
**Érintett modulok:** TENY (`/teny`), Tárgyi Eszköz Aktiválás (`AssetActivationDialog`), Eszköz Részletező Panel (`AssetDetailPanel`), Kettős Értékcsökkenés (`DepreciationCards`), Aktiválási Jegyzőkönyv (`assetActivationProtocolPdf`).

---

## 1. Háttér és Üzleti Kontextus

A magyar társasági adó törvény (Tao. tv. 7. § (1) f) és 7. § (15) bek.) szerint a gazdálkodók a jövőbeli beruházásaikra tekintettel **fejlesztési tartalékot képezhetnek** (eredménytartalékból lekötött tartalékba helyezéssel, 414-es főkönyvi számlán).
* **Adóelőny:** A képzett összeg az adóévben közvetlenül csökkenti a társasági adóalapot (előrehozott adókedvezmény).
* **Felhasználási kötelezettség:** A képzést követő 4 adóéven belül a lekötött összeget tárgyi eszköz beruházásra / aktiválásra kell felhasználni.
* **Kritikus szabály a TENY-ben:** Mivel a cég a fejlesztési tartalék képzésekor az adóalap-csökkentést már érvényesítette, a fejlesztési tartalékból megvalósított tárgyi eszköz után **a Tao. törvény szerinti értékcsökkenési leírás (Tao ÉCS) MÁR NEM számolható el** (Tao. tv. 7. § (15) bek.).
  * A számviteli törvény (Sztv.) szerinti értékcsökkenés továbbra is a teljes bekerülési értékre fut (könyvelési költségként).
  * A Tao szerinti értékcsökkenés alapja viszont csökken a felhasznált fejlesztési tartalék összegével. Ha 100%-ban fejlesztési tartalékból valósult meg, a Tao ÉCS havi és halmozott összege 0 Ft.

---

## 2. Felhasználói Igények és Szerepkörök

1. **Könyvelő:**
   * Nyilván szeretné tartani cégenként az egyes években képzett fejlesztési tartalékokat, azok lejárati határidejét (képzés éve + 4 év), a már felhasznált összegeket és a még szabadon beruházható keretet.
   * Új eszköz aktiválásakor egyetlen kattintással ki akarja választani a szabad fejlesztési tartalék keretet.
   * Elvárja, hogy a rendszer automatikusan kezelje a Tao ÉCS korrekciót (0 Ft vagy arányosan csökkentett adóalap).
   * Az aktiválási jegyzőkönyvben (PDF) látni akarja a törvényes hivatkozást.
2. **Cégvezető / Pénzügyi vezető:**
   * Látni akarja, hogy a korábban lekötött fejlesztési tartalékból mennyi forrás áll még rendelkezésre beruházásokra, nehogy kifussanak a 4 éves határidőből és késedelmi pótlékos adófizetésre kényszerüljenek.

---

## 3. UI/UX Tervezet

### 3.1 TENY Főoldal: Két Lapfül (`/teny`)
* **Lapfül 1: „Tárgyi eszközök” (`/teny?tab=assets`):** A meglévő Master-Detail eszköznyilvántartás. A táblázatban megjelenik egy opcionális badge/oszlop: `Fejlesztési tartalék` (ha az eszköz ilyen forrásból valósult meg).
* **Lapfül 2: „Fejlesztési tartalékok” (`/teny?tab=development_reserves`):**
  * **Összesítő kártyák:**
    * Összes képzett fejlesztési tartalék
    * Eddig felhasznált összeg
    * Aktuális szabad beruházási keret
    * Következő lejáró keret összege és határideje
  * **Keretek táblázata:**
    * Képzés éve (pl. 2023)
    * Eredeti összeg (Ft)
    * Felhasznált összeg (az eszközökhöz allokált összegek automatikus szummája)
    * Szabad keret (Ft)
    * Felhasználási határidő (pl. 2027. dec. 31.)
    * Státusz: `Aktív` (zöld), `Kimerült` (kék), `Lejárt` (piros)
  * **„+ Új fejlesztési tartalék” gomb és modális ablak:**
    * Képzés éve (évszám)
    * Összeg (Ft)
    * Megjegyzés / Határozat száma

### 3.2 Tárgyi Eszköz Aktiválási Varázsló (`AssetActivationDialog`)
* Új szekció az aktiválási űrlapon:
  * Checkbox: `Fejlesztési tartalék felhasználásával valósult meg`
  * Bekapcsolásakor megjelenő mezők:
    * **Keret kiválasztása:** Dropdown a cég szabad fejlesztési tartalékaival (pl. `2023. évi keret — Szabad: 6 500 000 Ft (Lejárat: 2027.12.31.)`).
    * **Felhasznált összeg (Ft):** Alapértelmezetten a bekerülési érték (vagy a még szabad keret maximuma). Részleges fedezet esetén tetszőlegesen módosítható (pl. 10 milliós gépből 4 millió Ft tartalék).
    * Figyelmeztető felirat: *"A Tao. tv. 7. § (15) bek. alapján a felhasznált összegre a társasági adó szerinti értékcsökkenés nem számolható el."*

### 3.3 Eszköz Részletező Panel (`AssetDetailPanel` & `DepreciationCards`)
* A Kettős Értékcsökkenés (Amortizáció) kártyán:
  * **Számviteli ÉCS:** Bekerülési érték alapján változatlanul ketyeg.
  * **Tao ÉCS kártyán:**
    * Jelölés: `Fejlesztési tartalék: [Összeg] Ft`
    * `Tao ÉCS alap: [Bekerülési érték - Tartalék] Ft`
    * Ha 100%-ban abból fedezve: kiemelt zöld/kék infó badge: `Tao ÉCS: 0 Ft (Teljes egészében fejlesztési tartalék terhére elszámolva)`.

### 3.4 Aktiválási Jegyzőkönyv Generálás (PDF)
* A 3. Aktiválási adatok blokk kiegészül:
  * `Finanszírozási forrás / Fejlesztési tartalék:` `X Ft (YYYY. évi keretből — Tao. tv. 7. § (15))`

### 3.5 Utólagos Hozzárendelés és Módosítás (`DevelopmentReserveAssignDialog`)
* Az `AssetDetailPanel`-ben új akciógomb és kezelőfelület:
  * Már aktivált eszközökhöz utólag is hozzárendelhető fejlesztési tartalék keret, vagy leválasztható onnan.
  * Valós idejű keretellenőrzés (szabad keret + eszköz által jelenleg használt keret).
  * Automatikusan újragenerálja a csatolt aktiválási jegyzőkönyv PDF-et.

### 3.6 Automatikus Főkönyvi Könyvelés (`postDevelopmentReserveReleaseToLedger`)
* Tárgyi eszköz aktiválásakor vagy utólagos tartalék összekapcsolásakor automatikusan elkészül a Vegyes napló tétel:
  * **T 414 (Lekötött tartalék)** — **K 413 (Eredménytartalék)**
  * Bizonylatszám: `FT-FELOLD-[Leltári szám]`
  * Tartalék leválasztásakor vagy nullázásakor a korábbi tételt a rendszer visszavonja/törli (`removeDevelopmentReservePosting`).

### 3.7 Tao Éves Zárás Varázsló Integráció (`TaoYearEndWizardPage`)
* A Tao éves bevallás összeállításakor a rendszer automatikusan felajánlja a TENY és fejlesztési tartalék adatokat:
  * **1. lépés (Beszámoló):** Számviteli ÉCS leírás átvétele a TENY-ből.
  * **3. lépés (7. § Csökkentő tételek):**
    * Fejlesztési tartalék képzés (7. § (1) f)) automatikus átvétele az adóévben képzett keretekből.
    * Adó szerinti ÉCS (7. § (1) d)) automatikus átvétele a tartalékkal csökkentett alapok alapján.
  * **4. lépés (8. § Növelő tételek):** Számviteli vs. Adó ÉCS különbözet (8. § (1) b)) automatikus betöltése.

---

## 4. Kapcsolódó Dokumentáció és Döntések
- [A-164: Fejlesztési Tartalék és Tárgyi Eszközök Adatmodell, ÉCS Kalkuláció és API](../../architecture/decisions/A-164-development-reserve-fixed-assets-db-and-depreciation.md)
- [10-assets: Tárgyi Eszközök Adatbázis Séma](../../architecture/database/10-assets.md)
- [P-052: Tárgyi Eszközök Projektekhez Rendelése (TENY Project Assignment) UX](./P-052-fixed-assets-project-assignment-ux.md)

