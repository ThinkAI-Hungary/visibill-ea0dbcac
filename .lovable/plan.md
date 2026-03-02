

## Plan: Delete "Viktor Jámbor" company and assign user to Taxology Kft

### Data found
- **Viktor Jámbor** user_id: `5abff3e7-0b0e-47eb-9198-4db551668caf`
- **"Viktor Jámbor" company** id: `5f23fcee-ad0b-4841-ad74-a46dd571f65d` (to delete)
- **Taxology Kft** company_id: `377d28cb-edc9-48a7-b261-bcd9c91d81a1` (target)

### Steps

**1. Delete company_members for the "Viktor Jámbor" company**
```sql
DELETE FROM company_members WHERE company_id = '5f23fcee-ad0b-4841-ad74-a46dd571f65d';
```

**2. Delete all related data for that company** (categories, projects, invoices, nav_invoices, partners, salary, tax, etc. that reference this company_id)
```sql
DELETE FROM categories WHERE company_id = '5f23fcee-ad0b-4841-ad74-a46dd571f65d';
DELETE FROM projects WHERE company_id = '5f23fcee-ad0b-4841-ad74-a46dd571f65d';
DELETE FROM nav_invoices WHERE company_id = '5f23fcee-ad0b-4841-ad74-a46dd571f65d';
DELETE FROM invoices WHERE company_id = '5f23fcee-ad0b-4841-ad74-a46dd571f65d';
DELETE FROM partners WHERE company_id = '5f23fcee-ad0b-4841-ad74-a46dd571f65d';
DELETE FROM salary WHERE company_id = '5f23fcee-ad0b-4841-ad74-a46dd571f65d';
DELETE FROM tax WHERE company_id = '5f23fcee-ad0b-4841-ad74-a46dd571f65d';
DELETE FROM email_aliases WHERE company_id = '5f23fcee-ad0b-4841-ad74-a46dd571f65d';
DELETE FROM salary_files WHERE company_id = '5f23fcee-ad0b-4841-ad74-a46dd571f65d';
-- etc.
```

**3. Delete the company itself**
```sql
DELETE FROM companies WHERE id = '5f23fcee-ad0b-4841-ad74-a46dd571f65d';
```

**4. Add Viktor Jámbor as admin (member) to Taxology Kft**
```sql
INSERT INTO company_members (user_id, company_id)
VALUES ('5abff3e7-0b0e-47eb-9198-4db551668caf', '377d28cb-edc9-48a7-b261-bcd9c91d81a1')
ON CONFLICT (user_id, company_id) DO NOTHING;
```

Since the role system uses `companies.owner_id` to identify owners (and everyone else is implicitly an admin), no extra role column is needed -- simply being in `company_members` without being the `owner_id` makes Viktor an Admin of Taxology Kft.

