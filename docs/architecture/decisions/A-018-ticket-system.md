# A-018: Hibajegy Rendszer Architektúra

**Status:** Decided  
**Date:** 2025-12 (utolsó frissítés: 2026-09-11)

## Context

A hibajegy rendszernek támogatnia kell a real-time kommentelést, olvasatlan követést, és trigger-alapú event sourcing-ot. Külső tool helyett Supabase-natív megoldásra építünk.

## Decision

### Adatmodell

**4 tábla — `feedback` (fő), `ticket_comments`, `ticket_events`, `ticket_reads`:**

```
feedback (fő tábla)
├── id: uuid (PK)
├── user_id: uuid (FK → auth.users, bejelentő)
├── company_id: uuid (FK → companies)
├── company_name: text (denormalizált — gyors listázás)
├── type: text ('bug' | 'feedback' | 'question')
├── service: text ('eaisybill' | 'accounty')
├── message: text
├── status: text ('created' | 'in_progress' | 'resolved')
├── priority: text ('low' | 'medium' | 'high' | 'critical')
├── page_url: text (automatikus — beküldés kontextusa)
├── attachments: text[] (Storage URL-ek)
├── ticket_number: text (trigger generálja)
├── assigned_to: uuid (FK → auth.users, felelős support agent)
├── created_by: uuid (FK → profiles, staff-initiated jegy esetén)
├── waiting_for_user_confirmation: boolean (megoldás-visszaigazolás folyamatban)
├── resolution_requested_at: timestamptz (megoldás kérés ideje)
├── resolution_requested_by: uuid (FK → profiles, megerősítést kérő admin)
├── resolution_confirmed_at: timestamptz (ügyfél megerősítés ideje)
├── slack_sent: boolean + slack_sent_at: timestamptz
├── created_at / updated_at: timestamptz
│
├── ticket_comments (1:N)
│   ├── feedback_id: uuid (FK → feedback)
│   ├── user_id: uuid (FK → auth.users)
│   ├── user_name, user_email: text (denormalizált)
│   ├── is_admin: boolean (support badge megjelenítés)
│   ├── message: text
│   ├── attachments: text[]
│   ├── is_internal: boolean (belső komment, user nem látja)
│   └── created_at: timestamptz
│
├── ticket_events (1:N, audit trail)
│   ├── feedback_id: uuid (FK → feedback)
│   ├── event_type: text ('created' | 'status_changed' | 'comment_added' | 'assignee_changed' | 'resolution_requested' | 'resolution_confirmed' | 'resolution_rejected')
│   ├── actor_id, actor_email, actor_name: user info
│   ├── old_value, new_value: text (pl. 'created' → 'in_progress')
│   ├── metadata: jsonb
│   └── created_at: timestamptz
│
└── ticket_reads (user olvasási állapot)
    ├── feedback_id: uuid + user_id: uuid (UNIQUE constraint)
    └── last_read_at: timestamptz
```

### Naming Decision: `feedback` vs `tickets`

A fő tábla neve `feedback` maradt a legacy-ből — eredetileg egyszerű visszajelzés volt, később bővült teljes ticket rendszerré. A kiegészítő táblák (`ticket_comments`, `ticket_events`, `ticket_reads`) már a „ticket" névkonvenciót követik. **Ez inkonsisztencia**, de a fő tábla átnevezése (rename + FK migration) túl nagy kockázat a meglévő RLS policy-k, trigger-ek és frontend hivatkozások miatt.

### Trigger-alapú Event Sourcing

```sql
-- 1. Automatikus jegyszám: EB-0001, EB-0002, ...
CREATE FUNCTION generate_ticket_number()  -- BEFORE INSERT ON feedback
-- A public.feedback_ticket_number_seq szekvencia következő értékéből lpad segítségével generál sorszámot.

-- 2. Létrehozás event
CREATE FUNCTION create_ticket_created_event()  -- AFTER INSERT ON feedback
-- Beszúr ticket_events-be: event_type='created'

-- 3. Státusz és felelős változás event
CREATE FUNCTION create_ticket_status_event()  -- AFTER UPDATE ON feedback
-- Ha status változott → ticket_events: event_type='status_changed', old/new value
-- Ha assigned_to változott → ticket_events: event_type='assignee_changed',
--   old/new value a felelős neve (profiles.name lookup)
-- Actor (módosító user) nevét és emailjét is loggolja

-- 4. Komment event (duplikáció-védelemmel)
CREATE FUNCTION create_comment_event()  -- AFTER INSERT ON ticket_comments
-- Beszúr ticket_events-be: event_type='comment_added'
-- KIVÉTEL: Az automatikus megoldás-megerősítési rendszerkommenteknél nem szúr be duplikált 'comment_added' eseményt,
-- mert a 'resolution_confirmed' esemény már önmagában reprezentálja a műveletet az audit trailben.

-- 5. updated_at frissítés
CREATE FUNCTION update_feedback_updated_at()  -- BEFORE UPDATE ON feedback
-- updated_at = NOW()
```

Mind az 5 trigger function `SECURITY DEFINER` + `search_path = 'public'`.

### Megoldás-Visszaigazolás és Automatikus Lezárás (2026-09)

A support munkatárs a megoldás elkészülte után megerősítést kérhet az ügyféltől:

1. **Kérés indítása (`request_ticket_resolution` RPC):**
   - Support admin vagy management munkatárs jogosult meghívni.
   - Beállítja: `waiting_for_user_confirmation = true`, `resolution_requested_at = NOW()`, `resolution_requested_by = auth.uid()`.
   - `ticket_events` audit bejegyzést hoz létre: `event_type = 'resolution_requested'`.
2. **Ügyfél visszajelzés (`respond_to_ticket_resolution` RPC):**
   - Ügyfél (`user_id = auth.uid()`) vagy support admin hívhatja meg.
   - **Ha megerősíti (`p_confirmed = true`):**
     - Automatikusan lezárja a jegyet: `status = 'resolved'`, `waiting_for_user_confirmation = false`, `resolution_confirmed_at = NOW()`.
     - `ticket_events` bejegyzés: `event_type = 'resolution_confirmed'`.
     - Rendszerkomment: *"Az ügyfél megerősítette: a probléma megoldódott. A hibajegy automatikusan lezárásra került."*
   - **Ha elutasítja (`p_confirmed = false`):**
     - Marad folyamatban: `status = 'in_progress'`, `waiting_for_user_confirmation = false`.
     - `ticket_events` bejegyzés: `event_type = 'resolution_rejected'`.
     - Ha megadott indoklást, azt új hozzászólásként beszúrja a szálba.
3. **Automatikus reset trigger (`trg_ticket_comment_resolution_reset`):**
   - Ha a jegy bejelentője megerősítésre váró jegyre új normál hozzászólást küld be, a trigger automatikusan visszaállítja a `waiting_for_user_confirmation = false` állapotot.
4. **Audit esemény deduplikáció:**
   - A `create_comment_event()` adatbázis trigger kihagyja az automatikus megerősítő rendszerkommenteknél a `comment_added` esemény generálását.
   - A frontend `TicketTimeline.tsx` további védelmi szűrővel rendelkezik, amely a `resolution_confirmed` eseményhez 15 másodpercen belül tartozó `comment_added` elemeket elrejti, megelőzve a megtévesztő "Üzenetet írt" bejegyzést.

### RLS Stratégia

| Tábla | Policy | Leírás |
|---|---|---|
| `feedback` SELECT | `user_id = auth.uid()` | User csak a sajátját látja |
| `feedback` SELECT | `is_support_admin()` | Support admin minden jegyet lát |
| `feedback` INSERT | `user_id = auth.uid()` | User csak sajátját hozhatja létre |
| `feedback` UPDATE | `is_support_admin()` | Support admin módosíthat (státusz, felelős) |
| `ticket_comments` SELECT | `USING (true)` | Bárki olvashat (a feedback RLS védi az FK-n) |
| `ticket_comments` INSERT | `user_id = auth.uid()` | Csak saját kommentet írhat |
| `ticket_events` SELECT | `USING (true)` | Bárki olvashatja (audit trail) |
| `ticket_reads` SELECT/INSERT/UPDATE | `user_id = auth.uid()` | Csak saját olvasási állapot |

**Admin hozzáférés:** Az `is_support_admin()` DB function ellenőrzi a `profiles.is_support_admin` flag-et. Dedikált SELECT és UPDATE policy-k biztosítják a support admin hozzáférést.

### Olvasatlan Detektálás

A rendszer két független forrásból származtatja az olvasatlan állapotot mind a `get_unread_ticket_count` RPC-ben, mind a kliensoldali `useTickets.ts` (`has_unread`) logikában:

```sql
-- 1. Feltétel: Beérkezett új komment más felhasználótól
ticket_reads.last_read_at IS NULL OR ticket_reads.last_read_at < max(ticket_comments.created_at WHERE user_id ≠ current_user)

-- 2. Feltétel (2026-09): Megoldás-visszaigazolás kérése az ügyféltől
waiting_for_user_confirmation = true 
AND resolution_requested_by <> current_user 
AND (ticket_reads.last_read_at IS NULL OR ticket_reads.last_read_at < feedback.resolution_requested_at)
```

- **Upsert pattern:** `ON CONFLICT (feedback_id, user_id) DO UPDATE SET last_read_at = NOW()`
- **Biztonságos olvasási életciklus (2026-09):** A frontend (`TicketDetailView`) az olvasottá jelölést (`markRead`) kizárólag a jegy sikeres betöltődése és validitása (`ticket?.id`) után futtatja le, elkerülve a törölt vagy nem létező azonosítókra indított mutációkat. A `useMarkTicketRead` hook csendben elnyeli a PostgreSQL `23503` (Foreign Key violation) hibakódot az esetleges versenyhelyzetek kezelésére.
- A sidebar badge és a felületi számlálók a `useUnreadTicketCount` hook-ból származnak

### Real-time Subscription

```typescript
supabase
  .channel('unread-ticket-count')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'ticket_comments',
  }, () => {
    queryClient.invalidateQueries({ queryKey: ["unread_ticket_count"] });
  })
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'feedback',
  }, () => {
    queryClient.invalidateQueries({ queryKey: ["unread_ticket_count"] });
  })
  .subscribe();
```

Minden új komment és minden feedback módosítás (pl. visszaigazolás kérése vagy megerősítése) azonnali cache invalidationt vált ki, azonnal frissítve az olvasatlan jelvényeket és a listát.

### Idővonal (Timeline) Folyamatos Vonal Architektúra

A korábbi, konténer-szintű egyetlen abszolút függőleges vonal hosszú vagy dinamikusan növekvő jegytörténet és belső görgetés esetén elcsúszhatott vagy megszakadhatott.  
Az új felépítésben minden egyes idővonal-elem (`TicketTimelineItem`) saját, elemen belüli összekötő vonalat kapott:
```tsx
<div className="absolute left-4 top-4 -bottom-2 w-px bg-border -translate-x-1/2 z-0" />
```
A vonal az adott elem ikonjától a következőig fut le, és automatikusan rejtve van az utolsó elemnél (`!isLast`). Ez szavatolja, hogy a vonal 100%-ban folytonos marad bármilyen DOM újrarajzolás, dinamikus magasság vagy görgetés esetén is.

### Storage

- **Bucket:** `ticket-attachments` (public bucket)
- **Path:** `{ticketId}/{userId}/{filename}`
- **Engedélyezett típusok:** JPEG, PNG, GIF, WebP, PDF, CSV, XLS, XLSX, XML (`application/xml`, `text/xml`)
- **Limit:** max 5 fájl / komment, max 10MB / fájl
- **Policy:** Public read (link-el elérhető), authenticated insert
- **Feltöltési védelem:** Kiterjesztés-alapú tartalék ellenőrzés (.xml) és explicit `contentType` továbbítás a Supabase Storage felé

### Slack Integráció

- A `feedback` táblában `slack_sent` boolean + `slack_sent_at` timestamp
- Külön folyamat (edge function / webhook) értesíti a Slack-et új jegyekről
- A frontend nem kezeli — DB trigger vagy scheduled job

### Indexek

```sql
idx_feedback_user_id           ON feedback(user_id)
idx_feedback_company_id        ON feedback(company_id)
idx_feedback_status            ON feedback(status)
idx_ticket_comments_feedback_id ON ticket_comments(feedback_id)
idx_ticket_events_feedback_id   ON ticket_events(feedback_id)
idx_ticket_reads_feedback_user  ON ticket_reads(feedback_id, user_id)
```

## Consequences

**Pozitív:**
- Trigger-alapú event sourcing → megbízható audit trail, a frontend nem felelős az event írásáért
- Kétlépcsős lezárási mechanizmus (ügyfél megerősítés) → jobb ügyfélélmény és elkerülhető a hibák idő előtti adminisztratív lezárása
- Dedikált unread állapot feloldás a megoldás kéréséhez → az ügyfél garantáltan észreveszi az értesítést
- Upsert-alapú read tracking → egyszerű, idempotens, nincs race condition
- Supabase Realtime több táblán → instant badge és lista szinkronizáció
- Denormalizált `company_name`, `user_name`, `user_email` → gyors listázás join nélkül
- Felelős (assignee) változás automatikus logolás → átlátható support workflow

**Negatív:**
- `feedback` vs `ticket_*` névkonvenció inkonzisztencia
- `ticket_comments` SELECT `USING (true)` — bármelyik authenticated user olvashatja bárki kommentjeit (a feedback FK-n keresztül a frontend véd, de API szinten nincs korlátozás)
- Denormalizáció → ha a user nevet változtat, a régi jegyekben marad a régi név

## Frontend funkciók (2026-06 állapot)

- **Státusz fordítás:** DB-ben `new` → frontend-en `Új` (normalizáció a hook-ban)

## Frontend funkciók (2026-08 frissítés)

- **Csoportos és Egyedi Felelős Kijelölés:** Support admin kijelölhet / módosíthat felelőst, ami timeline event-et generál.
- **Hozzászólás Zárolása Felelős Nélkül:** Ha a hibajegynek nincs kijelölt felelőse (`assigned_to`), a rendszer zárolja a hozzászólás mezőt, a fájlcsatolásokat, a belső feljegyzés jelölőt és a küldés gombot. Ezzel egy időben figyelmeztetést mutat a support adminoknak ("Kérjük, jelöljön ki egy felelőst...") és a klienseknek ("Kérjük, várja meg, amíg egy support munkatárs elvállalja...").
- **Admin Szűrő ("Összes ticket" Checkbox):** A support adminok számára a jegy listázása alapértelmezetten csak a **saját** és a **kiosztatlan** hibajegyeket mutatja. Egy szűrősávbeli jelölőnégyzettel ("Összes ticket") a szűrés feloldható a többi adminhoz rendelt jegyek megtekintéséhez.
- **Pagináció:** 15 jegy/oldal (user), 25 jegy/oldal (support admin)
- **Multi-status szűrő:** Több státusz egyidejű szűrése (pl. Új + Folyamatban) — Popover + Checkbox UI
- **Ticket típusok:** Hibajelentés (bug), Visszajelzés (feedback), Kérdés (question)
- **Prioritás:** Felhasználó választhatja meg a beküldéskor (low/medium/high/critical)
- **Clipboard paste:** Ctrl+V a hozzászólás mezőben képet csatol vágólapról
- **Kép előnézet:** Csatolt képek kattinthatók küldés előtt → fullscreen preview
- **Fullscreen galéria:** Portal-alapú overlay (z-index: 9999), teljes képernyős képnézegető

## Frontend & Architektúra funkciók (2026-09 frissítés)

- **Megoldás-Visszaigazolási Munkafolyamat (`TicketResolutionBanner`):** A support munkatárs megerősítést kérhet a megoldásról ("Megoldás jóváhagyás kérése"). Az ügyfél felületén letisztult, emoji-mentes megerősítő banner jelenik meg: jóváhagyáskor a jegy azonnal lezárul, elutasításkor indoklás adható meg, ami hozzászólásként kerül mentésre és visszateszi a jegyet folyamatban lévő státuszba.
- **Belső 404 Állapotkezelés (`TicketNotFoundView`):** A `TicketDetailView` szétválasztja az aktív aszinkron betöltési fázist (`isTicketLoading`) és a nem létező / törölt hibajegy állapotát (`!data?.ticket || isTicketError`). Ha a hibajegy törlésre került, a felület nem ragad be a skeleton loader állapotba, hanem a dedikált `TicketNotFoundView` kártyát jeleníti meg, garantálva a hibamentes visszanavigálást a hibajegylistára.
- **Szabványos Rich Text Szerkesztő (`RichTextEditor`):** TipTap StarterKit alapú szerkesztő félkövér, dőlt, áthúzott, címsor (H2, H3), felsorolás, számozott lista, idézet, inline kód és visszavonás/újra funkciókkal. `Ctrl+Enter` / `Cmd+Enter` gyorsbillentyű támogatással az azonnali beküldéshez (`onSubmit`).
- **Biztonságos és Tipográfiailag Stílusozott Megjelenítő (`RichTextContent`):** Biztonságos HTML és szöveges renderelés `prose prose-sm dark:prose-invert` osztályokkal. 100%-os visszafelé kompatibilitás a korábbi sima szöveges hibajegyekkel és hozzászólásokkal.
- **Kezelőkonzol (Console View) Keresés & Ergonómia:** A 2-hasábos konzol nézetben a keresőmező (`matchTicketSearch`) támogatja a `#` előtaggal beírt jegyszámokat (pl. `#EB-0094`), tárgyat, üzenetet, felhasználónevet, emailt és cégnevet. Mindkét keresőmező azonnali törlés (`X`) gombot kapott.
- **Kezelőkonzol Felelős-szűrés és „Összes jegy” Kapcsoló:** A Kezelőkonzol bal oldali listája (`consoleTickets`) a táblázathoz hasonlóan alapértelmezetten a `matchesOwner` szabályt követi (kizárólag a bejelentkezett operátor saját és a gazdátlan/nyitott jegyei jelennek meg). A bal oldali sáv tetején lévő „Összes jegy” jelölőnégyzettel (`Checkbox`) a szűrés azonnal feloldható a teljes queue-ra.
- **Táblázat és Badge Dizájn Szimmetria:** A "Visszaigazolásra vár" (`waiting_confirmation`) badge `whitespace-nowrap px-3 py-0.5` stílust kapott. A `Státusz` és `Prioritás` oszlopok és badge-ek pontosan a fejlécek alatt középre zártak (`flex justify-center items-center`, `w-[170px] min-w-[165px]`).
- **ThinkAI Badge Márkajelzés:** A ThinkAI operátorok azonosítására a standardizált `ThinkAiBadge` került bevezetésre.
- **Közvetlen Csatolmánykezelés Nyitott Hibajegyhez:** A `feedback.attachments` tömb közvetlen módosítása a `useUpdateTicketAttachments` mutációval és a jegy fejlécében elhelyezett `+ Csatolmány hozzáadása` gombbal.
- **Lebegő Eszköztáras Előnézeti Kártyák:** Új, egységes kártyás preview dizájn a feltöltött csatolmányokhoz (képeknél négyzetes előnézet, jobb felső lebegő kapszulában `Eye` előnézet és `Trash2` törlés gombok; dokumentumoknál dedikált típusjelvény és letöltési/törlési funkció).
- **Egységes Radix Tooltip Architektúra:** A hibajegy komponensekben (`TicketDetailView`, `FeedbackDialog`, `ImageGalleryModal`, `rich-text-editor`) a natív `title` attribútumok ki lettek váltva `<TooltipProvider delayDuration={200}>` és `<Tooltip>` komponensekkel, biztosítva a finom időzítést és az app dizájnrendszeréhez illeszkedő sötét/világos buborékokat.

