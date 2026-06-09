# A-018: Hibajegy Rendszer Architektúra

**Status:** Decided  
**Date:** 2025-12

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
├── type: text ('bug' | 'feedback')
├── service: text ('eaisybill' | 'accounty')
├── message: text
├── status: text ('created' | 'in_progress' | 'resolved')
├── priority: text ('low' | 'medium' | 'high' | 'critical')
├── page_url: text (automatikus — beküldés kontextusa)
├── attachments: text[] (Storage URL-ek)
├── ticket_number: text (trigger generálja)
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
│   └── created_at: timestamptz
│
├── ticket_events (1:N, audit trail)
│   ├── feedback_id: uuid (FK → feedback)
│   ├── event_type: text ('created' | 'status_changed' | 'comment_added')
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
-- 1. Automatikus jegyszám: TICKET-0001, TICKET-0002, ...
CREATE FUNCTION generate_ticket_number()  -- BEFORE INSERT ON feedback
-- Lekérdezi a max ticket_number-t és increment-el

-- 2. Létrehozás event
CREATE FUNCTION create_ticket_created_event()  -- AFTER INSERT ON feedback
-- Beszúr ticket_events-be: event_type='created'

-- 3. Státusz változás event
CREATE FUNCTION create_ticket_status_event()  -- AFTER UPDATE ON feedback
-- Ha status változott → ticket_events: event_type='status_changed', old/new value

-- 4. Komment event
CREATE FUNCTION create_comment_event()  -- AFTER INSERT ON ticket_comments
-- Beszúr ticket_events-be: event_type='comment_added'
```

Mind a 4 trigger function `SECURITY DEFINER` + `search_path = 'public'`.

### RLS Stratégia

| Tábla | Policy | Leírás |
|---|---|---|
| `feedback` SELECT | `user_id = auth.uid()` | User csak a sajátját látja |
| `feedback` INSERT | `user_id = auth.uid()` | User csak sajátját hozhatja létre |
| `ticket_comments` SELECT | `USING (true)` | Bárki olvashat (a feedback RLS védi az FK-n) |
| `ticket_comments` INSERT | `user_id = auth.uid()` | Csak saját kommentet írhat |
| `ticket_events` SELECT | `USING (true)` | Bárki olvashatja (audit trail) |
| `ticket_reads` SELECT/INSERT/UPDATE | `user_id = auth.uid()` | Csak saját olvasási állapot |

**Admin hozzáférés:** Az `is_support_admin` flag a `profiles` táblában van. A `feedback` RLS **nem szűr admin-re** — az admin **service_role bypass** nélkül csak a saját jegyeit látja. **Ez egy ismert limitáció** — a jelenlegi workaround az, hogy az admin felhasználó minden céghez hozzárendelés kap.

> **TODO:** A `feedback` SELECT policy-t bővíteni kellene: `user_id = auth.uid() OR is_support_admin(auth.uid())`.

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

**Negatív:**
- `feedback` vs `ticket_*` névkonvenció inkonzisztencia
- Admin nem lát minden jegyet RLS-en keresztül (workaround: cég hozzárendelés)
- `ticket_comments` SELECT `USING (true)` — bármelyik authenticated user olvashatja bárki kommentjeit (a feedback FK-n keresztül a frontend véd, de API szinten nincs korlátozás)
- Denormalizáció → ha a user nevet változtat, a régi jegyekben marad a régi név
