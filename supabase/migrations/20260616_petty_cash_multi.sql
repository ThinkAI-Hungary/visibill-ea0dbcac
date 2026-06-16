-- ============================================================
-- Multi-Register Petty Cash System
-- ============================================================
-- Replaces the single hp_settings table with a full multi-register,
-- multi-currency petty cash system including routing rules.
-- ============================================================

-- ─── 1. petty_cash_registers ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.petty_cash_registers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name        text NOT NULL,
  location    text,
  currencies  text[] NOT NULL DEFAULT '{HUF}',
  is_default  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES auth.users(id)
);

-- Only one default register per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_pcr_one_default
  ON public.petty_cash_registers(company_id) WHERE is_default = true;

CREATE INDEX IF NOT EXISTS idx_pcr_company
  ON public.petty_cash_registers(company_id);

-- RLS
ALTER TABLE public.petty_cash_registers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view petty_cash_registers"
  ON public.petty_cash_registers FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  ));

CREATE POLICY "Members can insert petty_cash_registers"
  ON public.petty_cash_registers FOR INSERT TO authenticated
  WITH CHECK (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  ));

CREATE POLICY "Members can update petty_cash_registers"
  ON public.petty_cash_registers FOR UPDATE TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  ));

CREATE POLICY "Members can delete petty_cash_registers"
  ON public.petty_cash_registers FOR DELETE TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  ));


-- ─── 2. petty_cash_opening_balances ────────────────────────
CREATE TABLE IF NOT EXISTS public.petty_cash_opening_balances (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  register_id  uuid NOT NULL REFERENCES public.petty_cash_registers(id) ON DELETE CASCADE,
  currency     text NOT NULL DEFAULT 'HUF',
  amount       numeric NOT NULL DEFAULT 0,
  start_date   date,
  UNIQUE(register_id, currency)
);

ALTER TABLE public.petty_cash_opening_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view petty_cash_opening_balances"
  ON public.petty_cash_opening_balances FOR SELECT TO authenticated
  USING (register_id IN (
    SELECT r.id FROM public.petty_cash_registers r
    JOIN public.company_members cm ON cm.company_id = r.company_id
    WHERE cm.user_id = auth.uid()
  ));

CREATE POLICY "Members can insert petty_cash_opening_balances"
  ON public.petty_cash_opening_balances FOR INSERT TO authenticated
  WITH CHECK (register_id IN (
    SELECT r.id FROM public.petty_cash_registers r
    JOIN public.company_members cm ON cm.company_id = r.company_id
    WHERE cm.user_id = auth.uid()
  ));

CREATE POLICY "Members can update petty_cash_opening_balances"
  ON public.petty_cash_opening_balances FOR UPDATE TO authenticated
  USING (register_id IN (
    SELECT r.id FROM public.petty_cash_registers r
    JOIN public.company_members cm ON cm.company_id = r.company_id
    WHERE cm.user_id = auth.uid()
  ));

CREATE POLICY "Members can delete petty_cash_opening_balances"
  ON public.petty_cash_opening_balances FOR DELETE TO authenticated
  USING (register_id IN (
    SELECT r.id FROM public.petty_cash_registers r
    JOIN public.company_members cm ON cm.company_id = r.company_id
    WHERE cm.user_id = auth.uid()
  ));


-- ─── 3. petty_cash_entries ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.petty_cash_entries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  register_id   uuid NOT NULL REFERENCES public.petty_cash_registers(id) ON DELETE CASCADE,
  entry_date    date NOT NULL,
  description   text,
  amount        numeric NOT NULL,      -- positive = income, negative = expense
  currency      text NOT NULL DEFAULT 'HUF',
  source_type   text NOT NULL,         -- 'withdrawal','cash_deposit','cash_sale','cash_expense','manual','transfer'
  source_id     uuid,                  -- FK to source row (nullable for manual entries)
  source_table  text,                  -- 'transactions','nav_invoices','invoices'
  routed_by     text NOT NULL DEFAULT 'default', -- 'default','rule','manual','ml'
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_pce_register_date
  ON public.petty_cash_entries(register_id, entry_date);

CREATE INDEX IF NOT EXISTS idx_pce_company_date
  ON public.petty_cash_entries(company_id, entry_date);

CREATE INDEX IF NOT EXISTS idx_pce_source
  ON public.petty_cash_entries(source_table, source_id);

ALTER TABLE public.petty_cash_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view petty_cash_entries"
  ON public.petty_cash_entries FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  ));

CREATE POLICY "Members can insert petty_cash_entries"
  ON public.petty_cash_entries FOR INSERT TO authenticated
  WITH CHECK (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  ));

CREATE POLICY "Members can update petty_cash_entries"
  ON public.petty_cash_entries FOR UPDATE TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  ));

CREATE POLICY "Members can delete petty_cash_entries"
  ON public.petty_cash_entries FOR DELETE TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  ));


-- ─── 4. petty_cash_routing_rules ───────────────────────────
CREATE TABLE IF NOT EXISTS public.petty_cash_routing_rules (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  target_register_id  uuid NOT NULL REFERENCES public.petty_cash_registers(id) ON DELETE CASCADE,
  priority            integer NOT NULL DEFAULT 0,
  match_currency      text,             -- e.g. 'EUR'
  match_source_type   text,             -- e.g. 'cash_sale'
  match_description_pattern text,       -- ILIKE pattern
  match_partner_pattern text,           -- ILIKE pattern
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pcrr_company
  ON public.petty_cash_routing_rules(company_id);

ALTER TABLE public.petty_cash_routing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view petty_cash_routing_rules"
  ON public.petty_cash_routing_rules FOR SELECT TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  ));

CREATE POLICY "Members can insert petty_cash_routing_rules"
  ON public.petty_cash_routing_rules FOR INSERT TO authenticated
  WITH CHECK (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  ));

CREATE POLICY "Members can update petty_cash_routing_rules"
  ON public.petty_cash_routing_rules FOR UPDATE TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  ));

CREATE POLICY "Members can delete petty_cash_routing_rules"
  ON public.petty_cash_routing_rules FOR DELETE TO authenticated
  USING (company_id IN (
    SELECT cm.company_id FROM public.company_members cm WHERE cm.user_id = auth.uid()
  ));


-- ─── 5. Migrate hp_settings → petty_cash_registers ────────
INSERT INTO public.petty_cash_registers (company_id, name, is_default, currencies, created_by)
SELECT hp.company_id, 'Központi pénztár', true, '{HUF}', hp.created_by
FROM public.hp_settings hp
ON CONFLICT DO NOTHING;

INSERT INTO public.petty_cash_opening_balances (register_id, currency, amount, start_date)
SELECT pcr.id, 'HUF', COALESCE(hp.opening_balance, 0), hp.start_date
FROM public.hp_settings hp
JOIN public.petty_cash_registers pcr ON pcr.company_id = hp.company_id AND pcr.is_default = true
ON CONFLICT (register_id, currency) DO NOTHING;


-- ─── 6. get_petty_cash_summary RPC ────────────────────────
CREATE OR REPLACE FUNCTION public.get_petty_cash_summary(p_company_id uuid)
RETURNS TABLE (
  register_id uuid,
  register_name text,
  is_default boolean,
  currency text,
  opening_balance numeric,
  start_date date,
  total_income numeric,
  total_expense numeric,
  current_balance numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH registers AS (
    SELECT r.id, r.name, r.is_default
    FROM petty_cash_registers r
    WHERE r.company_id = p_company_id
  ),
  -- Get all currencies in use per register (from opening balances + entries)
  register_currencies AS (
    SELECT r.id AS reg_id, r.name AS reg_name, r.is_default AS reg_default, ob.currency AS cur,
           COALESCE(ob.amount, 0) AS ob_amount, ob.start_date AS ob_start_date
    FROM registers r
    LEFT JOIN petty_cash_opening_balances ob ON ob.register_id = r.id
    
    UNION
    
    SELECT r.id, r.name, r.is_default, e.currency, 0, NULL
    FROM registers r
    JOIN petty_cash_entries e ON e.register_id = r.id
    WHERE e.company_id = p_company_id
  ),
  -- Deduplicated register+currency combos
  combos AS (
    SELECT DISTINCT ON (reg_id, cur)
      reg_id, reg_name, reg_default, cur,
      FIRST_VALUE(ob_amount) OVER (PARTITION BY reg_id, cur ORDER BY ob_amount DESC) AS ob_amount,
      FIRST_VALUE(ob_start_date) OVER (PARTITION BY reg_id, cur ORDER BY ob_start_date NULLS LAST) AS ob_start_date
    FROM register_currencies
    WHERE cur IS NOT NULL
  ),
  -- Aggregate entries per register+currency
  entry_sums AS (
    SELECT
      e.register_id AS reg_id,
      e.currency AS cur,
      COALESCE(SUM(CASE WHEN e.amount > 0 THEN e.amount ELSE 0 END), 0) AS income,
      COALESCE(SUM(CASE WHEN e.amount < 0 THEN e.amount ELSE 0 END), 0) AS expense
    FROM petty_cash_entries e
    WHERE e.company_id = p_company_id
    GROUP BY e.register_id, e.currency
  )
  SELECT
    c.reg_id,
    c.reg_name::text,
    c.reg_default,
    c.cur::text,
    c.ob_amount,
    c.ob_start_date,
    COALESCE(es.income, 0),
    COALESCE(es.expense, 0),
    CASE
      WHEN c.cur = 'HUF' THEN ROUND((c.ob_amount + COALESCE(es.income, 0) + COALESCE(es.expense, 0)) / 5.0) * 5
      ELSE c.ob_amount + COALESCE(es.income, 0) + COALESCE(es.expense, 0)
    END
  FROM combos c
  LEFT JOIN entry_sums es ON es.reg_id = c.reg_id AND es.cur = c.cur
  ORDER BY c.reg_default DESC, c.reg_name, c.cur;
END;
$$;

-- Grant access
REVOKE EXECUTE ON FUNCTION public.get_petty_cash_summary(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_petty_cash_summary(uuid) TO authenticated;
