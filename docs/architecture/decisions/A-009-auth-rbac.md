# A-009: Supabase Auth + RBAC

**Status:** Decided  
**Date:** 2025-09  
**Utoljára frissítve:** 2026-06-22

## Context

A rendszernek támogatnia kell: regisztrációt, bejelentkezést, session kezelést, és 4 különböző felhasználói szerepet.

## Decision

**Supabase Auth** — JWT-alapú autentikáció, custom RBAC:

**Szerepek:**
| Szerep | Hozzáférés | Hogyan kapja? |
|--------|-----------|---------------|
| `owner` | Teljes — minden modul, beállítások, tagkezelés | Cég létrehozásakor automatikusan |
| `admin` | Teljes (owner alias) | Owner adja |
| `member` | Teljes — minden modul, beállítások | Share token-nel csatlakozik, vagy accounty_assignments fallback |
| `assistant` | Számlák, tranzakciók, kintlévőségek, projektek R/W | Owner/admin adja |
| `viewer` | Csak olvasás — pénzügyi modulok | Owner/admin adja |
| `employee` | Csak Munkaidő modul | Meghívó link (`/register/:token`) |
| `management` / `thinkai` | Vezetői dashboard (`/management`) — cross-tenant áttekintés | `profiles.role` mezőben, manuálisan beállítva |

**Implementáció:**
- `auth.users` — Supabase beépített user tábla
- `company_members` — `user_id` + `company_id` + `role` összekapcsolás (eaisybill)
- `accounty_assignments` — `accountant_user_id` + `company_id` + `role` összekapcsolás (eaisybooks)
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

## Hozzárendelési Mechánizmusok

| Módszer | Tábla | Használat |
|---|---|---|
| `join-company` edge function (share_token) | `company_members` | eaisybill: céghez csatlakozás tag-ként |
| `seedAccountyAssignments()` | `accounty_assignments` | eaisybooks: összes `company_members` cég áthúzása könyvelőként |
| `join-company-as-accountant` edge function (share_token) | `accounty_assignments` | eaisybooks: egyedi cég hozzáadása meghívó kóddal |

> **Fontos:** Az `accounty_assignments` INSERT-nél az `is_main_accountant: true` flag kötelező — enélkül a non-admin `useAccountyClients` hook nem mutatja a céget.

## Hozzáférés-kezelő Hook-ok

| Hook | Logika | Hatás |
|---|---|---|
| `useHasEaisybillAccess` | `company_members` tagSág VAGY `profiles.eaisybill_access` flag | eaisybill toggle láthatóság (AccountyLayout sidebar) |
| `useHasAccountyAccess` | `accounty_assignments` tagság | eaisybooks link láthatóság (AppSidebar) |

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
