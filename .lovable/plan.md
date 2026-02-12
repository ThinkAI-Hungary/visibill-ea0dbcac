

# Fix: Members List Only Shows Current User

## Root Cause

The `profiles` RLS policy ("See team members") is correctly configured. The real bottleneck is the **`company_members`** table SELECT policy:

```
"Users can view their memberships" → USING (auth.uid() = user_id)
```

This restricts each user to seeing only their **own** membership row. When the Settings page queries `company_members` filtered by `company_id`, only one row (the logged-in user) is returned. Consequently, only one profile is fetched.

## Fix

Replace the `company_members` SELECT policy with one that allows users to see **all members** of companies they belong to:

```text
DROP POLICY "Users can view their memberships" ON public.company_members;

CREATE POLICY "Members can view company memberships"
  ON public.company_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = company_members.company_id
        AND cm.user_id = auth.uid()
    )
  );
```

**Important:** This policy references the same table (`company_members`) in a subquery, which can cause infinite recursion. To avoid this, we need a `SECURITY DEFINER` helper function:

```text
CREATE OR REPLACE FUNCTION public.user_is_company_member(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = p_company_id
      AND user_id = auth.uid()
  );
$$;
```

Then the policy becomes:

```text
DROP POLICY "Users can view their memberships" ON public.company_members;

CREATE POLICY "Members can view company memberships"
  ON public.company_members FOR SELECT
  USING (public.user_is_company_member(company_id));
```

This avoids recursion and lets users see all members of their shared companies.

## Scope

- **Database migration only** -- one new function + one replaced RLS policy on `company_members`
- **No frontend code changes** needed -- the existing queries in Settings.tsx will automatically return all members once the policy allows it

