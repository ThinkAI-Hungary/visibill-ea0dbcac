# Migrációs Terv — Auth Absztrakció & Edge Function Portolás

**Létrehozva:** 2026-06-13  
**Állapot:** Tervezett — implementáció user jóváhagyás után

---

## Fázisonkénti terv

### Fázis 0: Előkészítés (MOST — 0 kockázat) ⏱️ ~3-4 óra

Ezek a lépések nem változtatják meg a működést, csak előkészítenek.

- [ ] `AuthService` interface létrehozása → `src/services/auth/AuthService.ts`
- [ ] `SupabaseAuthService` wrapper implementáció → `src/services/auth/SupabaseAuthService.ts`
- [ ] `EdgeFunctionClient` interface → `src/services/api/EdgeFunctionClient.ts`
- [ ] `SupabaseEdgeFunctionClient` wrapper → `src/services/api/SupabaseEdgeFunctionClient.ts`

### Fázis 1: Auth absztrakció (~2-4 nap)

- [ ] `AuthContext.tsx` átírása → `authService.*` hívások `supabase.auth.*` helyett
- [ ] `useSessionGuard.ts` átírása → auth provider-agnosztikus
- [ ] 15 db `supabase.auth.getSession()` hívás cseréje komponensekben
- [ ] Tesztelés — minden auth flow manuális ellenőrzése

### Fázis 2: Edge Function előkészítés (~1 hét)

- [ ] Minden Edge Function-ben handler kiszervezése: `export async function handle(req): Promise<Response>`
- [ ] A `Deno.serve()` / `serve()` wrapper elkülönítése a tényleges logikától
- [ ] `Deno.env.get()` → config parameter injection
- [ ] Közös auth middleware kiszervezése a `_shared/`-be

### Fázis 3: Tényleges migráció (CSAK amikor szükséges)

- [ ] Alternatív `AuthService` implementáció (Keycloak / Auth0 / saját)
- [ ] Edge Functions → Node.js/Hono API routes
- [ ] User adatok migrációja (GoTrue → új provider)
- [ ] Frontend redirect URL-ek frissítése
- [ ] DNS és CORS config frissítés

---

## Auth Service Interface (tervezet)

```typescript
// src/services/auth/AuthService.ts

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  metadata?: Record<string, any>;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: AuthUser;
}

export type AuthEvent = 
  | 'SIGNED_IN' 
  | 'SIGNED_OUT' 
  | 'TOKEN_REFRESHED' 
  | 'PASSWORD_RECOVERY' 
  | 'USER_UPDATED';

export interface AuthService {
  // Core auth
  signInWithPassword(email: string, password: string): Promise<{
    session: AuthSession | null;
    error: Error | null;
  }>;
  signInWithOAuth(provider: 'google'): Promise<{ error: Error | null }>;
  signUp(email: string, password: string, metadata?: Record<string, any>): Promise<{
    user: AuthUser | null;
    error: Error | null;
  }>;
  signOut(options?: { scope?: 'local' | 'global' }): Promise<{ error: Error | null }>;
  
  // Session management
  getSession(): Promise<AuthSession | null>;
  getUser(): Promise<AuthUser | null>;
  getAccessToken(): Promise<string | null>;
  refreshSession(): Promise<AuthSession | null>;
  
  // State observation
  onAuthStateChange(
    callback: (event: AuthEvent, session: AuthSession | null) => void
  ): () => void; // returns unsubscribe function
  
  // Password management
  updatePassword(newPassword: string): Promise<{ error: Error | null }>;
  resetPasswordForEmail(email: string, redirectTo: string): Promise<{ error: Error | null }>;
  
  // OAuth callback
  exchangeCodeForSession(code: string): Promise<{ error: Error | null }>;
  
  // Admin operations (server-side only, optional)
  admin?: AuthAdminService;
}

export interface AuthAdminService {
  createUser(params: {
    email: string;
    password: string;
    emailConfirm?: boolean;
    metadata?: Record<string, any>;
  }): Promise<{ user: AuthUser | null; error: Error | null }>;
  
  listUsers(): Promise<{ users: AuthUser[]; error: Error | null }>;
}
```

## Edge Function Client Interface (tervezet)

```typescript
// src/services/api/EdgeFunctionClient.ts

export interface EdgeFunctionClient {
  invoke<T = any>(
    functionName: string,
    options?: {
      body?: Record<string, any>;
      headers?: Record<string, string>;
    }
  ): Promise<{ data: T | null; error: Error | null }>;
}
```

## Supabase → Node.js Konverziós Minta

```typescript
// ═══════════════════════════════════════════════
// JELENLEGI (Supabase Edge Function — Deno)
// ═══════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // ... üzleti logika ...
});

// ═══════════════════════════════════════════════
// MIGRÁLT (Node.js — Hono framework)
// ═══════════════════════════════════════════════

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createClient } from '@supabase/supabase-js';

const app = new Hono();
app.use('/*', cors());

app.post('/api/trigger-invoice-processing', async (c) => {
  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // ... UGYANAZ az üzleti logika ...
});

export default app;
```

---

## Döntési pontok

> [!IMPORTANT]
> Az alábbi kérdésekre kell majd válaszolni, mielőtt a Fázis 3-ba lépünk:

1. **Auth provider**: Keycloak (self-hosted, ingyenes) vs Auth0 (managed, fizetős) vs saját JWT auth?
2. **Edge Functions hova**: DigitalOcean App Platform (a worker mellé) vs Cloudflare Workers vs saját VPS?
3. **Adatbázis**: Supabase managed PostgreSQL marad, vagy self-hosted PG (Hetzner/DO)?
4. **Storage**: S3 (AWS) vs DigitalOcean Spaces vs Cloudflare R2?
5. **Realtime**: Ably vs Pusher vs saját WebSocket szerver?

---

## Kapcsolódó dokumentumok

- [01-vendor-lockin-audit.md](./01-vendor-lockin-audit.md) — Auth lock-in részletes audit
- [02-edge-functions-catalog.md](./02-edge-functions-catalog.md) — Teljes Edge Functions katalógus
