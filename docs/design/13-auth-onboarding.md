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

## Onboarding

### Categories (Onboarding Wizard)

**Route:** `/:companyId/:dateRange/categories` (vagy `/categories`)

**Fájl:** `pages/Onboarding.tsx` (10KB)

Kategória (számlatípus) kiválasztó — az első bejelentkezés után.

### Empty State Dashboard

**Fájl:** `components/dashboard/EmptyStateDashboard.tsx` (42KB)

Átfogó onboarding wizard ha a usernek még nincs cége:

```
┌─────────────────────────────────┐
│  Üdvözöljük a eaisybill-ben!     │
│                                 │
│  1. [Cég létrehozása]           │
│  2. [Kategóriák kiválasztása]   │
│  3. [Első számla feltöltése]    │
│                                 │
│  [Tovább →]                     │
└─────────────────────────────────┘
```

### Product Tour

**Fájl:** `components/ProductTour.tsx` (5KB) + `ProductTourTooltip.tsx` (3KB)

`react-joyride` alapú interaktív walkthrough az alkalmazás fő funkcióinak bemutatásához.

A sidebar elemeken `data-tour` attribútumok:

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

Részletes leírás: [09-error-handling-feedback.md](./09-error-handling-feedback.md#idle-warning-modal)

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
