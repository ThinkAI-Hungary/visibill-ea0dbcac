-- Fix: Set is_main_accountant = true for all "könyvelő" role assignments
-- that were created via the join-company-as-accountant edge function
-- but didn't have is_main_accountant set.
-- 
-- This is needed because the useAccountyClients hook filters by is_main_accountant
-- for non-admin users (line 224-226 of useAccountyData.ts).

UPDATE accounty_assignments 
SET is_main_accountant = true 
WHERE is_main_accountant IS NOT TRUE 
  AND role = 'könyvelő';
