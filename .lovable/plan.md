

## Plan: NAV Integration Owner-Only Access

### What Needs to Change

The NAV integration (credentials save/delete/modify) should only be accessible to the company Owner. When the Owner disconnects NAV, the credentials are deleted for the entire company (they're already company-scoped in `user_nav_credentials`).

### Current State
- `user_nav_credentials` is company-scoped (has `company_id`)
- `delete-nav-credentials` currently deletes by `user_id` instead of `company_id` — this is a bug
- The `NavCredentialsForm` component has no role check; any company member can see and use it
- `Company` type already has `owner_id` available in the context

### Changes

**1. Frontend: `src/pages/Integrations.tsx`**
- Compute `isOwner = selectedCompany?.owner_id === user?.id`
- Pass `isOwner` prop to `NavCredentialsForm`
- For non-owners: show a read-only status card (connection status visible) with a message like "Csak a cég tulajdonosa kezelheti a NAV integrációt" instead of the form/disconnect button

**2. Frontend: `src/components/nav/NavCredentialsForm.tsx`**
- Accept `isOwner` prop
- When `isOwner === false`: hide the credential form, save button, and disconnect button; show only the connection status card with a "read-only" notice
- When `isOwner === true`: current behavior (full form + disconnect)

**3. Edge Function: `supabase/functions/delete-nav-credentials/index.ts`**
- Accept `companyId` from request body
- Verify the user is the company owner by checking `companies.owner_id`
- Delete credentials by `company_id` instead of `user_id` (since credentials are company-scoped)
- Return 403 if the user is not the owner

**4. Edge Function: `supabase/functions/save-credentials/index.ts`**
- Add owner check: before calling `save_nav_credentials` RPC, verify the user is the owner of the provided `companyId`
- Return 403 with clear error message if not owner

### No Database Changes Needed
- The `user_nav_credentials` table is already company-scoped
- RLS policies are already based on company membership
- Owner role is determined by `companies.owner_id` — no separate roles table needed for this check

### Technical Details

Owner check query (in edge functions):
```sql
SELECT 1 FROM companies WHERE id = companyId AND owner_id = userId
```

Frontend owner check:
```typescript
const isOwner = selectedCompany?.owner_id === user?.id;
```

