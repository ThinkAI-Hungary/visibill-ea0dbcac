# A-030: Accounty Email Notification Architecture

**Status:** Decided  
**Date:** 2026-07-05  
**Utoljára frissítve:** 2026-07-07

## Context

Az eaisyBooks (Accounty) modulban az email értesítések beállítási UI-ja létezett, de **teljes mértékben mock** volt: `useState` hardcoded defaults-szal, DB mentés nélkül. Frissítéskor az összes beállítás visszaállt alapértékre.

Az eaisybill oldalon már létezett egy működő `user_email_preferences` tábla + `send-notification-email` Edge Function, de ez kizárólag az eaisybill (számlázó) modul értesítéseire vonatkozott (`noreply@mail.visibill.hu` feladó).

**Kérdés:** Hogyan valósítsuk meg az eaisyBooks email értesítéseit úgy, hogy:
1. A felhasználó be/ki tudja kapcsolni az egyes típusokat
2. A beállítások megmaradjanak oldal frissítés után (DB persist)
3. Az értesítések a bejelentkezett felhasználó email címére menjenek
4. Az eaisyBooks modulnak saját feladó címe legyen (`info@mail.visibill.hu`)
5. A meglévő eaisybill értesítéseket ne érintse
6. Az ügyfél kapcsolattartók is kaphassanak értesítést (hiányzó számlákról)

## Decision

### 1. Külön `accounty_email_preferences` tábla (könyvelő beállítások)

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

### 2. Dual-mode `send-accounty-notification` EF

A `send-accounty-notification` Edge Function **két módot** támogat:

#### MODE A: Könyvelő (accountant) — `recipient_type` nem megadva
```
Trigger event (hiányzó számla / jóváhagyás / stb.)
    ↓
send-accounty-notification EF (user_id alapján)
    ↓
SELECT [pref_column] FROM accounty_email_preferences WHERE user_id = $1
    ↓  true                        ↓  false / NULL / nincs sor
Resend API → info@mail.visibill.hu  Skip (opted_out / no_prefs_row)
    ↓
Log → outgoing_emails tábla (category: 'normal')
```

#### MODE B: Ügyfél kapcsolattartó — `recipient_type = 'client_contact'`
```
accounty-detect-missing EF talál hiányt
    ↓
Check: accounty_communication_preferences
  - contact_email létezik?
  - channel_email !== false?
  - auto_reminder !== false?
  - gdpr_opted_in === true?
    ↓ mind true
send-accounty-notification EF (recipient_email alapján)
    ↓
Resend API → info@mail.visibill.hu (wrapClientHtml template)
    ↓
Log → outgoing_emails tábla (category: 'client_notification')
```

### 3. Opt-in logika (v2 — javított)

**Eredeti (hibás):** Ha nincs sor a `accounty_email_preferences` táblában → `null` → az email elment (default: küld).

**Javított:** Ha nincs sor VAGY a mező nem `=== true` → **skip**. Csak explicit opt-in esetén küld.

```typescript
// RÉGI (hibás):
if (prefs && prefs[prefColumn] === false) { skip }

// ÚJ (javított):
if (!prefs || prefs[prefColumn] !== true) { skip }
```

### 4. Default értékek: minden KI

| Réteg | `channel_email` | `auto_reminder` | `gdpr_opted_in` |
|-------|----------------|-----------------|-----------------|
| DB DEFAULT | `false` | `false` | `false` |
| Frontend useState | `false` | `false` | `false` |
| Frontend upsert fallback | `false` | `false` | N/A |

A könyvelőnek explicit be kell kapcsolnia az ügyfél értesítéseket + az ügyfél GDPR hozzájárulását.

### 5. Dual trigger model

| Trigger típus | Honnan | Példa |
|--------------|--------|-------|
| **Frontend trigger** | UI action → `supabase.functions.invoke()` | Jóváhagyási kérelem: `addToApprovalQueue()` → notification EF |
| **Backend trigger** | Cron/EF → EF-to-EF hívás (service_role) | Hiányzó számla: `accounty-detect-missing` → notification EF |

### 6. Felhasználó email cím source

Az `auth.users` tábla email mezőjét használjuk (`supabase.auth.admin.getUserById(user_id)`), nem a `profiles` táblát. Ez biztosítja, hogy mindig az aktuális, verified email címre megy az értesítés.

Az ügyfél kapcsolattartó mód esetén az `accounty_communication_preferences.contact_email` mezőt használjuk.

## Consequences

**Pozitív:**
- Felhasználó teljes kontrollja az értesítésekről (6 toggle)
- Beállítások persist — frissítés, kijelentkezés után megmaradnak
- Modulárisan bővíthető: új notification típus = 1 oszlop + 1 mapping
- Két modul (eaisybill / eaisyBooks) teljesen független marad
- Ügyfél kapcsolattartók is kaphatnak értesítést (GDPR-kompatibilis, opt-in alapú)
- Opt-in logika: csak explicit bekapcsolás után küld (no silent emails)

**Negatív:**
- Két külön preferences tábla és két EF karbantartandó (de a modulok is elkülönültek)
- Push és Digest értesítések egyelőre csak UI mock — infrastruktúra nélkül
- Telegram/Viber csatorna egyelőre nem implementált (tervezett)

## Kapcsolódó
- [A-005: Edge Functions](./A-005-edge-functions.md) — `send-accounty-notification` katalógus bejegyzés
- [A-021: Email Auth Flow Redesign](./A-021-email-auth-flow-redesign.md) — email címkezelés
- [13-eaisybooks-core.md](../database/13-eaisybooks-core.md) — `accounty_email_preferences` tábla séma

