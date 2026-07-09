# A-032: Accounty Push Notification Preferences

**Status:** Decided  
**Date:** 2026-07-09  

## Context

Az eaisyBooks (Accounty) modulban a Push értesítések beállítási felülete létezett, de korábban csak mock UI volt. Az e-mail értesítések (A-030) mintájára szükségessé vált a Push beállítások perzisztálása az adatbázisban, hogy a felhasználók be- és kikapcsolhassák a különböző push eseményeket (pl. hiányzó számla, határidő, ügyfél státusz változás).

Kritikus üzleti követelmény, hogy **alapértelmezetten minden push beállítás ki van kapcsolva (false)** minden felhasználónál, és önállóan dönthetnek a bekapcsolásáról.

## Decision

### 1. Külön `accounty_push_preferences` tábla

Az `accounty_email_preferences` mintájára egy dedikált táblát hoztunk létre a Push beállításoknak. 
Ez azért fontos, mert a Push és E-mail értesítések teljesen eltérő csatornák, és a jövőben a Push-hoz Web Push subscription adatok (endpoint, auth keys) is kapcsolódni fognak.

**Séma (`accounty_push_preferences`):**
- `user_id` (uuid, FK auth.users, UNIQUE)
- `enabled` (boolean)
- `missing_invoice_alert` (boolean)
- `deadline_reminder` (boolean)
- `client_status_change` (boolean)
- `approval_request` (boolean)
- `critical_alerts` (boolean)

*Minden boolean mező alapértelmezett értéke: `false`.*

### 2. Frontend működés (AccountyNotificationPreferences.tsx)

A beállítások oldal a komponens betöltésekor párhuzamosan (`Promise.all`) kéri le az e-mail és a push beállításokat. Ha a felhasználónak még nincs sora a `accounty_push_preferences` táblában, akkor a default false értékekkel inicializálódik a UI. 
Amikor a felhasználó a böngészőben engedélyezi a push értesítéseket, az `enabled` mező automatikusan `true`-ra vált az adatbázisban.

### 3. Biztonság (RLS)

A tábla Row Level Security (RLS) védelemmel van ellátva.
Minden műveletnél (SELECT, INSERT, UPDATE) a `user_id = (SELECT auth.uid())` feltétel érvényesül. 

## Consequences

**Pozitív:**
- A push beállítások megmaradnak oldalfrissítés után.
- Alapértelmezett opt-out, így nem spammeljük a felhasználókat.
- A struktúra előkészíti a terepet a tényleges Web Push küldő szolgáltatás bekötéséhez.

**Negatív:**
- Jelenleg csak a beállítások tárolódnak. A tényleges böngészős Push Notification (Service Worker regisztráció és Supabase Edge Function hívás) egy későbbi fázis feladata.

## Kapcsolódó
- [A-030: Accounty Email Notification Architecture](./A-030-accounty-email-notifications.md)
