# A-018: Hibajegy Rendszer Architektúra

**Status:** Decided  
**Date:** 2025-12 (utolsó frissítés: 2026-09-01)

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
│   ├── event_type: text ('created' | 'status_changed' | 'comment_added' | 'assignee_changed')
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

-- 4. Komment event
CREATE FUNCTION create_comment_event()  -- AFTER INSERT ON ticket_comments
-- Beszúr ticket_events-be: event_type='comment_added'

-- 5. updated_at frissítés
CREATE FUNCTION update_feedback_updated_at()  -- BEFORE UPDATE ON feedback
-- updated_at = NOW()
```

Mind az 5 trigger function `SECURITY DEFINER` + `search_path = 'public'`.

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

**Admin hozzáférés:** Az `is_support_admin()` DB function ellenőrzi a `profiles.is_support_admin` flag-et. ~~Ez korábban egy ismert limitáció volt~~ — **megoldva**: dedikált SELECT és UPDATE policy-k biztosítják a support admin hozzáférést.

### Olvasatlan Detektálás

```
ticket_reads.last_read_at  < max(ticket_comments.created_at WHERE user_id ≠ current_user)
```

- **Upsert pattern:** `ON CONFLICT (feedback_id, user_id) DO UPDATE SET last_read_at = NOW()`
- A frontend minden jegy megnyitáskor `markRead(feedbackId)` → upsert
- A sidebar badge a `useUnreadTicketCount` hook-ból jön

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
  .subscribe();
```

Minden új komment → automatikus invalidation → badge frissül.

### Storage

- **Bucket:** `ticket-attachments` (public bucket)
- **Path:** `{ticketId}/{userId}/{filename}`
- **Engedélyezett típusok:** JPEG, PNG, GIF, WebP, PDF, CSV, XLS, XLSX
- **Limit:** max 5 fájl / komment, max 10MB / fájl
- **Policy:** Public read (link-el elérhető), authenticated insert

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
- Upsert-alapú read tracking → egyszerű, idempotens, nincs race condition
- Supabase Realtime → instant feedback badge frissítés
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

- **Szabványos Rich Text Szerkesztő (`RichTextEditor`):** TipTap StarterKit alapú szerkesztő félkövér, dőlt, áthúzott, címsor (H2, H3), felsorolás, számozott lista, idézet, inline kód és visszavonás/újra funkciókkal. `Ctrl+Enter` / `Cmd+Enter` gyorsbillentyű támogatással az azonnali beküldéshez (`onSubmit`).
- **Biztonságos és Tipográfiailag Stílusozott Megjelenítő (`RichTextContent`):** Biztonságos HTML és szöveges renderelés `prose prose-sm dark:prose-invert` osztályokkal. 100%-os visszafelé kompatibilitás a korábbi sima szöveges hibajegyekkel és hozzászólásokkal.
- **Közvetlen Csatolmánykezelés Nyitott Hibajegyhez:** A `feedback.attachments` tömb közvetlen módosítása a `useUpdateTicketAttachments` mutációval és a jegy fejlécében elhelyezett `+ Csatolmány hozzáadása` gombbal.
- **Lebegő Eszköztáras Előnézeti Kártyák:** Új, egységes kártyás preview dizájn a feltöltött csatolmányokhoz (képeknél négyzetes előnézet, jobb felső lebegő kapszulában `Eye` előnézet és `Trash2` törlés gombok; dokumentumoknál dedikált típusjelvény és letöltési/törlési funkció).
- **Egységes Radix Tooltip Architektúra:** A hibajegy komponensekben (`TicketDetailView`, `FeedbackDialog`, `ImageGalleryModal`, `rich-text-editor`) a natív `title` attribútumok ki lettek váltva `<TooltipProvider delayDuration={200}>` és `<Tooltip>` komponensekkel, biztosítva a finom időzítést és az app dizájnrendszeréhez illeszkedő sötét/világos buborékokat.

