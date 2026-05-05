-- 1. P&L Structure Table
CREATE TABLE IF NOT EXISTS public.pnl_structure (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  row_code varchar NOT NULL,
  name text NOT NULL,
  type varchar NOT NULL CHECK (type IN ('roman', 'capital', 'arabic', 'total', 'grand_total')),
  parent_id uuid REFERENCES public.pnl_structure(id),
  order_num integer NOT NULL,
  multiplier integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- 2. P&L Mapping Table
CREATE TABLE IF NOT EXISTS public.pnl_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  preset_id uuid NOT NULL REFERENCES public.chart_of_accounts_presets(id),
  gl_account_id uuid NOT NULL REFERENCES public.gl_accounts(id),
  pnl_structure_id uuid NOT NULL REFERENCES public.pnl_structure(id),
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, preset_id, gl_account_id)
);

-- 3. RLS
ALTER TABLE public.pnl_structure ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pnl_structure_read_all" ON public.pnl_structure FOR SELECT USING (true);

ALTER TABLE public.pnl_mapping ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pnl_mapping_read_company" ON public.pnl_mapping FOR SELECT USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));
CREATE POLICY "pnl_mapping_insert_company" ON public.pnl_mapping FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));
CREATE POLICY "pnl_mapping_update_company" ON public.pnl_mapping FOR UPDATE USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));
CREATE POLICY "pnl_mapping_delete_company" ON public.pnl_mapping FOR DELETE USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

-- 4. RPC to save mappings efficiently
CREATE OR REPLACE FUNCTION public.save_pnl_mappings(
  p_company_id uuid,
  p_preset_id uuid,
  p_mappings jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  mapping record;
BEGIN
  DELETE FROM public.pnl_mapping 
  WHERE company_id = p_company_id AND preset_id = p_preset_id;
  
  FOR mapping IN SELECT * FROM jsonb_to_recordset(p_mappings) AS x(gl_account_id uuid, pnl_structure_id uuid)
  LOOP
    IF mapping.pnl_structure_id IS NOT NULL THEN
      INSERT INTO public.pnl_mapping (company_id, preset_id, gl_account_id, pnl_structure_id, user_id)
      VALUES (p_company_id, p_preset_id, mapping.gl_account_id, mapping.pnl_structure_id, auth.uid());
    END IF;
  END LOOP;
END;
$$;

-- 5. Seed P&L Structure for Sztv "A" változat
INSERT INTO public.pnl_structure (id, row_code, name, type, order_num, multiplier, parent_id) VALUES 
('00000000-0000-0000-0000-000000000100', 'I.', 'Értékesítés nettó árbevétele', 'roman', 10, 1, NULL),
('00000000-0000-0000-0000-000000000200', 'II.', 'Aktivált saját teljesítmények értéke', 'roman', 20, 1, NULL),
('00000000-0000-0000-0000-000000000300', 'III.', 'Egyéb bevételek', 'roman', 30, 1, NULL),
('00000000-0000-0000-0000-000000000400', 'IV.', 'Anyagjellegű ráfordítások', 'roman', 40, -1, NULL),
('00000000-0000-0000-0000-000000000500', 'V.', 'Személyi jellegű ráfordítások', 'roman', 50, -1, NULL),
('00000000-0000-0000-0000-000000000600', 'VI.', 'Értékcsökkenési leírás', 'roman', 60, -1, NULL),
('00000000-0000-0000-0000-000000000700', 'VII.', 'Egyéb ráfordítások', 'roman', 70, -1, NULL),
('00000000-0000-0000-0000-000000000800', 'A.', 'ÜZEMI (ÜZLETI) TEVÉKENYSÉG EREDMÉNYE', 'capital', 80, 1, NULL),
('00000000-0000-0000-0000-000000000900', 'VIII.', 'Pénzügyi műveletek bevételei', 'roman', 90, 1, NULL),
('00000000-0000-0000-0000-000000001000', 'IX.', 'Pénzügyi műveletek ráfordításai', 'roman', 100, -1, NULL),
('00000000-0000-0000-0000-000000001100', 'B.', 'PÉNZÜGYI MŰVELETEK EREDMÉNYE', 'capital', 110, 1, NULL),
('00000000-0000-0000-0000-000000001200', 'C.', 'ADÓZÁS ELŐTTI EREDMÉNY', 'capital', 120, 1, NULL),
('00000000-0000-0000-0000-000000001300', 'X.', 'Adófizetési kötelezettség', 'roman', 130, -1, NULL),
('00000000-0000-0000-0000-000000001400', 'D.', 'ADÓZOTT EREDMÉNY', 'capital', 140, 1, NULL)
ON CONFLICT (id) DO NOTHING;

-- 6. RPC to get PnL Report Data
CREATE OR REPLACE FUNCTION public.get_pnl_report(
  p_company_id uuid,
  p_preset_id uuid,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL
)
RETURNS TABLE (
  pnl_structure_id uuid,
  row_code text,
  name text,
  type text,
  order_num integer,
  multiplier integer,
  balance numeric,
  gl_accounts jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH gl_data AS (
    -- Get base balances using the existing get_gl_balances function
    SELECT * FROM public.get_gl_balances(p_company_id, p_preset_id, p_date_from, p_date_to)
  ),
  mapped_data AS (
    SELECT 
      g.gl_account_id,
      g.gl_number,
      g.short_name,
      g.total_balance,
      m.pnl_structure_id
    FROM gl_data g
    JOIN public.pnl_mapping m ON g.gl_account_id = m.gl_account_id
    WHERE m.company_id = p_company_id AND m.preset_id = p_preset_id
  ),
  aggregated_pnl AS (
    SELECT
      s.id AS pnl_structure_id,
      s.row_code::text,
      s.name::text,
      s.type::text,
      s.order_num,
      s.multiplier,
      COALESCE(SUM(md.total_balance), 0)::numeric AS balance,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'gl_account_id', md.gl_account_id,
            'gl_number', md.gl_number,
            'short_name', md.short_name,
            'balance', md.total_balance
          )
        ) FILTER (WHERE md.gl_account_id IS NOT NULL),
        '[]'::jsonb
      ) AS gl_accounts
    FROM public.pnl_structure s
    LEFT JOIN mapped_data md ON s.id = md.pnl_structure_id
    GROUP BY s.id, s.row_code, s.name, s.type, s.order_num, s.multiplier
  )
  SELECT * FROM aggregated_pnl
  ORDER BY order_num;
END;
$$;
