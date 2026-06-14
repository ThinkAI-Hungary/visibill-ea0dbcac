# eaisybill Vendor Lock-in Audit & Migrációs Terv

**Cél:** Auth és Edge Functions Supabase-függőség dokumentálása és exit stratégia  
**Létrehozva:** 2026-06-13  
**Állapot:** Audit kész, absztrakció tervezés fázisban

---

## 📋 Összefoglaló Lock-in Mátrix

| Komponens | Lock-in szint | Érintett fájlok | Migrációs nehézség | Prioritás |
|---|:---:|:---:|:---:|:---:|
| **Auth (GoTrue)** | 🔴 Magas | 20+ fájl, 36 hívási pont | Nehéz | ⭐ Legfontosabb |
| **Edge Functions (Deno)** | 🔴 Magas | 42 funkció | Közepes-Nehéz | ⭐ Fontos |
| **PostgreSQL + RLS** | 🟢 Nulla | — | Triviális | — |
| **Storage** | 🟡 Közepes | ~5 fájl | Közepes | Később |
| **Realtime** | 🟡 Közepes | ~3 fájl | Közepes | Később |
| **PGMQ** | 🟢 Alacsony | Worker-ben | Triviális | — |

---

## 🔐 AUTH — Részletes Audit

### Használt Supabase Auth API-k

| API hívás | Hol használják | Hányszor | Standard OAuth2? |
|---|---|:---:|:---:|
| `signInWithPassword()` | `AuthContext.tsx`, `Auth.tsx` | 2 | ✅ Standard |
| `signInWithOAuth({provider: 'google'})` | `Auth.tsx` | 1 | ✅ Standard OAuth2 |
| `signUp()` | `AuthContext.tsx`, `EmployeeRegister.tsx` | 2 | ✅ Standard |
| `signOut({scope: 'local'})` | `AuthContext.tsx` | 3 | ⚠️ Supabase-specifikus `scope` paraméter |
| `getSession()` | 13 fájl | 15 | ⚠️ GoTrue-specifikus válasz formátum |
| `getUser()` | 3 fájl | 3 | ⚠️ GoTrue JWT dekódolás |
| `refreshSession()` | `useSessionGuard.ts`, `EmptyStateDashboard.tsx` | 2 | ⚠️ GoTrue refresh token mechanizmus |
| `onAuthStateChange()` | `AuthContext.tsx`, `ResetPassword.tsx` | 2 | 🔴 GoTrue-specifikus event stream |
| `updateUser({password})` | `AuthContext.tsx`, `ResetPassword.tsx`, `SettingsPage.tsx` | 3 | ⚠️ GoTrue-specifikus |
| `resetPasswordForEmail()` | `Auth.tsx` | 1 | ⚠️ GoTrue magic link mechanizmus |
| `exchangeCodeForSession()` | `AuthCallback.tsx` | 1 | ✅ PKCE standard |
| `auth.admin.createUser()` | `invite-user` Edge Function | 1 | 🔴 GoTrue Admin API |
| `auth.admin.listUsers()` | `invite-user` Edge Function | 1 | 🔴 GoTrue Admin API |

### Auth architektúra áttekintés

```
┌────────────────────────────────────────────────────────────────┐
│  Frontend (React)                                              │
│                                                                │
│  AuthContext.tsx ◄──── Központi auth provider                  │
│  ├── user, session, loading state                              │
│  ├── signUp / signIn / signOut / updatePassword                │
│  ├── onAuthStateChange listener                                │
│  └── useSessionGuard hook                                      │
│       ├── 4h absolute session expiry (localStorage)            │
│       ├── 28min idle warning + 120s countdown                  │
│       ├── Multi-tab sync (storage events)                      │
│       └── Throttled activity tracking (1 write/sec)            │
│                                                                │
│  Token tárolás: localStorage (supabase.auth.token)             │
│  Session formátum: { access_token, refresh_token, user, ... }  │
│  JWT claims: user.id, user.email, user.user_metadata           │
├────────────────────────────────────────────────────────────────┤
│  Edge Functions (auth ellenőrzés)                              │
│                                                                │
│  Minta (42-ből ~30 használja):                                 │
│    const authHeader = req.headers.get('Authorization');        │
│    const { data: { user } } = await supabase.auth.getUser(    │
│      authHeader.replace('Bearer ', '')                         │
│    );                                                          │
│                                                                │
│  invite-user: Auth Admin API-t is használ                      │
│    → auth.admin.createUser()                                   │
│    → auth.admin.listUsers()                                    │
├────────────────────────────────────────────────────────────────┤
│  Supabase GoTrue server                                        │
│  ├── JWT signing (HS256, supabase JWT secret)                  │
│  ├── Email verification (saját email template-ek)              │
│  ├── Password recovery magic links                             │
│  ├── Google OAuth2 provider                                    │
│  ├── Session management (refresh tokens)                       │
│  └── User metadata storage                                     │
└────────────────────────────────────────────────────────────────┘
```

### GoTrue-specifikus viselkedések, amiket migrációnál pótolni kell

1. **`onAuthStateChange` event stream** — GoTrue egyedi mechanizmus. Események: `INITIAL_SESSION`, `SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED`, `PASSWORD_RECOVERY`, `USER_UPDATED`. Alternatíva: saját EventEmitter + auth state polling.

2. **Refresh token rotate** — GoTrue automatikusan rotálja a refresh tokent minden használatnál. Ez biztonsági feature, amit saját auth-nál is implementálni kell.

3. **`scope: 'local'` signout** — Csak a helyi tab-ot jelenti ki, nem az összes session-t. Alternatíva: token törlés localStorage-ből + server-side blacklist.

4. **User metadata (`user_metadata`)** — A GoTrue a user objektumban tárol extra adatokat (name, invited_by). Alternatíva: külön `profiles` tábla (ami már létezik!).

5. **Admin API** — Az `invite-user` Edge Function az `auth.admin.createUser()` API-t használja. Alternatíva: saját admin endpoint a user létrehozáshoz.

### Érintett forrásfájlok (Auth)

**Központi:**
- `src/contexts/AuthContext.tsx` — 308 sor, 10 auth hívás
- `src/hooks/useSessionGuard.ts` — 203 sor, 1 auth hívás
- `src/integrations/supabase/client.ts` — Supabase client config

**Oldalak:**
- `src/pages/Auth.tsx` — Login/signup/forgot password
- `src/pages/AuthCallback.tsx` — OAuth callback (PKCE)
- `src/pages/ResetPassword.tsx` — Jelszó visszaállítás
- `src/pages/EmployeeRegister.tsx` — Alkalmazott regisztráció
- `src/pages/Settings.tsx` — Export user data
- `src/pages/ManagementDashboard.tsx` — Admin dashboard
- `src/pages/Accounty/SettingsPage.tsx` — Accounty beállítások
- `src/pages/Accounty/ClientDetailsPage.tsx`
- `src/pages/Accounty/ClientMissingInvoicesPage.tsx`
- `src/pages/Accounty/PayrollCyclePage.tsx`
- `src/pages/Accounty/ClientPortalPage.tsx`
- `src/pages/Accounty/ApprovalQueuePage.tsx`

**Komponensek:**
- `src/components/CompanySelector.tsx`
- `src/components/LiveNotificationProvider.tsx`
- `src/components/nav/NavCredentialsForm.tsx` — 6 auth hívás (legtöbb!)
- `src/components/settings/InviteUserDialog.tsx`
- `src/components/kintlevo/DunningDialog.tsx`
- `src/components/dashboard/EmptyStateDashboard.tsx` — 5 auth hívás
- `src/components/NylasEmailConnect.tsx`
- `src/components/InvoiceImagePreview.tsx`

**Utility:**
- `src/utils/seedAccounty.ts`
- `src/hooks/useInvoiceMutations.ts`
- `src/lib/constants.ts` — STORAGE_KEYS definíciók
