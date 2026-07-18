---
name: visibill-eaisybooks-activate
description: Use this skill when the user asks to activate, enable, or turn on the eaisyBooks (Accounty) module for a client company, user, or email. Matches commands like "/visibill-eaisybooks-activate" or Hungarian phrases like "eaisybooks-ot bekapcsolni", "aktiváld az eaisybooks-ot", "kapcsold be az eaisybooks-ot a következő ügyfélnek".
---

# eaisyBooks (Accounty) Module Activation Skill

Use this skill to activate the eaisyBooks (formerly Accounty) module for a specific company or user in the database. Activation consists of assigning the user as an `iroda_admin` for the company in the `accounty_assignments` table, and creating a default tax profile in `accounty_tax_profiles`.

## Workflow

### 1. Context Gathering (Identify User & Company)

Search the database to locate the target user and company.

1. **Search by Company Name**:
   If a company name was provided, search the `companies` table:
   ```sql
   SELECT id, name, tax_number, owner_id FROM companies WHERE name ILIKE '%COMPANY_NAME%';
   ```

2. **Search by User Email / Name**:
   If an email or user name was provided, search `auth.users` and `profiles`:
   ```sql
   SELECT id, email FROM auth.users WHERE email ILIKE '%EMAIL%';
   ```
   If found, query the user's company membership:
   ```sql
   SELECT cm.company_id, cm.role, c.name AS company_name
   FROM company_members cm
   JOIN companies c ON cm.company_id = c.id
   WHERE cm.user_id = 'USER_ID';
   ```

3. **Confirm Details**:
   Once user ID and company ID are identified, verify that:
   - Company ID is valid
   - User is the owner or member of that company

---

### 2. Execution (Enable eaisyBooks)

Execute the SQL script to insert the assignments and default tax profiles. This runs with RLS bypass (as `postgres` / `service_role`).

```sql
-- 1. Insert/upsert accounty assignment for the user as iroda_admin
INSERT INTO accounty_assignments (
  accountant_user_id,
  company_id,
  accounting_firm_id,
  role,
  is_primary,
  is_main_accountant,
  source
) VALUES (
  'USER_ID',
  'COMPANY_ID',
  'COMPANY_ID', -- Company acts as its own firm in this setup
  'iroda_admin',
  true,
  true,
  'manual'
)
ON CONFLICT (accountant_user_id, company_id) DO UPDATE SET
  role = 'iroda_admin',
  is_primary = true,
  is_main_accountant = true,
  updated_at = now();

-- 2. Insert default tax profile
INSERT INTO accounty_tax_profiles (
  company_id,
  vat_frequency,
  contribution_frequency,
  is_kata,
  is_kiva,
  has_payroll,
  payroll_settings
) VALUES (
  'COMPANY_ID',
  'monthly',
  'monthly',
  false,
  false,
  false,
  '{}'::jsonb
)
ON CONFLICT (company_id) DO NOTHING;
```

---

### 3. Verification

Always run SELECT queries to verify the database state after execution.

1. **Verify Assignment**:
   ```sql
   SELECT id, accountant_user_id, company_id, role, is_primary, is_main_accountant
   FROM accounty_assignments
   WHERE accountant_user_id = 'USER_ID' AND company_id = 'COMPANY_ID';
   ```

2. **Verify Tax Profile**:
   ```sql
   SELECT id, company_id, vat_frequency, is_kata, is_kiva
   FROM accounty_tax_profiles
   WHERE company_id = 'COMPANY_ID';
   ```

---

### 4. Output Summary

Present a clear summary of the activated client to the user:
- User Name & Email
- Company Name & Tax Number
- Status (e.g. `Enabled / Verified`)
