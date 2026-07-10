# A-034: Accounty Digest Összefoglaló Működése

**Status:** Decided
**Date:** 2026-07-10
**Utoljára frissítve:** 2026-07-10

## Context
Az eaisyBooks felhasználói felületén egy új modul, az "Összefoglaló (Digest)" jelent meg, ami lehetővé teszi a könyvelők számára, hogy a sok különálló értesítés helyett egyetlen napi, heti vagy kétheti összesítő hírlevelet (Digest) kapjanak. 
Két fontos technikai döntést kellett meghozni:
1. **Tárolás:** Hogyan tároljuk ezt a viszonylag komplex (8+ property) beállítást az adatbázisban?
2. **Kiküldés:** Hogyan oldjuk meg, hogy különböző könyvelők különböző órákban (07:00, 08:00, 17:00 stb.) kérhessék a levelet?

## Decision

**1. Dedikált oszlopok JSONB helyett:**
A felhasználó kifejezett kérése alapján a `digest_*` beállításokat NEM egyetlen JSONB oszlopba zsúfoltuk az `accounty_email_preferences` táblán belül, hanem 8 darab dedikált `boolean` és `text` oszlopot vettünk fel.
*(Oszlopok: digest_enabled, digest_frequency, digest_delivery_time, digest_include_kpis stb.)*

**2. Óránkénti Cron + Edge Function szűrés:**
Mivel a beállított órák változóak lehetnek, nem hozhattunk létre mindegyikhez (07:00, 08:00, 09:00...) külön cron jobot. Helyette létrehoztunk egyetlen **óránként futó Cron Job-ot** (`accounty-digest-hourly`), amely minden óra 0. percében meghívja a `send-accounty-digest` Edge Function-t.
Az Edge Function maga végzi el a szűrést:
`eq('digest_delivery_time', currentDeliveryTime)`.

## Consequences
**Pozitív:**
- A dedikált oszlopok nagyon gyorssá és típusbiztossá teszik a lekérdezést (nem kell JSON operátorokkal szűrni a Supabase-ben).
- Az óránkénti futás robosztus és könnyen skálázható bármilyen új időpont bevezetésénél (csak a frontend legördülőjét kell bővíteni).
- A kód szigorúan ügyfél-izolált: CSAK a megfelelő órában és frekvencián értesít.

**Negatív:**
- Az Edge Function napi 24-szer fut le feleslegesen, ami minimális plusz terhelést (kb. 24 kérés/nap) generál a Supabase infrastruktúrán, még akkor is, ha éjjel senki nem kér levelet. Ez a trade-off vállalható.

## Kapcsolódó
- [A-030: Accounty Email Notification Architecture](./A-030-accounty-email-notifications.md)
- [A-005: Edge Functions](./A-005-edge-functions.md)
