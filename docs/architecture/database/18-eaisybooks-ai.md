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
| is_helpful | boolean | Igen | `null` |
| feedback_reason | text | Igen | `null` |
| feedback_at | timestamp with time zone | Igen | `null` |
| created_at | timestamp with time zone | — | `now()` |

**FK:** `session_id` → `accounty_ai_chat_sessions.id` (`ON DELETE CASCADE`)

**Indexek:**
- `idx_accounty_ai_messages_session` (`session_id, created_at ASC`)
- `idx_accounty_ai_chat_messages_feedback` (`is_helpful, feedback_at`) WHERE `is_helpful IS NOT NULL`

---

### `view_ai_chat_feedback_reports` (Adminisztrátori Segédnézet)

> RAG Tuning és minőségbiztosítási jelentés, amely összekapcsolja az értékelt asszisztens választ az azt közvetlenül megelőző felhasználói kérdéssel. `security_invoker = true`.

| Mező | Típus | Leírás |
|---|---|---|
| `message_id` | uuid | Az értékelt válasz azonosítója |
| `session_id` | uuid | A beszélgetési szál azonosítója |
| `session_title` | text | A csevegés címe |
| `user_id` | uuid | A kérdező felhasználó |
| `question` | text | A közvetlenül megelőző felhasználói kérdés szövege |
| `answer` | text | Az asszisztens válasza |
| `is_helpful` | boolean | `true` (hasznos) / `false` (nem hasznos) |
| `feedback_reason` | text | A minősítés oka / megjegyzés |
| `feedback_at` | timestamptz | A visszajelzés ideje |
| `created_at` | timestamptz | A válasz generálásának ideje |

---

## Kapcsolódó döntések
- **BRD:** [Decision 055: eaisyBooks AI Asszisztens Chat](../../business/decisions/055-eaisybooks-ai-assistant-chat.md)
- **PRD:** [P-077: eaisyBooks AI Asszisztens Chat és Speed Dial UX](../../product/decisions/P-077-eaisybooks-ai-assistant-chat-and-speed-dial-ux.md)
- **ADR:** [A-104: eaisyBooks AI Chat Streaming és Edge Architektúra](../decisions/A-104-eaisybooks-ai-chat-streaming-and-edge-architecture.md)
