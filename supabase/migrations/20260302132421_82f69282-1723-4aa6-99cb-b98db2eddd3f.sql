
-- Step 1: Delete nav_invoice_items (FK to nav_invoices)
DELETE FROM nav_invoice_items WHERE nav_invoice_id IN (SELECT id FROM nav_invoices WHERE company_id = '5f23fcee-ad0b-4841-ad74-a46dd571f65d');

-- Step 2: Delete nav_invoices
DELETE FROM nav_invoices WHERE company_id = '5f23fcee-ad0b-4841-ad74-a46dd571f65d';

-- Step 3: Delete transactions (FK to transaction_uploads)
DELETE FROM transactions WHERE company_id = '5f23fcee-ad0b-4841-ad74-a46dd571f65d';

-- Step 4: Delete other company-scoped data
DELETE FROM transaction_uploads WHERE company_id = '5f23fcee-ad0b-4841-ad74-a46dd571f65d';
DELETE FROM invoice_uploads WHERE company_id = '5f23fcee-ad0b-4841-ad74-a46dd571f65d';
DELETE FROM nav_sync_logs WHERE company_id = '5f23fcee-ad0b-4841-ad74-a46dd571f65d';
DELETE FROM partners WHERE company_id = '5f23fcee-ad0b-4841-ad74-a46dd571f65d';
DELETE FROM email_aliases WHERE company_id = '5f23fcee-ad0b-4841-ad74-a46dd571f65d';
DELETE FROM user_nav_credentials WHERE company_id = '5f23fcee-ad0b-4841-ad74-a46dd571f65d';

-- Step 5: Delete company_members
DELETE FROM company_members WHERE company_id = '5f23fcee-ad0b-4841-ad74-a46dd571f65d';

-- Step 6: Delete the company itself
DELETE FROM companies WHERE id = '5f23fcee-ad0b-4841-ad74-a46dd571f65d';

-- Step 7: Add Viktor Jámbor as admin to Taxology Kft
INSERT INTO company_members (user_id, company_id)
VALUES ('5abff3e7-0b0e-47eb-9198-4db551668caf', '377d28cb-edc9-48a7-b261-bcd9c91d81a1')
ON CONFLICT (user_id, company_id) DO NOTHING;
