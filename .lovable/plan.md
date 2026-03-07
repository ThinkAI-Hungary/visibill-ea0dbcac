

## Fix: save-credentials "Auth session missing!" (attempt 3)

### Root Cause
Line 44 calls `serviceClient.auth.getUser(token)` on a service role client that has NO `Authorization` header. In Supabase's Deno runtime, `getUser(token)` still requires the client to have auth context — without it, the SDK returns "Auth session missing!" before even reaching the auth server.

The working `check-subscription` function has `{ auth: { persistSession: false } }` but also falls back gracefully. Here, we need the auth to actually succeed.

### Fix (single file change)

**File: `supabase/functions/save-credentials/index.ts`**

1. Add `{ auth: { persistSession: false } }` to both clients to prevent stale session caching in edge functions
2. Change line 44: use `supabaseClient.auth.getUser(token)` (anon client WITH auth header) instead of `serviceClient.auth.getUser(token)` (service role client WITHOUT auth header)

The anon client already has `{ global: { headers: { Authorization: authHeader } } }` set on line 33, which gives it the auth context needed for `getUser(token)` to work.

### What stays the same
- The service role client is still used for company ownership checks (line 130-138)
- The anon client (supabaseClient) is still used for the `save_nav_credentials` RPC call so `auth.uid()` works
- All validation, error handling, and CORS remain unchanged
- `verify_jwt = false` in config.toml stays as-is (manual validation in code)
