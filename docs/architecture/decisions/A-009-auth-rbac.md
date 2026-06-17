# A-009: Supabase Auth + RBAC

**Status:** Decided  
**Date:** 2025-09

## Context

A rendszernek támogatnia kell: regisztrációt, bejelentkezést, session kezelést, és 4 különböző felhasználói szerepet.

## Decision

**Supabase Auth** — JWT-alapú autentikáció, custom RBAC:

**Szerepek:**
| Szerep | Hozzáférés | Hogyan kapja? |
|--------|-----------|---------------|
| `owner` | Teljes — minden modul, beállítások, tagkezelés | Cég létrehozásakor automatikusan |
| `admin` | Teljes (owner alias) | Owner adja |
| `member` | Teljes — minden modul, beállítások | Share token-nel csatlakozik |
| `employee` | Csak Munkaidő modul | Meghívó link (`/register/:token`) |

**Implementáció:**
- `auth.users` — Supabase beépített user tábla
- `company_members` — `user_id` + `company_id` + `role` összekapcsolás
- `useAuth()` hook — session kezelés a frontend-en
- `useAppReady()` — session + company + profile betöltés gate
- `useSessionGuard()` — session timeout (30 perc inaktivitás)

**Auth flow:**
1. Email + jelszó regisztráció → email verifikáció
2. Supabase session → JWT token a böngészőben
3. Minden API hívás JWT-vel → RLS policy-k érvényesülnek

## Consequences

**Pozitív:**
- Nincs saját auth implementáció — JWT + session a Supabase kezeli
- A RLS policy-k közvetlenül a `company_members.role`-t használják
- Employee role — korlátozott hozzáférés regisztráció nélkül (token-based)

**Negatív:**
- Nincs social login (Google, GitHub) — csak email/password
- A role a `company_members`-ben van, nem a JWT-ben — minden role-check DB lekérdezés
- Session timeout manuálisan implementált (nem Supabase beépített)

## Signup Trigger Chain

> ⚠️ **Kritikus:** A regisztráció egy trigger chain-t indít el. Ha bármelyik trigger hibázik, az **egész tranzakció ROLLBACK-el** és a user nem jön létre. Részletes tanulságok: [A-020](./A-020-auth-trigger-chain-incident.md)

```
auth.users INSERT
  └── on_auth_user_created → handle_new_user()
        └── profiles INSERT
              ├── on_profile_created_init_email_prefs → initialize_email_preferences()
              └── on_profile_created_initialize_subscription → initialize_user_subscription()
```

**Trigger function szabályok:**
1. Minden trigger function → `SECURITY DEFINER` (auth.uid() NULL trigger kontextusban)
2. Ha extension function-t hív → `SET search_path TO 'public', 'extensions'`
3. `CREATE OR REPLACE` → MINDIG hordozd át az összes attribútumot

## Kapcsolódó
- [A-020: Auth Trigger Chain Incident](./A-020-auth-trigger-chain-incident.md)
- [A-017: Biztonsági Architektúra](./A-017-security-architecture.md)
- [A-003: Multi-tenancy RLS](./A-003-multi-tenancy-rls.md)
