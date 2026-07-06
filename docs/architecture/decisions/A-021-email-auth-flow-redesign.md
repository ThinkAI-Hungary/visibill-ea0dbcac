# A-021: Email Auth Flow Redesign (2026-06-24)

**Status:** Decided  
**Date:** 2026-06-24  
**Utoljára frissítve:** 2026-06-24

## Context

A session során az email-alapú auth flow több kritikus problémával szembesült:

1. **Email változtatás**: A user a megerősítő linkre kattintva automatikusan be lett jelentkeztetve és a dashboardra dobva (confirmation screen helyett).
2. **Kettős email regisztrációkor**: Signup esetén két email ment ki — az Auth Hook egyszerű emailje és a `send-welcome-email` szép onboarding emailje.
3. **Lejárt token kezelés**: Másodszori linkkattintáskor nem volt visszajelzés.
4. **Hash race condition**: A Supabase kliens aszinkron inicializáláskor törölte az URL hash-t, mielőtt az `AuthCallback.useEffect` olvasni tudta volna.
5. **sessionStorage security**: Korábbi megoldás az `access_token` JWT-t is tárolta sessionStorage-ban.

---

## Döntések

### 1. Email Change Flow — Kötelező Kijelentkeztetés

**Probléma:** Email változtatás után a Supabase `fix site_url` miatt mindig az app gyökerére (`/`) irányít vissza, ahol a Supabase kliens automatikusan bejelentkezett a userrel.

**Döntés:** Az email change confirmation után a user **mindig ki lesz jelentkeztetve**, és a bejelentkezési oldalra kerül (nem a dashboardra).

**Indok (iparági standard):** A megváltozott email cím érvényes hitelesítő adat. Erős biztonsági elv, hogy az email cím változtatása után az összes session érvénytelenítődjön, és a user az **új email + jelszó** kombinációval lépjen be újra.

**Implementáció:**
- `AuthCallback.tsx`: `type=email_change` detektáláskor → `supabase.auth.signOut()` → confirmation screen
- Confirmation screen után: "Vissza a bejelentkezéshez" gomb → `/auth`

### 2. App.tsx Szinkron IIFE Hash Interception

**Probléma:** Az `AuthHashInterceptor` React component (`useEffect`-alapú) aszinkron futott — a Supabase kliens hamarabb dolgozta fel a hash-t, mint a React render ciklus.

**Döntés:** Modulszintű **szinkron IIFE** az `App.tsx` tetején, minden React render előtt.

```typescript
// App.tsx — a React importok UTÁN, az App function előtt
;(function handleEmailChangeHash() {
  const hash = window.location.hash;
  const PENDING_KEY = 'visibill_pending_callback_type';

  if (window.location.pathname === '/auth/callback') {
    // Szinkron capture MIELŐTT Supabase aszinkron törli
    if (hash && !sessionStorage.getItem(PENDING_KEY)) {
      const params = new URLSearchParams(hash.replace('#', ''));
      const type = params.get('type');
      const errCode = params.get('error_code');
      if (type === 'email_change') sessionStorage.setItem(PENDING_KEY, 'email_change');
      else if (errCode === 'otp_expired') sessionStorage.setItem(PENDING_KEY, 'otp_expired');
    }
    return; // Ne redirect-elj ha már ott vagyunk
  }

  if (!hash) return;
  const params = new URLSearchParams(hash.replace('#', ''));

  if (params.get('type') === 'email_change') {
    sessionStorage.setItem(PENDING_KEY, 'email_change');
    window.location.replace('/auth/callback' + hash);
    return;
  }

  if (params.get('error') === 'access_denied' && params.get('error_code') === 'otp_expired') {
    sessionStorage.setItem(PENDING_KEY, 'otp_expired');
    window.location.replace('/auth/callback' + hash);
    return;
  }
})();
```

**Miért IIFE és nem useEffect?**
- A Supabase kliens `initialize()` aszinkron, de hamar fut → törli az URL hash-t a `replaceState`-tel
- Ha a hash detektálás `useEffect`-ben fut (React render UTÁN), a hash már üres
- A modulszintű IIFE a JS bundle betöltésekor **szinkron** fut, garantáltan a Supabase init előtt

### 3. sessionStorage — Csak Típus Flag, Nem Token

**Probléma:** Korábbi implementáció az egész hash-t (köztük az `access_token` JWT-t) sessionStorage-ba mentette.

**Döntés:** Csak a típus stringet mentjük: `'email_change'` vagy `'otp_expired'`.

**Indok:**
- A Supabase kliens úgyis feldolgozza a hash-t és beállítja a session-t → a `signOut()` token nélkül is működik
- sessionStorage ugyanúgy XSS-re érzékeny mint localStorage — felesleges érzékeny adatot tárolni benne
- A típus string (2 lehetséges érték) önmagában nem exploitálható

**sessionStorage kulcsok:**

| Kulcs | Érték | Életidő |
|-------|-------|---------|
| `visibill_pending_callback_type` | `'email_change'` \| `'otp_expired'` | Milliszekundumok (useEffect azonnal törli) |
| `visibill_email_change_confirmed` | `'1'` | Egyszer olvasható (2. linkkattintás kezelése) |

### 4. Lejárt/Felhasznált Token Kezelés

**Probléma:** 2. linkkattintásra a Supabase `otp_expired` hibát ad — de nem volt UI visszajelzés.

**Döntés:** 2 eset:
1. **Ha az 1. kattintás sikeres volt** (`visibill_email_change_confirmed` flag megvan): → ✅ Confirmation screen: "Email cím sikeresen megváltoztatva"
2. **Ha az 1. sem sikerült** (nincs flag): → ⚠️ Error screen: "Ez a link már lejárt vagy fel lett használva"

### 5. Signup — Egyetlen Email (Welcome Email)

**Probléma:** Regisztrációkor két email ment ki:
- Auth Hook (`send-email`): egyszerű "Email cím megerősítése" + OTP kód
- Postgres trigger (`handle_new_user` → `send-welcome-email`): szép branded onboarding email

**Döntés:** Az Auth Hook **skipeli** a signup típust (200 OK visszaad, emailt nem küld). Csak a `send-welcome-email` megy ki.

**Miért nem a welcome email-t szüntettük meg?**
- A welcome email szebb, branded, onboarding stepeket tartalmaz
- A `send-email` hook egyszerű sablonja felesleges volt melléje

### 6. verify-email — Supabase Auth Confirm

**Probléma:** A `send-welcome-email`-ben lévő verify link custom tokennel dolgozik (`profiles.email_verify_token`), ami csak a `profiles.email_verified` mezőt állítja be. A Supabase `email_confirmed_at` (`auth.users`-ben) nem volt beállítva — ez gondot okozna, ha a Supabase "Confirm email" setting BE van kapcsolva.

**Döntés:** A `verify-email` Edge Function (v22) mostantól a profile update után **meghívja az admin API-t** is:

```typescript
await supabase.auth.admin.updateUserById(profile.user_id, { email_confirm: true });
```

**Eredmény:** Egyetlen gombkattintás (welcome emailben) egyszerre állítja be:
- `profiles.email_verified = true` ✓
- `auth.users.email_confirmed_at = NOW()` ✓

Ez teszi lehetővé, hogy a Supabase "Confirm email" setting BE legyen kapcsolva, miközben csak a welcome email megy ki.

---

## Érintett Fájlok

| Fájl | Változás |
|------|---------|
| `src/App.tsx` | AuthHashInterceptor → szinkron IIFE; sessionStorage type flag |
| `src/pages/AuthCallback.tsx` | sessionStorage-ból olvassa a type-ot; email_change → signOut + confirmation; otp_expired kezelés |
| `src/pages/ResetPassword.tsx` | Lejárt jelszó-reset token → redirect `?forgot=1`-gyel |
| `supabase/functions/send-email/index.ts` | signup type → skip (200 OK, no email) |
| `supabase/functions/verify-email/index.ts` | auth.admin.updateUserById(email_confirm) hozzáadva |
| `src/components/dashboard/EmptyStateDashboard.tsx` | Logout button tabIndex={-1}; "Első lépések" autoFocus |

---

## Supabase Korlátok (Background)

> **`site_url` fix redirect:** A Supabase `updateUser({ email })` hívás után az email change visszairányítása NEM konfigurálható dinamikusan — mindig a projekt szintű `site_url`-re (gyökér) irányít. Ez az oka a hash-alapú detektálási megközelítésnek.

> **`otp_expired` hiba hely:** Email change esetén az `otp_expired` hiba a gyökér URL-en (`/`) jelenik meg. Jelszó visszaállítás esetén a `/reset-password`-on. Ezért különbözik a két flow kezelése.

---

## Kapcsolódó

- [A-009: Auth RBAC](./A-009-auth-rbac.md)
- [A-017: Biztonsági Architektúra](./A-017-security-architecture.md)
- [A-020: Auth Trigger Chain Incident](./A-020-auth-trigger-chain-incident.md)
- [frontend-auth-onboarding.md](../frontend-auth-onboarding.md)
