-- Migration: 20260925120000_company_accounting_policies.sql
-- Description: Tables, storage bucket, RLS and RPCs for company accounting policies and extracted accounting rules

-- 1. Create or update accounting_policies storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'accounting_policies',
  'accounting_policies',
  false,
  52428800, -- 50MB
  ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];

-- Storage bucket RLS policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'company_members_select_accounting_policies'
  ) THEN
    CREATE POLICY "company_members_select_accounting_policies"
    ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = 'accounting_policies' AND (
        (storage.foldername(name))[1]::uuid IN (
          SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
          UNION
          SELECT c.id FROM public.companies c WHERE c.owner_id = (SELECT auth.uid())
          UNION
          SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
        )
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'company_members_insert_accounting_policies'
  ) THEN
    CREATE POLICY "company_members_insert_accounting_policies"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'accounting_policies' AND (
        (storage.foldername(name))[1]::uuid IN (
          SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
          UNION
          SELECT c.id FROM public.companies c WHERE c.owner_id = (SELECT auth.uid())
          UNION
          SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
        )
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'company_members_delete_accounting_policies'
  ) THEN
    CREATE POLICY "company_members_delete_accounting_policies"
    ON storage.objects FOR DELETE TO authenticated
    USING (
      bucket_id = 'accounting_policies' AND (
        (storage.foldername(name))[1]::uuid IN (
          SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
          UNION
          SELECT c.id FROM public.companies c WHERE c.owner_id = (SELECT auth.uid())
          UNION
          SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
        )
      )
    );
  END IF;
END $$;

-- 2. Create company_accounting_policies table
CREATE TABLE IF NOT EXISTS public.company_accounting_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  file_type text NOT NULL,
  status text NOT NULL DEFAULT 'uploaded', -- 'uploaded', 'processing', 'processed', 'error', 'archived'
  extracted_summary text,
  error_message text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  effective_from date,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for company_accounting_policies
CREATE INDEX IF NOT EXISTS idx_company_accounting_policies_company_id ON public.company_accounting_policies(company_id);
CREATE INDEX IF NOT EXISTS idx_company_accounting_policies_status ON public.company_accounting_policies(status);
CREATE INDEX IF NOT EXISTS idx_company_accounting_policies_is_active ON public.company_accounting_policies(is_active);

-- Enable RLS for company_accounting_policies
ALTER TABLE public.company_accounting_policies ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'company_accounting_policies' AND policyname = 'company_accounting_policies_select'
  ) THEN
    CREATE POLICY "company_accounting_policies_select"
    ON public.company_accounting_policies FOR SELECT TO authenticated
    USING (
      company_id IN (
        SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
        UNION
        SELECT c.id FROM public.companies c WHERE c.owner_id = (SELECT auth.uid())
        UNION
        SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'company_accounting_policies' AND policyname = 'company_accounting_policies_insert'
  ) THEN
    CREATE POLICY "company_accounting_policies_insert"
    ON public.company_accounting_policies FOR INSERT TO authenticated
    WITH CHECK (
      company_id IN (
        SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
        UNION
        SELECT c.id FROM public.companies c WHERE c.owner_id = (SELECT auth.uid())
        UNION
        SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'company_accounting_policies' AND policyname = 'company_accounting_policies_update'
  ) THEN
    CREATE POLICY "company_accounting_policies_update"
    ON public.company_accounting_policies FOR UPDATE TO authenticated
    USING (
      company_id IN (
        SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
        UNION
        SELECT c.id FROM public.companies c WHERE c.owner_id = (SELECT auth.uid())
        UNION
        SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
      )
    )
    WITH CHECK (
      company_id IN (
        SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
        UNION
        SELECT c.id FROM public.companies c WHERE c.owner_id = (SELECT auth.uid())
        UNION
        SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'company_accounting_policies' AND policyname = 'company_accounting_policies_delete'
  ) THEN
    CREATE POLICY "company_accounting_policies_delete"
    ON public.company_accounting_policies FOR DELETE TO authenticated
    USING (
      company_id IN (
        SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
        UNION
        SELECT c.id FROM public.companies c WHERE c.owner_id = (SELECT auth.uid())
        UNION
        SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
      )
    );
  END IF;
END $$;

-- 3. Create company_accounting_rules table
CREATE TABLE IF NOT EXISTS public.company_accounting_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  policy_id uuid REFERENCES public.company_accounting_policies(id) ON DELETE CASCADE,
  rule_category text NOT NULL, -- 'fixed_assets', 'petty_cash', 'currency', 'inventory_gl'
  rule_key text NOT NULL,
  rule_name text NOT NULL,
  rule_value jsonb NOT NULL,
  description text,
  source_quote text,
  status text NOT NULL DEFAULT 'draft', -- 'draft', 'active', 'inactive', 'archived'
  user_overridden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for company_accounting_rules
CREATE INDEX IF NOT EXISTS idx_company_accounting_rules_company_key ON public.company_accounting_rules(company_id, rule_key);
CREATE INDEX IF NOT EXISTS idx_company_accounting_rules_policy ON public.company_accounting_rules(policy_id);
CREATE INDEX IF NOT EXISTS idx_company_accounting_rules_status ON public.company_accounting_rules(status);
CREATE INDEX IF NOT EXISTS idx_company_accounting_rules_category ON public.company_accounting_rules(company_id, rule_category);

-- Enable RLS for company_accounting_rules
ALTER TABLE public.company_accounting_rules ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'company_accounting_rules' AND policyname = 'company_accounting_rules_select'
  ) THEN
    CREATE POLICY "company_accounting_rules_select"
    ON public.company_accounting_rules FOR SELECT TO authenticated
    USING (
      company_id IN (
        SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
        UNION
        SELECT c.id FROM public.companies c WHERE c.owner_id = (SELECT auth.uid())
        UNION
        SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'company_accounting_rules' AND policyname = 'company_accounting_rules_insert'
  ) THEN
    CREATE POLICY "company_accounting_rules_insert"
    ON public.company_accounting_rules FOR INSERT TO authenticated
    WITH CHECK (
      company_id IN (
        SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
        UNION
        SELECT c.id FROM public.companies c WHERE c.owner_id = (SELECT auth.uid())
        UNION
        SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'company_accounting_rules' AND policyname = 'company_accounting_rules_update'
  ) THEN
    CREATE POLICY "company_accounting_rules_update"
    ON public.company_accounting_rules FOR UPDATE TO authenticated
    USING (
      company_id IN (
        SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
        UNION
        SELECT c.id FROM public.companies c WHERE c.owner_id = (SELECT auth.uid())
        UNION
        SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
      )
    )
    WITH CHECK (
      company_id IN (
        SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
        UNION
        SELECT c.id FROM public.companies c WHERE c.owner_id = (SELECT auth.uid())
        UNION
        SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'company_accounting_rules' AND policyname = 'company_accounting_rules_delete'
  ) THEN
    CREATE POLICY "company_accounting_rules_delete"
    ON public.company_accounting_rules FOR DELETE TO authenticated
    USING (
      company_id IN (
        SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = (SELECT auth.uid())
        UNION
        SELECT c.id FROM public.companies c WHERE c.owner_id = (SELECT auth.uid())
        UNION
        SELECT aa.company_id FROM public.accounty_assignments aa WHERE aa.accountant_user_id = (SELECT auth.uid())
      )
    );
  END IF;
END $$;

-- 4. Helper RPC: get_company_accounting_rule
CREATE OR REPLACE FUNCTION public.get_company_accounting_rule(
  p_company_id uuid,
  p_rule_key text
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rule_value
  FROM public.company_accounting_rules
  WHERE company_id = p_company_id
    AND rule_key = p_rule_key
    AND status = 'active'
  ORDER BY updated_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_company_accounting_rule(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_company_accounting_rule(uuid, text) TO authenticated, service_role;

-- 5. Helper RPC: activate_company_accounting_policy
CREATE OR REPLACE FUNCTION public.activate_company_accounting_policy(
  p_policy_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  -- Verify caller has access to the policy's company
  SELECT company_id INTO v_company_id
  FROM public.company_accounting_policies
  WHERE id = p_policy_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Policy not found';
  END IF;

  IF NOT (
    EXISTS (SELECT 1 FROM public.company_members WHERE company_id = v_company_id AND user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.companies WHERE id = v_company_id AND owner_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.accounty_assignments WHERE company_id = v_company_id AND accountant_user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Archive currently active policy and its rules for this company
  UPDATE public.company_accounting_policies
  SET is_active = false, status = 'archived', updated_at = now()
  WHERE company_id = v_company_id AND id <> p_policy_id AND is_active = true;

  UPDATE public.company_accounting_rules
  SET status = 'archived', updated_at = now()
  WHERE company_id = v_company_id AND policy_id <> p_policy_id AND status = 'active';

  -- Activate new policy and its rules
  UPDATE public.company_accounting_policies
  SET is_active = true, status = 'processed', updated_at = now()
  WHERE id = p_policy_id;

  UPDATE public.company_accounting_rules
  SET status = 'active', updated_at = now()
  WHERE policy_id = p_policy_id AND status = 'draft';
END;
$$;

REVOKE ALL ON FUNCTION public.activate_company_accounting_policy(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.activate_company_accounting_policy(uuid) TO authenticated, service_role;
