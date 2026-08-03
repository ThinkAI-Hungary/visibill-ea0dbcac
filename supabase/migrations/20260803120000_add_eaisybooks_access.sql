-- Add eaisybooks_access flag to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS eaisybooks_access BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.eaisybooks_access IS
  'Whether this user has global access to the eaisybooks (Accounty) module. Managed by superadmin.';
