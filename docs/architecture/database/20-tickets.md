# 🎫 Hibajegy Rendszer

> Ügyfélszolgálati hibajegy kommentek, olvasottsági állapot, események.
> A hibajegyek szülő táblája a `feedback` (dokumentálva: `19-platform-ops.md`), amely tartalmazza a státuszt, prioritást és az opcionális `category` mezőt (`idx_feedback_category`).

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
- `status_changed` — státusz módosítás (old_value → new_value: pl. `created` / `assigned` / `in_progress` / `resolved`)
- `comment_added` — hozzászólás
- `assignee_changed` — felelős módosítás (old_value → new_value: felelős neve, vagy NULL ha nincs)
- `resolution_requested` — support admin lezárási jóváhagyást kér az ügyféltől
- `resolution_confirmed` — ügyfél vagy könyvelőirodai kolléga jóváhagyta a megoldást (`confirmed_by_colleague: true`)
- `resolution_rejected` — ügyfél vagy könyvelőirodai kolléga elutasította a megoldást (`rejected_by_colleague: true`)

---

### 🛡️ Hozzáférés-szabályozás (Hybrid RLS Policy)

A hibajegyek hozzáférését a `public.can_access_ticket(p_company_id uuid, p_creator_id uuid)` `STABLE SECURITY DEFINER` függvény vezérli (`A-148`):
1. **Support Admin / Management / ThinkAI:** korlátlan hozzáférés.
2. **Bejelentő (Creator):** saját jegyhez közvetlen hozzáférés (`p_creator_id = auth.uid()`).
3. **Cégtagság:** `companies.owner_id` vagy `company_members.user_id = auth.uid()`.
4. **Könyvelői összerendelés:** közvetlen kijelölt könyvelő vagy a céget kezelő könyvelőiroda (`accounty_assignments.accounting_firm_id`) tagjai.
5. **Azonos könyvelőiroda:** ha a jegyet nyitó kolléga és a bejelentkezett felhasználó azonos `accounting_firm_id`-hez tartoznak, látják és kezelhetik egymás jegyeit.

