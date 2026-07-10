# A-032: Accounty Push Notification Preferences

**Status:** Decided  
**Date:** 2026-07-09  

## Context

Az eaisyBooks (Accounty) modulban a Push értesítések beállítási felülete létezett, de korábban csak mock UI volt. Az e-mail értesítések (A-030) mintájára szükségessé vált a Push beállítások perzisztálása az adatbázisban, hogy a felhasználók be- és kikapcsolhassák a különböző push eseményeket (pl. hiányzó számla, határidő, ügyfél státusz változás).

Kritikus üzleti követelmény, hogy **alapértelmezetten minden push beállítás ki van kapcsolva (false)** minden felhasználónál, és önállóan dönthetnek a bekapcsolásáról.

## Decision

### 1. Push Preferences és Subscriptions táblák

Az `accounty_email_preferences` mintájára egy dedikált táblát hoztunk létre a Push beállításoknak (`accounty_push_preferences`). 
Mivel a Push és E-mail értesítések teljesen eltérő csatornák, a Web Push subscription adatok (endpoint, auth keys) külön tárolódnak egy dedikált táblában (`accounty_push_subscriptions`), ami 1:N kapcsolatban áll a user-rel (több eszköz / böngésző).

**Séma (`accounty_push_preferences`):**
- `user_id` (uuid, FK auth.users, UNIQUE)
- `enabled` (boolean)
- `missing_invoice_alert` (boolean)
- `deadline_reminder` (boolean)
- `client_status_change` (boolean)
- `approval_request` (boolean)
- `critical_alerts` (boolean)

*Minden boolean mező alapértelmezett értéke: `false`.*

**Séma (`accounty_push_subscriptions`):**
- `id` (uuid, PK)
- `user_id` (uuid, FK auth.users, ON DELETE CASCADE)
- `endpoint` (text, UNIQUE)
- `auth_key` (text)
- `p256dh_key` (text)

### 2. Frontend működés (AccountyNotificationPreferences.tsx)

A beállítások oldal a komponens betöltésekor párhuzamosan (`Promise.all`) kéri le az e-mail és a push beállításokat. Ha a felhasználónak még nincs sora a `accounty_push_preferences` táblában, akkor a default false értékekkel inicializálódik a UI. 
Amikor a felhasználó a böngészőben engedélyezi a push értesítéseket, az `enabled` mező automatikusan `true`-ra vált az adatbázisban, és a háttérben megtörténik a Service Worker regisztrációja (a `vite-plugin-pwa` használatával), aminek eredményét (endpoint, kulcsok) lementi a `accounty_push_subscriptions` táblába.
Az `AuthContext`-be bekötött `usePushNotifications` hook gondoskodik róla, hogy bejelentkezéskor automatikusan újra-feliratkozzon (Auto-Restore), kijelentkezéskor pedig leiratkozzon (törölje az adott eszköz endpoint-ját a DB-ből) a biztonság érdekében.

### 3. Biztonság (RLS)

A táblák Row Level Security (RLS) védelemmel vannak ellátva.
Minden műveletnél (SELECT, INSERT, UPDATE, DELETE) a `user_id = (SELECT auth.uid())` feltétel érvényesül. 

### 4. Backend (Edge Function)

A push értesítések kiküldése a `send-web-push` Edge Function-ben történik, amely be van kötve a fő `send-accounty-notification` flow-ba. Így bármilyen esemény, amely idáig csak e-mailt küldött, aszinkron módon meghívja a `send-web-push`-t is, ami leellenőrzi a preferenciákat, lekéri az aktív subscription-öket, és a VAPID kulcsok (Supabase Secrets-ben tárolva) segítségével kiküldi a push üzenetet az adott felhasználó minden eszközére.

## Consequences

**Pozitív:**
- A push beállítások megmaradnak oldalfrissítés után.
- Alapértelmezett opt-out, így nem spammeljük a felhasználókat.
- Teljes End-to-End integráció: a régi notification flow érintetlen maradt, a push párhuzamosan és aszinkron módon működik.
- Auto-Restore és biztonságos leiratkozás Auth eventeken.

## Kapcsolódó
- [A-030: Accounty Email Notification Architecture](./A-030-accounty-email-notifications.md)
