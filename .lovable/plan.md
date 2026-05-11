# Mit látsz a console-ban

```
[RealtimeSync] Channel: CLOSED
  at LiveNotificationProvider.tsx:333
[RealtimeSync] ✅ Connected
[RealtimeSync] Channel: CLOSED
```

## Miért történik

A `LiveNotificationProvider` `useEffect`-je a `companyId`-tól függ (sor 381). Cégváltáskor:

1. Régi effect cleanup → `supabase.removeChannel(channelRef.current)` (sor 377).
2. A bezárt csatorna `subscribe` callback-je tüzel **`CLOSED` státusszal** (sor 329-335) — ez normál Supabase Realtime viselkedés.
3. Új effect lefut → új csatorna nyit → `SUBSCRIBED` → `✅ Connected`.
4. Esetenként még egy `CLOSED` érkezik a régi csatorna véglegesítéséről (network race).

A `CLOSED` státusz **`console.warn`**-ként logolódik (sor 333), ezért látszik narancs figyelmeztetésnek — pedig csak egy várt teardown esemény.

**Funkcionálisan minden rendben**: a `✅ Connected` sor mutatja, hogy az új cég csatornája él. Csak a log zajos.

## Javítási terv

A `subscribe` callback-ben különítsük el a várt teardown-t (`CLOSED` cleanup után) a tényleges hibáktól:

1. Vezessünk be egy `cancelledRef` / lokális `cancelled` flag-et (már létezik a sor 87-en) és a callback-be juttassuk be — ha a cleanup már lefutott, a `CLOSED` ne logoljon, vagy csak `console.debug`-gal.
2. A `CLOSED` státuszt általánosan kezeljük `console.debug` szinten (várt esemény minden teardown-nál), és csak a `CHANNEL_ERROR` / `TIMED_OUT` maradjon `console.warn`.
3. Opcionálisan: a `removeChannel` előtt explicit `channel.unsubscribe()`, hogy a `CLOSED` callback determinisztikusan a cleanup ágához rendelhető legyen.

## Érintett fájl
- `src/components/LiveNotificationProvider.tsx` (sor 329-335 + cleanup sor 376-379)

Ez egy ~5 soros, kockázatmentes log-tisztítás. Sem a Realtime-, sem a notifikációs logikát nem érinti.
