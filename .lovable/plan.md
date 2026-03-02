

## Fix: save-credentials "Auth session missing!" error

### Problem
Line 38 of `save-credentials/index.ts` calls `supabaseClient.auth.getClaims(token)` using an anon-key client. This method requires an active session and fails with "Auth session missing!" during auth transitions or with stale tokens. The same root cause we already fixed in `check-subscription`.

### Solution
Replace `getClaims(token)` with `getUser(token)` using the service role client (which validates the JWT directly without needing a session).

### Changes

**File: `supabase/functions/save-credentials/index.ts`**

1. Move the service role client creation (currently at line 51) to before the auth check (before line 36)
2. Replace lines 36-48:
   - Remove: `supabaseClient.auth.getClaims(token)` 
   - Add: `serviceClient.auth.getUser(token)` to validate the JWT
   - Extract `userId` from `user.id` instead of `claims.sub`
3. Keep the anon `supabaseClient` (with auth header) for the RPC call on line 160 so `auth.uid()` works in the database function

### What stays the same
- The anon client with auth header is still used for the `save_nav_credentials` RPC call (needed for `auth.uid()`)
- All validation, ownership checks, and error handling remain unchanged
- The edge function will be auto-deployed after the edit

