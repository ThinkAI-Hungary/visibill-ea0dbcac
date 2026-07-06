# A-030: Accounty Email Notification Architecture

**Status:** Decided  
**Date:** 2026-07-05  
**Utoljára frissítve:** 2026-07-06

## Context

Az eaisyBooks (Accounty) modulban az email értesítések beállítási UI-ja létezett, de **teljes mértékben mock** volt: `useState` hardcoded defaults-szal, DB mentés nélkül. Frissítéskor az összes beállítás visszaállt alapértékre.

Az eaisybill oldalon már létezett egy működő `user_email_preferences` tábla + `send-notification-email` Edge Function, de ez kizárólag az eaisybill (számlázó) modul értesítéseire vonatkozott (`noreply@mail.visibill.hu` feladó).

**Kérdés:** Hogyan valósítsuk meg az eaisyBooks email értesítéseit úgy, hogy:
1. A felhasználó be/ki tudja kapcsolni az egyes típusokat
2. A beállítások megmaradjanak oldal frissítés után (DB persist)
3. Az értesítések a bejelentkezett felhasználó email címére menjenek
4. Az eaisyBooks modulnak saját feladó címe legyen (`info@mail.visibill.hu`)
5. A meglévő eaisybill értesítéseket ne érintse

## Decision

### 1. Külön `accounty_email_preferences` tábla

A meglévő `user_email_preferences` tábla **bővítése helyett** külön táblát hoztunk létre:

| Aspektus | `user_email_preferences` (eaisybill) | `accounty_email_preferences` (eaisyBooks) |
|----------|--------------------------------------|-------------------------------------------|
| Oszlopok | `invoice_processed`, `subscription_warnings`, stb. | `missing_invoice_alert`, `approval_request`, stb. |
| EF | `send-notification-email` | `send-accounty-notification` |
| Feladó | `noreply@mail.visibill.hu` | `info@mail.visibill.hu` |
| Frontend | `EmailPreferences` komponens | `AccountyNotificationPreferences` komponens |

**Miért nem közös tábla?**
- A két modul (eaisybill vs eaisyBooks) teljesen eltérő notification típusokat kezel
- Egy közös tábla 20+ boolean oszlopot eredményezne, amelyek többsége irreleváns a felhasználó moduljától függően
- Az eaisyBooks értesítések céghez kötöttek (accounty_assignments), az eaisybill-ek nem
- Egyszerűbb karbantartás, RLS policies, és jövőbeli bővítés

### 2. Preference-gated email küldés

A `send-accounty-notification` Edge Function minden küldés előtt ellenőrzi a `accounty_email_preferences` táblát:

```
Trigger event (hiányzó számla / jóváhagyás / stb.)
    ↓
send-accounty-notification EF
    ↓
SELECT [pref_column] FROM accounty_email_preferences WHERE user_id = $1
    ↓  true / NULL (default: send)          ↓  false
Resend API → info@mail.visibill.hu          Skip (opted_out)
    ↓
Log → outgoing_emails tábla
```

Ha nincs sor a `accounty_email_preferences` táblában, az alapértékek érvényesek (küld).

### 3. Dual trigger model

| Trigger típus | Honnan | Példa |
|--------------|--------|-------|
| **Frontend trigger** | UI action → `supabase.functions.invoke()` | Jóváhagyási kérelem: `addToApprovalQueue()` → notification EF |
| **Backend trigger** | Cron/EF → EF-to-EF hívás (service_role) | Hiányzó számla: `accounty-detect-missing` → notification EF |

### 4. Felhasználó email cím source

Az `auth.users` tábla email mezőjét használjuk (`supabase.auth.admin.getUserById(user_id)`), nem a `profiles` táblát. Ez biztosítja, hogy mindig az aktuális, verified email címre megy az értesítés.

## Consequences

**Pozitív:**
- Felhasználó teljes kontrollja az értesítésekről (6 toggle)
- Beállítások persist — frissítés, kijelentkezés után megmaradnak
- Modulárisan bővíthető: új notification típus = 1 oszlop + 1 mapping
- Két modul (eaisybill / eaisyBooks) teljesen független marad

**Negatív:**
- Két külön preferences tábla és két EF karbantartandó (de a modulok is elkülönültek)
- Push és Digest értesítések egyelőre csak UI mock — infrastruktúra nélkül

## Kapcsolódó
- [A-005: Edge Functions](./A-005-edge-functions.md) — `send-accounty-notification` katalógus bejegyzés
- [A-021: Email Auth Flow Redesign](./A-021-email-auth-flow-redesign.md) — email címkezelés
- [13-eaisybooks-core.md](../database/13-eaisybooks-core.md) — `accounty_email_preferences` tábla séma
