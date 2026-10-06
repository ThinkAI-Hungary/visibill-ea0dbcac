# PRD Tisztasági Audit és Technikai Szivárgás-Megelőzés
## (PRD Purity Audit: Zero ADR, Zero Physical SQL/DDL, Zero Backend Code)

Ez az ellenőrző lista garantálja, hogy a létrehozott **PRD (Termékkövetelmény Dokumentáció)** csomag **kizárólag felületi, termékműködési és felhasználói interakciós követelményeket** tartalmazzon, és semmilyen technikai megvalósítási részlet (fizikai adatbázis DDL, SQL parancsok, backend implementáció vagy homályos technikai szleng) ne szivárogjon be.

---

## 🏛️ 1. A Három Dokumentumtípus Szigorú Elhatárolása

| Dokumentum Típus | Fő Kérdés | Miről Szól? | Mi Tilos Benne? |
|:---|:---:|:---|:---|
| **BRD** *(Üzleti Követelmény)* | **MIT & MIÉRT?** | • Üzleti célok, piaci problémák, értékajánlat<br>• Szereplők, felelősségek és felhasználói utak<br>• Üzleti szabályok, jogszabályi előírások, számítások<br>• Hatósági és belső kimenetek elvárásai | • Adatbázis sémák, SQL, DDL, táblák, kulcsok (ADR)<br>• Képernyőtervek, mezővalidációs hibaüzenetek (PRD)<br>• Fejlesztői technikai fuzzy szövegek ("egy async taskkal")<br>• Angol technikai kódnevek és hunglish |
| **PRD** *(Termékkövetelmény)* | **HOGYAN MŰKÖDIK A TERMÉK ÉS A FELÜLET?** | • Képernyőtervek, UI elrendezések, komponensek viselkedése<br>• Űrlapmezők pontos típusai, megkötései, hibaüzenetei<br>• A 4 kötelező UI állapot (betöltés, üres, siker, hiba)<br>• Interakciók, gyorsbillentyűk, double-submit védelem | • Fizikai adatbázis sémák, DDL (`CREATE TABLE`, `uuid`)<br>• Backend kód, tárolt eljárások (`SECURITY DEFINER`, RPC)<br>• Fizikai adatbázis indexelési és particionálási döntések<br>• Angol kódnevek és LaTeX formázás |
| **ADR** *(Architektúrális Döntés)* | **HOGYAN ÉPÜL FEL A KÓDBAN?** | • Technológiai keretrendszer választás (React, Deno, Postgres)<br>• Fizikai adatbázis táblák, DDL, oszloptípusok, RLS, RPC<br>• Hálózati protokollok, microservice/worker architektúra | • Felületi követelmények újrafogalmazása<br>• Nem-technikai vezetői szövegezés |

---

## 🚫 2. Szigorúan Tilos Elemek a PRD-ben (Tiltólista)

| Kategória | Szigorúan Tilos Minták / Kifejezések | Helyes Termék / Felületi Megfelelő a PRD-ben |
|:---|:---|:---|
| **Adatbázis / SQL (ADR)** | `CREATE TABLE`, `ALTER TABLE`, `REFERENCES`, `FOREIGN KEY`, `PRIMARY KEY`, `uuid`, `timestamptz`, `boolean`, `integer`, snake_case táblanevek (pl. `company_users`) | *Mezőspecifikációs táblázat: Szöveg, Szám, Dátum, Logikai érték; UI Komponensek, Entitások* |
| **RPC / Backend Logika (ADR)** | `SECURITY DEFINER`, `SECURITY INVOKER`, `CREATE FUNCTION`, `RETURNS jsonb`, `pg_proc`, `SET search_path` | *„Üzleti számítási szabályok”, „Kliensoldali érvényesítés”, „Backend szolgáltatás hívása mentéskor”* |
| **Jogosultság / RLS (ADR)** | `ENABLE ROW LEVEL SECURITY`, `CREATE POLICY`, `auth.uid()`, `USING (...)`, `WITH CHECK (...)` | *„Szerepkör-alapú jogosultságkezelés (Megtekintő, Tervező, Adminisztrátor)”, „Képernyőelemek feltételes megjelenítése”* |
| **Technikai Fuzzy Szövegek** | *„Majd egy cron job lehúzza a queue-ból”, „A controllerben megoldjuk”, „Egy aszinkron taskkal elintézzük”, „Majd egy libbel felrajzoljuk”* | *„Időzített háttérfolyamat”, „A beépített érvényesítési motor valós időben jelzi”, „Interaktív diagramkomponens”* |
| **LaTeX Formázás** | `$\rightarrow$`, `\approx`, `\le`, `\ge`, `\times` | Tiszta Unicode szimbólumok: `→`, `≈`, `≤`, `≥`, `×` |
| **Angol Címkék & Hunglish** | `Shift (Műszak)`, `AttendanceDay`, `generálja a shiftet`, `validálja a formot` | Tiszta magyar kifejezések: *„Műszak”, „Jelenléti nap”, „Létrehozza a beosztást”, „Ellenőrzi az űrlapot”* |

---

## ✅ 3. Kötelező Elemek Minden PRD Rekordban

1. **Fejléc Navigáció:**
   `[Előző rekord] · [Vissza a PRD Indexhez](./INDEX.md) · [Következő rekord]`
2. **Képernyőelrendezési Vázlat:**
   Szöveges vagy ASCII elrendezés (Fejléc, Szűrősáv, Munkaterület, Oldalsó sávok, Alsó összesítők).
3. **Vizuális Felületi Mockup (baoyu-diagram):**
   Vektoros SVG és nagyfelbontású `@2x.png` beágyazás a `./diagramms/` alkönyvtárból.
4. **Pontos Mezőspecifikációs Táblázat:**
   Mezőnév, Típus, Validációs szabályok és korlátok, Alapértelmezett érték, Hibaüzenet, Kapcsolódó követelmény ID.
5. **A 4 Kötelező UI Állapot:**
   - **Betöltési Állapot (Skeleton Loader):** Felületi rácsminta animált szürke vázakkal;
   - **Üres Állapot (Empty State):** Szemléletes illusztráció, magyarázó szöveg és elsődleges CTA gomb;
   - **Sikeres Állapot (Optimistic UI & Toast):** Azonnali vizuális frissülés és zöld visszajelző toast;
   - **Hibaállapot (Inline & Retry):** Mezőszintű piros kiemelés, hibaüzenet és hálózati hiba esetén `Újrapróbálkozás` lehetőség.
6. **Felhasználói Interakciók és Gyorsbillentyűk:**
   Kattintások, lebegő buborékok, billentyűkombinációk, kijelölési módok, double-submit védelem.
7. **Elfogadási Kritériumok (Definition of Done):**
   Egyértelmű ellenőrző lista a felület és a funkció elkészültének igazolására.

---

## 📋 4. A Tisztasági Audit Lépései

Minden PRD generálás vagy módosítás után kötelező lefuttatni a tisztasági auditot:

1. **Automatizált ellenőrzés a `verify_prd.py` szkripttel:**
   ```powershell
   python "<skill_eleresi_ut>/scripts/verify_prd.py" "<prd_mappa>"
   ```
2. **Kód- és DDL-mentesség:** Nincs benne egyetlen SQL parancs, DDL kulcsszó vagy backend implementációs kód.
3. **Nyelvi fegyelem:** Tiszta, egységes magyar felületi szaknyelv, hunglish halmozás nélkül.
4. **Link- és kép-integritás:** Minden hivatkozás működik, minden diagramnak létezik az SVG és `@2x.png` változata a `diagramms/` mappában.
5. **Csendes belső minőségi kapu (Zéró Fájlszemét):** Az auditot az ágens csendben, a háttérben futtatja le. **Szigorúan tilos külön audit jelentés fájlt (`*_TISZTASAGI_AUDIT_JELENTES.md`) létrehozni a dokumentációs mappában!** Ha a vizsgálat hibát vagy szivárgást észlel, azt csendben javítani kell a forrásrekordban.
