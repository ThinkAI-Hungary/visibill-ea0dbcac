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
| Profile | Profil adatok betöltve |

### Redirect Targetek

| `redirectTarget` | Feltétel | Cél |
|-----------------|----------|-----|
| `'auth'` | Nincs user session | `/auth` |
| `'unverified'` | Email nem megerősítve | `/auth?unverified=true` |
| `'onboarding'` | Nincs cég | `/categories` |
| `null` | Minden OK | Normál renderelés |

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

## Role-Based Access

### User Roles

| Szerep | Jogosultság |
|--------|-----------|
| `owner` / `admin` | Teljes hozzáférés |
| `employee` | Csak munkaidő oldal |
| `management` | Management dashboard (`/management`) |

### Role-Based UI Változások

| Elem | Owner | Employee | Management |
|------|-------|----------|------------|
| Sidebar menüpontok | Mind | Csak Munkaidő | – |
| CompanySelector | ✅ | ❌ | – |
| GlobalDatePicker | ✅ | ❌ | – |
| Settings gomb | ✅ | ❌ | – |
| Management dashboard | ❌ | ❌ | ✅ |

### Management Redirect

```tsx
// RootRedirect-ben
if (profileRole === 'management') {
  return <Navigate to="/management" replace />;
}
```

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
