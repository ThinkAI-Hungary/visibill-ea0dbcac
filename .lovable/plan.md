## Probléma

A `nav-auto-sync` edge function teljesen authentikáció nélkül elérhető (`verify_jwt = false` és kódban sincs ellenőrzés). Bárki POST kéréssel elindíthatja az összes cég NAV szinkronját, ami:
- terheli a NAV API-t (rate limit / blokk veszély),
- írja a `nav_invoices` és `nav_sync_logs` táblákat,
- N8N webhookot triggerel.

## Javítás célja

Beengedni **csak**:
1. a pg_cron ütemezett hívást, és
2. a függvény saját, mélységi self-reinvocation hívását,
úgy, hogy a működés (cron + reinvoke + frontend) ne sérüljön.

## Megoldás

### 1. `CRON_SECRET` bevezetése
- Generálok egy új secret-et `CRON_SECRET` néven (a Supabase Edge Function Secrets-be).
- Ezt használja a cron job és a self-reinvoke is.

### 2. `supabase/functions/nav-auto-sync/index.ts` – auth guard
A `Deno.serve` belső eleje után, a body parse előtt:

```ts
const cronSecret = Deno.env.get('CRON_SECRET');
const provided = req.headers.get('x-cron-secret');
if (!cronSecret || provided !== cronSecret) {
  return new Response(JSON.stringify({ error: 'Forbidden' }), {
    status: 403,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
```

A self-reinvocation `fetch` hívást úgy módosítom, hogy `x-cron-secret` headert küldjön a `CRON_SECRET` értékével (az eddigi `Authorization: Bearer <service role>` header maradhat vagy törölhető – a guard önállóan elég; én meghagyom a Bearer-t a kompatibilitás miatt).

### 3. `config.toml`
A `nav-auto-sync` már `verify_jwt = false`, ez így marad (cron nem tud user JWT-t küldeni). A védelmet a `CRON_SECRET` header adja.

### 4. Cron job frissítése
Új SQL futtatása, ami **újrarögzíti** a `nav-daily-sync` cron jobot, hogy `x-cron-secret` headert küldjön. A korábbi anon-key bearer headert eltávolítom (nem ad semmi védelmet, és így a publikált SQL-ben szereplő anon key sem kell). A cron job SQL bekerül `supabase/setup-nav-cron.sql`-be is dokumentációként, de a futtatást a `supabase--insert` tool-lal végzem (user-specifikus secret + URL miatt nem migration).

```sql
SELECT cron.unschedule('nav-daily-sync');
SELECT cron.schedule(
  'nav-daily-sync',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/nav-auto-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET értéke>'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

## Mellékhatás-ellenőrzés

- **Frontend**: a kódbázisban a `nav-auto-sync` függvényt frontend nem hívja (csak `nav-sync`, `nav-token`, stb. — lásd `02-edge-functions-catalog.md`), tehát user-facing flow nem törik.
- **Cron**: új SQL után a napi sync ugyanúgy megy, csak már secret-tel.
- **Self-reinvoke**: a depth-alapú újrahívás a `CRON_SECRET` headerrel átmegy a guarodon, így a részlet-letöltő láncolt futás működik tovább.
- **Más edge function**: nincs érintve.

## Lépések sorrendje

1. `CRON_SECRET` secret létrehozása (`generate_secret`).
2. `supabase/functions/nav-auto-sync/index.ts` szerkesztése: guard hozzáadása + self-reinvoke header bővítése.
3. `supabase/setup-nav-cron.sql` frissítése (dokumentáció, az anon key kikerül).
4. `supabase--insert` futtatása: `cron.unschedule` + új `cron.schedule` a secret-tel.
5. Verifikáció: edge function logokból visszanézni, hogy a következő cron futás 200-zal megy és a 403 már csak ismeretlen hívóknál jelenik meg.
