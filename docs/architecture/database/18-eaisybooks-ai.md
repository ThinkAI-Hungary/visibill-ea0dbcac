# 📘 eaisyBooks — AI Chat

> AI asszisztens chat sessionök és üzenetek.

**Táblák ebben a csoportban:** 2

---

### `accounty_ai_chat_sessions`

> AI Assistant chat sessions per user. Each session is a separate conversation thread.

**RLS:** ✅ | **Sorok:** ~2

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| user_id | uuid | — |  |
| title | text | — | `'Új beszélgetés'::text` |
| created_at | timestamp with time zone | — | `now()` |
| updated_at | timestamp with time zone | — | `now()` |

**FK:** `user_id` → `auth.users.id`

**Indexek:** `idx_accounty_ai_sessions_user`

---

### `accounty_ai_chat_messages`

> Individual messages within an AI chat session. Ordered by created_at.

**RLS:** ✅ | **Sorok:** ~4

| Oszlop | Típus | Null | Default |
|--------|-------|------|---------|
| id | uuid | — | `gen_random_uuid()` |
| session_id | uuid | — |  |
| role | text | — |  |
| content | text | — |  |
| created_at | timestamp with time zone | — | `now()` |

**FK:** `session_id` → `accounty_ai_chat_sessions.id`

**Indexek:** `idx_accounty_ai_messages_session`

---

