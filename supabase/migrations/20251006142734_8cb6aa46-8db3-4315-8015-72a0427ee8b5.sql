-- First, drop the existing tier check constraint
ALTER TABLE public.user_subscriptions 
DROP CONSTRAINT IF EXISTS user_subscriptions_tier_check;

-- Add the new constraint that includes 'teszt'
ALTER TABLE public.user_subscriptions 
ADD CONSTRAINT user_subscriptions_tier_check 
CHECK (tier IN ('salmon', 'tuna', 'shark', 'orca', 'teszt'));

-- Now upgrade all existing users to Teszt unlimited tier
UPDATE public.user_subscriptions 
SET 
  tier = 'teszt',
  invoice_limit = 999999,
  updated_at = now()
WHERE tier != 'teszt';