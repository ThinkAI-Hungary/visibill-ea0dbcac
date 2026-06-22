# 13 — Autentikáció & Onboarding

> Login flow, regisztráció, onboarding wizard, session management.

---

## Auth Oldalak

### Route Struktúra

| Útvonal | Komponens | Felhasználás |
|---------|-----------|-------------|
| `/auth` | `Auth.tsx` (65KB) | Bejelentkezés + regisztráció |
| `/auth/callback` | `AuthCallback.tsx` | OAuth callback |
| `/reset-password` | `ResetPassword.tsx` | Jelszó visszaállítás |
| `/register/:token` | `EmployeeRegister.tsx` | Alkalmazott meghívó regisztráció |

### Auth Oldal Jellemzők

| Tulajdonság | Érték |
|-------------|-------|
| **Méret** | 65KB — komplex, többlépéses flow |
| **Layout** | Standalone — nincs sidebar |
| **Suspense fallback** | `<LoadingSpinner message="Betöltés..." />` |
| **Initial loader** | `RemoveInitialLoader` mount-kor eltávolítja |

### Auth Root CSS

```css
@media (max-height: 900px) {
  .auth-root {
    transform: scale(0.9);
    transform-origin: top left;
    width: 111.111%;    /* Kompenzáció */
    height: 111.111vh;
  }
}

/* Scrollbar elrejtés a bal panelen */
.auth-root > div:first-child::-webkit-scrollbar {
  display: none;
}
```

---

## Auth Provider

**Fájl:** `contexts/AuthContext.tsx`

### Biztosított API

| Funkció | Leírás |
|---------|--------|
| `user` | Supabase User objektum |
| `session` | Supabase Session |
| `isLoading` | Auth állapot betöltődik |
| `signOut()` | Kijelentkezés |
| `isSigningOut` | Kijelentkezés folyamatban |
| `isPasswordRecovery` | Jelszó recovery mode |
| `clearPasswordRecovery()` | Recovery flag törlése |
| `sessionGuard` | Idle timeout kezelés |

### Sign-Out Flow

1. `isSigningOut` → `true` (overlay megjelenik)
2. Security-sensitive localStorage kulcsok törlése (`SIGNOUT_DELETE_KEYS`)
3. UX preferences megmaradnak (`SIGNOUT_KEEP_KEYS`)
4. Supabase `signOut()` hívás
5. `sessionStorage` flag beállítás → `/auth` redirect

### Return-To Pattern

Ha a user nem bejelentkezett és protected route-ra próbál navigálni:

```tsx
const returnTo = location.pathname + location.search;
const authUrl = `/auth?returnTo=${encodeURIComponent(returnTo)}`;
return <Navigate to={authUrl} replace />;
```

Bejelentkezés után a `returnTo` query param-ból visszairányít.

### Post-Login Routing (Centralizált)

Az `Auth.tsx` **nem hoz routing döntést** — mindig `/`-re navigál (vagy `returnTo`-ra, ha van). A `RootRedirect` komponens (App.tsx) dönt a végső útvonalról:

```
Auth.tsx  →  navigate('/')  →  RootRedirect  →  végső útvonal
```

| Prioritás | Feltétel | Cél |
|:---------:|----------|-----|
| 1 | `profiles.role` = `management` / `thinkai` | `/management` |
| 2 | `companies.length === 0` | Onboarding wizard (EmptyStateDashboard) |
| 3 | `hasEaisybillAccess === false` (van cég, de nincs eaisybill jog) | `/accounty` |
| 4 | Normál user | `/:companyId/:dateRange/` (scoped dashboard) |

> **Megjegyzés:** Korábban az `Auth.tsx` is tartalmazott `hasEaisybillAccess` checkeket, ami duplán routolt és friss (cég nélküli) user-eket tévesen `/accounty`-ra küldött az onboarding helyett. Ez javítva — a routing döntés egyetlen helyen van (`RootRedirect`).

---

## Password Recovery Flow

**Fájl:** `components/PasswordRecoveryRedirect.tsx` (App.tsx-ben)

### Flow

1. User jelszó reset emailt kap
2. Link-re kattint → `#type=recovery&access_token=...` hash-el érkezik
3. `PasswordRecoveryRedirect` komponens detektálja a hash-t
4. Átirányít → `/reset-password` + hash megtartása
5. `ResetPassword` komponens feldolgozza a token-t

### Hash Paraméterek

```tsx
const hashParams = new URLSearchParams(location.hash.slice(1));
const hasRecoveryHash = hashParams.get("type") === "recovery" && (
  hashParams.has("access_token") ||
  hashParams.has("refresh_token") ||
  hashParams.has("token")
);
```

---

## App Ready Gate

**Fájl:** `hooks/useAppReady.ts`

A `ProtectedLayout` SEMMIT nem renderel, amíg az összes adat be nem töltődött:

| Feltétel | Mire vár |
|----------|----------|
| Auth | Supabase session resolved |
| Company | Cégek listája betöltődött |
| Role | User role (owner/employee) lekérdezve |
| Profile | Profil adatok betöltve (name, email_verified, **role**) |

### Redirect Targetek

| `redirectTarget` | Feltétel | Cél |
|-----------------|----------|-----|
| `'auth'` | Nincs user session | `/auth` |
| ~~`'unverified'`~~ | ~~Email nem megerősítve~~ | ~~`/auth?unverified=true`~~ |
| `'management'` | `profiles.role` = `'management'` vagy `'thinkai'` | `/management` |
| `'onboarding'` | Nincs profil / profil incomplete | `/categories` |
| `null` | Minden OK | Normál renderelés |

> **Megjegyzés:** Az `'unverified'` redirect jelenleg `[DISABLED]` — a kódban kikommentezve, jövőbeli visszakapcsolásra fenntartva.

### Management Routing (Zero-Flash Guard)

A `management` / `thinkai` role-lal rendelkező felhasználók **azonnal** a `/management` útvonalra kerülnek bejelentkezéskor, sidebar/navbar villanás nélkül. Ezt 3 rétegű frontend guard biztosítja:

| Réteg | Komponens | Feladata |
|-------|-----------|----------|
| 1 | `useAppReady()` | Profile query-ból felismeri a management role-t → `redirectTarget = 'management'` |
| 2 | `ProtectedLayout` | A `/` és scoped route-okból azonnal `<Navigate to="/management">` — sidebar nem renderel |
| 3 | `ProtectedRoute` | A `/accounty` és bármely más route-ból is redirect — `isPending` alatt `null`-t renderel (zero flash) |

Az initial-loader (CSS spinner) a `ProtectedLayout`-ban **NEM** távolítódik el management redirect esetén — a `/management` oldal saját `<RemoveInitialLoader />` komponense kezeli.

---

## Onboarding Folyamat

### Kezdeti Átirányítás (App Ready Gate)

**Fájl:** `hooks/useAppReady.ts`

Az alkalmazás betöltésekor a `useAppReady` hook ellenőrzi a felhasználó állapotát. Amennyiben a felhasználónak még nincs profilja (`no-profile` vagy `incomplete`), a `redirectTarget` értéke `'onboarding'` lesz.
A `ProtectedLayout.tsx` észleli ezt a státuszt, és átirányítja a felhasználót a `/categories` útvonalra (`pages/Onboarding.tsx`).
Ha a felhasználónak nincs egyetlen cége sem a rendszerben (`companies.length === 0`), az `App.tsx` az `Index.tsx` főoldal betöltésekor az `EmptyStateDashboard.tsx` komponenst rendereli.

### Onboarding Varázsló (Empty State Dashboard)

**Fájl:** `components/dashboard/EmptyStateDashboard.tsx` (42KB)

A cég nélküli felhasználók számára megjelenő, Grayed-out teaser háttér előtt renderelt modal ablak, amely egy 4-lépéses folyamaton vezeti végig a felhasználót:

```
┌─────────────────────────────────────────────────────────────┐
│                 Üdvözöljük a eaisybill-ben!                 │
│                                                             │
│  Lépés 1: Cég hozzáadása (Új létrehozása / Csatlakozás kód)  │
│  Lépés 2: Projektek létrehozása (Opcionális)                │
│  Lépés 3: Költség kategóriák felvétele (Opcionális)         │
│  Lépés 4: NAV Online Számla Integráció (Opcionális)         │
│                                                             │
│  [Előző]                                   [Tovább / Kész]  │
└─────────────────────────────────────────────────────────────┘
```

- **Step 1 (Cég):** A felhasználó megadhatja az új cég nevét, adószámát és székhelyét, vagy megadhat egy csatlakozási kódot (share token). Új cég létrehozásakor automatikusan létrejön a `company_members` rekord `role = 'owner'` értékkel. Csatlakozás esetén a `join-company` Edge Function hívódik meg, és a felhasználó `member` jogosultságot kap.
- **Step 2 (Projektek):** Kereskedelmi partnerek és projektek gyors rögzítése.
- **Step 3 (Kategóriák):** Költség kategóriák rögzítése (a háttérben a `categories` táblába kerülnek).
- **Step 4 (NAV):** Technikai felhasználói adatok rögzítése és tesztelése. A validáció a `save-credentials` Edge Function-ön keresztül történik, majd a háttérben elindul az elmúlt 90 nap számláinak lekérése 35 napos blokkokban az API korlátok miatt.

A folyamat végén a cégadatok és a beállítások elmentődnek a DB-ben, vagy hiba esetén Rollback fut le (a létrehozott cég törlődik).

### Kategória Kezelő (Categories Page)

**Route:** `/categories`
**Fájl:** `pages/Onboarding.tsx` (10KB)

A kezdeti onboarding után, vagy ha a felhasználó a Beállításokból navigál ide, ez a felület szolgál a költség kategóriák szerkesztésére, hozzáadására és törlésére. `useUnsavedChanges` hook és `UnsavedChangesDialog` komponens védi a felhasználót a nem mentett adatok elvesztésétől.

### Product Tour

**Fájl:** `components/ProductTour.tsx` (5KB) + `ProductTourTooltip.tsx` (3KB)

Az onboarding wizard befejezése után automatikusan elindul a `react-joyride` alapú interaktív 13-lépéses tour.
A tour a sidebar és a főoldal meghatározott elemeire fókuszál a HTML-be ágyazott `data-tour` attribútumok segítségével:

```tsx
<SidebarMenuItem data-tour="dashboard">
<SidebarMenuItem data-tour="invoices">
<div data-tour="company-selector">
```

---

## Session Management

### Idle Timeout

**Fájl:** `hooks/useIdleTimeout.ts` + `hooks/useSessionGuard.ts`

| Paraméter | Érték |
|-----------|-------|
| Inaktivitás limit | (konfiguráció szerint) |
| Warning időszak | 120 mp (2 perc) |
| Kritikus küszöb | 30 mp |

### Idle Warning Modal

Részletes leírás: [09-error-handling-feedback.md](../design/09-error-handling-feedback.md#idle-warning-modal)

### Last Active Tracking

```tsx
localStorage.setItem('eaisybill_last_active', Date.now().toString());
```

---

## Role-Based Access (Szerepkörök és Jogosultságok)

A rendszer két különálló alkalmazási felülettel rendelkezik (eaisybill és eaisybooks), amelyek saját szerepkörökkel és jogosultsági szintekkel bírnak. A hozzáférések feloldását és a felületek közötti áttérést egy intelligens fallback-mechanizmus biztosítja.

### 1. eaisybill Jogosultsági Körök

| Szerepkör | Kulcs | Jogosultságok leírása |
| :--- | :--- | :--- |
| **Tulajdonos / Admin** | `owner` / `admin` | Teljes hozzáférés az összes modulhoz, cégbeállításokhoz, számlázási csomagokhoz, meghívók kezeléséhez és tagok szerepköreinek módosításához. |
| **Tag** | `member` | Írási és olvasási jog a pénzügyi modulokhoz (Számlák, Tranzakciók, Házipénztár, Projektek, Munkaidő rögzítés). Nem érheti el a cégbeállításokat és tagkezelést. |
| **Asszisztens** | `assistant` | Számlák, tranzakciók, kintlévőségek, projektek R/W — bérszámfejtés/HR/könyvelési modulok nélkül. |
| **Betekintő** | `viewer` | Csak olvasási jog a pénzügyi modulokhoz. Nem hozhat létre és nem módosíthat adatokat. |
| **Munkavállaló** | `employee` | Kizárólag a saját Munkaidő oldalát éri el és rögzíthet időbejegyzéseket. Minden más menüpont rejtve van számára. |
| **Vezetőség / ThinkAI** | `management` / `thinkai` | Speciális hozzáférés a vezetői dashboardhoz (`/management`). Nem lát eaisybill/eaisybooks felületet. A `profiles.role` mezőben tárolódik (nem `company_members`). Aktuális ThinkAI user: `management@thinkai.hu` (`thinkai` role). |

#### UI Eltérések az eaisybill szerepkörök alapján:

| UI Elem | Admin / Owner | Member / Viewer | Employee | Management |
| :--- | :---: | :---: | :---: | :---: |
| **Pénzügyi menüpontok** | ✅ | ✅ | ❌ | ❌ |
| **Munkaidő menü** | ✅ | ✅ | ✅ | ❌ |
| **Cégválasztó** | ✅ | ✅ | ❌ | ❌ |
| **Dátumválasztó** | ✅ | ✅ | ❌ | ❌ |
| **Cégbeállítások** | ✅ | ❌ | ❌ | ❌ |
| **Vezetői Dashboard** | ❌ | ❌ | ❌ | ✅ |

> [!NOTE]
> **Moduláris jogosultságkezelés:** A fenti statikus szerepkör-alapú alapértelmezések **per-user, per-company alapon felülírhatók**
> az `eaisybill_module_permissions` DB táblán keresztül. Az admin felhasználók a **Beállítások → Jogosultságkezelő** panelben 
> konfigurálhatják a nem-admin tagok modul hozzáféréseit (olvasás/írás külön-külön).
>
> **Kliens-specifikus modulok:** Egyes modulok (pl. Szállítmányozás) **alapértelmezetten MINDEN felhasználónál kikapcsoltak** 
> (beleértve adminokat is!), és csak explicit DB override-dal engedélyezhetők.
> Teljes dokumentáció: [shipment-matching.md § 6](./shipment-matching.md#6-module-permission-system-menü-ki-bekapcsolás)
>
> **Fő fájlok:**
> - [useEaisybillPermissions.ts](../../src/hooks/useEaisybillPermissions.ts) — permission hook
> - [EaisybillPermissionPanel.tsx](../../src/components/settings/EaisybillPermissionPanel.tsx) — admin UI
> - [AppSidebar.tsx](../../src/components/AppSidebar.tsx) — menü szűrés (`canAccess(moduleKey)`)

### 2. eaisybooks (Accounty) Szerepkörök

Az eaisybooks könyvelőirodai felületén az alábbi hierarchia működik:

1. **Iroda Admin** (`iroda_admin`): Teljes körű irodai adminisztráció, csapattagok és NAV kulcsok kezelése.
2. **Senior Könyvelő** (`senior_könyvelő`): Kiemelt könyvelési funkciók.
3. **Könyvelő** (`könyvelő`): Standard könyvelői feladatok és ügyfél hozzárendelések.
4. **Asszisztens** (`asszisztens`): Korlátozottabb, asszisztensi hozzáférés.

---

### 3. Kereszt-Alkalmazás Szerepkör-feloldás (Cross-App Role Resolution)

Amikor egy `eaisybooks` könyvelő/asszisztens átvált az `eaisybill` felületre egy hozzárendelt cég kezelésére:
- A `useUserRole.ts` hook először ellenőrzi a standard `company_members` táblát.
- **Fallback logika**: Ha a felhasználó nem szerepel a cég direkt tagjai (`company_members`) között, a rendszer lekérdezi az `accounty_assignments` táblát.
- Ha ott van érvényes hozzárendelése az adott céghez mint könyvelő, a rendszer **automatikusan `member` szerepkört biztosít neki az eaisybill-ben**.
- Ezáltal a könyvelő azonnal látja a teljes könyvelési menüt és bizonylatokat anélkül, hogy admin jogosultságot kellene kapnia a cégben.

---

### 4. Eaisybooks — Meghívó kód alapú cég hozzárendelés

Az eaisybooks felületen a könyvelők kétféleképpen rendelhetnek hozzá ügyfelet:

**A) Automatikus áthúzás (eaisybill cégek):** A `seedAccountyAssignments()` utility áthúzza az összes `company_members`-ből ismert céget `accounty_assignments`-be.

**B) Meghívó kód (share_token):** Inline form az `AccountyApp.tsx` üres állapotában:
1. Cég tulajdonos generál meghívó kódot eaisybill Beállításokban → `companies.share_token` + `share_token_created_at`
2. Könyvelő beírja a kódot → `validate-partner-code` EF ellenőriz (10 perc lejárat)
3. Validálás után → `join-company-as-accountant` EF INSERT-el `accounty_assignments`-be

| Edge Function | Hatás | Tábla |
|---|---|---|
| `validate-partner-code` | Read-only: cég adatok visszaadása | `companies` (SELECT) |
| `join-company-as-accountant` | Könyvelő hozzárendelés | `accounty_assignments` (INSERT) |

> [!IMPORTANT]
> Mindkét edge function **status 200**-at ad minden business logic válasznál — a `supabase.functions.invoke` non-2xx válaszokat az `error` mezőbe teszi, nem `data`-ba.

> [!IMPORTANT]
> Az `accounty_assignments` INSERT-nél az `is_main_accountant: true` flag kötelező — a `useAccountyClients` hook non-admin usereknek csak ezeket a cégeket mutatja.

**Hozzáférés-ellenőrző hook-ok:**

| Hook | Ellenőrzés | Mire hat |
|---|---|---|
| `useHasEaisybillAccess` | `company_members` tagság (NEM `accounty_assignments`!) | eaisybill toggle megjelenítése |
| `useHasAccountyAccess` | `accounty_assignments` tagság | eaisybooks sidebar link megjelenítése |

---

---

## Biztonsági Konvenciók

### FOUC Megelőzés

1. HTML `<script>` block: téma class hozzáadása PAINT előtt
2. CSS custom properties: `--initial-bg` / `--initial-text`
3. HTML spinner: brand szín (#18b8a0) JavaScript nélkül

### Error Boundary: Cache Reset

```tsx
handleResetAndSignOut = async () => {
  // Összes eaisybill_ és sb- kulcs törlése
  localStorage keysToRemove.forEach(k => localStorage.removeItem(k));
  sessionStorage.clear();
  window.location.href = '/auth';
};
```

---

## Felhasználókezelési Rendszer & Könyvelői Áttérés

A rendszer támogatja a normál felhasználók, meghívott csapattagok, valamint az `eaisybooks` (könyvelőirodai) felületről áttérő könyvelők kezelését.

### 1. Profilok és Feliratkozások Automatikus Létrehozása
- **Regisztráció/Meghívás**: Amikor egy felhasználó létrejön, a Supabase trigger adatbázis-szinten létrehozza a `profiles` bejegyzést.
- **Adat-helyreállítás (Backfill Migration)**: Ha egy adminisztrátor által manuálisan létrehozott felhasználónál nem futott le a trigger, az adatbázis migrációs szkript (`20260619_backfill_missing_user_data.sql`) automatikusan pótolja a hiányzó profilokat, a teszt feliratkozásokat (`user_subscriptions`), és szinkronizálja a `user_company_access_cache` rekordokat a `company_members` tábla alapján.

### 2. Meghívási és Ellenőrzési Folyamat
- **InviteUserDialog & lookup_user_by_email RPC**: Új tag meghívásakor a felület ellenőrzi, hogy a megadott e-mail cím létezik-e már a rendszerben. Ehhez a `lookup_user_by_email` biztonságos RPC-t használja. Ha a felhasználó létezik, azonnal hozzáadja a céghez, ha nem, meghívót küld az Edge Function-ön keresztül.
- **Email Megerősítési Callback**: A rendszer kezeli az e-mail megerősítő linkek (`verify_token` paraméterek) feldolgozását, elkerülve a duplán megerősített vagy lejárt token hibákat a dinamikus átirányítások során.

### 3. Könyvelők Áttérése (eaisybooks → eaisybill)
- **Jogosultságok**: Az `eaisybooks` könyvelőirodákból áttérő könyvelők alapértelmezetten `member` jogosultsági kört kapnak a hozzárendelt cégekhez az `eaisybill` rendszerben. Ez biztosítja számukra a hozzáférést a teljes könyvelési menühöz (Könyvelés sidebar csoport, Főkönyv, Áfa analitika, Tranzakciók, Házipénztár), miközben elkerüli, hogy feleslegesen globális rendszer-adminisztrátori jogokat kapjanak.
- **Profil mezők zárolása (Profile Locking)**:
  - Ha a felhasználónak van aktív könyvelőirodai összerendelése (`accounty_assignments`), a rendszer zárolja a profil beállításaiban a **Pozíció** (Position) és **Cég neve** (Company Name) mezőket.
  - A `Settings.tsx` lekérdezi a legmagasabb könyvelői szerepkört és az iroda nevét, majd ezeket átadja a `ProfileSection` komponensnek `readOnlyOverrides` propként. A felületen a zárolt mezők mellett lakat ikon jelenik meg, és a beviteli mezők inaktívvá (disabled) válnak.

