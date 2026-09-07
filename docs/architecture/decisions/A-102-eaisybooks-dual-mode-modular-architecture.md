# Architecture Decision Record (ADR)

# A-102: eaisyBooks Kettős Működési Mód (Dual-Mode Router), Kliens Kontextus és Hibrid Szerepkör Architektúra

**Státusz:** ✅ Decided  
**Dátum:** 2026-09-07  
**Kategória:** Frontend & Rendszer Architektúra  
**Kapcsolódó döntések:** [031](../../business/decisions/031-accounty-module.md), [054](../../business/decisions/054-eaisybooks-client-centric-navigation.md), [A-009](./A-009-auth-rbac.md), [A-013](./A-013-scoped-routing.md), [A-073](./A-073-eaisybill-eaisybooks-company-auto-sync.md), [A-079](./A-079-accounty-errorboundary-route-reset-and-prompt-rules-scoping.md)

---

## 1. Kontextus és Problémafelvetés

Az eaisyBooks (korábbi kódnevén: `Accounty`) eredetileg egy egyszerű kiegészítő felületként indult az eaisyBill mellett, amely elsősorban az ügyfélcégek listázására és a hiányzó számlák követésére szolgált. Az elmúlt fejlesztési ciklusokban azonban egy teljes értékű, többügyfeles könyvelőirodai ERP rendszerré nőtte ki magát:
- Megjelent a teljes körű bérszámfejtési modul 4 fázisú havi ciklussal és NAV 08 ÁNYK XML rekonstrukcióval.
- Bevezetésre került az Egyéni Vállalkozói (EV) és nonprofit egyszeres könyvvitel pénztárkönyvvel és 14 törvényes nyilvántartással.
- Kialakításra került a Társasági Adó (TAO) és Kisvállalati Adó (KIVA) követő és optimalizáló modul.
- Integrálódott a Cégkapu / KÜNY hivatalos tárhely és a NAV EGYKE képviseleti nyilvántartás.
- Cégre szabható könyvelési szabálytár (`company_prompt_rules`) jött létre az AI kontírozó irányítására.

Ez a méretnövekedés építészeti kihívásokat vetett fel:
1. **Navigációs torlódás:** A könyvelőnek egyszerre van szüksége átfogó irodai portfólió nézetre (ahol az összes cég határidejét és státuszát látja) és mélyfúrási ügyfél nézetre (ahol egy adott cég belső analitikáit böngészi).
2. **Környezetváltási nehézségek:** Ha a könyvelő a Bérszámfejtés oldalon dolgozott, és át akart térni egy másik ügyfél bérszámfejtésére, a korábbi rendszer visszadobta a kezdőoldalra.
3. **Merev jogosultságkezelés:** A korábbi 2-szintű szerepkör (`admin` / `könyvelő`) nem tudta kezelni a valós irodai hierarchiát (irodavezető, senior könyvelő, könyvelő, asszisztens), sem az egyedi megbízási igényeket (pl. egy asszisztens csak egy adott modulhoz kaphat írási jogot).

---

## 2. A Döntés

Elfogadtuk az **eaisyBooks Kettős Működési Mód (Dual-Mode Router) és Hibrid Szerepkör (Hybrid RBAC) Architektúráját**:

### 2.1. Dual-Mode Navigáció és Kliens Kontextus Scoping
A rendszer az `AccountyLayout` és az `accountyRoutes.tsx` rétegen keresztül két élesen elkülönülő módban működik:
1. **Portfólió Mód (`/eaisybooks/*`):**
   - Irodai szintű konszolidált nézetek: Portfólió Kanban/Grid/List, központi hiányzó számlák, jóváhagyási sor, NAV határidők és adónaptár, irodai riportok, AI asszisztens és rendszeradminisztráció.
   - A sidebar a portfólió menüpontjait rendereli.
2. **Ügyfél Kontextus Mód (`/eaisybooks/:companyId/:dateRange/*`):**
   - Egy adott ügyfélcég könyvelési környezete: áttekintés, számlák, tranzakciók, jóváhagyási sor, főkönyv, bérszámfejtés, EV könyvvitel, Cégkapu, képviselet és szabálytár.
   - A sidebar azonnal átvált az ügyfél almoduljaira, a fejlécében egy kiemelt "← Vissza a portfólióhoz" navigációs gombbal.
   - **Aloldal-megőrző `CompanySwitcher`:** A felső sávban található cégválasztó cégváltáskor megtartja az aktuális aloldal útvonalát és a kiválasztott dátumtartományt.

### 2.2. Négyszintű Szerepkör & Adatbázis-szintű Felülbírálat (Hybrid RBAC)
1. **Négy Irodai Szerepkör:**
   - `iroda_admin`: Teljes hozzáférés az iroda összes felületéhez, könyvelőkhöz és adminisztrációhoz.
   - `senior_könyvelő`: Riportok, jóváhagyási folyamatok, adónaptár és zárási felügyelet.
   - `könyvelő`: Hozzárendelt ügyfelek operatív könyvelése (számlák, tranzakciók, bérek, EV).
   - `asszisztens`: Részleges adatrögzítés, hiányzó bizonylatok követése és feltöltése.
2. **Dinamikus DB Felülbírálat (`accounty_module_permissions`):**
   - Az `iroda_admin` a `PermissionMatrixPage` felületen felhasználónként és modulonként felülbírálhatja az olvasási (`can_read`) vagy írási (`can_write`) jogot.
   - A `useAccountyPermissions` hook a prioritási lánc szerint dolgozik: DB override > Statikus szerepkör alapértelmezése.

### 2.3. Visszafelé Kompatibilitás és Márkanév Kezelés
- Hivatalos terméknév: `eaisyBooks`.
- A korábbi `/accounty/*` útvonalakat a router transzparensen átirányítja a megfelelő `/eaisybooks/*` célpontra.
- A kódbeli és adatbázis-szintű prefixek (`accounty_*` táblák, `AccountyLayout`, `useAccounty*` hookok) technikai örökségként stabilan megmaradnak.

---

## 3. Következmények és Előnyök

### Pozitív Következmények:
- **Átlátható Munkavégzés:** A könyvelő egyetlen kattintással mozoghat a madártávlati irodai áttekintés és az egyes cégek mély analitikái között.
- **Nulla Kontextusvesztés:** Az aloldal-megőrző cégváltó drasztikusan gyorsítja a kötegelt ügyféli feladatokat (pl. havi bérszámfejtési audit egymás után több cégnél).
- **Finomhangolható Biztonság:** Az irodavezetők rugalmasan oszthatnak ki jogosultságokat anélkül, hogy merev szerepkörökbe kényszerülnének.
- **Hibaelhatárolás:** Az ADR A-079 route-reset funkcióval ellátott hibakerete garantálja, hogy egy-egy specifikus modul hiba ne blokkolja a könyvelő teljes irodai munkáját.

### Trade-off-ok és Megfontolások:
- Kétféle útvonalstruktúra párhuzamos létezése a rendszerben (az eaisyBill `/:companyId/:dateRange/*` és az eaisyBooks `/eaisybooks/...`), amit a `RootRedirect` és az `AppModeSwitcher` komponensek fognak össze.
- A frontend és a backend lekérdezéseknek mindig ellenőrizniük kell az `accounty_assignments` és `accounty_module_permissions` táblákat a jogosultság-ellenőrzés során.
