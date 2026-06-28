# 🎫 Hibajegy Rendszer

> Ügyfélszolgálati hibajegy kommentek, olvasottsági állapot, események.

**Táblák ebben a csoportban:** 3

---

### `ticket_comments`

**RLS:** ✅ | **Sorok:** ~8

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| feedback_id | uuid | — |  |
| user_id | uuid | — |  |
| user_name | text | ✓ |  |
| user_email | text | ✓ |  |
| is_admin | boolean | ✓ | `false` |
| message | text | — |  |
| attachments | ARRAY | ✓ |  |
| created_at | timestamp with time zone | ✓ | `now()` |
| is_internal | boolean | ✓ | `false` |

**FK:** `feedback_id` → `feedback.id`

**Indexek:** `idx_ticket_comments_feedback_id`

**Megjegyzés:** `is_internal = true` kommentek belső support megjegyzések, amelyeket a user nem lát.

---

### `ticket_reads`

**RLS:** ✅ | **Sorok:** ~3

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| feedback_id | uuid | — |  |
| user_id | uuid | — |  |
| last_read_at | timestamp with time zone | — | `now()` |

**FK:** `feedback_id` → `feedback.id`

**Indexek:** `idx_ticket_reads_feedback_user`, `ticket_reads_feedback_id_user_id_key`

---

### `ticket_events`

**RLS:** ✅ | **Sorok:** ~20

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| feedback_id | uuid | — |  |
| event_type | text | — |  |
| actor_id | uuid | ✓ |  |
| actor_email | text | ✓ |  |
| actor_name | text | ✓ |  |
| old_value | text | ✓ |  |
| new_value | text | ✓ |  |
| metadata | jsonb | ✓ |  |
| created_at | timestamp with time zone | ✓ | `now()` |

**FK:** `feedback_id` → `feedback.id`

**Indexek:** `idx_ticket_events_feedback_id`

**Event típusok:**
- `created` — jegy létrehozva
- `status_changed` — státusz módosítás (old_value → new_value: pl. `new` → `in_progress`)
- `comment_added` — hozzászólás
- `assignee_changed` — felelős módosítás (old_value → new_value: felelős neve, vagy NULL ha nincs)

---
