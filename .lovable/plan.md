

# Multi-Tenancy Refactor: Many-to-Many (Users <-> Companies)

Refactoring company access from single-owner to shared membership model with join codes.

---

## Step 1: Database Migration (Manual SQL)

A single SQL script to run manually, covering all schema and policy changes:

### 1a. Create `company_members` junction table
- Columns: `id` (uuid PK), `user_id` (uuid, NOT NULL, references auth.users ON DELETE CASCADE), `company_id` (uuid, NOT NULL, references public.companies ON DELETE CASCADE), `created_at` (timestamptz)
- UNIQUE constraint on (user_id, company_id)
- RLS enabled

### 1b. Add `share_token` to `companies`
- New column: `share_token` (text, UNIQUE, nullable)

### 1c. Migrate existing data
- INSERT INTO company_members from all existing companies (owner_id -> user_id)

### 1d. Create trigger: `on_company_created`
- AFTER INSERT on `public.companies`
- Automatically inserts a row into `company_members` using `NEW.id` and `NEW.owner_id`
- This eliminates the need for frontend to manually insert membership on company creation

### 1e. RLS on `company_members`
- SELECT: `auth.uid() = user_id`
- DELETE: `auth.uid() = user_id` (user can leave)
- No INSERT policy for regular users (handled by trigger + edge function with service role)

### 1f. Update `user_has_company_access` function
Replace owner check with membership check:
```text
SELECT EXISTS (
  SELECT 1 FROM public.company_members
  WHERE company_id = p_company_id AND user_id = auth.uid()
)
```

### 1g. Update `companies` RLS policies
- DROP old SELECT/UPDATE policies that check `owner_id`
- New SELECT: membership check via `company_members`
- New UPDATE: membership check via `company_members`
- INSERT remains: `auth.uid() = owner_id` (only creator sets owner)
- DELETE remains: `auth.uid() = owner_id` (only owner can delete)

### 1h. Update RLS on shared-resource tables
The following tables have `company_id` and need membership-based access instead of `user_id`-based:

**invoices** -- Drop old 4 policies, create new ones checking `company_members` via `company_id`

**nav_invoices** -- Drop old ALL policy, create new ALL policy checking `company_members`

**partners** -- Drop old 4 policies, create new ones checking `company_members`

**salary** -- Drop old 4 policies, create new ones checking `company_members`

**salary_files** -- Drop old 4 policies, create new ones checking `company_members`

**tax** -- Drop old 4 policies, create new ones checking `company_members`

**email_aliases** -- Drop old 4 policies, create new ones checking `company_members`

**invoice_uploads** -- Drop old 4 policies, create new ones checking `company_members`

**bank_statements** -- Drop old 4 policies, create new ones checking `company_members`

**bank_statement_uploads** -- Drop old 4 policies, create new ones checking `company_members`

**nav_sync_logs** -- Drop old SELECT policy, create new one checking `company_members`

**user_nav_credentials** -- Drop old ALL policy, create new ALL policy checking `company_members`

**categories** -- Drop old 4 policies, create new ones checking `company_members`

**projects** -- Drop old 4 policies, create new ones checking `company_members`

**transactions** -- Already company-based via companies table join; will be updated to use `company_members` directly

**transaction_uploads** -- Drop old 4 policies, create new ones checking `company_members`

Each policy follows the pattern:
```text
EXISTS (
  SELECT 1 FROM public.company_members
  WHERE company_members.company_id = <table>.company_id
    AND company_members.user_id = auth.uid()
)
```

---

## Step 2: Edge Function - `join-company`

Create `supabase/functions/join-company/index.ts`:

- `verify_jwt = true` in config.toml (user must be authenticated)
- POST endpoint accepting `{ share_token: string }`
- Uses service role client to:
  1. Find company by `share_token` (bypasses RLS since user isn't a member yet)
  2. Check if user is already a member
  3. Insert into `company_members` using service role
- Returns company data on success
- CORS headers included

---

## Step 3: Update `CompanyContext.tsx`

- Remove `.eq('owner_id', user.id)` filter from `fetchCompanies`
- Simply query `companies` with `select('*')` and let RLS (membership-based) handle filtering
- The `Company` interface keeps `owner_id` (still needed for delete permission checks)

---

## Step 4: Update `CompanySelector.tsx` - Add Join Tab

Modify the create dialog to have two tabs:

**Tab 1: "Uj ceg letrehozasa"** (default) -- existing create form, unchanged (trigger handles membership)

**Tab 2: "Csatlakozas meglevo ceghez"**
- Input field for 6-character join code
- "Csatlakozas" button
- Calls the `join-company` edge function
- On success: refreshes companies, switches to joined company
- Error handling for "already a member", "invalid code"

---

## Step 5: Settings Page - Share Token & Members

Add a new Card in the "Ceg" (Business) tab of `src/pages/Settings.tsx`:

### Share Token Section ("Ceg hozzaferes")
- If no `share_token`: "Meghivo kod generalasa" button
- If `share_token` exists: display code with Copy button + "Ujrageneralas" button
- Generate: random 6-char alphanumeric, save via Supabase update on `companies`
- Only visible to company owner (`selectedCompany.owner_id === user.id`)

### Members List ("Tagok")
- Query `company_members` joined with `profiles` for the selected company
- Display member names/emails
- Owner can remove members (delete from `company_members`)

---

## Step 6: No Frontend Membership Insert Needed

Thanks to the `on_company_created` trigger:
- `CompanySelector.tsx` `handleCreateCompany` -- no change needed
- `EmptyStateDashboard.tsx` `handleFinishOnboarding` -- no change needed
- Both already insert into `companies` with `owner_id`, and the trigger auto-creates membership

---

## Files to Create
- `supabase/functions/join-company/index.ts`

## Files to Modify
- `supabase/config.toml` -- add `[functions.join-company]` with `verify_jwt = true`
- `src/contexts/CompanyContext.tsx` -- remove owner_id filter
- `src/components/CompanySelector.tsx` -- add join tab UI
- `src/pages/Settings.tsx` -- add share token management + members list

## SQL to Provide (manual execution)
- Single comprehensive migration script covering all schema changes, trigger, function updates, and RLS policy updates

