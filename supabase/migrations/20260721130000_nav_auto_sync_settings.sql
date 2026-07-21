-- Add auto_sync_enabled and sync_frequency columns to user_nav_credentials table
ALTER TABLE public.user_nav_credentials
ADD COLUMN IF NOT EXISTS auto_sync_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS sync_frequency TEXT DEFAULT 'daily';

-- Add check constraint for sync_frequency values ('daily', 'weekly')
ALTER TABLE public.user_nav_credentials
DROP CONSTRAINT IF EXISTS check_sync_frequency,
ADD CONSTRAINT check_sync_frequency CHECK (sync_frequency IN ('daily', 'weekly'));
