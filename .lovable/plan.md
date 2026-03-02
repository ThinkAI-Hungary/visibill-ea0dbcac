

## Plan: Categories and Projects from User-Level to Company-Level

### Current State
- **Categories**: Queried with `.eq('user_id', user.id)` everywhere. RLS policies already use `company_members` + `company_id`, but frontend code filters by `user_id`.
- **Projects**: Same pattern - queried with `.eq('user_id', user.id)`, but inserts already include `company_id`.
- Both tables already have a `company_id` column and company-member-based RLS policies, so **no database schema or RLS changes are needed**.

### What Needs to Change

All frontend queries need to switch from `user_id` filtering to `company_id` filtering (using `selectedCompany.id`).

### Files to Modify

**1. `src/pages/Projects.tsx`** (3 changes)
- `loadProjects`: Change `.eq('user_id', user.id)` → `.eq('company_id', selectedCompany.id)`
- `handleSaveProject` update: Change `.eq('user_id', user.id)` → `.eq('company_id', selectedCompany.id)` 
- `handleDeleteProject`: Change `.eq('user_id', user.id)` → `.eq('company_id', selectedCompany.id)`

**2. `src/pages/InvoicesPage.tsx`** (2 changes)
- Categories fetch: `.eq('user_id', user.id)` → `.eq('company_id', selectedCompany.id)`
- Projects fetch: `.eq('user_id', user.id)` → `.eq('company_id', selectedCompany.id)`

**3. `src/pages/Index.tsx`** (1 change)
- Categories fetch: `.eq('user_id', user.id)` → `.eq('company_id', selectedCompany.id)`

**4. `src/pages/Onboarding.tsx`** (major refactor)
- Add `useCompany` context import and use `selectedCompany`
- All category queries: switch from `.eq('user_id', user.id)` to `.eq('company_id', selectedCompany.id)`
- Category inserts: include `company_id` instead of (or alongside) `user_id`
- Guard against missing `selectedCompany`

**5. `supabase/functions/export-user-data/index.ts`** (minor)
- Projects export query should also consider company-based access (may keep user_id for data export purposes)

### No Database Changes Needed
The `categories` and `projects` tables already have `company_id` columns and company-member-based RLS policies. The RLS already allows any company member (Owner or Admin) to perform CRUD operations. The only issue is that the frontend is filtering by `user_id` instead of `company_id`.

