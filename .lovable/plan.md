

# Three Multi-Tenancy Improvements

## Clarification on `profiles` Column

The `profiles` table has two UUID columns: `id` (the table's own primary key) and `user_id` (the reference to `auth.users`). All existing code and RLS policies use `user_id` as the auth link. Therefore, `cm2.user_id = profiles.user_id` is the correct join condition.

---

## Step 1: Database Migration (Manual SQL)

### 1a. Fix Members List Visibility -- New RLS Policy on `profiles`

```text
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Members can view co-member profiles"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.company_members cm1
      JOIN public.company_members cm2 ON cm1.company_id = cm2.company_id
      WHERE cm1.user_id = auth.uid()
        AND cm2.user_id = profiles.user_id
    )
  );
```

This replaces the old "own profile only" policy with one that also allows viewing profiles of users who share any company membership.

### 1b. Add Token Expiration Column

```text
ALTER TABLE public.companies
  ADD COLUMN share_token_created_at timestamptz;
```

---

## Step 2: Edge Function -- Token Expiration Check

**File:** `supabase/functions/join-company/index.ts`

- Add `share_token_created_at` to the SELECT query when looking up the company.
- After finding the company, check if the token has expired:
  - If `share_token_created_at` exists and `now - share_token_created_at > 10 minutes`, return `{ error: "token_expired" }` with status 410.
- No other changes to the function.

---

## Step 3: Settings UI Updates

**File:** `src/pages/Settings.tsx`

### 3a. CompanyAccessCard -- Countdown Timer

- When generating/regenerating a token, also save `share_token_created_at: new Date().toISOString()` in the update call.
- After token generation, start a countdown timer using `useEffect` + `setInterval`:
  - Calculate remaining = `(share_token_created_at + 10min) - now`.
  - Display as MM:SS next to the token.
  - When expired: blur the token text, disable Copy button, show "Lejart" label.
- Fetch `share_token_created_at` alongside `share_token` when loading company data.

### 3b. Company Details Form -- Owner-Only Editing

- Add check: `const isOwner = selectedCompany?.owner_id === user?.id`
- If NOT owner:
  - Disable the Name, Tax Number, and Address input fields.
  - Disable or hide the "Save" button.
  - Show info text: "Csak a tulajdonos szerkesztheti a ceg adatait."

### 3c. Members List -- Role Badges

- For each member, show a badge:
  - "Tulajdonos" (green/primary) if `member.user_id === selectedCompany.owner_id`
  - "Admin" (secondary/muted) for all other members
- Only the owner can see the "Remove" button for other members.

---

## Step 4: Error Handling in Join Flows

### 4a. `src/components/CompanySelector.tsx`

In `handleJoinCompany`, add handling for `data?.error === 'token_expired'`:
- Show toast: "A csatlakozasi kod lejart! Kerj uj kodot a ceg tulajdonosatol."

### 4b. `src/components/dashboard/EmptyStateDashboard.tsx`

Same `token_expired` error handling in the onboarding join flow.

---

## Files to Modify

- `supabase/functions/join-company/index.ts` -- add expiration check
- `src/pages/Settings.tsx` -- countdown timer, owner-only fields, role badges
- `src/components/CompanySelector.tsx` -- handle `token_expired` error
- `src/components/dashboard/EmptyStateDashboard.tsx` -- handle `token_expired` error

## Database Migration (SQL to provide for manual execution)

- Drop old profiles SELECT policy, create new co-member policy
- Add `share_token_created_at` column to `companies`

