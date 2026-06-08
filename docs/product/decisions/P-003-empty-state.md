# P-003: Empty State Dashboard & Onboarding Wizard

**Status:** Decided  
**Category:** Onboarding & Első Élmény  
**BRD Reference:** Decision 038

**Question:** Mit lát a felhasználó, ha még nincs cége a rendszerben? Hogyan épül fel az első konfigurációs folyamat?

**Decision:**

A főoldal (Dashboard) helyett egy elsötétített teaser háttér előtt megjelenő modal alapú, 4-lépéses Onboarding Wizard (`EmptyStateDashboard.tsx`) vezeti végig a felhasználót a kezdeti cég- és rendszerkonfiguráción.

## Onboarding Wizard Felépítése és Lépései

### 1. Üdvözlő képernyő (Welcome)
A felhasználó egy barátságos üdvözlést kap, ahonnan elindíthatja az első lépéseket, vagy a bal felső sarokban található ikonnal kijelentkezhet.

### 2. Step 1: Cég hozzáadása (Kötelező)
Két opció közül választhat:
- **Új cég regisztrációja:** Megadja a cég nevét, adószámát (8 számjegy) és székhelyét. A mentés után ő lesz a cég tulajdonosa (`owner`).
- **Csatlakozás meglévőhöz:** Megadja a cégtulajdonos által generált 6 karakteres csatlakozási kódot (share token). Sikeres csatlakozás után `member` szerepkört kap a cégben.

### 3. Step 2: Projektek (Opcionális)
Lehetőség van egy vagy több projekt gyors létrehozására (név, ügyfél neve, rövid leírás és kiinduló státusz megadásával), amelyek a számlák és kiadások későbbi csoportosítására szolgálnak.

### 4. Step 3: Kategóriák (Opcionális)
Költség kategóriák (pl. Irodaszer, Marketing) és a hozzájuk kapcsolódó automatikus felismerést segítő kulcsszavak megadása.

### 5. Step 4: NAV Integráció (Opcionális)
A NAV Online Számla rendszer technikai felhasználói adatainak (felhasználónév, adószám, jelszó, aláíró kulcs, cserekulcs) megadása és validálása.

## Technikai Háttérfolyamatok a Befejezéskor

A "Befejezés" gombra kattintva a következő folyamatok futnak le:
1. **Adatbázis mentés:** A cég, a tagság, a projektek és a kategóriák rekordjai bekerülnek a Supabase adatbázisba.
2. **NAV adatok mentése:** A megadott NAV kulcsok a biztonságos `save-credentials` Edge Function segítségével titkosítva elmentődnek a Supabase Vault-ba.
3. **Háttérszinkronizáció:** Sikeres kapcsolat esetén a rendszer a háttérben azonnal elindítja a számlák lekérését a megelőző 90 napra vonatkozóan. A NAV API 35 napos korlátja miatt az időszak 3 különálló chunkra (35, 35 és 20 nap) van osztva, amelyek egymás után, aszinkron Promise.all hívásokkal futnak le.
4. **Vezérlőpult aktiválása:** A rendszer frissíti a céglistát, kiválasztja az aktív céget, bezárja a modalt, és automatikusan elindítja a 13-lépéses interaktív Product Tour-t.

## Rollback és Hibakezelés
Ha a cég sikeresen létrejött, de a NAV adatok mentése vagy a kategóriák beállítása kritikus hibát okoz, a rendszer törli a létrehozott cég rekordot (Rollback) a konzisztencia megőrzése érdekében. Ha a NAV adatok validálása sikerült, de a mentésnél lép fel hálózati hiba, a cég megmarad, de a felhasználó figyelmeztetést kap, hogy az Integrációk menüben később is megadhatja a NAV adatokat.

**Rationale:**

Ez az inline folyamat drasztikusan lecsökkenti az első bejelentkezés utáni lemorzsolódást. A felhasználónak nem kell üres Dashboardot néznie, hanem azonnal cég- és NAV-szinkronizált adatokkal kezdheti el a rendszer használatát.
