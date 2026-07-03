# A-017: Biztonsági Architektúra (Security Layers)

**Status:** Decided  
**Date:** 2025-Q3 (implementálva) → Folyamatosan bővül

## Context

A rendszer pénzügyi adatokat kezel (számlák, banki tranzakciók, NAV credentials, béradatok). A biztonságot több rétegben kell biztosítani: hálózat, autentikáció, autorizáció, adatvédelem.

## Decision

**8 rétegű biztonsági modell:**

---

### 1. réteg: Autentikáció (Supabase Auth)

| Elem | Megoldás |
|---|---|
| Regisztráció | Email + jelszó (Supabase Auth) |
| Login | Email/jelszó → JWT token |
| Session | Supabase Auth session (auto-refresh) |
| Password reset | Supabase Auth beépített flow |
| Email verifikáció | `verify-email` Edge Function + Mailgun |

**Frontend AuthContext:**
```typescript
// src/contexts/AuthContext.tsx
const { data: { session } } = await supabase.auth.getSession();
// → session.user.id (auth.uid()) minden RLS policy-ban használt
```

**Nincs:** Social login, MFA (Multi-Factor Auth), SSO — jövőbeli bővítés.

---

### 2. réteg: Autorizáció — Row Level Security (RLS)

**Minden tábla RLS-sel védett.** A felhasználó kizárólag a saját cégéhez tartozó adatokat látja.

#### RLS policy pattern:

```sql
-- Standard RLS pattern (minden táblánál)
CREATE POLICY "company_member_access" ON public.invoices
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM public.company_members
      WHERE user_id = auth.uid()
    )
  );
```

#### Multi-tenancy modell:

```
auth.users (1) ──→ company_members (N) ──→ companies (N)
   │                    │
   └── auth.uid()       └── company_id = szűrő MINDEN táblán
```

- A `company_members` tábla a bridge: user_id ↔ company_id mapping
- Egy user több céghez is tartozhat
- A `company_id` oszlop **MINDEN üzleti táblán** megtalálható
- Az RLS policy minden SELECT/INSERT/UPDATE/DELETE-re érvényes

#### Jogosultsági szintek:

| Szint | company_members.role | Lehetőségek |
|---|---|---|
| `owner` | Teljes hozzáférés, cég törlés, tagok kezelése |
| `admin` | Teljes hozzáférés, tagok kezelése |
| `member` | Olvasás + írás, nincs tag kezelés |
| `assistant` | Számlák, tranzakciók, kintlévőségek, projektek R/W |
| `viewer` | Csak olvasás — pénzügyi modulok |
| `employee` | Csak Munkaidő modul (token-based, nincs email regisztráció) |
| `management` / `thinkai` | Cross-tenant vezetői dashboard (`/management`) |

> Lásd részletesen: [A-009: Auth és RBAC](./A-009-auth-rbac.md)

**Frontend ellenőrzés:**
```typescript
// src/contexts/CompanyContext.tsx
const { role } = useCompany();
if (role === 'owner' || role === 'admin') { /* admin features */ }
```

---

### 3. réteg: Edge Function Biztonság

#### Auth middleware pattern:
```typescript
// Minden Edge Function-ben:
const authHeader = req.headers.get('Authorization');
const { data: { user }, error } = await supabaseClient.auth.getUser(
  authHeader?.replace('Bearer ', '')
);
if (!user) return new Response('Unauthorized', { status: 401 });
```

#### Service Role használat:
- Edge Function-ök `SUPABASE_SERVICE_ROLE_KEY`-val is dolgozhatnak
- Ez **bypass-olja az RLS-t** — cég-specifikus műveletekhez
- Csak szerveren, soha nem kerül a frontendbe

#### CORS Headers:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',  // TODO: restriction a prod domain-re
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

---

### 4. réteg: API Key Autentikáció (Külső Integrációk)

Az `openclaw-api` Edge Function saját API key authentikációt implementál:

| Elem | Megoldás |
|---|---|
| Key formátum | `vb_` prefix + 40 hex karakter (20 random byte) |
| Tárolás | SHA-256 hash az `api_keys` táblában (nyers kulcs **soha** nem tárolódik) |
| Auth header | `Authorization: Bearer vb_xxxxxxxx...` |
| Scope | Company-scoped (company_id) vagy projekt-széles (company_id = NULL) |
| Rate limiting | In-memory, 100 req/perc/kulcs (konfigurálható per API key) |
| Lejárat | Konfigurálható `expires_at` mező |
| Visszavonás | `revoke_api_key()` RPC — `is_active = false` |
| Audit | `last_used_at` automatikus frissítés minden hívásnál |

#### API Key lifecycle:
```
Admin (Frontend/SQL) → generate_api_key() RPC → nyers kulcs (CSAK EGYSZER látható)
                                                       ↓
OpenClaw → Bearer vb_xxx... → openclaw-api EF → SHA-256(key) → api_keys tábla lookup
                                                       ↓
                                              company_id scope → tábla lekérdezés
```

#### Biztonsági korlátok:
- **Table allowlist:** 120+ tábla engedélyezve, 6 szenzitív tábla blokkolva (NAV credentials, subscriptions, api_keys, error logs, OAuth tokens, emails)
- **Read-only:** Kizárólag SELECT műveletek
- **JWT disabled:** `verify_jwt: false` — saját API key auth helyettesíti
- **Service role:** RLS bypass + manuális company_id szűrés

---

### 5. réteg: Credential Titkosítás (AES-256-GCM)

Részletek: [A-010: Credential Titkosítás](./A-010-credential-encryption.md)

**Összefoglalva:**
- NAV API credentials AES-256-GCM-mel titkosítva a DB-ben
- Per-record Initialization Vector (IV) — nincs ismétlődő ciphertext
- Feloldás kizárólag Edge Function-ben (save-credentials, nav-token)
- A frontend soha nem látja a nyers credentials-t
- `ENCRYPTION_KEY` env variable — Supabase secrets-ben

#### NAV Credential lifecycle:
```
Frontend (NAV form) → save-credentials EF → encrypt → nav_credentials tábla
                                                            ↓
query-nav-invoices EF ← decrypt ← nav_credentials tábla
        ↓
   NAV API hívás (HMAC-SHA512 signature)
```

---

### 6. réteg: Audit Trail

#### Global audit log:
```sql
-- Trigger-alapú audit minden fontosabb táblán
-- global_audit_trigger_func() (SECURITY DEFINER)
-- Tüzel: invoice_uploads, invoices, salary_files, transactions
--
-- INSERT → 'feltöltés' audit_log bejegyzés
-- UPDATE → 'módosítás' (csak specifikus státusz-átmeneteknél):
--   • invoice_uploads: processing_status → 'processed' (⚠️ korábban hibásan 'completed'-re figyelt, 2026-06-14 fixálva)
--   • invoices: statusz → 'feldolgozott'
--   • salary_files: status → 'completed'
-- DELETE → 'törlés' audit_log bejegyzés
-- Worker → 'átirányítás' (multi-company invoice routing, company_router.py INSERT-eli)
--
-- A details JSONB mező tartalmazza: source, table, op, upload_source, is_system, processing_type
```

**Auditált műveletek:**
- Számla / dokumentum feltöltés (INSERT trigger)
- Számla feldolgozás befejezése (`invoice_uploads.processing_status = 'processed'`)
- **Számla átirányítás** multi-company user-eknél (worker `company_router.py` → `audit_logs` INSERT, action = `'átirányítás'`)
- Tranzakció match módosítás
- GL felülbírálás (`override_gl_classification`)
- NAV credential mentés
- Dokumentum / számla törlés

---

### 7. réteg: Worker Biztonság

| Elem | Megoldás |
|---|---|
| DB hozzáférés | `service_role_key` (RLS bypass) |
| AI API kulcsok | Env variable a Docker container-ben |
| Hálózat | DigitalOcean Droplet, SSH key-based auth |
| Log | structlog JSON (no sensitive data) |
| Secrets | `.env.prod` / `.env.vsweb` / `.env.thinkerman` (git-ignored) |

**Worker SOHA nem logol:**
- Jelszavakat, API kulcsokat
- NAV credentials-t
- Felhasználói személyes adatokat

---

### 8. réteg: Frontend Biztonság

| Elem | Megoldás |
|---|---|
| API kulcsok | Csak `SUPABASE_ANON_KEY` a frontendben (publikus, RLS védi) |
| XSS | React JSX auto-escape |
| CSRF | Supabase JWT token-based auth (nem cookie) |
| Routing | Protected routes (`AuthContext` check) |
| Error | Nem mutat stack trace-t a felhasználónak |

**Protected route pattern:**
```typescript
// src/App.tsx
<Route path="/dashboard" element={
  session ? <DashboardPage /> : <Navigate to="/auth" />
} />
```

## Consequences

**Pozitív:**
- 8 réteg → defense in depth
- RLS → adatszivárgás kockázat minimális, DB-szintű védelemmel
- AES-256-GCM → credentials biztonságos tárolás
- Audit trail → visszakereshető minden módosítás

**Negatív:**
- CORS: jelenleg `*` → production-ben szűkítendő
- Nincs MFA → jövőbeli feature
- Nincs rate limiting a frontend API hívásokon (az `openclaw-api` EF-en van)
- Key rotation nincs implementálva (ENCRYPTION_KEY)
- `service_role_key` kompromittálása = teljes hozzáférés

## Kapcsolódó
- [A-003: Multi-tenancy RLS](./A-003-multi-tenancy-rls.md)
- [A-009: Auth és RBAC](./A-009-auth-rbac.md)
- [A-010: Credential Titkosítás](./A-010-credential-encryption.md)
- [A-005: Edge Functions](./A-005-edge-functions.md)
- [BRD 028: GDPR & Adatvédelem](../../business/decisions/028-gdpr-compliance.md)
