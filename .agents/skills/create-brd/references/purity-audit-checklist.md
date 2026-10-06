# BRD Tisztasági Audit és Technikai Szivárgás-Megelőzés
## (BRD Purity Audit: Zero ADR, Zero PRD, Zero Technical Fuzzy Text)

Ez az ellenőrző lista garantálja, hogy a létrehozott BRD dokumentáció **kizárólag üzleti követelményeket, jogszabályokat, munkafolyamatokat és felületi elvárásokat** tartalmazzon, és semmilyen technikai megvalósítási részlet (ADR, PRD, adatbázis-séma, API kód vagy homályos fejlesztői szleng) ne szivárogjon be.

---

## 🏛️ 1. A Három Dokumentumtípus Szigorú Elhatárolása

| Dokumentum Típus | Fő Kérdés | Miről Szól? | Mi Tilos Benne? |
|:---|:---:|:---|:---|
| **BRD** *(Üzleti Követelmény Dokumentum)* | **MIT & MIÉRT?** | • Üzleti célok, piaci problémák, értékajánlat<br>• Szereplők, felelősségek és felhasználói utak<br>• Üzleti szabályok, jogszabályi előírások, számítások<br>• Hatósági és belső kimenetek, adatátadási elvárások | • Adatbázis sémák, SQL, DDL, táblák, kulcsok (ADR)<br>• REST végpontok, HTTP státuszkódok, UI propok (PRD)<br>• Fejlesztői technikai fuzzy szövegek ("egy async taskkal")<br>• Angol technikai kódnevek és hunglish |
| **PRD** *(Termékkövetelmény Dokumentum)* | **HOGYAN MŰKÖDIK A TERMÉK?** | • Képernyőtervek, UI komponensek viselkedése<br>• Űrlapmezők pontos validációi és hibaüzenetei<br>• Felhasználói interakciók és állapotátmenetek | • Adatbázis szintű fizikai optimalizáció, indexelés<br>• Architektúrális kód-implementációs döntések |
| **ADR** *(Architektúrális Döntési Rekord)* | **HOGYAN ÉPÜL FEL A KÓDBAN?** | • Technológiai keretrendszer választás (React, Deno, Postgres)<br>• Adatbázis fizikai sémák, táblák, idegen kulcsok, RLS, RPC<br>• Hálózati protokollok, microservice/worker architektúra | • Üzleti igények újrafogalmazása<br>• Nem-technikai vezetői szövegezés |

---

## 🚫 2. Szigorúan Tilos Elemek a BRD-ben (Tiltólista)

| Kategória | Szigorúan Tilos Minták / Kifejezések | Helyes Üzleti Megfelelő a BRD-ben |
|:---|:---|:---|
| **Adatbázis / SQL (ADR)** | `CREATE TABLE`, `ALTER TABLE`, `REFERENCES`, `FOREIGN KEY`, `PRIMARY KEY`, `uuid`, `timestamptz`, `boolean`, `integer`, snake_case táblanevek (pl. `company_users`) | *„Munkatársak nyilvántartása a céghez rendelve”, „Adatcsoportok és attribútumok”* |
| **RPC / Backend Logika (ADR)** | `SECURITY DEFINER`, `SECURITY INVOKER`, `CREATE FUNCTION`, `RETURNS jsonb`, `pg_proc`, `SET search_path` | *„Üzleti számítási szabályok”, „Rendszerszintű érvényesítési motor”* |
| **Jogosultság / RLS (ADR)** | `ENABLE ROW LEVEL SECURITY`, `CREATE POLICY`, `auth.uid()`, `USING (...)`, `WITH CHECK (...)` | *„Többcéges adatszigetelés és szerepkör-alapú hozzáférés-szabályozás”* |
| **API / Hálózat (PRD/ADR)** | `GET /api/v1/...`, `POST /items`, `HTTP 200 OK`, `HTTP 400 Bad Request`, `Bearer token`, `JSON payload` | *„Szabványos elektronikus adatátadási interfész (Data Contract)”* |
| **Technikai Könyvtárak & Kód** | `import React from 'react'`, `FastAPI`, `Deno.serve`, `npm install`, `@tanstack/react-table`, `Zod schema` | *„Virtuális táblázatmegjelenítés”, „Adatérvényesítési szabályok”* |
| **Technikai Fuzzy Szövegek** | *„Majd egy cron job lehúzza a queue-ból”, „A controllerben megoldjuk”, „Egy aszinkron taskkal elintézzük”, „Majd egy libbel felrajzoljuk”* | *„Automatikus időzített feldolgozás a határidő lejárta után”, „A beépített szabálymotor valós időben értékeli ki”* |
| **LaTeX Formázás** | `$\rightarrow$`, `\approx`, `\le`, `\ge`, `\times` | Tiszta Unicode szimbólumok: `→`, `≈`, `≤`, `≥`, `×` |
| **Angol Címkék & Hunglish** | `Workplace (Munkahely)`, `JobPosition`, `Shift`, `AttendanceDay`, `generálja a shiftet`, `validálja a requestet` | Tiszta magyar kifejezések: *„Munkahely”, „Munkakör”, „Műszak”, „Jelenléti nap”* |

---

## 📋 3. A Tisztasági Audit Lépései

Minden BRD generálás vagy módosítás után kötelező lefuttatni a tisztasági auditot:

1. **Automatizált ellenőrzés a `verify_brd.py` szkripttel:**
   ```powershell
   python "<skill_eleresi_ut>/scripts/verify_brd.py" "<brd_mappa>"
   ```
2. **Kód- és végpontmentesség:** Nincs benne egyetlen SQL parancs, API végpont, vagy kódimport sem.
3. **Nyelvi fegyelem:** Tiszta, egységes magyar szaknyelv, hunglish és zárójeles angol halmozás nélkül.
4. **Link- és kép-integritás:** Minden hivatkozás működik, minden diagramnak létezik az SVG és `@2x.png` változata.
5. **Csendes belső minőségi kapu (Zéró Fájlszemét):** Az auditot az ágens csendben, a háttérben futtatja le. **Szigorúan tilos külön audit jelentés fájlt (`*_TISZTASAGI_AUDIT_JELENTES.md`) létrehozni a dokumentációs mappában!** Ha a vizsgálat hibát vagy szivárgást észlel, azt csendben javítani kell a forrásrekordban.

