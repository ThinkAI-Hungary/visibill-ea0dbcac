-- ============================================================================
-- MANUAL RUN: Create test user with "Pénzügyi asszisztens" (assistant) role
-- ============================================================================
-- Run this in the Supabase SQL Editor (with service_role access).
-- This creates:
--   1. auth.users entry
--   2. profiles entry
--   3. company_members entry with role = 'assistant'
--   4. user_subscriptions entry
--   5. user_company_access_cache entry
-- ============================================================================

-- ── Configuration ──
-- Change these values as needed:
DO $$
DECLARE
  v_email       TEXT := 'test.assistant@eaisybill.hu';
  v_password    TEXT := 'TestAssistant1!';
  v_name        TEXT := 'Teszt Asszisztens';
  v_user_id     UUID;
  v_company_id  UUID;
BEGIN
  -- Find the first company (or specify a specific one)
  SELECT id INTO v_company_id
  FROM public.companies
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'No company found in the database!';
  END IF;

  RAISE NOTICE 'Using company: %', v_company_id;

  -- ── 1. Create auth.users entry ──
  -- Check if user already exists
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_email;

  IF v_user_id IS NOT NULL THEN
    RAISE NOTICE 'User already exists with id: %. Skipping auth creation.', v_user_id;
  ELSE
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      v_email,
      crypt(v_password, gen_salt('bf')),
      NOW(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      jsonb_build_object('name', v_name),
      NOW(),
      NOW(),
      '',
      ''
    )
    RETURNING id INTO v_user_id;

    -- Also insert into auth.identities (required by Supabase Auth)
    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      v_user_id::text,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
      'email',
      NOW(),
      NOW(),
      NOW()
    );

    RAISE NOTICE 'Created auth user: % (%)', v_email, v_user_id;
  END IF;

  -- ── 2. Create profiles entry ──
  INSERT INTO public.profiles (user_id, name)
  VALUES (v_user_id, v_name)
  ON CONFLICT (user_id) DO UPDATE SET name = EXCLUDED.name;

  -- ── 3. Create company_members entry with assistant role ──
  INSERT INTO public.company_members (user_id, company_id, role)
  VALUES (v_user_id, v_company_id, 'assistant')
  ON CONFLICT (user_id, company_id) DO UPDATE SET role = 'assistant';

  -- ── 4. Create user_subscriptions entry ──
  INSERT INTO public.user_subscriptions (user_id, tier, invoice_limit, invoices_used)
  VALUES (v_user_id, 'teszt', 999999, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- ── 5. Create access cache entry ──
  INSERT INTO public.user_company_access_cache (
    user_id, company_id, access_source, role,
    can_read_invoices, can_read_transactions, can_read_salaries, can_read_hr
  ) VALUES (
    v_user_id, v_company_id, 'eaisybill', 'assistant',
    true,   -- can_read_invoices: assistant can read invoices
    true,   -- can_read_transactions: assistant can read transactions
    false,  -- can_read_salaries: assistant cannot see salaries
    false   -- can_read_hr: assistant cannot see HR
  )
  ON CONFLICT (user_id, company_id, access_source) DO UPDATE SET
    role = 'assistant',
    can_read_invoices = true,
    can_read_transactions = true,
    can_read_salaries = false,
    can_read_hr = false;

  -- ── Done ──
  RAISE NOTICE '✅ Test assistant user created successfully!';
  RAISE NOTICE '   Email:    %', v_email;
  RAISE NOTICE '   Password: %', v_password;
  RAISE NOTICE '   Role:     assistant (Pénzügyi asszisztens)';
  RAISE NOTICE '   Company:  %', v_company_id;
END $$;

-- Verify the created user
SELECT
  au.email,
  p.name,
  cm.role,
  cm.company_id,
  c.name AS company_name
FROM auth.users au
JOIN public.profiles p ON p.user_id = au.id
JOIN public.company_members cm ON cm.user_id = au.id
LEFT JOIN public.companies c ON c.id = cm.company_id
WHERE au.email = 'test.assistant@eaisybill.hu';
