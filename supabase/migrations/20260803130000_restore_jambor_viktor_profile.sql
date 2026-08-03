-- Restore missing profile for viktor.jambor@taxology.hu
INSERT INTO public.profiles (user_id, name, role, eaisybill_access, eaisybooks_access)
SELECT id, 'Jámbor Viktor', 'user', true, true
FROM auth.users
WHERE email = 'viktor.jambor@taxology.hu'
ON CONFLICT (user_id) DO UPDATE 
SET name = 'Jámbor Viktor', eaisybill_access = true, eaisybooks_access = true;
