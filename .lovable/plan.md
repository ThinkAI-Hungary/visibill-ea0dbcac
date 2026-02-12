

# Fix: Partners Page Only Shows Data for Owner

## Root Cause

In `src/pages/PartnersPage.tsx` (line 120), the partners query filters by `user_id`:

```
.eq("user_id", user.id)
.eq("company_id", selectedCompany.id)
```

Since partners are typically created during NAV sync (which runs under the owner's user ID), the `user_id` filter means only the owner sees the data. Other company members get an empty list.

## Fix

Remove the `.eq("user_id", user.id)` filter from the partners query. The RLS policies on the `partners` table already enforce access control via `company_members`, so filtering by `company_id` alone is sufficient and secure.

### Change in `src/pages/PartnersPage.tsx`

**Before (line 117-122):**
```typescript
const { data, error } = await supabase
  .from("partners")
  .select("*")
  .eq("user_id", user.id)
  .eq("company_id", selectedCompany.id)
  .order("name", { ascending: true });
```

**After:**
```typescript
const { data, error } = await supabase
  .from("partners")
  .select("*")
  .eq("company_id", selectedCompany.id)
  .order("name", { ascending: true });
```

No database or RLS changes needed -- the existing `company_members`-based RLS policies on the `partners` table already handle authorization correctly.

## Technical Details

- The `partners` table RLS policy ("Members can view partners") uses: `EXISTS (SELECT 1 FROM company_members WHERE company_members.company_id = partners.company_id AND company_members.user_id = auth.uid())`
- This already ensures only company members can see the data
- The redundant `user_id` filter in the frontend was the sole cause of the issue
- The `queryKey` can also be simplified to remove `user?.id` since it's no longer relevant to the query

## Files to Modify

- `src/pages/PartnersPage.tsx` -- remove `user_id` filter from the query (1 line change)
