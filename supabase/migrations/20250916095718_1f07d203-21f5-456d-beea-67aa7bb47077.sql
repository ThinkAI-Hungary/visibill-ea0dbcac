-- Create user_subscriptions table to track subscription limits and usage
CREATE TABLE public.user_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'salmon' CHECK (tier IN ('salmon', 'tuna', 'shark', 'orca')),
  invoice_limit INTEGER NOT NULL DEFAULT 3,
  invoices_used INTEGER NOT NULL DEFAULT 0,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  period_end TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '1 month'),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_product_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policies for user_subscriptions
CREATE POLICY "Users can view their own subscription" 
ON public.user_subscriptions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscription" 
ON public.user_subscriptions 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscription" 
ON public.user_subscriptions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create function to update updated_at column
CREATE OR REPLACE FUNCTION public.update_user_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_subscriptions_updated_at
BEFORE UPDATE ON public.user_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_user_subscriptions_updated_at();

-- Create function to initialize user subscription on profile creation
CREATE OR REPLACE FUNCTION public.initialize_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_subscriptions (user_id, tier, invoice_limit, invoices_used)
  VALUES (NEW.user_id, 'salmon', 3, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to initialize subscription when profile is created
CREATE TRIGGER on_profile_created_initialize_subscription
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.initialize_user_subscription();

-- Create function to increment invoice usage
CREATE OR REPLACE FUNCTION public.increment_invoice_usage(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_usage INTEGER;
  current_limit INTEGER;
BEGIN
  -- Get current usage and limit
  SELECT invoices_used, invoice_limit 
  INTO current_usage, current_limit
  FROM public.user_subscriptions 
  WHERE user_id = user_uuid;
  
  -- Check if user has remaining invoices
  IF current_usage >= current_limit THEN
    RETURN FALSE; -- No more invoices available
  END IF;
  
  -- Increment usage
  UPDATE public.user_subscriptions 
  SET invoices_used = invoices_used + 1,
      updated_at = now()
  WHERE user_id = user_uuid;
  
  RETURN TRUE; -- Successfully incremented
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create function to reset monthly usage (for cron job or manual reset)
CREATE OR REPLACE FUNCTION public.reset_monthly_usage()
RETURNS INTEGER AS $$
DECLARE
  reset_count INTEGER;
BEGIN
  -- Reset usage for subscriptions where period has ended
  UPDATE public.user_subscriptions 
  SET 
    invoices_used = 0,
    period_start = now(),
    period_end = CASE 
      WHEN tier = 'salmon' THEN now() + INTERVAL '1 month'
      ELSE period_end + INTERVAL '1 month'
    END,
    updated_at = now()
  WHERE period_end <= now();
  
  GET DIAGNOSTICS reset_count = ROW_COUNT;
  RETURN reset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;