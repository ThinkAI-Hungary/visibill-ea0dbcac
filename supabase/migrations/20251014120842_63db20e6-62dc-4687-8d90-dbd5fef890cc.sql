-- Create email_aliases table for Mailgun integration
CREATE TABLE public.email_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Alias information
  alias_email TEXT UNIQUE NOT NULL,
  company_name TEXT NOT NULL,
  
  -- Status and metadata
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  mailgun_route_id TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  
  -- Constraints
  UNIQUE(user_id, company_name)
);

-- Enable RLS
ALTER TABLE public.email_aliases ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own email aliases"
  ON public.email_aliases FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own email aliases"
  ON public.email_aliases FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own email aliases"
  ON public.email_aliases FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own email aliases"
  ON public.email_aliases FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_email_aliases_updated_at
  BEFORE UPDATE ON public.email_aliases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();