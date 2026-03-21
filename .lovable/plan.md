
# Audit: Bérek Real-time értesítés hiánya — Gyökérok és javítás

## Feltárt problémák

### 1. KRITIKUS: `salaries_status_check` CHECK constraint blokkolja az edge function-t

A `salary_files` táblán egy CHECK constraint (`salaries_status_check`) csak a következő státuszokat engedi:
`'pending'`, `'paid'`, `'cancelled'`, `'overdue'`

A `trigger-salary-processing` edge function viszont `'processing'`, `'webhook_sent'`, `'webhook_failed'` értékeket próbál beállítani — mindegyik **sikertelen** (23514 hiba). A logokban **16+ ilyen hiba** van az utolsó feltöltésekből.

**Következmény:** A `salary_files.status` örökre `'pending'` marad, a feldolgozási állapot nem követhető.

### 2. Dupla webhook hívás (test + prod)

A `ManualUpload.tsx` **mindkét** webhook URL-re küld:
- `webhook-test/jarulek` → mindig 404-et ad
- `webhook/jarulek` → működik

Minden fájl feltöltésnél 2 felesleges edge function hívás történik, a test webhook mindig hibaüzenetet generál a logokban.

### 3. Real-time értesítés NEM érkezik meg

A `LiveNotificationProvider` helyesen figyeli a `salary` tábla INSERT eseményeit, és a `salary_file_id` alapján triggeli a "Gratulálunk!" toastot. A Supabase Realtime csatorna aktív (`SUBSCRIBED`), de a console logokban **egyetlen salary event sem jelenik meg**.

**Valószínű ok:** Az n8n a `service_role` kulccsal szúrja be a `salary` sorokat. Bár a Supabase Realtime elvileg kézbesíti ezeket az eseményeket RLS-alapú szűréssel, a gyakorlatban **service-role INSERT-ek gyakran nem érkeznek meg az anon-key feliratkozókhoz** — ez egy ismert Supabase viselkedés.

### 4. `partners` tábla hiányzik a Realtime publikációból

A `LiveNotificationProvider` figyeli a `partners` táblát, de az **nincs hozzáadva** a `supabase_realtime` publikációhoz. Így a partners események soha nem érkeznek meg.

---

## Javítási terv

### 1. DB migráció: CHECK constraint bővítés + partners Realtime

```sql
-- Bővítjük a status constraint-et
ALTER TABLE salary_files DROP CONSTRAINT salaries_status_check;
ALTER TABLE salary_files ADD CONSTRAINT salaries_status_check
  CHECK (status IN ('pending','paid','cancelled','overdue','processing','webhook_sent','webhook_failed','completed'));

-- Partners hozzáadása a Realtime publikációhoz
ALTER PUBLICATION supabase_realtime ADD TABLE partners;
```

### 2. Edge function: `trigger-salary-processing` frissítés

Amikor a webhook sikeres és az n8n válaszol, az edge function frissítse a `salary_files.status`-t `'completed'`-re (a korábban blokkolt `'webhook_sent'` helyett, vagy most már az is működik).

### 3. ManualUpload: Test webhook eltávolítása

A `webhook-test/jarulek` URL eltávolítása — csak a produkciós `webhook/jarulek`-et hívjuk.

### 4. Notification fallback: Polling a salary feltöltések után

Mivel a Realtime service-role INSERT-ek megbízhatatlanok, a `ManualUpload.tsx`-ben a bérfeltöltés után egy **időzített polling** biztonsági hálót adunk hozzá:
- 5 és 15 másodperc után ellenőrizzük, hogy megjelentek-e új `salary` sorok az adott `salary_file_id`-vel
- Ha igen ÉS a toast még nem jelent meg, megjeleníjük a "Gratulálunk!" értesítést
- Invalidáljuk a `salaries` és `salary_files` query cache-t

### 5. LiveNotificationProvider: `salary_files` UPDATE figyelés javítása

A `salary_files` UPDATE eseményre is figyeljünk: ha a `status` `'completed'`-re vált, az is triggerelhet értesítést — ez egy másodlagos csatorna a Realtime-on keresztül (ha az UPDATE event megérkezik).

---

## Érintett fájlok

| Fájl | Módosítás |
|---|---|
| DB migráció | CHECK constraint + Realtime publication |
| `supabase/functions/trigger-salary-processing/index.ts` | Status értékek frissítése |
| `src/pages/ManualUpload.tsx` | Test webhook eltávolítás + polling fallback |
| `src/components/LiveNotificationProvider.tsx` | `salary_files` UPDATE → notification trigger |
