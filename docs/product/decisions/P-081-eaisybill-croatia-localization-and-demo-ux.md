# P-081: Eaisybill Horvát Lokalizáció, /hr/ Route Prefix és Demó Navigáció UX

**Status:** Decided  
**Category:** UI / Localization / Navigation  
**Question:** Hogyan tegyük zökkenőmentesen demonstrálhatóvá az Eaisybill alkalmazást horvát partnerek számára anélkül, hogy a magyar felhasználók felületén zavaró nyelvválasztó jelenne meg, vagy a nyelvváltás véletlenszerűen beragadna a helyi tárolóban?  
**Decision:**
1. **Dedikált `/hr/` Route Prefix:**
   - A horvát felület elérése a `/hr/` prefixen keresztül történik mind a bejelentkezési oldalon (`/hr/auth`), mind a védett felületen (`/hr/:companyId/:dateRange/...`).
   - Ha egy partner vagy értékesítő a `/hr/auth` oldalon lép be, a sikeres autentikáció után automatikusan a horvát nyelvű védett kezdőlapra navigál.
2. **Nyelvválasztó Eltávolítása a Felületről:**
   - A fejlesztési és tesztelési fázisban a felhasználói felület (AppSidebar) nem tartalmaz látható nyelvváltó komponenst, így a normál magyar felhasználók nem találkoznak idegen nyelvű opcióval.
   - A demó prezentációja közvetlenül a dedikált URL hivatkozás átadásával / megnyitásával történik.
3. **Determinisztikus, LocalStorage-Mentes Nyelvszinkronizáció:**
   - A nyelv nem tárolódik a böngésző `localStorage`-ában. Ha a felhasználó a böngésző címsorából kitörli a `/hr/` szegmenst, az oldal azonnal és tisztán visszavált a magyar nyelvű felületre.
4. **Pénznem és Dátum Lokáció:**
   - Horvát felületen a KPI kártyák, táblázatok és diagramok automatikusan euróban (`€`), horvát számformátummal és horvát hónapnevekkel (`date-fns/locale/hr`) renderelődnek.

**Current Implementation:**
- A `src/App.tsx`-ben `<LanguageRouteSync />` figyeli az útvonal változásait és szinkronizálja az `i18n` állapotot.
- A `src/routes/authRoutes.tsx` a `/hr/auth` és `/hr/auth/callback` útvonalakat `<LanguageRouteWrapper language="hr">` burokban futtatja.
- Az `AppSidebar.tsx` minden csoportneve és menüpontja többnyelvű kulcsokból táplálkozik.
- A `VatSection.tsx` automatikusan számolja ki a fizetendő / visszaigényelhető ÁFA pozíciót és jeleníti meg a kiválasztott devizában.

**Rationale:**
A nemzetközi értékesítéshez kulcsfontosságú az autentikus helyi nyelvű és pénznemű demonstráció. Ugyanakkor a termelésben lévő magyar ügyfelek zavartalan élménye és a technikai stabilitás (ne ragadjon be a felület horvát nyelven) elsődleges prioritás. A tiszta útvonal-vezérelt megoldás mindkét feltételt maximálisan teljesíti.

## Kapcsolódó
- [A-109: Eaisybill Horvát Lokalizáció, /hr/ Scoped Route Architektúra](../../architecture/decisions/A-109-eaisybill-i18n-croatia-localization-and-route-architecture.md)
- [P-006: Sidebar Menüstruktúra](./P-006-sidebar-structure.md)
- [Information Architecture](../information-architecture.md)
