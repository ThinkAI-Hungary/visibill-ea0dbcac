# Decision 030: API & Third-party Hozzáférés

**Status:** ✅ Decided (2026-06-23)

**Category:** Platform & Terjeszkedés

**Question:** Tervezünk-e nyilvános API-t harmadik fél számára? Ha igen, milyen funkciókra (számlák lekérdezése, tranzakciók, NAV adatok)? Szükséges-e API kulcs kezelés, rate limiting, dokumentáció?

**Decision:**

Read-only REST API endpoint az `openclaw-api` Edge Function-ön keresztül, saját API key autentikációval.

**Jelenlegi implementáció:**

| Elem | Megoldás |
|---|---|
| Edge Function | `openclaw-api` (verify_jwt: false, saját API key auth) |
| Auth | `Bearer <api_key>` header — SHA-256 hash lookup az `api_keys` táblában |
| Scope | Projekt-szintű (company_id = NULL) vagy cég-specifikus read-only hozzáférés |
| Elérhető adatok | 120+ tábla — invoices, transactions, partners, GL, NAV, stb. |
| Blokkolt adatok | 6 szenzitív tábla (NAV credentials, subscriptions, API keys, OAuth tokens, stb.) |
| Rate limiting | 100 req/perc/api_key (in-memory, konfigurálható) |
| API key format | `vb_` prefix + 40 hex karakter |
| Key tárolás | SHA-256 hash (nyers kulcs soha nem tárolódik) |
| Generálás | `generate_api_key()` RPC (owner/admin) |
| Visszavonás | `revoke_api_key()` RPC |

**API Endpoint:** `https://vxxgvdlqvvchtlmqnrqf.supabase.co/functions/v1/openclaw-api`

**Elérhető action-ök:**

| Action | Leírás |
|--------|--------|
| `help` | API dokumentáció és használati útmutató |
| `list-tables` | Összes elérhető tábla listája row count-tal |
| `schema` | Egy tábla oszlopainak típus- és mintaadatai |
| `query` | Generikus tábla lekérdezés szűrőkkel, pagination-nel, rendezéssel |

**Szűrő operátorok:** `column=value` (exact), `column__gte`, `column__lte`, `column__like`, `column__neq`, `column__is=null|true|false`

**Rationale:**

- Az OpenClaw AI agent számára szükséges az eaisybill adatbázis read-only elérése
- Saját API key auth (nem Supabase JWT) mert az OpenClaw nem tud Supabase Auth-ot használni
- Generikus table query megközelítés → nem kell minden táblához külön endpoint
- SHA-256 hash-elt kulcsok → a nyers kulcs kompromittálása esetén is biztonságos
- Table allowlist/blocklist → szenzitív adatok védelme

**Kapcsolódó:**
- [A-005: Edge Functions](../../architecture/decisions/A-005-edge-functions.md) — `openclaw-api` EF
- [A-016: PostgreSQL Query Strategy](../../architecture/decisions/A-016-postgresql-query-strategy.md) — `generate_api_key`, `revoke_api_key` RPC
- [A-017: Security Architecture](../../architecture/decisions/A-017-security-architecture.md) — 4. réteg: API Key Auth
