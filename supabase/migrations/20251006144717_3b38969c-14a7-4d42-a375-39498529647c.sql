-- Change default tier to 'teszt' in user_subscriptions table
ALTER TABLE public.user_subscriptions 
ALTER COLUMN tier SET DEFAULT 'teszt';

ALTER TABLE public.user_subscriptions 
ALTER COLUMN invoice_limit SET DEFAULT 999999;

-- Update the initialize_user_subscription function to use teszt as default
CREATE OR REPLACE FUNCTION public.initialize_user_subscription()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_subscriptions (user_id, tier, invoice_limit, invoices_used)
  VALUES (NEW.user_id, 'teszt', 999999, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;